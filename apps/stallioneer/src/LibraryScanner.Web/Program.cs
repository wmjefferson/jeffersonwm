using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Authentication;
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
builder.Services.Configure<CentralAuthOptions>(builder.Configuration.GetSection(CentralAuthOptions.SectionName));
builder.Services.PostConfigure<CentralAuthOptions>(options =>
{
    options.AuthBaseUrl =
        builder.Configuration["STALLIONEER_AUTH_BASE_URL"] ??
        builder.Configuration["AUTH_BASE_URL"] ??
        options.AuthBaseUrl;
    options.AppKey =
        builder.Configuration["STALLIONEER_APP_KEY"] ??
        options.AppKey;
    options.RequireAppAccess =
        bool.TryParse(builder.Configuration["STALLIONEER_REQUIRE_APP_ACCESS"], out var requireAppAccess)
            ? requireAppAccess
            : options.RequireAppAccess;
    options.InternalLogToken =
        builder.Configuration["STALLIONEER_AUTH_INTERNAL_LOG_TOKEN"] ??
        builder.Configuration["AUTH_INTERNAL_LOG_TOKEN"] ??
        options.InternalLogToken;
});
builder.Services.Configure<LookupProviderOptions>(options =>
{
    options.IsbnDbApiKey =
        builder.Configuration["STALLIONEER_ISBNDB_API_KEY"] ??
        builder.Configuration["LookupProviders:IsbnDbApiKey"];
});

builder.Services.AddDefaultIdentity<ApplicationUser>(options =>
    {
        options.SignIn.RequireConfirmedAccount = false;
        options.User.RequireUniqueEmail = true;
    })
    .AddRoles<IdentityRole>()
    .AddEntityFrameworkStores<ApplicationDbContext>();
builder.Services.AddAuthentication(options =>
    {
        options.DefaultAuthenticateScheme = CentralAuthDefaults.AuthenticationScheme;
        options.DefaultChallengeScheme = CentralAuthDefaults.AuthenticationScheme;
    })
    .AddScheme<AuthenticationSchemeOptions, CentralAuthHandler>(CentralAuthDefaults.AuthenticationScheme, _ => { });
builder.Services.AddHttpClient<CentralAuthService>();
builder.Services.AddScoped<InventoryAccessService>();
builder.Services.AddHttpClient<AuthHistoryLogService>();
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

await EnsureAccountScopedInventorySchemaAsync(app.Services);
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
app.UseStatusCodePages(async context =>
{
    var httpContext = context.HttpContext;
    if (httpContext.Response.StatusCode == StatusCodes.Status404NotFound &&
        HttpMethods.IsGet(httpContext.Request.Method) &&
        !httpContext.Request.Path.StartsWithSegments("/api"))
    {
        httpContext.Response.Redirect("/");
    }

    await Task.CompletedTask;
});

app.UseRouting();

app.UseAuthentication();
app.UseAuthorization();

app.MapStaticAssets();
// Historical note: the former Bulk page was removed during development; Inventory now owns selection workflows.
app.MapRazorPages()
   .WithStaticAssets();

app.MapGet("/api/auth/status", async (HttpContext httpContext, CentralAuthService centralAuthService) =>
{
    var status = await centralAuthService.GetStatusAsync(httpContext, httpContext.RequestAborted);
    return Results.Ok(new
    {
        ok = true,
        user = status.HasAccess ? status.User : null,
        hasAccess = status.HasAccess,
        appKey = centralAuthService.AppKey,
        authBaseUrl = centralAuthService.AuthBaseUrl
    });
});

app.MapGet("/api/isbn/{isbn}", async (string isbn, HttpContext httpContext, IIsbnLookupService lookupService, CancellationToken cancellationToken) =>
{
    var providerValue = httpContext.Request.Query["provider"].ToString();
    var provider = Enum.TryParse<LookupProviderPreference>(providerValue, true, out var parsedProvider)
        ? parsedProvider
        : LookupProviderPreference.OpenLibrary;
    var result = await lookupService.LookupAsync(isbn, provider, cancellationToken);
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

static async Task EnsureAccountScopedInventorySchemaAsync(IServiceProvider services)
{
    using var scope = services.CreateScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    var connection = dbContext.Database.GetDbConnection();
    await connection.OpenAsync();

    try
    {
        async Task<bool> HasColumnAsync(string tableName, string columnName)
        {
            await using var command = connection.CreateCommand();
            command.CommandText = $"""PRAGMA table_info("{tableName}")""";
            await using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                if (string.Equals(Convert.ToString(reader["name"]), columnName, StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }
            }

            return false;
        }

        async Task AddOwnerColumnsAsync(string tableName)
        {
            if (!await HasColumnAsync(tableName, "OwnerAuthId"))
            {
                var sql = tableName switch
                {
                    "Books" => """ALTER TABLE "Books" ADD COLUMN "OwnerAuthId" TEXT NOT NULL DEFAULT 'wm';""",
                    "Tags" => """ALTER TABLE "Tags" ADD COLUMN "OwnerAuthId" TEXT NOT NULL DEFAULT 'wm';""",
                    "Locations" => """ALTER TABLE "Locations" ADD COLUMN "OwnerAuthId" TEXT NOT NULL DEFAULT 'wm';""",
                    "Collections" => """ALTER TABLE "Collections" ADD COLUMN "OwnerAuthId" TEXT NOT NULL DEFAULT 'wm';""",
                    _ => throw new InvalidOperationException($"Unsupported inventory table: {tableName}")
                };
                await dbContext.Database.ExecuteSqlRawAsync(sql);
            }

            if (!await HasColumnAsync(tableName, "OwnerUsername"))
            {
                var sql = tableName switch
                {
                    "Books" => """ALTER TABLE "Books" ADD COLUMN "OwnerUsername" TEXT NOT NULL DEFAULT 'wm';""",
                    "Tags" => """ALTER TABLE "Tags" ADD COLUMN "OwnerUsername" TEXT NOT NULL DEFAULT 'wm';""",
                    "Locations" => """ALTER TABLE "Locations" ADD COLUMN "OwnerUsername" TEXT NOT NULL DEFAULT 'wm';""",
                    "Collections" => """ALTER TABLE "Collections" ADD COLUMN "OwnerUsername" TEXT NOT NULL DEFAULT 'wm';""",
                    _ => throw new InvalidOperationException($"Unsupported inventory table: {tableName}")
                };
                await dbContext.Database.ExecuteSqlRawAsync(sql);
            }
        }

        await AddOwnerColumnsAsync("Books");
        await AddOwnerColumnsAsync("Tags");
        await AddOwnerColumnsAsync("Locations");
        await AddOwnerColumnsAsync("Collections");

        await dbContext.Database.ExecuteSqlRawAsync("""DROP INDEX IF EXISTS "IX_Books_Isbn13";""");
        await dbContext.Database.ExecuteSqlRawAsync("""DROP INDEX IF EXISTS "IX_BookIdentifiers_Type_NormalizedValue";""");
        await dbContext.Database.ExecuteSqlRawAsync("""DROP INDEX IF EXISTS "IX_Collections_NormalizedName";""");
        await dbContext.Database.ExecuteSqlRawAsync("""DROP INDEX IF EXISTS "IX_Locations_NormalizedName";""");
        await dbContext.Database.ExecuteSqlRawAsync("""DROP INDEX IF EXISTS "IX_Tags_NormalizedName";""");

        await dbContext.Database.ExecuteSqlRawAsync("""
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_Books_OwnerAuthId_Isbn13"
            ON "Books" ("OwnerAuthId", "Isbn13");
            """);
        await dbContext.Database.ExecuteSqlRawAsync("""
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_BookIdentifiers_BookId_Type_NormalizedValue"
            ON "BookIdentifiers" ("BookId", "Type", "NormalizedValue");
            """);
        await dbContext.Database.ExecuteSqlRawAsync("""
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_Collections_OwnerAuthId_NormalizedName"
            ON "Collections" ("OwnerAuthId", "NormalizedName");
            """);
        await dbContext.Database.ExecuteSqlRawAsync("""
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_Locations_OwnerAuthId_NormalizedName"
            ON "Locations" ("OwnerAuthId", "NormalizedName");
            """);
        await dbContext.Database.ExecuteSqlRawAsync("""
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_Tags_OwnerAuthId_NormalizedName"
            ON "Tags" ("OwnerAuthId", "NormalizedName");
            """);
    }
    finally
    {
        await connection.CloseAsync();
    }
}
