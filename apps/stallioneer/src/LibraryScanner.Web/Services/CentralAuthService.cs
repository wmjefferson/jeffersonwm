using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using System.Text.Json;

namespace LibraryScanner.Web.Services;

public sealed class CentralAuthService(
    HttpClient httpClient,
    IMemoryCache cache,
    IOptions<CentralAuthOptions> options,
    ILogger<CentralAuthService> logger)
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    private readonly CentralAuthOptions options = options.Value;

    public string AuthBaseUrl => NormalizeBaseUrl(options.AuthBaseUrl);

    public string AppKey => options.AppKey;

    public async Task<CentralAuthStatus> GetStatusAsync(HttpContext httpContext, CancellationToken cancellationToken = default)
    {
        var cookieHeader = httpContext.Request.Headers.Cookie.ToString();
        var cacheKey = $"central-auth:{cookieHeader.GetHashCode(StringComparison.Ordinal)}";
        if (cache.TryGetValue(cacheKey, out CentralAuthStatus? cached) && cached is not null)
        {
            return cached;
        }

        var status = await FetchStatusAsync(cookieHeader, cancellationToken);
        status.HasAccess = UserHasAccess(status.User);
        cache.Set(cacheKey, status, TimeSpan.FromSeconds(10));
        return status;
    }

    public bool UserHasAccess(CentralAuthUser? user)
    {
        if (user is null || !user.IsApproved || user.IsBlocked || user.IsDeleted)
        {
            return false;
        }

        if (user.IsOwner || user.IsAdmin || !options.RequireAppAccess)
        {
            return true;
        }

        return user.Memberships.Any(membership =>
            string.Equals(membership, options.AppKey, StringComparison.OrdinalIgnoreCase));
    }

    public string BuildAuthHomeUrl(HttpRequest request, bool popup = false)
    {
        var authUrl = new UriBuilder($"{AuthBaseUrl}/home");
        var returnTo = Uri.EscapeDataString($"{request.Scheme}://{request.Host}{request.PathBase}{request.Path}{request.QueryString}");
        authUrl.Query = popup ? $"returnTo={returnTo}&popup=1" : $"returnTo={returnTo}";
        return authUrl.Uri.ToString();
    }

    private async Task<CentralAuthStatus> FetchStatusAsync(string cookieHeader, CancellationToken cancellationToken)
    {
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, $"{AuthBaseUrl}/api/auth/status");
            if (!string.IsNullOrWhiteSpace(cookieHeader))
            {
                request.Headers.TryAddWithoutValidation("Cookie", cookieHeader);
            }

            using var response = await httpClient.SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                return new CentralAuthStatus();
            }

            var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            return await JsonSerializer.DeserializeAsync<CentralAuthStatus>(stream, JsonOptions, cancellationToken)
                ?? new CentralAuthStatus();
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            logger.LogWarning(ex, "Central Auth status lookup failed.");
            return new CentralAuthStatus();
        }
    }

    private static string NormalizeBaseUrl(string value) =>
        string.IsNullOrWhiteSpace(value) ? "https://auth.jeffersonwm.com" : value.Trim().TrimEnd('/');
}
