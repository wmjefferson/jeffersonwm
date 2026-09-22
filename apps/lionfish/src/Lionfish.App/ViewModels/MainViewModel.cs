using System;
using System.Linq;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Lionfish.App.Models;
using Lionfish.Core.Config;
using Lionfish.Core.Interception;
using Lionfish.Core.Mapping;

namespace Lionfish.App.ViewModels;

public partial class MainViewModel : ObservableObject
{
    private readonly ConfigStore _configStore = new();
    private readonly InterceptionService _interceptionService = new();
    private readonly MappingEngine _mappingEngine = new();

    [ObservableProperty] private int _selectedTabIndex;
    [ObservableProperty] private string _statusText = "Ready";
    [ObservableProperty] private InterceptionStatus _interceptionStatus = InterceptionStatus.Active;
    [ObservableProperty] private string _activeProfileName = "Default Profile";
    [ObservableProperty] private int _activeDeviceCount = 0;

    public DevicesViewModel DevicesVM { get; }
    public KeyMapViewModel KeyMapVM { get; }
    public MacroEditorViewModel MacroEditorVM { get; }
    public SettingsViewModel SettingsVM { get; }

    public InterceptionService Interception => _interceptionService;
    public MappingEngine Engine => _mappingEngine;

    public MainViewModel()
    {
        DevicesVM = new DevicesViewModel();
        KeyMapVM = new KeyMapViewModel();
        MacroEditorVM = new MacroEditorViewModel();
        SettingsVM = new SettingsViewModel();

        // 1. Connect KeyMapVM with MappingEngine
        KeyMapVM.SetMappingEngine(_mappingEngine);

        // 2. Wire MappingEngine action execution events to UI status
        _mappingEngine.ActionExecuted += (mapping, action) =>
        {
            System.Windows.Application.Current?.Dispatcher?.Invoke(() =>
            {
                StatusText = $"⚡ Executed [{mapping.KeyName}] → {action.DisplayName}";
            });
        };

        // 3. Wire Interception events
        _interceptionService.KeyIntercepted += (device, e) =>
        {
            // A. Dispatch mapped action
            _mappingEngine.Dispatch(device, e);

            // B. Notify Key Map tab (for Listen mode or live key feedback)
            KeyMapVM.OnKeyIntercepted(device, e);

            // C. Notify Macro Editor tab (if recording)
            MacroEditorVM.OnKeyIntercepted(device, e);
        };

        _interceptionService.KillSwitchActivated += () =>
        {
            System.Windows.Application.Current?.Dispatcher?.Invoke(() =>
            {
                InterceptionStatus = InterceptionStatus.Paused;
                StatusText = "⚠️ PAUSED (Emergency Kill Switch Activated: LCtrl + RCtrl).";
            });
        };

        // 4. Wire Devices changes to Interception service & KeyMap tab
        DevicesVM.DevicesChanged += () =>
        {
            System.Windows.Application.Current?.Dispatcher?.Invoke(() =>
            {
                SyncRegisteredDevicesToInterception();
                KeyMapVM.SyncDevices(DevicesVM.Devices);
                ActiveDeviceCount = DevicesVM.MacroPadCount;
            });
        };

        // 5. Initial sync of registered devices from config
        SyncRegisteredDevicesToInterception();

        // 6. Start Interception capture loop
        if (_interceptionService.IsDriverInstalled)
        {
            _interceptionService.StartCapture();
            InterceptionStatus = InterceptionStatus.Active;
            StatusText = "Active (Interception driver running)";
        }
        else
        {
            InterceptionStatus = InterceptionStatus.DriverNotInstalled;
            StatusText = "Interception driver not installed. Click Settings to install.";
        }
    }

    private void SyncRegisteredDevicesToInterception()
    {
        try
        {
            var config = _configStore.LoadConfig();
            var registeredHwIds = config.RegisteredDevices.Select(r => r.HardwareId).ToList();
            var masterHwId = config.MasterKeyboardHardwareId;

            _interceptionService.SetRegisteredDevices(registeredHwIds, masterHwId);
        }
        catch { }
    }

    partial void OnSelectedTabIndexChanged(int value)
    {
        // When switching to Key Map tab (index 1), refresh devices
        if (value == 1)
        {
            KeyMapVM.SyncDevices(DevicesVM.Devices);
        }
    }

    [RelayCommand]
    private void ResumeInterception()
    {
        if (_interceptionService.IsDriverInstalled && !_interceptionService.IsCapturing)
        {
            _interceptionService.StartCapture();
            InterceptionStatus = InterceptionStatus.Active;
            StatusText = "Active (Interception capture resumed)";
        }
    }

    [RelayCommand]
    private void PauseInterception()
    {
        if (_interceptionService.IsCapturing)
        {
            _interceptionService.StopCapture();
            InterceptionStatus = InterceptionStatus.Paused;
            StatusText = "Paused (Interception capture stopped)";
        }
    }

    public void Shutdown()
    {
        _interceptionService.Dispose();
    }
}
