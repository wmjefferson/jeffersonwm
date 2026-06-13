using Microsoft.AspNetCore.Identity;
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

builder.Services.AddDefaultIdentity<ApplicationUser>(options =>
    {
        options.SignIn.RequireConfirmedAccount = false;
        options.User.RequireUniqueEmail = true;
    })
    .AddEntityFrameworkStores<ApplicationDbContext>();
builder.Services.AddHttpClient<IIsbnLookupService, OpenLibraryIsbnLookupService>(client =>
{
    client.BaseAddress = new Uri("https://openlibrary.org/");
    client.DefaultRequestHeaders.UserAgent.ParseAdd("LibraryScanner/0.1");
});
builder.Services.AddRazorPages();

var app = builder.Build();

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
