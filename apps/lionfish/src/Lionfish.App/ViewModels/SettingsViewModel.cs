using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Lionfish.App.Models;
using Lionfish.App.Services;
using Lionfish.Core.Config;
using KeyMapping = Lionfish.App.Models.KeyMapping;
using DeviceInfo = Lionfish.App.Models.DeviceInfo;
using CoreInterception = Lionfish.Core.Interception;

namespace Lionfish.App.ViewModels;

public partial class SettingsViewModel : ObservableObject
{
    [ObservableProperty] private bool _startWithWindows = true;
    [ObservableProperty] private bool _startMinimized = false;
    [ObservableProperty] private bool _minimizeToTrayOnClose = true;
    [ObservableProperty] private string _killSwitchCombo = "Left Ctrl + Right Ctrl";
    [ObservableProperty] private int _startupDelaySeconds = 2;
    [ObservableProperty] private string _masterKeyboardName = "Generic USB Keyboard";
    [ObservableProperty] private bool _isDriverInstalled = true;
    [ObservableProperty] private string _configLocation = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Lionfish", "config.json");
    [ObservableProperty] private string _appVersion = "0.1.3-alpha";
    [ObservableProperty] private string _selectedThemeMode = "System";
    [ObservableProperty] private bool _isBrowserConnected;
    [ObservableProperty] private string _extensionFolderPath = ResolveExtensionFolderPath();

    [ObservableProperty] private bool _autoProfileSwitching = false;
    [ObservableProperty] private bool _showOsdOverlay = false;

    [ObservableProperty] private ObservableCollection<DeviceOverviewItem> _deviceOverviews = new();
    [ObservableProperty] private DeviceOverviewItem? _selectedDeviceOverview;

    public ObservableCollection<DeviceOverviewItem> ProfileOverviews => DeviceOverviews;
    public DeviceOverviewItem? SelectedProfileOverview { get => SelectedDeviceOverview; set => SelectedDeviceOverview = value; }

    [ObservableProperty] private ObservableCollection<HiddenDeviceItem> _hiddenDevices = new();
    [ObservableProperty] private bool _hasHiddenDevices;

    public event Action? DeviceVisibilityChanged;
    public event Action<bool>? AutoProfileSwitchingChanged;
    public event Action<bool>? ShowOsdOverlayChanged;

    public List<string> ThemeModes { get; } = new() { "System", "Light", "Dark" };

    public SettingsViewModel()
    {
        try
        {
            var configStore = new ConfigStore();
            var config = configStore.LoadConfig();
            _selectedThemeMode = string.IsNullOrWhiteSpace(config.ThemeMode) ? "System" : config.ThemeMode;
            _startWithWindows = config.StartWithWindows;
            _startMinimized = config.StartMinimized;
            _minimizeToTrayOnClose = config.MinimizeToTray;
            _startupDelaySeconds = config.StartupDelaySeconds;
            _killSwitchCombo = config.KillSwitchCombo;
            _autoProfileSwitching = config.AutoProfileSwitching;
            _showOsdOverlay = config.ShowOsdOverlay;
        }
        catch { }

        if (Lionfish.Core.Web.BrowserBridgeService.Instance != null)
        {
            _isBrowserConnected = Lionfish.Core.Web.BrowserBridgeService.Instance.IsConnected;
            Lionfish.Core.Web.BrowserBridgeService.Instance.ConnectionStateChanged += connected =>
            {
                System.Windows.Application.Current?.Dispatcher?.Invoke(() =>
                {
                    IsBrowserConnected = connected;
                });
            };
        }

        RefreshConfigOverview();
    }

    private static string ResolveExtensionFolderPath()
    {
        var devPath = Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "..", "..", "..", "extension"));
        if (Directory.Exists(devPath)) return devPath;

        var pubPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "extension");
        if (Directory.Exists(pubPath)) return pubPath;

        var hardcodedPath = @"c:\Users\wmjef\Desktop\Precious Box\Dotcoms\jeffersonwm\apps\lionfish\extension";
        if (Directory.Exists(hardcodedPath)) return hardcodedPath;

        return devPath;
    }

    partial void OnSelectedThemeModeChanged(string value)
    {
        if (string.IsNullOrWhiteSpace(value)) return;
        ThemeManager.ApplyTheme(value);

        try
        {
            var configStore = new ConfigStore();
            var config = configStore.LoadConfig();
            config.ThemeMode = value;
            configStore.SaveConfig(config);
        }
        catch { }
    }

    partial void OnAutoProfileSwitchingChanged(bool value)
    {
        try
        {
            var configStore = new ConfigStore();
            var config = configStore.LoadConfig();
            config.AutoProfileSwitching = value;
            configStore.SaveConfig(config);
        }
        catch { }
        AutoProfileSwitchingChanged?.Invoke(value);
    }

    partial void OnShowOsdOverlayChanged(bool value)
    {
        try
        {
            var configStore = new ConfigStore();
            var config = configStore.LoadConfig();
            config.ShowOsdOverlay = value;
            configStore.SaveConfig(config);
        }
        catch { }
        ShowOsdOverlayChanged?.Invoke(value);
    }

    partial void OnStartWithWindowsChanged(bool value)
    {
        try
        {
            var configStore = new ConfigStore();
            var config = configStore.LoadConfig();
            config.StartWithWindows = value;
            configStore.SaveConfig(config);
        }
        catch { }
    }

    partial void OnStartMinimizedChanged(bool value)
    {
        try
        {
            var configStore = new ConfigStore();
            var config = configStore.LoadConfig();
            config.StartMinimized = value;
            configStore.SaveConfig(config);
        }
        catch { }
    }

    partial void OnMinimizeToTrayOnCloseChanged(bool value)
    {
        try
        {
            var configStore = new ConfigStore();
            var config = configStore.LoadConfig();
            config.MinimizeToTray = value;
            configStore.SaveConfig(config);
        }
        catch { }
    }

    partial void OnStartupDelaySecondsChanged(int value)
    {
        try
        {
            var configStore = new ConfigStore();
            var config = configStore.LoadConfig();
            config.StartupDelaySeconds = value;
            configStore.SaveConfig(config);
        }
        catch { }
    }

    [RelayCommand]
    private async Task InstallDriverAsync()
    {
        try
        {
            var exePath = Environment.ProcessPath;
            if (string.IsNullOrEmpty(exePath)) return;

            var psi = new System.Diagnostics.ProcessStartInfo
            {
                FileName = exePath,
                Arguments = "--install-driver",
                UseShellExecute = true,
                Verb = "runas"
            };

            var proc = System.Diagnostics.Process.Start(psi);
            if (proc != null)
            {
                await proc.WaitForExitAsync();
                IsDriverInstalled = CoreInterception.InterceptionService.IsDriverInstalledStatic;
                if (proc.ExitCode == 0)
                {
                    System.Windows.MessageBox.Show(
                        "Interception driver installed successfully!\n\nA computer reboot is required before device interception becomes active.",
                        "Lionfish", System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Information);
                }
            }
        }
        catch (System.ComponentModel.Win32Exception)
        {
            // User cancelled UAC prompt
        }
        catch (Exception ex)
        {
            System.Windows.MessageBox.Show($"Failed to install driver: {ex.Message}", "Lionfish", System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Error);
        }
    }

    [RelayCommand]
    private async Task UninstallDriverAsync()
    {
        try
        {
            var confirm = System.Windows.MessageBox.Show(
                "Are you sure you want to uninstall the Interception driver?\n\nA reboot will be required after uninstallation.",
                "Lionfish — Uninstall Driver", System.Windows.MessageBoxButton.YesNo, System.Windows.MessageBoxImage.Warning);
            if (confirm != System.Windows.MessageBoxResult.Yes) return;

            var exePath = Environment.ProcessPath;
            if (string.IsNullOrEmpty(exePath)) return;

            var psi = new System.Diagnostics.ProcessStartInfo
            {
                FileName = exePath,
                Arguments = "--uninstall-driver",
                UseShellExecute = true,
                Verb = "runas"
            };

            var proc = System.Diagnostics.Process.Start(psi);
            if (proc != null)
            {
                await proc.WaitForExitAsync();
                IsDriverInstalled = CoreInterception.InterceptionService.IsDriverInstalledStatic;
                if (proc.ExitCode == 0)
                {
                    System.Windows.MessageBox.Show(
                        "Interception driver uninstalled successfully!\n\nPlease reboot your computer to complete removal.",
                        "Lionfish", System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Information);
                }
            }
        }
        catch (System.ComponentModel.Win32Exception)
        {
            // User cancelled UAC
        }
        catch (Exception ex)
        {
            System.Windows.MessageBox.Show($"Failed to uninstall driver: {ex.Message}", "Lionfish", System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Error);
        }
    }

    [RelayCommand]
    private void OpenConfigFolder()
    {
        try
        {
            var folder = Path.GetDirectoryName(ConfigLocation);
            if (!string.IsNullOrEmpty(folder) && Directory.Exists(folder))
            {
                System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
                {
                    FileName = folder,
                    UseShellExecute = true
                });
            }
        }
        catch { }
    }

    [RelayCommand]
    private void OpenExtensionFolder()
    {
        try
        {
            if (Directory.Exists(ExtensionFolderPath))
            {
                System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
                {
                    FileName = ExtensionFolderPath,
                    UseShellExecute = true
                });
            }
        }
        catch { }
    }

    [RelayCommand]
    private void ExportSettings()
    {
    }

    [RelayCommand]
    private void ImportSettings()
    {
    }

    [RelayCommand]
    private void ChangeKillSwitch()
    {
    }

    [RelayCommand]
    public void RefreshConfigOverview(IEnumerable<DeviceInfo>? currentDevices = null)
    {
        try
        {
            var configStore = new ConfigStore();
            var profiles = configStore.GetAllProfiles();
            var config = configStore.LoadConfig();

            // 1. Gather all physical keyboard devices
            var allDevices = new List<DeviceInfo>();
            if (currentDevices != null && currentDevices.Any())
            {
                allDevices.AddRange(currentDevices);
            }
            else
            {
                // Fallback: discover physical devices directly
                try
                {
                    var service = new CoreInterception.InterceptionService();
                    var coreDevices = service.GetAllKeyboardDevices();
                    foreach (var cd in coreDevices)
                    {
                        if (cd.DeviceCategory.Contains("Virtual") || cd.HardwareId.Contains("UVHID"))
                            continue;

                        string icon = cd.IsLaptopKeyboard ? "💻" :
                                      (cd.ConnectionType.Contains("Wireless") ? "📡" : "🔌");

                        bool isMaster = !string.IsNullOrEmpty(config.MasterKeyboardHardwareId)
                            ? cd.HardwareId.Equals(config.MasterKeyboardHardwareId, StringComparison.OrdinalIgnoreCase)
                            : cd.IsLaptopKeyboard;

                        bool isMacroPad = config.RegisteredDevices.Any(r => r.HardwareId.Equals(cd.HardwareId, StringComparison.OrdinalIgnoreCase));

                        allDevices.Add(new DeviceInfo
                        {
                            FriendlyName = cd.FriendlyName,
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
                        });
                    }
                }
                catch { }
            }

            // 2. Build device lookup and custom names
            var deviceLookup = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            foreach (var d in allDevices)
            {
                if (!string.IsNullOrEmpty(d.HardwareId))
                {
                    if (config.CustomDeviceNames.TryGetValue(d.HardwareId, out var customName) && !string.IsNullOrWhiteSpace(customName))
                    {
                        d.FriendlyName = customName;
                    }
                    deviceLookup[d.HardwareId] = d.FriendlyName;
                }
            }
            foreach (var rd in config.RegisteredDevices)
            {
                if (!string.IsNullOrEmpty(rd.HardwareId) && !deviceLookup.ContainsKey(rd.HardwareId))
                {
                    deviceLookup[rd.HardwareId] = rd.FriendlyName;
                }
            }
            foreach (var kvp in config.CustomDeviceNames)
            {
                if (!deviceLookup.ContainsKey(kvp.Key))
                {
                    deviceLookup[kvp.Key] = kvp.Value;
                }
            }

            var newOverviews = new List<DeviceOverviewItem>();
            var processedHwIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            // 3. Add all physical devices (connected)
            foreach (var d in allDevices)
            {
                if (string.IsNullOrEmpty(d.HardwareId) || processedHwIds.Contains(d.HardwareId))
                    continue;

                processedHwIds.Add(d.HardwareId);

                bool isHidden = config.HiddenDeviceHardwareIds.Any(hid => hid.Equals(d.HardwareId, StringComparison.OrdinalIgnoreCase));
                bool isMaster = !string.IsNullOrEmpty(config.MasterKeyboardHardwareId)
                    ? d.HardwareId.Equals(config.MasterKeyboardHardwareId, StringComparison.OrdinalIgnoreCase)
                    : d.IsLaptop;
                bool isMacroPad = config.RegisteredDevices.Any(r => r.HardwareId.Equals(d.HardwareId, StringComparison.OrdinalIgnoreCase));

                // Find matching profile for this device
                var reg = config.RegisteredDevices.FirstOrDefault(r => r.HardwareId.Equals(d.HardwareId, StringComparison.OrdinalIgnoreCase));
                Lionfish.Core.Profiles.Profile? matchingProfile = null;
                if (reg != null && !string.IsNullOrEmpty(reg.ActiveProfileId))
                {
                    matchingProfile = profiles.FirstOrDefault(p => p.Id == reg.ActiveProfileId);
                }
                if (matchingProfile == null)
                {
                    matchingProfile = profiles.FirstOrDefault(p => !string.IsNullOrEmpty(p.DeviceHardwareId) &&
                        p.DeviceHardwareId.Equals(d.HardwareId, StringComparison.OrdinalIgnoreCase));
                }

                var item = new DeviceOverviewItem
                {
                    HardwareId = d.HardwareId,
                    FriendlyName = d.FriendlyName,
                    DeviceCategory = d.DeviceCategory,
                    ConnectionType = d.ConnectionType,
                    CategoryIcon = d.CategoryIcon,
                    IsLaptop = d.IsLaptop,
                    IsMaster = isMaster,
                    IsMacroPad = isMacroPad,
                    IsDeviceHidden = isHidden
                };

                if (matchingProfile != null)
                {
                    item.ProfileName = matchingProfile.Name;
                    item.ProfileId = matchingProfile.Id;
                    foreach (var m in matchingProfile.Mappings)
                    {
                        var appM = KeyMapping.FromCoreMapping(m);
                        item.Mappings.Add(new ConfigMappingItem
                        {
                            KeyName = appM.KeyName,
                            ScanCodeHex = $"0x{appM.ScanCode:X2}{(appM.IsE0 ? " (E0)" : "")}",
                            ActionType = appM.ActionType,
                            ActionSummary = appM.ActionAssignment
                        });
                    }
                }

                newOverviews.Add(item);
            }

            // 4. Add any registered devices that are currently disconnected
            foreach (var rd in config.RegisteredDevices)
            {
                if (string.IsNullOrEmpty(rd.HardwareId) || processedHwIds.Contains(rd.HardwareId))
                    continue;

                processedHwIds.Add(rd.HardwareId);
                bool isHidden = config.HiddenDeviceHardwareIds.Any(hid => hid.Equals(rd.HardwareId, StringComparison.OrdinalIgnoreCase));

                var matchingProfile = profiles.FirstOrDefault(p =>
                    (!string.IsNullOrEmpty(rd.ActiveProfileId) && p.Id == rd.ActiveProfileId) ||
                    (!string.IsNullOrEmpty(p.DeviceHardwareId) && p.DeviceHardwareId.Equals(rd.HardwareId, StringComparison.OrdinalIgnoreCase)));

                var item = new DeviceOverviewItem
                {
                    HardwareId = rd.HardwareId,
                    FriendlyName = rd.FriendlyName + " (Disconnected)",
                    DeviceCategory = "Registered Keypad",
                    ConnectionType = "Disconnected",
                    CategoryIcon = "🔌",
                    IsMacroPad = true,
                    IsDeviceHidden = isHidden
                };

                if (matchingProfile != null)
                {
                    item.ProfileName = matchingProfile.Name;
                    item.ProfileId = matchingProfile.Id;
                    foreach (var m in matchingProfile.Mappings)
                    {
                        var appM = KeyMapping.FromCoreMapping(m);
                        item.Mappings.Add(new ConfigMappingItem
                        {
                            KeyName = appM.KeyName,
                            ScanCodeHex = $"0x{appM.ScanCode:X2}{(appM.IsE0 ? " (E0)" : "")}",
                            ActionType = appM.ActionType,
                            ActionSummary = appM.ActionAssignment
                        });
                    }
                }

                newOverviews.Add(item);
            }

            // 5. Add global profiles
            foreach (var p in profiles)
            {
                if (string.IsNullOrEmpty(p.DeviceHardwareId) || p.DeviceHardwareId == "All Keyboards")
                {
                    var globalItem = new DeviceOverviewItem
                    {
                        HardwareId = "(Global Profile)",
                        FriendlyName = $"Global Profile: {p.Name}",
                        DeviceCategory = "Configuration Profile",
                        ConnectionType = "All Keyboards",
                        CategoryIcon = "🌐",
                        IsGlobalProfile = true,
                        ProfileName = p.Name,
                        ProfileId = p.Id
                    };

                    foreach (var m in p.Mappings)
                    {
                        var appM = KeyMapping.FromCoreMapping(m);
                        globalItem.Mappings.Add(new ConfigMappingItem
                        {
                            KeyName = appM.KeyName,
                            ScanCodeHex = $"0x{appM.ScanCode:X2}{(appM.IsE0 ? " (E0)" : "")}",
                            ActionType = appM.ActionType,
                            ActionSummary = appM.ActionAssignment
                        });
                    }

                    newOverviews.Add(globalItem);
                }
            }

            // 6. Sort logically: Active Keypads first, then Inactive Keyboards, then Master, then Hidden, then Global profiles
            var sorted = newOverviews
                .OrderByDescending(o => o.IsMacroPad && !o.IsDeviceHidden)
                .ThenByDescending(o => !o.IsMaster && !o.IsDeviceHidden && !o.IsGlobalProfile)
                .ThenByDescending(o => o.IsMaster && !o.IsDeviceHidden)
                .ThenByDescending(o => o.IsDeviceHidden)
                .ThenBy(o => o.IsGlobalProfile)
                .ThenBy(o => o.FriendlyName)
                .ToList();

            var prevHwId = SelectedDeviceOverview?.HardwareId;
            var prevProfileId = SelectedDeviceOverview?.ProfileId;

            DeviceOverviews.Clear();
            foreach (var ov in sorted)
            {
                DeviceOverviews.Add(ov);
            }

            if (!string.IsNullOrEmpty(prevHwId))
            {
                SelectedDeviceOverview = DeviceOverviews.FirstOrDefault(o => o.HardwareId.Equals(prevHwId, StringComparison.OrdinalIgnoreCase));
            }
            if (SelectedDeviceOverview == null && !string.IsNullOrEmpty(prevProfileId))
            {
                SelectedDeviceOverview = DeviceOverviews.FirstOrDefault(o => o.ProfileId == prevProfileId);
            }
            if (SelectedDeviceOverview == null && DeviceOverviews.Count > 0)
            {
                SelectedDeviceOverview = DeviceOverviews.FirstOrDefault(d => d.IsMacroPad) ?? DeviceOverviews[0];
            }

            // Populate Hidden Devices list
            RefreshHiddenDevicesList(config, deviceLookup);
        }
        catch { }
    }

    [RelayCommand]
    private void ToggleHideCurrentDevice()
    {
        if (SelectedDeviceOverview == null || !SelectedDeviceOverview.CanHide)
            return;

        string hwId = SelectedDeviceOverview.HardwareId;
        var configStore = new ConfigStore();
        var config = configStore.LoadConfig();

        bool currentlyHidden = config.HiddenDeviceHardwareIds.Any(id => id.Equals(hwId, StringComparison.OrdinalIgnoreCase));
        if (currentlyHidden)
        {
            config.HiddenDeviceHardwareIds.RemoveAll(id => id.Equals(hwId, StringComparison.OrdinalIgnoreCase));
            SelectedDeviceOverview.IsDeviceHidden = false;
        }
        else
        {
            config.HiddenDeviceHardwareIds.Add(hwId);
            SelectedDeviceOverview.IsDeviceHidden = true;
        }

        configStore.SaveConfig(config);

        SelectedDeviceOverview.NotifyChanged();

        RefreshHiddenDevicesList(config);
        DeviceVisibilityChanged?.Invoke();
    }

    [RelayCommand]
    private void UnhideDevice(string? hardwareId)
    {
        if (string.IsNullOrEmpty(hardwareId)) return;

        var configStore = new ConfigStore();
        var config = configStore.LoadConfig();
        config.HiddenDeviceHardwareIds.RemoveAll(id => id.Equals(hardwareId, StringComparison.OrdinalIgnoreCase));
        configStore.SaveConfig(config);

        foreach (var ov in DeviceOverviews)
        {
            if (ov.HardwareId.Equals(hardwareId, StringComparison.OrdinalIgnoreCase))
            {
                ov.IsDeviceHidden = false;
                ov.NotifyChanged();
            }
        }

        RefreshHiddenDevicesList(config);
        DeviceVisibilityChanged?.Invoke();
    }

    private void RefreshHiddenDevicesList(Lionfish.Core.Config.AppConfig config, Dictionary<string, string>? deviceLookup = null)
    {
        deviceLookup ??= new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var d in DeviceOverviews)
        {
            if (!string.IsNullOrEmpty(d.HardwareId) && !deviceLookup.ContainsKey(d.HardwareId))
                deviceLookup[d.HardwareId] = d.FriendlyName;
        }
        foreach (var rd in config.RegisteredDevices)
        {
            if (!string.IsNullOrEmpty(rd.HardwareId) && !deviceLookup.ContainsKey(rd.HardwareId))
                deviceLookup[rd.HardwareId] = rd.FriendlyName;
        }
        foreach (var kvp in config.CustomDeviceNames)
        {
            if (!deviceLookup.ContainsKey(kvp.Key))
                deviceLookup[kvp.Key] = kvp.Value;
        }

        HiddenDevices.Clear();
        foreach (var hid in config.HiddenDeviceHardwareIds)
        {
            string name = deviceLookup.TryGetValue(hid, out var fn) ? fn : hid;
            HiddenDevices.Add(new HiddenDeviceItem { HardwareId = hid, FriendlyName = name });
        }
        HasHiddenDevices = HiddenDevices.Count > 0;
    }
}

public partial class DeviceOverviewItem : ObservableObject
{
    public string Id { get; set; } = string.Empty;
    public string HardwareId { get; set; } = string.Empty;
    public string FriendlyName { get; set; } = string.Empty;
    public string DeviceCategory { get; set; } = "USB Keyboard";
    public string ConnectionType { get; set; } = "USB Wired";
    public string CategoryIcon { get; set; } = "⌨";
    public bool IsLaptop { get; set; }
    public bool IsMaster { get; set; }
    public bool IsMacroPad { get; set; }
    public bool IsGlobalProfile { get; set; }

    public bool IsInactive => !IsMacroPad && !IsMaster && !IsGlobalProfile;
    public bool CanHide => !IsGlobalProfile && !string.IsNullOrEmpty(HardwareId);
    public bool ShowEmptyMacroPadNotice => IsMacroPad && !HasMappings;

    [ObservableProperty] private bool _isDeviceHidden;

    partial void OnIsDeviceHiddenChanged(bool value)
    {
        OnPropertyChanged(nameof(DisplayTitle));
    }

    public string? ProfileName { get; set; }
    public string? ProfileId { get; set; }
    public List<ConfigMappingItem> Mappings { get; set; } = new();
    public int MappingsCount => Mappings.Count;
    public bool HasMappings => Mappings.Count > 0;

    public string DisplayTitle
    {
        get
        {
            if (IsGlobalProfile)
                return $"🌐 Global Profile: {ProfileName} ({MappingsCount} mapped)";

            string status;
            if (IsMaster) status = "Master Keyboard";
            else if (IsMacroPad) status = $"Activated Keypad • {MappingsCount} mapped";
            else if (IsDeviceHidden) status = "Hidden from Devices";
            else status = "Inactive (Standard Typing)";

            string icon = CategoryIcon;
            if (IsDeviceHidden) icon = "🚫";
            else if (IsMacroPad) icon = "⚡";
            else if (IsMaster) icon = "🛡️";

            return $"{icon} {FriendlyName} [{status}]";
        }
    }

    public void NotifyChanged()
    {
        OnPropertyChanged(nameof(DisplayTitle));
        OnPropertyChanged(nameof(IsDeviceHidden));
    }
}

public class ConfigProfileOverview : DeviceOverviewItem
{
    public string TargetDeviceName { get => FriendlyName; set => FriendlyName = value; }
    public string TargetDeviceHardwareId { get => HardwareId; set => HardwareId = value; }
    public bool HasTargetDevice => CanHide;
}

public class HiddenDeviceItem : ObservableObject
{
    public string HardwareId { get; set; } = string.Empty;
    public string FriendlyName { get; set; } = string.Empty;
}

public class ConfigMappingItem
{
    public string KeyName { get; set; } = string.Empty;
    public string ScanCodeHex { get; set; } = string.Empty;
    public string ActionType { get; set; } = string.Empty;
    public string ActionSummary { get; set; } = string.Empty;
}
