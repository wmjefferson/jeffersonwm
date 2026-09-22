using System;
using System.Collections.Generic;
using System.Linq;
using CommunityToolkit.Mvvm.ComponentModel;
using Lionfish.Core.Config;

namespace Lionfish.Core.Profiles;

public partial class ProfileManager : ObservableObject
{
    private readonly ConfigStore _configStore;
    private readonly List<Profile> _profiles = new();

    [ObservableProperty]
    private Profile? _activeProfile;

    public ProfileManager(ConfigStore configStore)
    {
        _configStore = configStore;
        _profiles = _configStore.GetAllProfiles();
    }

    public void SwitchProfile(string profileId)
    {
        ActiveProfile = _profiles.FirstOrDefault(p => p.Id == profileId);
    }

    public List<Profile> GetProfilesForDevice(string hardwareId)
    {
        return _profiles.Where(p => p.DeviceHardwareId == hardwareId || p.DeviceHardwareId == null).ToList();
    }
}
