using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Lionfish.App.Models;
using Lionfish.Core.Config;
using Lionfish.Core.Mapping;
using Lionfish.Core.Profiles;
using KeyMapping = Lionfish.App.Models.KeyMapping;
using Profile = Lionfish.App.Models.Profile;

namespace Lionfish.App.ViewModels;

public partial class KeyMapViewModel : ObservableObject
{
    private readonly ConfigStore _configStore = new();
    private MappingEngine? _mappingEngine;

    [ObservableProperty] private ObservableCollection<KeyMapping> _mappings = new();
    [ObservableProperty] private KeyMapping? _selectedMapping;
    [ObservableProperty] private ObservableCollection<Profile> _profiles = new();
    [ObservableProperty] private Profile? _selectedProfile;
    [ObservableProperty] private ObservableCollection<DeviceInfo> _registeredDevices = new();
    [ObservableProperty] private DeviceInfo? _selectedDevice;

    [ObservableProperty] private bool _isEditing;
    [ObservableProperty] private bool _isListeningForKey;
    [ObservableProperty] private string _listenStatusText = string.Empty;

    public List<string> ActionTypes { get; } = new() { "Keystroke", "Text", "Launch", "Media", "Macro" };
    public List<string> MediaCommands { get; } = new() { "PlayPause", "NextTrack", "PrevTrack", "VolumeUp", "VolumeDown", "Mute", "Stop" };

    public List<string> AvailableKeys { get; } = new()
    {
        "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
        "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
        "D0", "D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8", "D9",
        "Enter", "Escape", "Space", "Tab", "Backspace", "Delete", "Insert",
        "Home", "End", "PageUp", "PageDown", "Up", "Down", "Left", "Right",
        "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12",
        "NumPad0", "NumPad1", "NumPad2", "NumPad3", "NumPad4", "NumPad5", "NumPad6", "NumPad7", "NumPad8", "NumPad9",
        "Add", "Subtract", "Multiply", "Divide", "Decimal",
        "VolumeUp", "VolumeDown", "VolumeMute", "MediaPlayPause", "MediaNextTrack", "MediaPrevTrack"
    };

    [ObservableProperty] private ObservableCollection<string> _availableMacros = new();

    public event Action? MappingsChanged;

    public KeyMapViewModel()
    {
        LoadAllProfiles();
    }

    public void SetMappingEngine(MappingEngine engine)
    {
        _mappingEngine = engine;
        SyncCurrentProfileToEngine();
    }

    public void SyncDevices(IEnumerable<DeviceInfo> allDevices)
    {
        var currentSelectedHwId = SelectedDevice?.HardwareId;

        RegisteredDevices.Clear();

        var eligible = allDevices
            .Where(d => !d.IsLaptop)
            .OrderByDescending(d => d.IsMacroPad)
            .ThenBy(d => d.FriendlyName)
            .ToList();

        foreach (var dev in eligible)
        {
            RegisteredDevices.Add(dev);
        }

        if (RegisteredDevices.Count == 0)
        {
            foreach (var dev in allDevices)
            {
                RegisteredDevices.Add(dev);
            }
        }

        if (!string.IsNullOrEmpty(currentSelectedHwId))
        {
            SelectedDevice = RegisteredDevices.FirstOrDefault(d => d.HardwareId.Equals(currentSelectedHwId, StringComparison.OrdinalIgnoreCase));
        }

        if (SelectedDevice == null && RegisteredDevices.Count > 0)
        {
            SelectedDevice = RegisteredDevices.FirstOrDefault(d => d.IsMacroPad) ?? RegisteredDevices[0];
        }

        FilterProfilesForDevice();
    }

    partial void OnSelectedDeviceChanged(DeviceInfo? value)
    {
        FilterProfilesForDevice();
    }

    partial void OnSelectedProfileChanged(Profile? value)
    {
        Mappings.Clear();
        if (value != null)
        {
            foreach (var m in value.Mappings)
            {
                Mappings.Add(m);
            }
        }
        SyncCurrentProfileToEngine();
    }

    private void LoadAllProfiles()
    {
        var coreProfiles = _configStore.GetAllProfiles();
        Profiles.Clear();

        if (coreProfiles.Count == 0)
        {
            // Seed default profiles
            CreateDefaultProfiles();
        }
        else
        {
            foreach (var cp in coreProfiles)
            {
                Profiles.Add(Profile.FromCoreProfile(cp));
            }
        }

        FilterProfilesForDevice();
    }

    private void CreateDefaultProfiles()
    {
        // 1. Default Profile for 8-Button Macro Pad (VID_30FA&PID_1340)
        var p8 = new Profile
        {
            Name = "8-Button Shortcuts",
            DeviceHardwareId = "VID_30FA&PID_1340"
        };
        p8.Mappings.Add(new KeyMapping { ScanCode = 0x1E, KeyName = "Button 1", ActionType = "Keystroke", IsCtrl = true, TargetKey = "C" });
        p8.Mappings.Add(new KeyMapping { ScanCode = 0x1F, KeyName = "Button 2", ActionType = "Keystroke", IsCtrl = true, TargetKey = "V" });
        p8.Mappings.Add(new KeyMapping { ScanCode = 0x20, KeyName = "Button 3", ActionType = "Keystroke", IsCtrl = true, TargetKey = "Z" });
        p8.Mappings.Add(new KeyMapping { ScanCode = 0x21, KeyName = "Button 4", ActionType = "Keystroke", IsCtrl = true, TargetKey = "Y" });
        p8.Mappings.Add(new KeyMapping { ScanCode = 0x22, KeyName = "Button 5", ActionType = "Keystroke", IsWin = true, IsShift = true, TargetKey = "S" });
        p8.Mappings.Add(new KeyMapping { ScanCode = 0x22, IsE0 = true, KeyName = "Button 6", ActionType = "Media", MediaCommand = "PlayPause" });
        p8.Mappings.Add(new KeyMapping { ScanCode = 0x10, IsE0 = true, KeyName = "Button 7", ActionType = "Media", MediaCommand = "PrevTrack" });
        p8.Mappings.Add(new KeyMapping { ScanCode = 0x1C, KeyName = "Button 8 (Large)", ActionType = "Launch", LaunchTarget = "powershell.exe" });
        p8.Mappings.Add(new KeyMapping { ScanCode = 0x2E, IsE0 = true, KeyName = "Rotary Knob (Left)", ActionType = "Media", MediaCommand = "VolumeDown" });
        p8.Mappings.Add(new KeyMapping { ScanCode = 0x30, IsE0 = true, KeyName = "Rotary Knob (Right)", ActionType = "Media", MediaCommand = "VolumeUp" });
        p8.Mappings.Add(new KeyMapping { ScanCode = 0x20, IsE0 = true, KeyName = "Rotary Knob (Press)", ActionType = "Media", MediaCommand = "Mute" });

        foreach (var m in p8.Mappings) m.UpdateActionAssignment();
        _configStore.SaveProfile(p8.ToCoreProfile());
        Profiles.Add(p8);

        // 2. Default Profile for 34-Key Numpad (VID_258E&PID_000F)
        var p34 = new Profile
        {
            Name = "34-Key Productivity",
            DeviceHardwareId = "VID_258E&PID_000F"
        };
        p34.Mappings.Add(new KeyMapping { ScanCode = 0x4F, KeyName = "Numpad 1", ActionType = "Keystroke", IsCtrl = true, TargetKey = "D1" });
        p34.Mappings.Add(new KeyMapping { ScanCode = 0x50, KeyName = "Numpad 2", ActionType = "Keystroke", IsCtrl = true, TargetKey = "D2" });
        p34.Mappings.Add(new KeyMapping { ScanCode = 0x51, KeyName = "Numpad 3", ActionType = "Keystroke", IsCtrl = true, TargetKey = "D3" });
        p34.Mappings.Add(new KeyMapping { ScanCode = 0x1C, IsE0 = true, KeyName = "Numpad Enter", ActionType = "Keystroke", TargetKey = "Enter" });
        p34.Mappings.Add(new KeyMapping { ScanCode = 0x01, KeyName = "Esc", ActionType = "Keystroke", TargetKey = "Escape" });
        p34.Mappings.Add(new KeyMapping { ScanCode = 0x0F, KeyName = "Tab", ActionType = "Keystroke", IsAlt = true, TargetKey = "Tab" });
        p34.Mappings.Add(new KeyMapping { ScanCode = 0x3B, KeyName = "Calculator", ActionType = "Launch", LaunchTarget = "calc.exe" });

        foreach (var m in p34.Mappings) m.UpdateActionAssignment();
        _configStore.SaveProfile(p34.ToCoreProfile());
        Profiles.Add(p34);
    }

    private void FilterProfilesForDevice()
    {
        if (Profiles.Count == 0) return;

        if (SelectedDevice != null)
        {
            var match = Profiles.FirstOrDefault(p =>
                !string.IsNullOrEmpty(p.DeviceHardwareId) &&
                SelectedDevice.HardwareId.Contains(p.DeviceHardwareId, StringComparison.OrdinalIgnoreCase));

            SelectedProfile = match ?? Profiles.FirstOrDefault(p => string.IsNullOrEmpty(p.DeviceHardwareId)) ?? Profiles[0];
        }
        else
        {
            SelectedProfile = Profiles[0];
        }
    }

    public void OnKeyIntercepted(Lionfish.Core.Interception.DeviceInfo device, Lionfish.Core.Interception.InterceptedKeyEventArgs e)
    {
        System.Windows.Application.Current?.Dispatcher?.Invoke(() =>
        {
            if (IsListeningForKey && SelectedMapping != null)
            {
                SelectedMapping.ScanCode = e.ScanCode;
                SelectedMapping.IsE0 = e.IsE0;
                SelectedMapping.KeyName = e.KeyName;
                IsListeningForKey = false;
                ListenStatusText = $"Captured key: [{e.KeyName}] (ScanCode: 0x{e.ScanCode:X2})";
                return;
            }

            // Highlight or select matching mapping if already configured
            var match = Mappings.FirstOrDefault(m => m.ScanCode == e.ScanCode && m.IsE0 == e.IsE0);
            if (match != null)
            {
                SelectedMapping = match;
            }
        });
    }

    [RelayCommand]
    private void AddMapping()
    {
        var newMapping = new KeyMapping
        {
            KeyName = "Press a key...",
            ActionType = "Keystroke",
            TargetKey = "A"
        };
        newMapping.UpdateActionAssignment();

        if (SelectedProfile != null)
        {
            SelectedProfile.Mappings.Add(newMapping);
            Mappings.Add(newMapping);
        }

        SelectedMapping = newMapping;
        IsEditing = true;
        IsListeningForKey = true;
        ListenStatusText = "👉 Press ANY key on your keypad to assign...";
    }

    [RelayCommand]
    private void ListenForKey()
    {
        IsListeningForKey = true;
        ListenStatusText = "👉 Press ANY key on your keypad...";
    }

    [RelayCommand]
    private void RemoveMapping(KeyMapping? mapping)
    {
        if (mapping == null) return;

        Mappings.Remove(mapping);
        SelectedProfile?.Mappings.Remove(mapping);
        SaveCurrentProfile();

        if (SelectedMapping == mapping)
        {
            SelectedMapping = Mappings.FirstOrDefault();
            IsEditing = false;
        }
    }

    [RelayCommand]
    private void EditMapping(KeyMapping? mapping)
    {
        if (mapping == null) return;
        SelectedMapping = mapping;
        IsEditing = true;
        IsListeningForKey = false;
        ListenStatusText = string.Empty;
    }

    [RelayCommand]
    private void SaveMapping()
    {
        if (SelectedMapping != null)
        {
            SelectedMapping.UpdateActionAssignment();
            SaveCurrentProfile();
        }
        IsEditing = false;
        IsListeningForKey = false;
    }

    [RelayCommand]
    private void CancelEdit()
    {
        IsEditing = false;
        IsListeningForKey = false;
    }

    [RelayCommand]
    private void NewProfile()
    {
        string name = $"Profile {Profiles.Count + 1}";
        var p = new Profile
        {
            Name = name,
            DeviceHardwareId = SelectedDevice?.HardwareId
        };
        _configStore.SaveProfile(p.ToCoreProfile());
        Profiles.Add(p);
        SelectedProfile = p;
    }

    [RelayCommand]
    private void DeleteProfile()
    {
        if (SelectedProfile != null && Profiles.Count > 1)
        {
            _configStore.DeleteProfile(SelectedProfile.Id);
            var toRemove = SelectedProfile;
            Profiles.Remove(toRemove);
            SelectedProfile = Profiles[0];
        }
    }

    private void SaveCurrentProfile()
    {
        if (SelectedProfile == null) return;

        SelectedProfile.Mappings.Clear();
        foreach (var m in Mappings)
        {
            SelectedProfile.Mappings.Add(m);
        }

        _configStore.SaveProfile(SelectedProfile.ToCoreProfile());
        SyncCurrentProfileToEngine();
        MappingsChanged?.Invoke();
    }

    private void SyncCurrentProfileToEngine()
    {
        if (_mappingEngine != null && SelectedProfile != null)
        {
            _mappingEngine.LoadProfile(SelectedProfile.ToCoreProfile());
        }
    }
}
