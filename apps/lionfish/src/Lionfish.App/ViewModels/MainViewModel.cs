using System;
using System.Linq;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Lionfish.App.Models;
using Lionfish.App.Services;
using Lionfish.App.Views;
using Lionfish.Core.Config;
using Lionfish.Core.Interception;
using Lionfish.Core.Mapping;
using Lionfish.Core.Web;

namespace Lionfish.App.ViewModels;

public partial class MainViewModel : ObservableObject
{
    private readonly ConfigStore _configStore = new();
    private readonly InterceptionService _interceptionService = new();
    private readonly MappingEngine _mappingEngine = new();
    private readonly BrowserBridgeService _browserBridge = new();
    private readonly AppFocusWatcher _focusWatcher = new();
    private OsdOverlayWindow? _osdWindow;

    [ObservableProperty] private int _selectedTabIndex;
    [ObservableProperty] private string _statusText = "Ready";
    [ObservableProperty] private InterceptionStatus _interceptionStatus = InterceptionStatus.Active;
    [ObservableProperty] private string _activeProfileName = "Default Profile";
    [ObservableProperty] private int _activeDeviceCount = 0;
    [ObservableProperty] private string _lastActionSummary = "Ready";

    public DevicesViewModel DevicesVM { get; }
    public KeyMapViewModel KeyMapVM { get; }
    public MacroEditorViewModel MacroEditorVM { get; }
    public SettingsViewModel SettingsVM { get; }

    public InterceptionService Interception => _interceptionService;
    public MappingEngine Engine => _mappingEngine;
    public BrowserBridgeService BrowserBridge => _browserBridge;

    public MainViewModel()
    {
        // 0. Start Browser Companion WebSocket bridge
        _browserBridge.Start();
        _browserBridge.ConnectionStateChanged += connected =>
        {
            System.Windows.Application.Current?.Dispatcher?.Invoke(() =>
            {
                StatusText = connected ? "🌐 Browser Companion Extension connected" : "🌐 Browser Extension disconnected";
            });
        };
        _browserBridge.WebClickRecorded += (step, url) =>
        {
            System.Windows.Application.Current?.Dispatcher?.Invoke(() =>
            {
                StatusText = $"🌐 Captured browser click: {step.Description}";
            });
        };
        _browserBridge.RecordingStateChanged += isRec =>
        {
            System.Windows.Application.Current?.Dispatcher?.Invoke(() =>
            {
                StatusText = isRec ? "🔴 Recording clicks from browser..." : "Ready";
            });
        };

        DevicesVM = new DevicesViewModel();
        KeyMapVM = new KeyMapViewModel();
        MacroEditorVM = new MacroEditorViewModel();
        SettingsVM = new SettingsViewModel();

        // 1. Connect KeyMapVM with MappingEngine
        KeyMapVM.SetMappingEngine(_mappingEngine);

        // 2. Wire MappingEngine action execution events to UI status & OSD
        _mappingEngine.ActionExecuted += (mapping, action) =>
        {
            System.Windows.Application.Current?.Dispatcher?.Invoke(() =>
            {
                StatusText = $"⚡ Executed [{mapping.KeyName}] → {action.DisplayName}";
                LastActionSummary = $"[{mapping.KeyName}] → {action.DisplayName}";
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

            // D. Notify Devices tab to identify the activated keypad in blue!
            if (e.IsKeyDown)
            {
                DevicesVM.OnInterceptedKeyInput(device.HardwareId, device.DevicePath, e.KeyName);

                System.Windows.Application.Current?.Dispatcher?.Invoke(() =>
                {
                    var m = KeyMapVM.Mappings.FirstOrDefault(x => x.ScanCode == e.ScanCode && x.IsE0 == e.IsE0);
                    if (m != null)
                    {
                        LastActionSummary = $"[{m.KeyName}] → {m.ActionAssignment}";
                    }
                    else
                    {
                        LastActionSummary = $"[{e.KeyName}] (Unmapped)";
                    }
                });
            }
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
                SettingsVM.RefreshConfigOverview(DevicesVM.AllDiscoveredDevices);
                ActiveDeviceCount = DevicesVM.MacroPadCount;
            });
        };

        // 4b. Wire KeyMap changes to active profile name and settings overview
        KeyMapVM.MappingsChanged += () =>
        {
            System.Windows.Application.Current?.Dispatcher?.Invoke(() =>
            {
                ActiveProfileName = KeyMapVM.SelectedProfile?.Name ?? "Default Profile";
                SettingsVM.RefreshConfigOverview(DevicesVM.AllDiscoveredDevices);
            });
        };

        // 4c. Wire Settings changes (hidden devices) to DevicesVM
        SettingsVM.DeviceVisibilityChanged += () =>
        {
            _ = DevicesVM.RefreshDevicesAsync();
        };

        // 4d. Focus watcher for Auto-Profile Switching
        _focusWatcher.ForegroundAppChanged += (procName, winTitle) =>
        {
            System.Windows.Application.Current?.Dispatcher?.Invoke(() =>
            {
                OnForegroundAppChanged(procName, winTitle);
            });
        };

        SettingsVM.AutoProfileSwitchingChanged += enabled =>
        {
            System.Windows.Application.Current?.Dispatcher?.Invoke(() =>
            {
                if (enabled)
                {
                    _focusWatcher.Start();
                    StatusText = "Automatic Profile Switching: ON";
                }
                else
                {
                    _focusWatcher.Stop();
                    StatusText = "Automatic Profile Switching: OFF";
                }
            });
        };

        SettingsVM.ShowOsdOverlayChanged += enabled =>
        {
            System.Windows.Application.Current?.Dispatcher?.Invoke(() =>
            {
                UpdateOsdVisibility(enabled);
            });
        };

        if (SettingsVM.AutoProfileSwitching)
        {
            _focusWatcher.Start();
        }

        if (SettingsVM.ShowOsdOverlay)
        {
            UpdateOsdVisibility(true);
        }

        // 5. Initial sync of registered devices from config
        SyncRegisteredDevicesToInterception();
        KeyMapVM.SyncDevices(DevicesVM.Devices);
        SettingsVM.RefreshConfigOverview(DevicesVM.AllDiscoveredDevices);

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

    private void OnForegroundAppChanged(string processName, string windowTitle)
    {
        if (!SettingsVM.AutoProfileSwitching) return;
        if (string.IsNullOrWhiteSpace(processName)) return;

        // Find profile whose TargetProcessName matches processName
        var matchedProfile = KeyMapVM.Profiles.FirstOrDefault(p =>
        {
            if (string.IsNullOrWhiteSpace(p.TargetProcessName)) return false;
            var target = p.TargetProcessName.Trim();
            if (target.EndsWith(".exe", StringComparison.OrdinalIgnoreCase))
                target = target[..^4];
            return target.Equals(processName, StringComparison.OrdinalIgnoreCase);
        });

        if (matchedProfile != null)
        {
            if (KeyMapVM.SelectedProfile?.Id != matchedProfile.Id)
            {
                KeyMapVM.SelectedProfile = matchedProfile;
                ActiveProfileName = matchedProfile.Name;
                StatusText = $"🎯 Auto-switched to '{matchedProfile.Name}' ({processName})";
            }
        }
        else
        {
            // If current profile had a specific target, restore the default/unassigned profile
            if (KeyMapVM.SelectedProfile != null && !string.IsNullOrWhiteSpace(KeyMapVM.SelectedProfile.TargetProcessName))
            {
                var defaultProfile = KeyMapVM.Profiles.FirstOrDefault(p => string.IsNullOrWhiteSpace(p.TargetProcessName))
                                    ?? KeyMapVM.Profiles.FirstOrDefault();
                if (defaultProfile != null && KeyMapVM.SelectedProfile.Id != defaultProfile.Id)
                {
                    KeyMapVM.SelectedProfile = defaultProfile;
                    ActiveProfileName = defaultProfile.Name;
                    StatusText = $"Default profile restored ({processName})";
                }
            }
        }
    }

    public void UpdateOsdVisibility(bool show)
    {
        if (show)
        {
            if (_osdWindow == null)
            {
                _osdWindow = new Views.OsdOverlayWindow { DataContext = this };
            }
            _osdWindow.Show();
        }
        else
        {
            _osdWindow?.Hide();
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
        else if (value == 3) // Settings tab
        {
            SettingsVM.RefreshConfigOverview(DevicesVM.AllDiscoveredDevices);
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
        _focusWatcher.Dispose();
        _osdWindow?.Close();
        _osdWindow = null;
        _interceptionService.Dispose();
        _browserBridge.Dispose();
    }
}
