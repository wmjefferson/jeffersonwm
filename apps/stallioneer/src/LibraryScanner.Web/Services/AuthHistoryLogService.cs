using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace LibraryScanner.Web.Services;

public sealed class AuthHistoryLogService(
    HttpClient httpClient,
    IOptions<CentralAuthOptions> options,
    ILogger<AuthHistoryLogService> logger)
{
    private readonly CentralAuthOptions options = options.Value;

    public async Task LogAsync(
        InventoryAccount account,
        string action,
        object payload,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var target = JsonSerializer.Serialize(payload);
            using var request = new HttpRequestMessage(HttpMethod.Post, $"{NormalizeBaseUrl(options.AuthBaseUrl)}/api/history/log");
            if (!string.IsNullOrWhiteSpace(options.InternalLogToken))
            {
                request.Headers.TryAddWithoutValidation("x-auth-internal-token", options.InternalLogToken);
            }

            request.Content = JsonContent.Create(new
            {
                action,
                site = "stallioneer",
                target,
                userId = account.AuthId,
                username = account.Username
            });

            var response = await httpClient.SendAsync(request, cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("Auth history log failed for {Action}: {StatusCode}", action, response.StatusCode);
            }
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            logger.LogWarning(ex, "Auth history log failed for {Action}.", action);
        }
    }

    private static string NormalizeBaseUrl(string value) =>
        string.IsNullOrWhiteSpace(value) ? "https://auth.jeffersonwm.com" : value.Trim().TrimEnd('/');
}
