using System;
using System.Collections.ObjectModel;
using System.Linq;
using System.Threading.Tasks;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Lionfish.App.Models;
using CoreInterception = Lionfish.Core.Interception;

namespace Lionfish.App.ViewModels;

public partial class DevicesViewModel : ObservableObject
{
    [ObservableProperty] private ObservableCollection<DeviceInfo> _devices = new();
    [ObservableProperty] private DeviceInfo? _selectedDevice;
    [ObservableProperty] private DeviceInfo? _masterKeyboard;
    [ObservableProperty] private bool _isListening;
    [ObservableProperty] private int _macroPadCount;
    [ObservableProperty] private string _statusMessage = "Ready. Plug in your keypads and click Identify Device or press any key.";
    [ObservableProperty] private bool _showVirtualDevices = false;

    public event Action? DevicesChanged;

    private readonly CoreInterception.InterceptionService? _interceptionService;

    public DevicesViewModel()
    {
        try
        {
            _interceptionService = new CoreInterception.InterceptionService();
        }
        catch
        {
            // Fallback if driver service instantiation has issues
        }

        // Auto-scan on startup
        _ = RefreshDevicesAsync();
    }

    private void UpdateCounts()
    {
        MasterKeyboard = null;
        int pads = 0;
        foreach (var d in Devices)
        {
            if (d.IsMaster) MasterKeyboard = d;
            if (d.IsMacroPad) pads++;
        }
        MacroPadCount = pads;
    }

    [RelayCommand]
    public async Task RefreshDevicesAsync()
    {
        StatusMessage = "Scanning for physical keyboard and keypad devices...";

        await Task.Run(() =>
        {
            try
            {
                var service = _interceptionService ?? new CoreInterception.InterceptionService();
                var coreDevices = service.GetAllKeyboardDevices();

                System.Windows.Application.Current?.Dispatcher?.Invoke(() =>
                {
                    // Load saved config for nicknames and registered roles
                    var configStore = new Lionfish.Core.Config.ConfigStore();
                    var config = configStore.LoadConfig();

                    // Preserve existing assignments (Master / MacroPad) if refreshing
                    var previousMasterHwId = MasterKeyboard?.HardwareId;
                    var previousMacroPadHwIds = Devices.Where(d => d.IsMacroPad).Select(d => d.HardwareId).ToHashSet();

                    Devices.Clear();

                    foreach (var cd in coreDevices)
                    {
                        // Filter out virtual software devices unless explicitly requested
                        if (!ShowVirtualDevices && (cd.DeviceCategory.Contains("Virtual") || cd.HardwareId.Contains("UVHID")))
                            continue;

                        string friendlyName = cd.FriendlyName;
                        if (config.CustomDeviceNames.TryGetValue(cd.HardwareId, out var customName) && !string.IsNullOrWhiteSpace(customName))
                        {
                            friendlyName = customName;
                        }

                        string icon = cd.IsLaptopKeyboard ? "💻" :
                                      (cd.ConnectionType.Contains("Wireless") ? "📡" : "🔌");

                        bool isMaster = !string.IsNullOrEmpty(previousMasterHwId)
                            ? cd.HardwareId.Equals(previousMasterHwId, StringComparison.OrdinalIgnoreCase)
                            : (!string.IsNullOrEmpty(config.MasterKeyboardHardwareId)
                                ? cd.HardwareId.Equals(config.MasterKeyboardHardwareId, StringComparison.OrdinalIgnoreCase)
                                : cd.IsLaptopKeyboard);

                        bool isMacroPad = previousMacroPadHwIds.Contains(cd.HardwareId) ||
                                          config.RegisteredDevices.Any(r => r.HardwareId.Equals(cd.HardwareId, StringComparison.OrdinalIgnoreCase));

                        var device = new DeviceInfo
                        {
                            FriendlyName = friendlyName,
                            HardwareId = cd.HardwareId,
                            DevicePath = cd.DevicePath,
                            AllDevicePaths = cd.AllDevicePaths.ToList(),
                            DeviceCategory = cd.DeviceCategory,
                            ConnectionType = cd.ConnectionType,
                            CategoryIcon = icon,
                            IsLaptop = cd.IsLaptopKeyboard,
                            IsMaster = isMaster,
                            IsMacroPad = isMacroPad,
                            IsUnregistered = !isMaster && !isMacroPad
                        };

                        Devices.Add(device);
                    }

                    SortDevices();

                    if (SelectedDevice == null && Devices.Count > 0)
                    {
                        // Select the first non-laptop device or first device
                        SelectedDevice = Devices.FirstOrDefault(d => !d.IsLaptop) ?? Devices[0];
                    }

                    UpdateCounts();
                    DevicesChanged?.Invoke();

                    int total = Devices.Count;
                    var laptop = Devices.FirstOrDefault(d => d.IsLaptop);
                    string laptopText = laptop != null ? "Laptop keyboard detected." : "No internal keyboard detected.";
                    StatusMessage = $"Found {total} active input device(s). {laptopText}";
                });
            }
            catch (Exception ex)
            {
                System.Windows.Application.Current?.Dispatcher?.Invoke(() =>
                {
                    StatusMessage = $"Error scanning devices: {ex.Message}";
                });
            }
        });
    }

    /// <summary>
    /// Invoked whenever any keypress is detected via Windows Raw Input (WM_INPUT).
    /// Instantly matches which physical device pressed the key!
    /// </summary>
    public void OnKeyInput(string devicePath, ushort vKey, string keyName)
    {
        System.Windows.Application.Current?.Dispatcher?.Invoke(() =>
        {
            // 1. Match by exact DevicePath or contained in AllDevicePaths
            DeviceInfo? match = Devices.FirstOrDefault(d =>
                (!string.IsNullOrEmpty(d.DevicePath) && d.DevicePath.Equals(devicePath, StringComparison.OrdinalIgnoreCase)) ||
                (d.AllDevicePaths != null && d.AllDevicePaths.Any(p => p.Equals(devicePath, StringComparison.OrdinalIgnoreCase))));

            // 2. If no exact match, try matching by hardware ID (VID_xxxx&PID_xxxx)
            if (match == null && devicePath.Contains("VID_", StringComparison.OrdinalIgnoreCase))
            {
                var vidMatch = System.Text.RegularExpressions.Regex.Match(devicePath, @"VID_[0-9A-Fa-f]{4}&PID_[0-9A-Fa-f]{4}", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                if (vidMatch.Success)
                {
                    match = Devices.FirstOrDefault(d => d.HardwareId.Contains(vidMatch.Value, StringComparison.OrdinalIgnoreCase));
                    if (match != null && !match.AllDevicePaths.Contains(devicePath))
                    {
                        match.AllDevicePaths.Add(devicePath);
                    }
                }
            }

            // 3. Match laptop internal keyboard if ACPI/PS2/HPQ
            if (match == null && (devicePath.Contains("ACPI", StringComparison.OrdinalIgnoreCase) ||
                                  devicePath.Contains("HPQ", StringComparison.OrdinalIgnoreCase) ||
                                  devicePath.Contains("PS2", StringComparison.OrdinalIgnoreCase)))
            {
                match = Devices.FirstOrDefault(d => d.IsLaptop);
            }

            if (match != null)
            {
                // Reset highlight on all, highlight the responding device
                foreach (var d in Devices)
                {
                    d.IsHighlighted = (d == match);
                }

                match.LastKeyPressed = keyName;
                SelectedDevice = match;

                if (IsListening)
                {
                    IsListening = false;
                    StatusMessage = $"🎯 Identified '{match.FriendlyName}'! (Key: [{keyName}]) — Click 'Set Macro Pad' or 'Set Master' below.";
                }
                else
                {
                    StatusMessage = $"⚡ Key [{keyName}] received from '{match.FriendlyName}' ({match.HardwareId})";
                }
            }
            else
            {
                // Discovered a new device currently not listed!
                var (friendlyName, hardwareId, category, connType, isLaptop) = CoreInterception.InterceptionService.ClassifyDevice(devicePath);
                string icon = isLaptop ? "💻" : (connType.Contains("Wireless") ? "📡" : "🔌");

                var newDev = new DeviceInfo
                {
                    FriendlyName = friendlyName,
                    HardwareId = hardwareId,
                    DevicePath = devicePath,
                    AllDevicePaths = new List<string> { devicePath },
                    DeviceCategory = category,
                    ConnectionType = connType,
                    CategoryIcon = icon,
                    IsLaptop = isLaptop,
                    IsMaster = isLaptop,
                    IsMacroPad = false,
                    IsUnregistered = !isLaptop,
                    IsHighlighted = true,
                    LastKeyPressed = keyName
                };

                Devices.Add(newDev);
                SelectedDevice = newDev;
                SortDevices();

                if (IsListening)
                {
                    IsListening = false;
                    StatusMessage = $"✨ Newly identified device: '{newDev.FriendlyName}'! (Key: [{keyName}])";
                }
                else
                {
                    StatusMessage = $"Input from newly discovered device: '{newDev.FriendlyName}' (Key: [{keyName}])";
                }

                UpdateCounts();
            }
        });
    }

    private void SortDevices()
    {
        var sorted = Devices
            .OrderByDescending(d => d.IsMaster)
            .ThenByDescending(d => d.IsMacroPad)
            .ThenBy(d => d.FriendlyName)
            .ToList();

        for (int i = 0; i < sorted.Count; i++)
        {
            int oldIndex = Devices.IndexOf(sorted[i]);
            if (oldIndex != i && oldIndex >= 0)
            {
                Devices.Move(oldIndex, i);
            }
        }
    }

    [RelayCommand]
    private void StartRename(DeviceInfo? device)
    {
        if (device == null) return;
        device.RenameText = device.FriendlyName;
        device.IsRenaming = true;
    }

    [RelayCommand]
    private void SaveRename(DeviceInfo? device)
    {
        if (device == null) return;
        if (!string.IsNullOrWhiteSpace(device.RenameText))
        {
            device.FriendlyName = device.RenameText.Trim();
            try
            {
                var configStore = new Lionfish.Core.Config.ConfigStore();
                var config = configStore.LoadConfig();
                config.CustomDeviceNames[device.HardwareId] = device.FriendlyName;
                var reg = config.RegisteredDevices.FirstOrDefault(r => r.HardwareId.Equals(device.HardwareId, StringComparison.OrdinalIgnoreCase));
                if (reg != null) reg.FriendlyName = device.FriendlyName;
                configStore.SaveConfig(config);
            }
            catch { }
            StatusMessage = $"✏️ Renamed device to '{device.FriendlyName}'.";
        }
        device.IsRenaming = false;
        SortDevices();
        DevicesChanged?.Invoke();
    }

    [RelayCommand]
    private void CancelRename(DeviceInfo? device)
    {
        if (device == null) return;
        device.IsRenaming = false;
    }

    [RelayCommand]
    private void SetAsMaster(DeviceInfo? device)
    {
        if (device == null) return;
        foreach (var d in Devices)
        {
            d.IsMaster = false;
            if (d.IsMacroPad == false) d.IsUnregistered = true;
        }
        device.IsMaster = true;
        device.IsMacroPad = false;
        device.IsUnregistered = false;
        try
        {
            var configStore = new Lionfish.Core.Config.ConfigStore();
            var config = configStore.LoadConfig();
            config.MasterKeyboardHardwareId = device.HardwareId;
            config.RegisteredDevices.RemoveAll(r => r.HardwareId.Equals(device.HardwareId, StringComparison.OrdinalIgnoreCase));
            configStore.SaveConfig(config);
        }
        catch { }
        SortDevices();
        UpdateCounts();
        DevicesChanged?.Invoke();
        StatusMessage = $"✅ '{device.FriendlyName}' set as Master Keyboard (protected from interception).";
    }

    [RelayCommand]
    private void RegisterAsMacroPad(DeviceInfo? device)
    {
        if (device == null) return;
        device.IsMaster = false;
        device.IsMacroPad = true;
        device.IsUnregistered = false;
        try
        {
            var configStore = new Lionfish.Core.Config.ConfigStore();
            var config = configStore.LoadConfig();
            if (!config.RegisteredDevices.Any(r => r.HardwareId.Equals(device.HardwareId, StringComparison.OrdinalIgnoreCase)))
            {
                config.RegisteredDevices.Add(new Lionfish.Core.Config.RegisteredDevice
                {
                    HardwareId = device.HardwareId,
                    FriendlyName = device.FriendlyName
                });
            }
            if (config.MasterKeyboardHardwareId == device.HardwareId)
            {
                config.MasterKeyboardHardwareId = null;
            }
            configStore.SaveConfig(config);
        }
        catch { }
        SortDevices();
        UpdateCounts();
        DevicesChanged?.Invoke();
        StatusMessage = $"🎯 '{device.FriendlyName}' registered as Macro Pad! Go to the Key Map tab to assign shortcuts.";
    }

    [RelayCommand]
    private void Unregister(DeviceInfo? device)
    {
        if (device == null) return;
        device.IsMaster = false;
        device.IsMacroPad = false;
        device.IsUnregistered = true;
        try
        {
            var configStore = new Lionfish.Core.Config.ConfigStore();
            var config = configStore.LoadConfig();
            config.RegisteredDevices.RemoveAll(r => r.HardwareId.Equals(device.HardwareId, StringComparison.OrdinalIgnoreCase));
            if (config.MasterKeyboardHardwareId == device.HardwareId) config.MasterKeyboardHardwareId = null;
            configStore.SaveConfig(config);
        }
        catch { }
        SortDevices();
        UpdateCounts();
        DevicesChanged?.Invoke();
        StatusMessage = $"'{device.FriendlyName}' is now unregistered.";
    }

    [RelayCommand]
    private void StartListening()
    {
        IsListening = true;
        StatusMessage = "👉 Press ANY button on the keypad or keyboard you want to identify...";
    }

    [RelayCommand]
    private void StopListening()
    {
        IsListening = false;
        StatusMessage = "Cancelled identification.";
    }
}
