using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using LibraryScanner.Web.Data;
using LibraryScanner.Web.Models;
using LibraryScanner.Web.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection") ?? throw new InvalidOperationException("Connection string 'DefaultConnection' not found.");
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlite(connectionString));
builder.Services.AddDatabaseDeveloperPageExceptionFilter();
builder.Services.AddMemoryCache();

builder.Services.AddDefaultIdentity<ApplicationUser>(options =>
    {
        options.SignIn.RequireConfirmedAccount = false;
        options.User.RequireUniqueEmail = true;
    })
    .AddRoles<IdentityRole>()
    .AddEntityFrameworkStores<ApplicationDbContext>();
builder.Services.AddHttpClient<IIsbnLookupService, OpenLibraryIsbnLookupService>(client =>
{
    client.BaseAddress = new Uri("https://openlibrary.org/");
    client.DefaultRequestHeaders.UserAgent.ParseAdd("LibraryScanner/0.1");
});
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders =
        ForwardedHeaders.XForwardedFor |
        ForwardedHeaders.XForwardedProto |
        ForwardedHeaders.XForwardedHost;

    // Cloudflare Tunnel forwards proxy headers from a local loopback origin,
    // so we accept forwarded values without pinning a specific upstream address here.
    options.KnownIPNetworks.Clear();
    options.KnownProxies.Clear();
});
builder.Services.AddRazorPages();

var app = builder.Build();

await EnsureIdentityBootstrapAsync(app.Services);

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseMigrationsEndPoint();
}
else
{
    app.UseExceptionHandler("/Error");
    // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
    app.UseHsts();
}

app.UseForwardedHeaders();
app.UseHttpsRedirection();

app.UseRouting();

app.UseAuthentication();
app.UseAuthorization();

app.MapStaticAssets();
app.MapRazorPages()
   .WithStaticAssets();

app.MapGet("/api/isbn/{isbn}", async (string isbn, IIsbnLookupService lookupService, CancellationToken cancellationToken) =>
{
    var result = await lookupService.LookupAsync(isbn, cancellationToken);
    return result.Status switch
    {
        BookLookupStatus.Success => Results.Ok(result),
        BookLookupStatus.InvalidCode => Results.BadRequest(result),
        BookLookupStatus.Ambiguous => Results.Conflict(result),
        _ => Results.NotFound(result)
    };
}).RequireAuthorization();

app.Run();

static async Task EnsureIdentityBootstrapAsync(IServiceProvider services)
{
    using var scope = services.CreateScope();
    var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
    var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();

    foreach (var roleName in new[] { AppRoles.Admin, AppRoles.User })
    {
        if (!await roleManager.RoleExistsAsync(roleName))
        {
            await roleManager.CreateAsync(new IdentityRole(roleName));
        }
    }

    var users = userManager.Users.ToList();
    foreach (var user in users)
    {
        var roles = await userManager.GetRolesAsync(user);
        if (!roles.Contains(AppRoles.User))
        {
            await userManager.AddToRoleAsync(user, AppRoles.User);
        }
    }

    var adminUser = await userManager.FindByNameAsync("jefferson");
    if (adminUser is not null && !await userManager.IsInRoleAsync(adminUser, AppRoles.Admin))
    {
        await userManager.AddToRoleAsync(adminUser, AppRoles.Admin);
    }
}
