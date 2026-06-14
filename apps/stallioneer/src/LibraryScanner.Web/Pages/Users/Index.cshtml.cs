using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using System.Text;
using LibraryScanner.Web.Data;
using LibraryScanner.Web.Models;
using LibraryScanner.Web.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
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

    public IReadOnlyList<InventoryExportField> ExportFields => InventoryExportField.All;

    [BindProperty]
    public ProfileInput Input { get; set; } = new();

    [BindProperty]
    public IFormFile? ImportFile { get; set; }

    [BindProperty]
    public string ImportMode { get; set; } = ImportModes.MergeUpdate;

    [BindProperty]
    public List<string> PdfFieldKeys { get; set; } = [];

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

    public async Task<IActionResult> OnPostExportAsync()
    {
        var books = await GetInventoryBooksAsync();
        var csv = InventoryCsv.ExportBooks(books);
        var fileName = $"stallioneer-inventory-{DateTime.UtcNow:yyyyMMdd-HHmmss}.csv";
        return File(Encoding.UTF8.GetBytes(csv), "text/csv", fileName);
    }

    public async Task<IActionResult> OnPostExportPdfAsync()
    {
        var fields = InventoryExportField.Select(PdfFieldKeys);
        var books = await GetInventoryBooksAsync();
        var pdf = InventoryPdf.ExportBooks(books, fields);
        var fileName = $"stallioneer-inventory-{DateTime.UtcNow:yyyyMMdd-HHmmss}.pdf";
        return File(pdf, "application/pdf", fileName);
    }

    public async Task<IActionResult> OnPostImportAsync()
    {
        if (ImportFile is null || ImportFile.Length == 0)
        {
            StatusMessage = "Choose a CSV file first.";
            return RedirectToPage();
        }

        using var reader = new StreamReader(ImportFile.OpenReadStream());
        var content = await reader.ReadToEndAsync();
        var rows = InventoryCsv.Parse(content);
        if (rows.Count == 0)
        {
            StatusMessage = "That CSV file did not contain any import rows.";
            return RedirectToPage();
        }

        var result = await ImportInventoryAsync(rows, ImportMode);
        StatusMessage = $"Import complete. Added {result.Added}, updated {result.Updated}, skipped {result.Skipped}.";
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

    private async Task<List<Book>> GetInventoryBooksAsync()
    {
        var books = await dbContext.Books
            .AsNoTracking()
            .Include(book => book.Location)
            .Include(book => book.BookTags)
            .ThenInclude(bookTag => bookTag.Tag)
            .Include(book => book.CollectionBooks)
            .ThenInclude(collectionBook => collectionBook.Collection)
            .OrderBy(book => book.Title)
            .ToListAsync();

        return books
            .OrderBy(book => book.Title)
            .ThenBy(book => book.Authors)
            .ToList();
    }

    private async Task<ImportResult> ImportInventoryAsync(IReadOnlyList<Dictionary<string, string>> rows, string importMode)
    {
        if (importMode == ImportModes.Overwrite)
        {
            await ClearInventoryAsync();
        }

        var importedIsbns = rows
            .Select(row => GetValue(row, InventoryCsv.Isbn13))
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .Select(value => value!.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var existingBooks = await dbContext.Books
            .Include(book => book.Location)
            .Include(book => book.BookTags)
            .ThenInclude(bookTag => bookTag.Tag)
            .Include(book => book.CollectionBooks)
            .ThenInclude(collectionBook => collectionBook.Collection)
            .Where(book => importedIsbns.Contains(book.Isbn13))
            .ToDictionaryAsync(book => book.Isbn13, StringComparer.OrdinalIgnoreCase);

        var locations = await dbContext.Locations.ToDictionaryAsync(location => location.NormalizedName);
        var tags = await dbContext.Tags.ToDictionaryAsync(tag => tag.NormalizedName);
        var collections = await dbContext.Collections.ToDictionaryAsync(collection => collection.NormalizedName);

        var result = new ImportResult();
        var now = DateTimeOffset.UtcNow;
        var seenImportIsbns = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var row in rows)
        {
            var isbn13 = GetValue(row, InventoryCsv.Isbn13)?.Trim();
            if (string.IsNullOrWhiteSpace(isbn13))
            {
                result.Skipped++;
                continue;
            }

            if (!seenImportIsbns.Add(isbn13))
            {
                result.Skipped++;
                continue;
            }

            var title = GetValue(row, InventoryCsv.Title)?.Trim();
            var quantity = ParseOptionalNonNegativeInt(row, InventoryCsv.Quantity);
            var pageCount = ParseOptionalNonNegativeInt(row, InventoryCsv.PageCount);
            if (quantity.IsInvalid || pageCount.IsInvalid)
            {
                result.Skipped++;
                continue;
            }

            var isNew = !existingBooks.TryGetValue(isbn13, out var book);
            if (isNew)
            {
                if (string.IsNullOrWhiteSpace(title))
                {
                    result.Skipped++;
                    continue;
                }

                book = new Book
                {
                    Isbn13 = isbn13,
                    Title = title,
                    MetadataSource = "CSV import",
                    Quantity = 1,
                    CreatedAt = now,
                    UpdatedAt = now
                };
                dbContext.Books.Add(book);
                existingBooks[isbn13] = book;
                result.Added++;
            }
            else
            {
                if (importMode == ImportModes.AppendIgnore)
                {
                    result.Skipped++;
                    continue;
                }

                result.Updated++;
            }

            if (!string.IsNullOrWhiteSpace(title))
            {
                book!.Title = title;
            }

            SetIfPresent(row, InventoryCsv.Isbn10, value => book!.Isbn10 = value);
            SetIfPresent(row, InventoryCsv.Authors, value => book!.Authors = value);
            SetIfPresent(row, InventoryCsv.Publisher, value => book!.Publisher = value);
            SetIfPresent(row, InventoryCsv.PublishedDate, value => book!.PublishedDate = value);
            SetIfPresent(row, InventoryCsv.Language, value => book!.Language = value);
            SetIfPresent(row, InventoryCsv.Notes, value => book!.Notes = value);

            if (quantity.HasValue)
            {
                book!.Quantity = quantity.Value!.Value;
            }

            if (pageCount.HasValue)
            {
                book!.PageCount = pageCount.Value;
            }

            if (TryGetValue(row, InventoryCsv.Location, out var locationValue) && !string.IsNullOrWhiteSpace(locationValue))
            {
                book!.Location = GetOrCreateLocation(locationValue!, locations, now);
            }

            if (TryGetValue(row, InventoryCsv.Tags, out var tagValue))
            {
                ReplaceTags(book!, tagValue, tags, now);
            }

            if (TryGetValue(row, InventoryCsv.Collections, out var collectionValue))
            {
                ReplaceCollections(book!, collectionValue, collections, now);
            }

            SetIfPresent(row, InventoryCsv.Status, value => book!.Status = value);
            book!.UpdatedAt = now;
        }

        await dbContext.SaveChangesAsync();
        return result;
    }

    private async Task ClearInventoryAsync()
    {
        dbContext.CollectionBooks.RemoveRange(dbContext.CollectionBooks);
        dbContext.BookTags.RemoveRange(dbContext.BookTags);
        dbContext.InventoryEvents.RemoveRange(dbContext.InventoryEvents);
        dbContext.Books.RemoveRange(dbContext.Books);
        await dbContext.SaveChangesAsync();
    }

    private Location GetOrCreateLocation(string name, Dictionary<string, Location> locations, DateTimeOffset now)
    {
        var normalized = InventoryText.NormalizeName(name);
        if (locations.TryGetValue(normalized, out var location))
        {
            return location;
        }

        location = new Location
        {
            Name = name.Trim(),
            NormalizedName = normalized,
            CreatedAt = now
        };
        dbContext.Locations.Add(location);
        locations[normalized] = location;
        return location;
    }

    private void ReplaceTags(Book book, string? rawTags, Dictionary<string, Tag> tags, DateTimeOffset now)
    {
        book.BookTags.Clear();

        foreach (var tagName in InventoryText.ParseTags(rawTags))
        {
            var normalized = InventoryText.NormalizeName(tagName);
            if (!tags.TryGetValue(normalized, out var tag))
            {
                tag = new Tag
                {
                    Name = tagName.Trim(),
                    NormalizedName = normalized,
                    Color = InventoryText.DefaultTagColor(tagName),
                    CreatedAt = now
                };
                dbContext.Tags.Add(tag);
                tags[normalized] = tag;
            }

            book.BookTags.Add(new BookTag
            {
                Book = book,
                Tag = tag
            });
        }
    }

    private void ReplaceCollections(Book book, string? rawCollections, Dictionary<string, Collection> collections, DateTimeOffset now)
    {
        book.CollectionBooks.Clear();

        foreach (var collectionName in InventoryText.ParseTags(rawCollections))
        {
            var normalized = InventoryText.NormalizeName(collectionName);
            if (!collections.TryGetValue(normalized, out var collection))
            {
                collection = new Collection
                {
                    Name = collectionName.Trim(),
                    NormalizedName = normalized,
                    CreatedAt = now
                };
                dbContext.Collections.Add(collection);
                collections[normalized] = collection;
            }

            book.CollectionBooks.Add(new CollectionBook
            {
                Book = book,
                Collection = collection
            });
        }
    }

    private static string? GetValue(IReadOnlyDictionary<string, string> row, string key)
    {
        return row.TryGetValue(key, out var value) ? value : null;
    }

    private static bool TryGetValue(IReadOnlyDictionary<string, string> row, string key, out string? value)
    {
        if (row.TryGetValue(key, out var found))
        {
            value = found;
            return true;
        }

        value = null;
        return false;
    }

    private static void SetIfPresent(IReadOnlyDictionary<string, string> row, string key, Action<string> setter)
    {
        if (!TryGetValue(row, key, out var value) || string.IsNullOrWhiteSpace(value))
        {
            return;
        }

        setter(value.Trim());
    }

    private static ImportNumber ParseOptionalNonNegativeInt(IReadOnlyDictionary<string, string> row, string key)
    {
        if (!TryGetValue(row, key, out var value) || string.IsNullOrWhiteSpace(value))
        {
            return ImportNumber.Empty;
        }

        if (int.TryParse(value, out var parsed) && parsed >= 0)
        {
            return new ImportNumber(parsed, false);
        }

        return new ImportNumber(null, true);
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

    private sealed class ImportResult
    {
        public int Added { get; set; }
        public int Updated { get; set; }
        public int Skipped { get; set; }
    }

    private readonly record struct ImportNumber(int? Value, bool IsInvalid)
    {
        public bool HasValue => Value.HasValue;

        public static ImportNumber Empty => new(null, false);
    }

    public static class ImportModes
    {
        public const string MergeUpdate = "merge-update";
        public const string AppendIgnore = "append-ignore";
        public const string Overwrite = "overwrite";
    }
}
