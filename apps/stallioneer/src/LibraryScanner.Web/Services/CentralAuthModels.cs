using System.Text.Json.Serialization;

namespace LibraryScanner.Web.Services;

public sealed class CentralAuthOptions
{
    public const string SectionName = "CentralAuth";

    public string AuthBaseUrl { get; set; } = "https://auth.jeffersonwm.com";

    public string AppKey { get; set; } = "stallioneer";

    public bool RequireAppAccess { get; set; } = true;

    public string? InternalLogToken { get; set; }
}

public sealed class CentralAuthStatus
{
    [JsonPropertyName("ok")]
    public bool Ok { get; set; }

    [JsonPropertyName("user")]
    public CentralAuthUser? User { get; set; }

    [JsonPropertyName("requireAuth")]
    public bool RequireAuth { get; set; }

    [JsonIgnore]
    public bool HasAccess { get; set; }
}

public sealed class CentralAuthUser
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("username")]
    public string Username { get; set; } = string.Empty;

    [JsonPropertyName("displayName")]
    public string? DisplayName { get; set; }

    [JsonPropertyName("isAdmin")]
    public bool IsAdmin { get; set; }

    [JsonPropertyName("isOwner")]
    public bool IsOwner { get; set; }

    [JsonPropertyName("isApproved")]
    public bool IsApproved { get; set; }

    [JsonPropertyName("isBlocked")]
    public bool IsBlocked { get; set; }

    [JsonPropertyName("isDeleted")]
    public bool IsDeleted { get; set; }

    [JsonPropertyName("memberships")]
    public List<string> Memberships { get; set; } = [];
}
