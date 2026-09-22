using System.Collections.Generic;

namespace Lionfish.Core.Config;

public class RegisteredDevice
{
    public string HardwareId { get; set; } = string.Empty;
    public string FriendlyName { get; set; } = string.Empty;
    public string? ActiveProfileId { get; set; }
}

public class AppConfig
{
    public string? MasterKeyboardHardwareId { get; set; }
    public List<RegisteredDevice> RegisteredDevices { get; set; } = new();
    public bool StartWithWindows { get; set; }
    public bool MinimizeToTray { get; set; }
    public bool StartMinimized { get; set; }
    public string KillSwitchCombo { get; set; } = "LCtrl+RCtrl";
    public int StartupDelaySeconds { get; set; } = 3;
    public string? ActiveProfileId { get; set; }
    public Dictionary<string, string> CustomDeviceNames { get; set; } = new();
    public string ThemeMode { get; set; } = "System";
}
