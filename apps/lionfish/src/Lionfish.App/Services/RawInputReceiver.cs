using System;
using System.Runtime.InteropServices;
using System.Text.RegularExpressions;
using System.Windows.Input;

namespace Lionfish.App.Services;

/// <summary>
/// Service that listens for Raw Input (WM_INPUT) messages sent to the WPF window.
/// Allows real-time detection of which physical keyboard/keypad generated a keystroke.
/// </summary>
public class RawInputReceiver : IDisposable
{
    public event Action<string /*devicePath*/, ushort /*vKey*/, string /*keyName*/>? KeyDetected;
    public event Action? DeviceConnectionChanged;

    private IntPtr _hwnd = IntPtr.Zero;
    private bool _isRegistered;

    private const int WM_INPUT = 0x00FF;
    private const int WM_INPUT_DEVICE_CHANGE = 0x00FE;
    private const int WM_DEVICECHANGE = 0x0219;
    private const uint RID_INPUT = 0x10000003;
    private const uint RIDI_DEVICENAME = 0x20000007;
    private const uint RIDEV_INPUTSINK = 0x00000100;
    private const uint RIDEV_DEVNOTIFY = 0x00002000;
    private const uint RIDEV_REMOVE = 0x00000001;

    private const uint WM_KEYDOWN = 0x0100;
    private const uint WM_SYSKEYDOWN = 0x0104;

    [StructLayout(LayoutKind.Sequential)]
    private struct RAWINPUTDEVICE
    {
        public ushort usUsagePage;
        public ushort usUsage;
        public uint dwFlags;
        public IntPtr hwndTarget;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct RAWINPUTHEADER
    {
        public uint dwType;
        public uint dwSize;
        public IntPtr hDevice;
        public IntPtr wParam;
    }

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool RegisterRawInputDevices(
        [In] RAWINPUTDEVICE[] pRawInputDevices,
        uint uiNumDevices,
        uint cbSize);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern uint GetRawInputData(
        IntPtr hRawInput,
        uint uiCommand,
        IntPtr pData,
        ref uint pcbSize,
        uint cbSizeHeader);

    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern uint GetRawInputDeviceInfoW(
        IntPtr hDevice,
        uint uiCommand,
        IntPtr pData,
        ref uint pcbSize);

    /// <summary>
    /// Registers the specified window to receive background raw keyboard input sink messages.
    /// </summary>
    public bool Register(IntPtr hwnd)
    {
        _hwnd = hwnd;
        var device = new RAWINPUTDEVICE
        {
            usUsagePage = 0x01, // Generic Desktop Controls
            usUsage = 0x06,     // Keyboard
            dwFlags = RIDEV_INPUTSINK | RIDEV_DEVNOTIFY,
            hwndTarget = hwnd
        };

        _isRegistered = RegisterRawInputDevices(
            new[] { device },
            1,
            (uint)Marshal.SizeOf<RAWINPUTDEVICE>());

        return _isRegistered;
    }

    /// <summary>
    /// Window procedure hook to process WM_INPUT and PnP device change messages.
    /// </summary>
    public IntPtr Hook(IntPtr hwnd, int msg, IntPtr wParam, IntPtr lParam, ref bool handled)
    {
        if (msg == WM_INPUT)
        {
            ProcessWmInput(lParam);
        }
        else if (msg == WM_INPUT_DEVICE_CHANGE || msg == WM_DEVICECHANGE)
        {
            DeviceConnectionChanged?.Invoke();
        }
        return IntPtr.Zero;
    }

    private void ProcessWmInput(IntPtr hRawInput)
    {
        uint headerSize = (uint)Marshal.SizeOf<RAWINPUTHEADER>();
        uint bufferSize = 0;

        // Get required size
        GetRawInputData(hRawInput, RID_INPUT, IntPtr.Zero, ref bufferSize, headerSize);
        if (bufferSize == 0) return;

        IntPtr buffer = Marshal.AllocHGlobal((int)bufferSize);
        try
        {
            uint copied = GetRawInputData(hRawInput, RID_INPUT, buffer, ref bufferSize, headerSize);
            if (copied == unchecked((uint)-1) || copied == 0) return;

            // Header offset: 0 = dwType, 4 = dwSize, 8 = hDevice (on 64-bit)
            uint dwType = (uint)Marshal.ReadInt32(buffer, 0);
            if (dwType != 1) return; // 1 = RIM_TYPEKEYBOARD

            IntPtr hDevice = Marshal.ReadIntPtr(buffer, 8);

            // RAWKEYBOARD structure begins after RAWINPUTHEADER (24 bytes on 64-bit Windows)
            int keyboardOffset = (int)headerSize;

            ushort vKey = (ushort)Marshal.ReadInt16(buffer, keyboardOffset + 6);
            uint message = (uint)Marshal.ReadInt32(buffer, keyboardOffset + 8);

            // Only respond to key-down events
            if (message != WM_KEYDOWN && message != WM_SYSKEYDOWN)
                return;

            string? devicePath = GetDevicePath(hDevice);
            if (string.IsNullOrEmpty(devicePath)) return;

            string keyName = FormatKeyName(vKey);

            KeyDetected?.Invoke(devicePath, vKey, keyName);
        }
        catch
        {
            // Ignore corrupted input messages
        }
        finally
        {
            Marshal.FreeHGlobal(buffer);
        }
    }

    private static string? GetDevicePath(IntPtr hDevice)
    {
        uint pathSize = 0;
        GetRawInputDeviceInfoW(hDevice, RIDI_DEVICENAME, IntPtr.Zero, ref pathSize);
        if (pathSize == 0) return null;

        IntPtr buffer = Marshal.AllocHGlobal((int)(pathSize * 2));
        try
        {
            uint written = GetRawInputDeviceInfoW(hDevice, RIDI_DEVICENAME, buffer, ref pathSize);
            if (written == unchecked((uint)-1) || written == 0) return null;
            return Marshal.PtrToStringUni(buffer);
        }
        finally
        {
            Marshal.FreeHGlobal(buffer);
        }
    }

    private static string FormatKeyName(ushort vKey)
    {
        try
        {
            var key = KeyInterop.KeyFromVirtualKey(vKey);
            return key switch
            {
                Key.D0 or Key.D1 or Key.D2 or Key.D3 or Key.D4 or
                Key.D5 or Key.D6 or Key.D7 or Key.D8 or Key.D9 => key.ToString().TrimStart('D'),
                Key.NumPad0 => "Numpad 0",
                Key.NumPad1 => "Numpad 1",
                Key.NumPad2 => "Numpad 2",
                Key.NumPad3 => "Numpad 3",
                Key.NumPad4 => "Numpad 4",
                Key.NumPad5 => "Numpad 5",
                Key.NumPad6 => "Numpad 6",
                Key.NumPad7 => "Numpad 7",
                Key.NumPad8 => "Numpad 8",
                Key.NumPad9 => "Numpad 9",
                Key.Add => "Numpad +",
                Key.Subtract => "Numpad -",
                Key.Multiply => "Numpad *",
                Key.Divide => "Numpad /",
                Key.Decimal => "Numpad .",
                _ => key.ToString()
            };
        }
        catch
        {
            return $"VK_{vKey:X2}";
        }
    }

    public void Dispose()
    {
        if (_isRegistered && _hwnd != IntPtr.Zero)
        {
            var device = new RAWINPUTDEVICE
            {
                usUsagePage = 0x01,
                usUsage = 0x06,
                dwFlags = RIDEV_REMOVE,
                hwndTarget = IntPtr.Zero
            };
            RegisterRawInputDevices(new[] { device }, 1, (uint)Marshal.SizeOf<RAWINPUTDEVICE>());
            _isRegistered = false;
        }
    }
}
