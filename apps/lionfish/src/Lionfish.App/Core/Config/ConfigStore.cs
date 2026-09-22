using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using Lionfish.Core.Profiles;

namespace Lionfish.Core.Config;

public class ConfigStore
{
    private readonly string _configDir;
    private readonly string _profilesDir;
    private readonly string _configFile;
    
    private readonly JsonSerializerOptions _options = new()
    {
        WriteIndented = true,
        PropertyNameCaseInsensitive = true
    };

    public ConfigStore()
    {
        _configDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Lionfish");
        _profilesDir = Path.Combine(_configDir, "profiles");
        _configFile = Path.Combine(_configDir, "config.json");

        Directory.CreateDirectory(_configDir);
        Directory.CreateDirectory(_profilesDir);
    }

    public void SaveConfig(AppConfig config)
    {
        var json = JsonSerializer.Serialize(config, _options);
        File.WriteAllText(_configFile, json);
    }

    public AppConfig LoadConfig()
    {
        if (!File.Exists(_configFile)) return new AppConfig();
        var json = File.ReadAllText(_configFile);
        return JsonSerializer.Deserialize<AppConfig>(json, _options) ?? new AppConfig();
    }

    public void SaveProfile(Profile profile)
    {
        var file = Path.Combine(_profilesDir, $"{profile.Id}.json");
        var json = JsonSerializer.Serialize(profile, _options);
        File.WriteAllText(file, json);
    }

    public Profile? LoadProfile(string id)
    {
        var file = Path.Combine(_profilesDir, $"{id}.json");
        if (!File.Exists(file)) return null;
        var json = File.ReadAllText(file);
        return JsonSerializer.Deserialize<Profile>(json, _options);
    }

    public List<Profile> GetAllProfiles()
    {
        var profiles = new List<Profile>();
        foreach (var file in Directory.GetFiles(_profilesDir, "*.json"))
        {
            var json = File.ReadAllText(file);
            var p = JsonSerializer.Deserialize<Profile>(json, _options);
            if (p != null) profiles.Add(p);
        }
        return profiles;
    }

    public void DeleteProfile(string id)
    {
        var file = Path.Combine(_profilesDir, $"{id}.json");
        if (File.Exists(file))
        {
            File.Delete(file);
        }
    }
}
