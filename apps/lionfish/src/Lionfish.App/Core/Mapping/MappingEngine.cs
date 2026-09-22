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
}
