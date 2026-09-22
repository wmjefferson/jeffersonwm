using System.Text.Json.Serialization;

namespace Lionfish.Core.Interception;

/// <summary>
/// Defines the type of keyboard device in Lionfish.
/// </summary>
public enum DeviceType
{
    Unknown,
    MasterKeyboard,
    MacroPad
}

/// <summary>
/// Data model for a discovered keyboard device with rich hardware classification.
/// </summary>
public record DeviceInfo
{
    public int DeviceHandle { get; init; }
    public string HardwareId { get; init; } = string.Empty;
    public string DevicePath { get; init; } = string.Empty;
    public string FriendlyName { get; init; } = string.Empty;
    public string DeviceCategory { get; init; } = string.Empty;
    public string ConnectionType { get; init; } = string.Empty;
    public bool IsLaptopKeyboard { get; init; }
    public List<string> AllDevicePaths { get; init; } = new();
    public bool IsRegistered { get; init; }
    public bool IsMasterKeyboard { get; init; }
    public DeviceType DeviceType { get; init; }
}
