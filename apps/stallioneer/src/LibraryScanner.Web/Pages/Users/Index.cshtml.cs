using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using LibraryScanner.Web.Data;
using LibraryScanner.Web.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace LibraryScanner.Web.Pages.Users;

[Authorize]
public class IndexModel(
    ApplicationDbContext dbContext,
    IConfiguration configuration,
    IHostEnvironment environment,
    UserManager<ApplicationUser> userManager) : PageModel
{
    public List<UserRow> Users { get; private set; } = [];

    public string? CurrentUserId { get; private set; }

    public UserRow? CurrentUser => Users.FirstOrDefault(user => user.Id == CurrentUserId);

    public bool IsAdmin { get; private set; }

    public int TotalUsers => Users.Count;

    public int ConfirmedUsers => Users.Count(user => user.EmailConfirmed);

    public int NamedUsers => Users.Count(user => !string.IsNullOrWhiteSpace(user.DisplayName));

    public int AdminUsers => Users.Count(user => user.IsAdmin);

    public AppSnapshot Snapshot { get; private set; } = new();

    [BindProperty]
    public ProfileInput Input { get; set; } = new();

    [TempData]
    public string? StatusMessage { get; set; }

    public async Task OnGetAsync()
    {
        await LoadPageAsync();
    }

    public async Task<IActionResult> OnPostUpdateProfileAsync()
    {
        CurrentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(CurrentUserId))
        {
            return Challenge();
        }

        var user = await dbContext.Users.FirstOrDefaultAsync(appUser => appUser.Id == CurrentUserId);
        if (user is null)
        {
            return NotFound();
        }

        if (!ModelState.IsValid)
        {
            await LoadPageAsync();
            return Page();
        }

        user.DisplayName = string.IsNullOrWhiteSpace(Input.DisplayName)
            ? null
            : Input.DisplayName.Trim();

        await dbContext.SaveChangesAsync();
        StatusMessage = "Profile updated.";
        return RedirectToPage();
    }

    public async Task<IActionResult> OnPostUpdatePermissionsAsync(string userId, bool isAdmin)
    {
        CurrentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(CurrentUserId))
        {
            return Challenge();
        }

        if (!User.IsInRole(AppRoles.Admin))
        {
            return Forbid();
        }

        var user = await userManager.FindByIdAsync(userId);
        if (user is null)
        {
            return NotFound();
        }

        var currentlyAdmin = await userManager.IsInRoleAsync(user, AppRoles.Admin);
        if (currentlyAdmin == isAdmin)
        {
            return RedirectToPage();
        }

        if (!isAdmin)
        {
            var adminUsers = await userManager.GetUsersInRoleAsync(AppRoles.Admin);
            if (currentlyAdmin && adminUsers.Count <= 1)
            {
                StatusMessage = "Stallioneer must keep at least one admin account.";
                return RedirectToPage();
            }

            await userManager.RemoveFromRoleAsync(user, AppRoles.Admin);
            StatusMessage = $"Removed admin access from {user.UserName}.";
        }
        else
        {
            if (!await userManager.IsInRoleAsync(user, AppRoles.User))
            {
                await userManager.AddToRoleAsync(user, AppRoles.User);
            }

            await userManager.AddToRoleAsync(user, AppRoles.Admin);
            StatusMessage = $"Granted admin access to {user.UserName}.";
        }

        return RedirectToPage();
    }

    private async Task LoadPageAsync()
    {
        CurrentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        Users = await LoadUsersAsync();
        Snapshot = await LoadSnapshotAsync();
        IsAdmin = User.IsInRole(AppRoles.Admin);

        Input = new ProfileInput
        {
            DisplayName = CurrentUser?.DisplayName ?? string.Empty
        };
    }

    private async Task<List<UserRow>> LoadUsersAsync()
    {
        var users = await dbContext.Users
            .AsNoTracking()
            .OrderBy(user => user.UserName)
            .ToListAsync();

        var rows = new List<UserRow>(users.Count);
        foreach (var user in users)
        {
            var roles = await userManager.GetRolesAsync(user);
            rows.Add(new UserRow(
                user.Id,
                user.UserName ?? string.Empty,
                user.DisplayName,
                user.Email,
                user.EmailConfirmed,
                roles.OrderBy(role => role).ToList(),
                roles.Contains(AppRoles.Admin)));
        }

        return rows;
    }

    private async Task<AppSnapshot> LoadSnapshotAsync()
    {
        var connectionString = configuration.GetConnectionString("DefaultConnection") ?? string.Empty;
        var databasePath = ResolveDatabasePath(connectionString);
        var databaseFile = new FileInfo(databasePath);
        var backupDirectory = Path.GetFullPath(Path.Combine(environment.ContentRootPath, "..", "..", "backups"));
        var backupFolder = new DirectoryInfo(backupDirectory);
        var latestBackup = backupFolder.Exists
            ? backupFolder.GetFiles("*.db").OrderByDescending(file => file.LastWriteTimeUtc).FirstOrDefault()
            : null;

        return new AppSnapshot
        {
            DatabasePath = databasePath,
            DatabaseLastUpdated = databaseFile.Exists ? databaseFile.LastWriteTime : null,
            BackupDirectory = backupDirectory,
            LatestBackupName = latestBackup?.Name,
            LatestBackupUpdated = latestBackup?.LastWriteTime,
            TotalBooks = await dbContext.Books.CountAsync(),
            TotalItems = await dbContext.Books.SumAsync(book => (int?)book.Quantity) ?? 0,
            TotalTags = await dbContext.Tags.CountAsync(),
            TotalCollections = await dbContext.Collections.CountAsync(),
            TotalLocations = await dbContext.Locations.CountAsync()
        };
    }

    private string ResolveDatabasePath(string connectionString)
    {
        var builder = new SqliteConnectionStringBuilder(connectionString);
        var dataSource = builder.DataSource;
        if (string.IsNullOrWhiteSpace(dataSource))
        {
            return environment.ContentRootPath;
        }

        return Path.IsPathRooted(dataSource)
            ? dataSource
            : Path.GetFullPath(Path.Combine(environment.ContentRootPath, dataSource));
    }

    public sealed record UserRow(
        string Id,
        string UserName,
        string? DisplayName,
        string? Email,
        bool EmailConfirmed,
        IReadOnlyList<string> Roles,
        bool IsAdmin);

    public sealed class ProfileInput
    {
        [StringLength(80)]
        public string DisplayName { get; set; } = string.Empty;
    }

    public sealed class AppSnapshot
    {
        public string DatabasePath { get; set; } = string.Empty;

        public DateTime? DatabaseLastUpdated { get; set; }

        public string BackupDirectory { get; set; } = string.Empty;

        public string? LatestBackupName { get; set; }

        public DateTime? LatestBackupUpdated { get; set; }

        public int TotalBooks { get; set; }

        public int TotalItems { get; set; }

        public int TotalTags { get; set; }

        public int TotalCollections { get; set; }

        public int TotalLocations { get; set; }
    }
}
