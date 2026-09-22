using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Lionfish.App.Services;
using Lionfish.Core.Config;

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
        }
        catch { }
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

    [RelayCommand]
    private async Task InstallDriverAsync()
    {
        await Task.Delay(1000);
        IsDriverInstalled = true;
    }

    [RelayCommand]
    private async Task UninstallDriverAsync()
    {
        await Task.Delay(1000);
        IsDriverInstalled = false;
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
}
