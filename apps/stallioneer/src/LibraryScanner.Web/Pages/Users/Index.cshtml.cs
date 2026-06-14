using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using LibraryScanner.Web.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace LibraryScanner.Web.Pages.Users;

[Authorize]
public class IndexModel(ApplicationDbContext dbContext, IConfiguration configuration, IHostEnvironment environment) : PageModel
{
    public List<UserRow> Users { get; private set; } = [];

    public string? CurrentUserId { get; private set; }

    public UserRow? CurrentUser => Users.FirstOrDefault(user => user.Id == CurrentUserId);

    public int TotalUsers => Users.Count;

    public int ConfirmedUsers => Users.Count(user => user.EmailConfirmed);

    public int NamedUsers => Users.Count(user => !string.IsNullOrWhiteSpace(user.DisplayName));

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

    private async Task LoadPageAsync()
    {
        CurrentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        Users = await LoadUsersAsync();
        Snapshot = await LoadSnapshotAsync();

        Input = new ProfileInput
        {
            DisplayName = CurrentUser?.DisplayName ?? string.Empty
        };
    }

    private async Task<List<UserRow>> LoadUsersAsync()
    {
        return await dbContext.Users
            .AsNoTracking()
            .OrderBy(user => user.UserName)
            .Select(user => new UserRow(
                user.Id,
                user.UserName ?? string.Empty,
                user.DisplayName,
                user.Email,
                user.EmailConfirmed))
            .ToListAsync();
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
        bool EmailConfirmed);

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
