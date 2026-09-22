using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Linq;
using CommunityToolkit.Mvvm.ComponentModel;
using Lionfish.Core.Actions;
using Lionfish.Core.Mapping;
using CoreProfile = Lionfish.Core.Profiles.Profile;
using CoreMapping = Lionfish.Core.Mapping.KeyMapping;
using CoreMacro = Lionfish.Core.Macros.Macro;
using CoreMacroStep = Lionfish.Core.Macros.MacroStep;
using CoreMacrosStepType = Lionfish.Core.Macros.MacroStepType;

namespace Lionfish.App.Models;

public partial class DeviceInfo : ObservableObject
{
    [ObservableProperty] private string _friendlyName = string.Empty;
    [ObservableProperty] private string _hardwareId = string.Empty;
    [ObservableProperty] private string _devicePath = string.Empty;
    [ObservableProperty] private string _deviceCategory = string.Empty;
    [ObservableProperty] private string _connectionType = string.Empty;
    [ObservableProperty] private string _categoryIcon = "⌨";
    [ObservableProperty] private bool _isLaptop;
    [ObservableProperty] private bool _isMaster;
    [ObservableProperty] private bool _isMacroPad;
    [ObservableProperty] private bool _isUnregistered;
    [ObservableProperty] private bool _isHighlighted;
    [ObservableProperty] private string _lastKeyPressed = string.Empty;
    [ObservableProperty] private List<string> _allDevicePaths = new();
    [ObservableProperty] private bool _isRenaming;
    [ObservableProperty] private string _renameText = string.Empty;

    public string DisplayTitle => IsMacroPad ? $"⚡ {FriendlyName}" : FriendlyName;
}

public partial class KeyMapping : ObservableObject
{
    [ObservableProperty] private ushort _scanCode;
    [ObservableProperty] private bool _isE0;
    [ObservableProperty] private string _keyName = string.Empty;
    [ObservableProperty] private string _actionAssignment = "Not assigned";
    [ObservableProperty] private string _actionType = "Keystroke"; // "Keystroke", "Text", "Launch", "Media", "Macro"

    // Keystroke properties
    [ObservableProperty] private bool _isCtrl;
    [ObservableProperty] private bool _isShift;
    [ObservableProperty] private bool _isAlt;
    [ObservableProperty] private bool _isWin;
    [ObservableProperty] private string _targetKey = "C";

    // Text properties
    [ObservableProperty] private string _textValue = string.Empty;
    [ObservableProperty] private int _charDelayMs = 0;

    // Launch properties
    [ObservableProperty] private string _launchTarget = string.Empty;
    [ObservableProperty] private string _launchArgs = string.Empty;
    [ObservableProperty] private bool _runAsAdmin;

    // Media properties
    [ObservableProperty] private string _mediaCommand = "PlayPause";

    // Macro properties
    [ObservableProperty] private string _selectedMacroName = string.Empty;

    public void UpdateActionAssignment()
    {
        ActionAssignment = ActionType switch
        {
            "Keystroke" => BuildKeystrokeSummary(),
            "Text" => string.IsNullOrEmpty(TextValue) ? "Type: (Empty)" : $"Type: {(TextValue.Length > 20 ? TextValue[..17] + "..." : TextValue)}",
            "Launch" => string.IsNullOrEmpty(LaunchTarget) ? "Launch: (Not set)" : $"Launch: {System.IO.Path.GetFileName(LaunchTarget)}",
            "Media" => $"Media: {MediaCommand}",
            "Macro" => string.IsNullOrEmpty(SelectedMacroName) ? "Macro: (None)" : $"Macro: {SelectedMacroName}",
            _ => "Not assigned"
        };
    }

    private string BuildKeystrokeSummary()
    {
        var parts = new List<string>();
        if (IsCtrl) parts.Add("Ctrl");
        if (IsShift) parts.Add("Shift");
        if (IsAlt) parts.Add("Alt");
        if (IsWin) parts.Add("Win");
        if (!string.IsNullOrEmpty(TargetKey)) parts.Add(TargetKey);
        return parts.Count > 0 ? $"Keystroke: {string.Join(" + ", parts)}" : "Keystroke: (None)";
    }

    public CoreMapping ToCoreMapping()
    {
        IAction? action = null;
        try
        {
            action = ActionType switch
            {
                "Keystroke" => new KeystrokeAction
                {
                    Key = Enum.TryParse<VirtualKeyCode>(TargetKey, true, out var vk) ? vk : VirtualKeyCode.None,
                    Modifiers = (IsCtrl ? ModifierKeys.Ctrl : ModifierKeys.None) |
                                (IsShift ? ModifierKeys.Shift : ModifierKeys.None) |
                                (IsAlt ? ModifierKeys.Alt : ModifierKeys.None) |
                                (IsWin ? ModifierKeys.Win : ModifierKeys.None)
                },
                "Text" => new TextTypeAction
                {
                    Text = TextValue,
                    DelayBetweenCharsMs = CharDelayMs
                },
                "Launch" => new LaunchAction
                {
                    Target = LaunchTarget,
                    Arguments = LaunchArgs,
                    RunAsAdmin = RunAsAdmin
                },
                "Media" => new MediaAction
                {
                    Command = Enum.TryParse<Lionfish.Core.Actions.MediaCommand>(MediaCommand, true, out var mc) ? mc : Lionfish.Core.Actions.MediaCommand.PlayPause
                },
                "Macro" => new Lionfish.Core.Macros.MacroAction
                {
                    Macro = new CoreMacro { Name = SelectedMacroName }
                },
                _ => null
            };
        }
        catch { }

        return new CoreMapping
        {
            ScanCode = ScanCode,
            IsE0 = IsE0,
            KeyName = KeyName,
            Trigger = KeyTrigger.OnKeyDown,
            Action = action
        };
    }

    public static KeyMapping FromCoreMapping(CoreMapping core)
    {
        var model = new KeyMapping
        {
            ScanCode = core.ScanCode,
            IsE0 = core.IsE0,
            KeyName = core.KeyName
        };

        if (core.Action is KeystrokeAction ka)
        {
            model.ActionType = "Keystroke";
            model.IsCtrl = ka.Modifiers.HasFlag(ModifierKeys.Ctrl);
            model.IsShift = ka.Modifiers.HasFlag(ModifierKeys.Shift);
            model.IsAlt = ka.Modifiers.HasFlag(ModifierKeys.Alt);
            model.IsWin = ka.Modifiers.HasFlag(ModifierKeys.Win);
            model.TargetKey = ka.Key.ToString();
        }
        else if (core.Action is TextTypeAction ta)
        {
            model.ActionType = "Text";
            model.TextValue = ta.Text;
            model.CharDelayMs = ta.DelayBetweenCharsMs;
        }
        else if (core.Action is LaunchAction la)
        {
            model.ActionType = "Launch";
            model.LaunchTarget = la.Target;
            model.LaunchArgs = la.Arguments ?? "";
            model.RunAsAdmin = la.RunAsAdmin;
        }
        else if (core.Action is MediaAction ma)
        {
            model.ActionType = "Media";
            model.MediaCommand = ma.Command.ToString();
        }
        else if (core.Action is Lionfish.Core.Macros.MacroAction mca)
        {
            model.ActionType = "Macro";
            model.SelectedMacroName = mca.Macro.Name;
        }

        model.UpdateActionAssignment();
        return model;
    }
}

public partial class Profile : ObservableObject
{
    [ObservableProperty] private string _id = Guid.NewGuid().ToString();
    [ObservableProperty] private string _name = "New Profile";
    [ObservableProperty] private string? _deviceHardwareId;
    [ObservableProperty] private ObservableCollection<KeyMapping> _mappings = new();

    public CoreProfile ToCoreProfile()
    {
        return new CoreProfile
        {
            Id = Id,
            Name = Name,
            DeviceHardwareId = DeviceHardwareId,
            Mappings = Mappings.Select(m => m.ToCoreMapping()).ToList(),
            ModifiedAt = DateTime.UtcNow
        };
    }

    public static Profile FromCoreProfile(CoreProfile core)
    {
        var p = new Profile
        {
            Id = core.Id,
            Name = core.Name,
            DeviceHardwareId = core.DeviceHardwareId
        };
        foreach (var m in core.Mappings)
        {
            p.Mappings.Add(KeyMapping.FromCoreMapping(m));
        }
        return p;
    }
}

public enum InterceptionStatus
{
    Active,
    Paused,
    Error,
    DriverNotInstalled
}

public partial class Macro : ObservableObject
{
    [ObservableProperty] private string _id = Guid.NewGuid().ToString();
    [ObservableProperty] private string _name = string.Empty;
    [ObservableProperty] private int _stepCount;
    [ObservableProperty] private int _repeatCount = 1;
    [ObservableProperty] private double _speedMultiplier = 1.0;
    [ObservableProperty] private ObservableCollection<MacroStep> _steps = new();

    public CoreMacro ToCoreMacro()
    {
        return new CoreMacro
        {
            Id = Id,
            Name = Name,
            RepeatCount = RepeatCount,
            SpeedMultiplier = SpeedMultiplier,
            Steps = Steps.Select(s => s.ToCoreMacroStep()).ToList()
        };
    }

    public static Macro FromCoreMacro(CoreMacro core)
    {
        var m = new Macro
        {
            Id = core.Id,
            Name = core.Name,
            RepeatCount = core.RepeatCount,
            SpeedMultiplier = core.SpeedMultiplier,
            StepCount = core.Steps.Count
        };
        foreach (var s in core.Steps)
        {
            m.Steps.Add(MacroStep.FromCoreMacroStep(s));
        }
        return m;
    }
}

public partial class MacroStep : ObservableObject
{
    [ObservableProperty] private string _typeIcon = "⌨";
    [ObservableProperty] private string _description = string.Empty;
    [ObservableProperty] private int _delay;
    [ObservableProperty] private string _stepType = "KeyPress"; // KeyPress, KeyDown, KeyUp, TextType, Delay
    [ObservableProperty] private string _key = "Space";
    [ObservableProperty] private string _text = string.Empty;

    public CoreMacroStep ToCoreMacroStep()
    {
        return new CoreMacroStep
        {
            DelayMs = Delay,
            Description = Description,
            Type = StepType switch
            {
                "KeyDown" => CoreMacrosStepType.KeyDown,
                "KeyUp" => CoreMacrosStepType.KeyUp,
                "TextType" => CoreMacrosStepType.TextType,
                "Delay" => CoreMacrosStepType.Delay,
                _ => CoreMacrosStepType.KeyPress
            },
            Key = Enum.TryParse<VirtualKeyCode>(Key, true, out var vk) ? vk : null,
            Text = Text
        };
    }

    public static MacroStep FromCoreMacroStep(CoreMacroStep core)
    {
        return new MacroStep
        {
            Delay = core.DelayMs,
            Description = core.Description ?? core.Type.ToString(),
            StepType = core.Type.ToString(),
            Key = core.Key?.ToString() ?? "Space",
            Text = core.Text ?? "",
            TypeIcon = core.Type switch
            {
                CoreMacrosStepType.KeyDown => "⬇",
                CoreMacrosStepType.KeyUp => "⬆",
                CoreMacrosStepType.TextType => "🔤",
                CoreMacrosStepType.Delay => "⏱",
                _ => "⚡"
            }
        };
    }
}
