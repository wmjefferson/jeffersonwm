using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Threading.Tasks;
using Lionfish.Core.Actions;
using Lionfish.Core.Interception;
using Lionfish.Core.Profiles;

namespace Lionfish.Core.Mapping;

public class MappingEngine
{
    private readonly ConcurrentDictionary<(string HardwareId, ushort ScanCode, bool IsE0), KeyMapping> _lookup = new();

    public event Action<KeyMapping, IAction>? ActionExecuted;

    public void LoadProfile(Profile profile)
    {
        string hwId = profile.DeviceHardwareId ?? string.Empty;

        // Remove old mappings for this device
        var keysToRemove = new List<(string HardwareId, ushort ScanCode, bool IsE0)>();
        foreach (var key in _lookup.Keys)
        {
            if (string.Equals(key.HardwareId, hwId, StringComparison.OrdinalIgnoreCase))
            {
                keysToRemove.Add(key);
            }
        }
        foreach (var key in keysToRemove)
        {
            _lookup.TryRemove(key, out _);
        }

        // Add new mappings
        foreach (var mapping in profile.Mappings)
        {
            _lookup[(hwId, mapping.ScanCode, mapping.IsE0)] = mapping;
        }
    }

    public void LoadProfiles(IEnumerable<Profile> profiles)
    {
        _lookup.Clear();
        foreach (var profile in profiles)
        {
            LoadProfile(profile);
        }
    }

    public void Dispatch(DeviceInfo device, InterceptedKeyEventArgs e)
    {
        // 1. Try matching with exact device hardware ID
        if (!_lookup.TryGetValue((device.HardwareId, e.ScanCode, e.IsE0), out var mapping))
        {
            // 2. Fallback: try matching with generic/wildcard hardware ID
            _lookup.TryGetValue((string.Empty, e.ScanCode, e.IsE0), out mapping);
        }

        if (mapping?.Action == null) return;

        // Check if this action is a modifier-only key (e.g. Ctrl alone, Shift alone, Alt alone, Win alone)
        if (mapping.Action is KeystrokeAction ka && IsModifierOnlyAction(ka))
        {
            HandleModifierKeyDispatch(mapping, ka, e);
            return;
        }

        bool shouldTrigger = (e.IsKeyDown && mapping.Trigger == KeyTrigger.OnKeyDown) ||
                             (!e.IsKeyDown && mapping.Trigger == KeyTrigger.OnKeyUp);

        if (shouldTrigger)
        {
            var action = mapping.Action;
            ActionExecuted?.Invoke(mapping, action);

            Task.Run(async () =>
            {
                try
                {
                    await action.ExecuteAsync();
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"Error executing action for [{mapping.KeyName}]: {ex.Message}");
                }
            });
        }
    }

    private readonly ConcurrentDictionary<string, bool> _activeDownKeys = new();

    private static bool IsModifierOnlyAction(KeystrokeAction ka)
    {
        if (ka.Modifiers != ModifierKeys.None && ka.Key == VirtualKeyCode.None)
            return true;

        if (ka.Key is VirtualKeyCode.Control or VirtualKeyCode.LControl or VirtualKeyCode.RControl or
                      VirtualKeyCode.Shift or VirtualKeyCode.LShift or VirtualKeyCode.RShift or
                      VirtualKeyCode.Alt or VirtualKeyCode.LAlt or VirtualKeyCode.RAlt or
                      VirtualKeyCode.LWin or VirtualKeyCode.RWin)
            return true;

        return false;
    }

    private void HandleModifierKeyDispatch(KeyMapping mapping, KeystrokeAction ka, InterceptedKeyEventArgs e)
    {
        string keyId = $"{mapping.ScanCode}_{mapping.IsE0}";

        if (e.IsKeyDown)
        {
            // Only trigger on initial press, ignore hardware auto-repeats while held
            if (_activeDownKeys.TryAdd(keyId, true))
            {
                ActionExecuted?.Invoke(mapping, ka);

                if (ka.Modifiers != ModifierKeys.None)
                {
                    InputSimulator.SendModifiersDown(ka.Modifiers);
                }
                if (ka.Key != VirtualKeyCode.None)
                {
                    InputSimulator.SendKeyDown(ka.Key);
                }
            }
        }
        else
        {
            // Physical button released: release held modifiers
            if (_activeDownKeys.TryRemove(keyId, out _))
            {
                if (ka.Key != VirtualKeyCode.None)
                {
                    InputSimulator.SendKeyUp(ka.Key);
                }
                if (ka.Modifiers != ModifierKeys.None)
                {
                    InputSimulator.SendModifiersUp(ka.Modifiers);
                }
            }
        }
    }
}
