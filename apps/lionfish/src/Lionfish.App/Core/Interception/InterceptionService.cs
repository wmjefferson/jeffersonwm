using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using InputInterceptorNS;
using Microsoft.Win32;

namespace Lionfish.Core.Interception;

public class InterceptedKeyEventArgs : EventArgs
{
    public ushort ScanCode { get; init; }
    public bool IsKeyDown { get; init; }
    public bool IsE0 { get; init; }
    public string KeyName { get; init; } = string.Empty;
}

public class InterceptionService : IDisposable
{
    private IntPtr _context = IntPtr.Zero;
    private Thread? _captureThread;
    private volatile bool _isCapturing;

    private readonly HashSet<string> _registeredHardwareIds = new(StringComparer.OrdinalIgnoreCase);
    private string? _masterHardwareId;
    private readonly Dictionary<int, string> _deviceIdToHwId = new();
    private readonly List<DeviceInfo> _allDiscoveredDevices = new();

    private bool _lCtrlDown;
    private bool _rCtrlDown;

    public event Action<DeviceInfo, InterceptedKeyEventArgs>? KeyIntercepted;
    public event Action? KillSwitchActivated;
    public event Action<DeviceInfo>? DeviceConnected;
    public event Action<DeviceInfo>? DeviceDisconnected;

    public bool IsDriverInstalled => InputInterceptor.CheckDriverInstalled();
    public static bool IsDriverInstalledStatic => InputInterceptor.CheckDriverInstalled();
    public bool IsCapturing => _isCapturing;

    public void Initialize()
    {
        InputInterceptor.Initialize();
    }

    public static bool InstallDriver()
    {
        if (!InputInterceptor.CheckAdministratorRights())
            throw new UnauthorizedAccessException(
                "Administrator privileges are required to install the Interception driver. " +
                "Please restart Lionfish as Administrator.");

        return InputInterceptor.InstallDriver();
    }

    public static bool UninstallDriver()
    {
        if (!InputInterceptor.CheckAdministratorRights())
            throw new UnauthorizedAccessException(
                "Administrator privileges are required to uninstall the Interception driver. " +
                "Please restart Lionfish as Administrator.");

        return InputInterceptor.UninstallDriver();
    }

    public void SetRegisteredDevices(IEnumerable<string> registeredHardwareIds, string? masterHardwareId)
    {
        lock (_registeredHardwareIds)
        {
            _registeredHardwareIds.Clear();
            foreach (var id in registeredHardwareIds)
            {
                _registeredHardwareIds.Add(id);
            }
            _masterHardwareId = masterHardwareId;
        }
    }

    public void RegisterDevice(DeviceInfo device)
    {
        lock (_registeredHardwareIds)
        {
            _registeredHardwareIds.Add(device.HardwareId);
            if (string.Equals(_masterHardwareId, device.HardwareId, StringComparison.OrdinalIgnoreCase))
            {
                _masterHardwareId = null;
            }
        }
    }

    public void UnregisterDevice(string hardwareId)
    {
        lock (_registeredHardwareIds)
        {
            _registeredHardwareIds.Remove(hardwareId);
        }
    }

    public void SetMasterKeyboard(DeviceInfo device)
    {
        lock (_registeredHardwareIds)
        {
            _masterHardwareId = device.HardwareId;
            _registeredHardwareIds.Remove(device.HardwareId);
        }
    }

    private bool IsRegisteredMacroPad(string hardwareId)
    {
        // Never intercept internal laptop keyboard!
        if (hardwareId.Contains("ACPI", StringComparison.OrdinalIgnoreCase) ||
            hardwareId.Contains("HPQ", StringComparison.OrdinalIgnoreCase) ||
            hardwareId.Contains("PS2", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        lock (_registeredHardwareIds)
        {
            if (!string.IsNullOrEmpty(_masterHardwareId) &&
                hardwareId.Equals(_masterHardwareId, StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }

            return _registeredHardwareIds.Contains(hardwareId);
        }
    }

    /// <summary>
    /// Enumerates all connected keyboard/keypad devices using the Windows Raw Input API.
    /// Returns real device info including friendly names and hardware IDs.
    /// </summary>
    public List<DeviceInfo> GetAllKeyboardDevices()
    {
        var devices = new List<DeviceInfo>();

        uint deviceCount = 0;
        uint structSize = (uint)Marshal.SizeOf<RAWINPUTDEVICELIST>();
        uint result = GetRawInputDeviceList(null, ref deviceCount, structSize);

        if (result == unchecked((uint)-1) || deviceCount == 0)
            return devices;

        var rawDevices = new RAWINPUTDEVICELIST[deviceCount];
        result = GetRawInputDeviceList(rawDevices, ref deviceCount, structSize);

        if (result == unchecked((uint)-1))
            return devices;

        int handleIndex = 0;
        for (int i = 0; i < deviceCount; i++)
        {
            var rawDevice = rawDevices[i];
            if (rawDevice.dwType != RIM_TYPEKEYBOARD)
                continue;

            string? devicePath = GetDevicePath(rawDevice.hDevice);
            if (string.IsNullOrEmpty(devicePath))
                continue;

            var (friendlyName, hardwareId, category, connType, isLaptop) = ClassifyDevice(devicePath);

            if (category.Contains("Virtual", StringComparison.OrdinalIgnoreCase))
                continue;

            var existing = devices.FirstOrDefault(d =>
                (isLaptop && d.IsLaptopKeyboard) ||
                (!isLaptop && !string.IsNullOrEmpty(hardwareId) && d.HardwareId.Equals(hardwareId, StringComparison.OrdinalIgnoreCase)));

            if (existing != null)
            {
                if (!existing.AllDevicePaths.Contains(devicePath))
                {
                    existing.AllDevicePaths.Add(devicePath);
                }
                continue;
            }

            var deviceInfo = new DeviceInfo
            {
                DeviceHandle = handleIndex++,
                HardwareId = hardwareId,
                DevicePath = devicePath,
                AllDevicePaths = new List<string> { devicePath },
                FriendlyName = friendlyName,
                DeviceCategory = category,
                ConnectionType = connType,
                IsLaptopKeyboard = isLaptop,
                IsRegistered = false,
                IsMasterKeyboard = isLaptop,
                DeviceType = isLaptop ? DeviceType.MasterKeyboard : DeviceType.Unknown
            };

            devices.Add(deviceInfo);
        }

        lock (_allDiscoveredDevices)
        {
            _allDiscoveredDevices.Clear();
            _allDiscoveredDevices.AddRange(devices);
        }

        return devices;
    }

    private string? GetDevicePath(IntPtr hDevice)
    {
        uint pathSize = 0;
        GetRawInputDeviceInfoW(hDevice, RIDI_DEVICENAME, IntPtr.Zero, ref pathSize);
        if (pathSize == 0)
            return null;

        IntPtr pathBuffer = Marshal.AllocHGlobal((int)(pathSize * 2));
        try
        {
            uint written = GetRawInputDeviceInfoW(hDevice, RIDI_DEVICENAME, pathBuffer, ref pathSize);
            if (written == unchecked((uint)-1) || written == 0)
                return null;

            return Marshal.PtrToStringUni(pathBuffer);
        }
        finally
        {
            Marshal.FreeHGlobal(pathBuffer);
        }
    }

    public static (string friendlyName, string hardwareId, string category, string connType, bool isLaptop) ClassifyDevice(string devicePath)
    {
        if (devicePath.Contains("ACPI", StringComparison.OrdinalIgnoreCase) ||
            devicePath.Contains("HPQ8001", StringComparison.OrdinalIgnoreCase) ||
            devicePath.Contains("PS2", StringComparison.OrdinalIgnoreCase) ||
            devicePath.Contains("PNP03", StringComparison.OrdinalIgnoreCase))
        {
            return ("Built-in Laptop Keyboard", "Internal (ACPI/PS2)", "Laptop Keyboard", "Built-in", true);
        }

        if (devicePath.Contains("UVHID", StringComparison.OrdinalIgnoreCase) ||
            devicePath.Contains(@"\ROOT\", StringComparison.OrdinalIgnoreCase))
        {
            return ("Virtual Software Device (UVHID)", "VIRTUAL_HID", "Virtual Device", "Software", false);
        }

        string hardwareId = ExtractHardwareId(devicePath);

        if (hardwareId.Equals("VID_045E&PID_07B2", StringComparison.OrdinalIgnoreCase))
        {
            return ("Microsoft Wireless Keyboard", hardwareId, "Wireless Keyboard", "Wireless USB", false);
        }

        if (hardwareId.Equals("VID_258E&PID_000F", StringComparison.OrdinalIgnoreCase))
        {
            return ("34-Key Numeric Keypad", hardwareId, "USB Numeric Keypad", "USB", false);
        }

        if (hardwareId.Equals("VID_30FA&PID_1340", StringComparison.OrdinalIgnoreCase))
        {
            return ("8-Button Macro Pad (with Rotary Knob)", hardwareId, "USB Macro Keypad", "USB", false);
        }

        string friendlyName = GetFriendlyNameFromRegistry(devicePath, hardwareId);
        string category = hardwareId.Contains("VID_") ? "External USB Keypad" : "External Keyboard";
        string connType = hardwareId.Contains("VID_") ? "USB" : "External";

        return (friendlyName, hardwareId, category, connType, false);
    }

    private static string ExtractHardwareId(string devicePath)
    {
        var match = Regex.Match(devicePath, @"VID_([0-9A-Fa-f]{4})&PID_([0-9A-Fa-f]{4})", RegexOptions.IgnoreCase);
        if (match.Success)
        {
            return $"VID_{match.Groups[1].Value.ToUpper()}&PID_{match.Groups[2].Value.ToUpper()}";
        }

        var parts = devicePath.Split('#');
        if (parts.Length >= 2)
        {
            return parts[1].Replace('&', ' ').Trim();
        }

        return "Unknown";
    }

    private static string GetFriendlyNameFromRegistry(string devicePath, string hardwareId)
    {
        try
        {
            string cleanPath = devicePath
                .Replace(@"\\?\", "")
                .TrimEnd('}')
                .TrimEnd('#');

            int lastHash = cleanPath.LastIndexOf('#');
            if (lastHash > 0)
                cleanPath = cleanPath[..lastHash];

            var segments = cleanPath.Split('#');
            if (segments.Length >= 3)
            {
                string enumPath = $@"SYSTEM\CurrentControlSet\Enum\{segments[0]}\{segments[1]}\{segments[2]}";
                using var key = Registry.LocalMachine.OpenSubKey(enumPath);
                if (key != null)
                {
                    string? name = key.GetValue("FriendlyName") as string
                              ?? key.GetValue("DeviceDesc") as string;

                    if (!string.IsNullOrWhiteSpace(name))
                    {
                        int semicolon = name.LastIndexOf(';');
                        if (semicolon >= 0 && semicolon < name.Length - 1)
                            name = name[(semicolon + 1)..];

                        if (!name.Equals("HID Keyboard Device", StringComparison.OrdinalIgnoreCase) &&
                            !name.Equals("Keyboard Device", StringComparison.OrdinalIgnoreCase))
                        {
                            return name;
                        }
                    }
                }
            }
        }
        catch { }

        if (hardwareId.Contains("VID_"))
            return $"USB Keypad ({hardwareId})";

        return $"Keyboard Device ({hardwareId})";
    }

    public void StartCapture()
    {
        if (_isCapturing) return;

        if (!IsDriverInstalled)
        {
            System.Diagnostics.Debug.WriteLine("Interception driver is not installed. Cannot start capture.");
            return;
        }

        try
        {
            InputInterceptor.Initialize();
            _context = InputInterceptor.CreateContext();
            if (_context == IntPtr.Zero)
            {
                System.Diagnostics.Debug.WriteLine("Failed to create Interception context.");
                return;
            }

            // Set filter for all keyboards
            InputInterceptor.SetFilter(_context, InputInterceptor.IsKeyboard, KeyboardFilter.All);

            // Populate device ID map
            RefreshInterceptionDeviceMap();

            _isCapturing = true;
            _captureThread = new Thread(CaptureLoop)
            {
                IsBackground = true,
                Name = "Lionfish_InterceptionCapture"
            };
            _captureThread.Start();
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error starting Interception capture: {ex.Message}");
            StopCapture();
        }
    }

    public void StopCapture()
    {
        _isCapturing = false;

        if (_captureThread != null && _captureThread.IsAlive)
        {
            _captureThread.Join(500);
            _captureThread = null;
        }

        if (_context != IntPtr.Zero)
        {
            try
            {
                InputInterceptor.DestroyContext(_context);
            }
            catch { }
            _context = IntPtr.Zero;
        }
    }

    private void RefreshInterceptionDeviceMap()
    {
        try
        {
            var deviceList = InputInterceptor.GetDeviceList(InputInterceptor.IsKeyboard);
            lock (_deviceIdToHwId)
            {
                _deviceIdToHwId.Clear();
                foreach (var d in deviceList)
                {
                    string hwId = ExtractHardwareIdFromNames(d.CompositeName, d.Names);
                    _deviceIdToHwId[d.Device] = hwId;
                }
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error refreshing device map: {ex.Message}");
        }
    }

    private string GetHardwareIdForDevice(int deviceId)
    {
        lock (_deviceIdToHwId)
        {
            if (_deviceIdToHwId.TryGetValue(deviceId, out var hwId))
                return hwId;
        }

        // Fallback: query hardware ID directly via Interception
        if (_context != IntPtr.Zero)
        {
            IntPtr buffer = Marshal.AllocHGlobal(512);
            try
            {
                uint len = InputInterceptor.GetHardwareId(_context, deviceId, buffer, 512);
                if (len > 0)
                {
                    string rawHw = Marshal.PtrToStringUni(buffer) ?? "";
                    string hwId = ExtractHardwareId(rawHw);
                    lock (_deviceIdToHwId)
                    {
                        _deviceIdToHwId[deviceId] = hwId;
                    }
                    return hwId;
                }
            }
            catch { }
            finally
            {
                Marshal.FreeHGlobal(buffer);
            }
        }

        return "Unknown";
    }

    private static string ExtractHardwareIdFromNames(string composite, IEnumerable<string> names)
    {
        if (composite.Contains("ACPI", StringComparison.OrdinalIgnoreCase) ||
            composite.Contains("HPQ8001", StringComparison.OrdinalIgnoreCase) ||
            composite.Contains("PS2", StringComparison.OrdinalIgnoreCase))
        {
            return "Internal (ACPI/PS2)";
        }

        var match = Regex.Match(composite, @"VID_([0-9A-Fa-f]{4})&PID_([0-9A-Fa-f]{4})", RegexOptions.IgnoreCase);
        if (match.Success)
        {
            return $"VID_{match.Groups[1].Value.ToUpper()}&PID_{match.Groups[2].Value.ToUpper()}";
        }

        foreach (var name in names)
        {
            match = Regex.Match(name, @"VID_([0-9A-Fa-f]{4})&PID_([0-9A-Fa-f]{4})", RegexOptions.IgnoreCase);
            if (match.Success)
            {
                return $"VID_{match.Groups[1].Value.ToUpper()}&PID_{match.Groups[2].Value.ToUpper()}";
            }
        }

        return ExtractHardwareId(composite);
    }

    private void CaptureLoop()
    {
        while (_isCapturing && _context != IntPtr.Zero)
        {
            try
            {
                int deviceId = InputInterceptor.WaitWithTimeout(_context, 100);
                if (deviceId == 0) continue;

                Stroke stroke = default;
                int received = InputInterceptor.Receive(_context, deviceId, ref stroke, 1);
                if (received <= 0) continue;

                ushort scanCode = (ushort)stroke.Key.Code;
                bool isKeyDown = (stroke.Key.State & KeyState.Up) == 0;
                bool isE0 = (stroke.Key.State & KeyState.E0) == KeyState.E0;

                // 1. Emergency Kill Switch Check: Left Ctrl + Right Ctrl pressed simultaneously
                if (scanCode == 0x1D) // Control
                {
                    if (!isE0) _lCtrlDown = isKeyDown;
                    else _rCtrlDown = isKeyDown;

                    if (_lCtrlDown && _rCtrlDown)
                    {
                        // Pass through current stroke so key is not stuck down
                        InputInterceptor.Send(_context, deviceId, ref stroke, 1);
                        _isCapturing = false;
                        KillSwitchActivated?.Invoke();
                        break;
                    }
                }

                // 2. Identify physical device
                string hwId = GetHardwareIdForDevice(deviceId);

                // 3. Check if device is a registered macro pad
                if (IsRegisteredMacroPad(hwId))
                {
                    // BLOCK: Do NOT call InputInterceptor.Send!
                    // This completely prevents the key from passing into Windows or active apps.
                    string keyName = FormatKeyName(scanCode, isE0);
                    var devInfo = GetOrBuildDeviceInfo(hwId, deviceId);

                    KeyIntercepted?.Invoke(devInfo, new InterceptedKeyEventArgs
                    {
                        ScanCode = scanCode,
                        IsKeyDown = isKeyDown,
                        IsE0 = isE0,
                        KeyName = keyName
                    });
                }
                else
                {
                    // Pass through immediately with zero latency!
                    InputInterceptor.Send(_context, deviceId, ref stroke, 1);
                }
            }
            catch (ThreadAbortException)
            {
                break;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Exception in Interception CaptureLoop: {ex.Message}");
            }
        }
    }

    private DeviceInfo GetOrBuildDeviceInfo(string hwId, int deviceId)
    {
        lock (_allDiscoveredDevices)
        {
            var match = _allDiscoveredDevices.FirstOrDefault(d => d.HardwareId.Equals(hwId, StringComparison.OrdinalIgnoreCase));
            if (match != null) return match;
        }

        return new DeviceInfo
        {
            DeviceHandle = deviceId,
            HardwareId = hwId,
            FriendlyName = hwId.Contains("30FA") ? "8-Button Macro Pad (with Rotary Knob)" :
                           hwId.Contains("258E") ? "34-Key Numeric Keypad" : $"Keypad ({hwId})",
            DeviceCategory = "External USB Keypad",
            ConnectionType = "USB",
            IsLaptopKeyboard = false,
            IsRegistered = true,
            DeviceType = DeviceType.MacroPad
        };
    }

    public static string FormatKeyName(ushort scanCode, bool isE0)
    {
        if (isE0)
        {
            return scanCode switch
            {
                0x1C => "Numpad Enter",
                0x1D => "Right Ctrl",
                0x35 => "Numpad /",
                0x37 => "Print Screen",
                0x38 => "Right Alt",
                0x47 => "Home",
                0x48 => "Up Arrow",
                0x49 => "Page Up",
                0x4B => "Left Arrow",
                0x4D => "Right Arrow",
                0x4F => "End",
                0x50 => "Down Arrow",
                0x51 => "Page Down",
                0x52 => "Insert",
                0x53 => "Delete",
                0x5B => "Left Windows",
                0x5C => "Right Windows",
                0x5D => "Menu / Apps",
                0x20 => "Media: Mute",
                0x2E => "Media: Volume Down",
                0x30 => "Media: Volume Up",
                0x22 => "Media: Play / Pause",
                0x24 => "Media: Stop",
                0x10 => "Media: Previous Track",
                0x19 => "Media: Next Track",
                _ => $"ExtKey_0x{scanCode:X2}"
            };
        }

        return scanCode switch
        {
            0x01 => "Escape",
            0x02 => "1", 0x03 => "2", 0x04 => "3", 0x05 => "4", 0x06 => "5",
            0x07 => "6", 0x08 => "7", 0x09 => "8", 0x0A => "9", 0x0B => "0",
            0x0C => "-", 0x0D => "=", 0x0E => "Backspace", 0x0F => "Tab",
            0x10 => "Q", 0x11 => "W", 0x12 => "E", 0x13 => "R", 0x14 => "T",
            0x15 => "Y", 0x16 => "U", 0x17 => "I", 0x18 => "O", 0x19 => "P",
            0x1A => "[", 0x1B => "]", 0x1C => "Enter", 0x1D => "Left Ctrl",
            0x1E => "A", 0x1F => "S", 0x20 => "D", 0x21 => "F", 0x22 => "G",
            0x23 => "H", 0x24 => "J", 0x25 => "K", 0x26 => "L", 0x27 => ";",
            0x28 => "'", 0x29 => "`", 0x2A => "Left Shift", 0x2B => "\\",
            0x2C => "Z", 0x2D => "X", 0x2E => "C", 0x2F => "V", 0x30 => "B",
            0x31 => "N", 0x32 => "M", 0x33 => ",", 0x34 => ".", 0x35 => "/",
            0x36 => "Right Shift", 0x37 => "Numpad *", 0x38 => "Left Alt", 0x39 => "Space",
            0x3A => "Caps Lock",
            0x3B => "F1", 0x3C => "F2", 0x3D => "F3", 0x3E => "F4", 0x3F => "F5",
            0x40 => "F6", 0x41 => "F7", 0x42 => "F8", 0x43 => "F9", 0x44 => "F10",
            0x45 => "Num Lock", 0x46 => "Scroll Lock",
            0x47 => "Numpad 7", 0x48 => "Numpad 8", 0x49 => "Numpad 9", 0x4A => "Numpad -",
            0x4B => "Numpad 4", 0x4C => "Numpad 5", 0x4D => "Numpad 6", 0x4E => "Numpad +",
            0x4F => "Numpad 1", 0x50 => "Numpad 2", 0x51 => "Numpad 3",
            0x52 => "Numpad 0", 0x53 => "Numpad .",
            0x57 => "F11", 0x58 => "F12",
            _ => $"Key_0x{scanCode:X2}"
        };
    }

    public void Dispose()
    {
        StopCapture();
        InputInterceptor.Dispose();
    }

    // ========== Win32 P/Invoke Constants ==========
    private const uint RIM_TYPEKEYBOARD = 1;
    private const uint RIDI_DEVICENAME = 0x20000007;

    [StructLayout(LayoutKind.Sequential)]
    private struct RAWINPUTDEVICELIST
    {
        public IntPtr hDevice;
        public uint dwType;
    }

    [DllImport("user32.dll", SetLastError = true)]
    private static extern uint GetRawInputDeviceList(
        [Out] RAWINPUTDEVICELIST[]? devices,
        ref uint numDevices,
        uint cbSize);

    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern uint GetRawInputDeviceInfoW(
        IntPtr hDevice,
        uint uiCommand,
        IntPtr pData,
        ref uint pcbSize);
}
