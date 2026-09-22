using System.Security.Claims;
using System.Text.Encodings.Web;
using LibraryScanner.Web.Models;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

namespace LibraryScanner.Web.Services;

public sealed class CentralAuthHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder,
    CentralAuthService centralAuthService)
    : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var status = await centralAuthService.GetStatusAsync(Context, Context.RequestAborted);
        if (status.User is null)
        {
            return AuthenticateResult.NoResult();
        }

        if (!status.HasAccess)
        {
            return AuthenticateResult.Fail("The signed-in account does not have Stallioneer access.");
        }

        var user = status.User;
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id),
            new(ClaimTypes.Name, user.DisplayName ?? user.Username),
            new("username", user.Username),
            new("display_name", user.DisplayName ?? string.Empty),
            new("central_auth_provider", "jeffersonwm"),
            new(ClaimTypes.Role, AppRoles.User)
        };

        if (user.IsAdmin || user.IsOwner)
        {
            claims.Add(new Claim(ClaimTypes.Role, AppRoles.Admin));
        }

        if (user.IsOwner)
        {
            claims.Add(new Claim("account_type", "owner"));
        }
        else if (user.IsAdmin)
        {
            claims.Add(new Claim("account_type", "admin"));
        }
        else
        {
            claims.Add(new Claim("account_type", "user"));
        }

        var identity = new ClaimsIdentity(claims, Scheme.Name);
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, Scheme.Name);
        return AuthenticateResult.Success(ticket);
    }

    protected override Task HandleChallengeAsync(AuthenticationProperties properties)
    {
        if (Request.Path.StartsWithSegments("/api"))
        {
            Response.StatusCode = StatusCodes.Status401Unauthorized;
            return Task.CompletedTask;
        }

        Response.Redirect(centralAuthService.BuildAuthHomeUrl(Request));
        return Task.CompletedTask;
    }
}
