using System;
using System.Collections.Generic;
using Lionfish.Core.Mapping;

namespace Lionfish.Core.Profiles;

public class Profile
{
    public string Id { get; init; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = "New Profile";
    public string? DeviceHardwareId { get; set; }
    public List<KeyMapping> Mappings { get; set; } = new();
    public DateTime CreatedAt { get; init; } = DateTime.UtcNow;
    public DateTime ModifiedAt { get; set; } = DateTime.UtcNow;
}
