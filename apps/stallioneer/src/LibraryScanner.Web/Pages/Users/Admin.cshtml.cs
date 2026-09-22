using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using System.Text;
using LibraryScanner.Web.Data;
using LibraryScanner.Web.Models;
using LibraryScanner.Web.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace LibraryScanner.Web.Pages.Users;

[Authorize(Roles = AppRoles.Admin)]
public class AdminModel(
    ApplicationDbContext dbContext,
    IConfiguration configuration,
    IHostEnvironment environment,
    InventoryAccessService inventoryAccess,
    AuthHistoryLogService authHistoryLog,
    UserManager<ApplicationUser> userManager) : PageModel
{
    public List<UserRow> Users { get; private set; } = [];

    public string? CurrentUserId { get; private set; }

    public UserRow? CurrentUser => Users.FirstOrDefault(user => user.Id == CurrentUserId);

    public int TotalUsers => Users.Count;

    public int ConfirmedUsers => Users.Count(user => user.EmailConfirmed);

    public int NamedUsers => Users.Count(user => !string.IsNullOrWhiteSpace(user.DisplayName));

    public int AdminUsers => Users.Count(user => user.IsAdmin);

    public AppSnapshot Snapshot { get; private set; } = new();

    public IReadOnlyList<InventoryExportField> ExportFields => InventoryExportField.All;

    public List<TagRow> Tags { get; private set; } = [];

    public List<CollectionRow> Collections { get; private set; } = [];

    public List<LocationRow> Locations { get; private set; } = [];

    [BindProperty]
    public TagInput NewTag { get; set; } = new();

    [BindProperty]
    public CollectionInput NewCollection { get; set; } = new();

    [BindProperty]
    public LocationInput NewLocation { get; set; } = new();

    [BindProperty]
    public List<string> PdfFieldKeys { get; set; } = [];

    [BindProperty]
    [DataType(DataType.Date)]
    public DateOnly? LogStartDate { get; set; }

    [BindProperty]
    [DataType(DataType.Date)]
    public DateOnly? LogEndDate { get; set; }

    [TempData]
    public string? StatusMessage { get; set; }

    public async Task OnGetAsync()
    {
        ApplyDefaultLogRange();
        await LoadPageAsync();
    }

    public async Task<IActionResult> OnPostExportAsync()
    {
        var books = await GetInventoryBooksAsync();
        var csv = InventoryCsv.ExportBooks(books);
        var fileName = $"stallioneer-inventory-{DateTime.UtcNow:yyyyMMdd-HHmmss}.csv";
        await authHistoryLog.LogAsync(inventoryAccess.GetAccount(User), "stallioneer.exported", new
        {
            type = "inventory-csv",
            count = books.Count,
            fileName,
            books = CreateExportElements(books)
        });
        return File(Encoding.UTF8.GetBytes(csv), "text/csv", fileName);
    }

    public async Task<IActionResult> OnPostExportPdfAsync()
    {
        var fields = InventoryExportField.Select(PdfFieldKeys);
        var books = await GetInventoryBooksAsync();
        var pdf = InventoryPdf.ExportBooks(books, fields);
        var fileName = $"stallioneer-inventory-{DateTime.UtcNow:yyyyMMdd-HHmmss}.pdf";
        await authHistoryLog.LogAsync(inventoryAccess.GetAccount(User), "stallioneer.exported", new
        {
            type = "inventory-pdf",
            count = books.Count,
            fields = fields.Select(field => field.Key).ToArray(),
            fileName,
            books = CreateExportElements(books)
        });
        return File(pdf, "application/pdf", fileName);
    }

    public async Task<IActionResult> OnPostExportLogAsync()
    {
        var startDate = LogStartDate ?? DateOnly.FromDateTime(DateTime.Today.AddDays(-29));
        var endDate = LogEndDate ?? DateOnly.FromDateTime(DateTime.Today);
        if (endDate < startDate)
        {
            StatusMessage = "Log export end date must be on or after the start date.";
            return RedirectToPage();
        }

        var start = startDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Local);
        var endExclusive = endDate.AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Local);

        var visibleBookIds = inventoryAccess.ScopeBooks(dbContext.Books, User).Select(book => book.Id);
        var events = await dbContext.InventoryEvents
            .AsNoTracking()
            .Include(inventoryEvent => inventoryEvent.Book)
            .Where(inventoryEvent => visibleBookIds.Contains(inventoryEvent.BookId))
            .Where(inventoryEvent => inventoryEvent.CreatedAt >= start && inventoryEvent.CreatedAt < endExclusive)
            .OrderByDescending(inventoryEvent => inventoryEvent.CreatedAt)
            .ToListAsync();

        var csv = InventoryLogCsv.ExportEvents(events);
        var fileName = $"stallioneer-log-{startDate:yyyyMMdd}-to-{endDate:yyyyMMdd}.csv";
        await authHistoryLog.LogAsync(inventoryAccess.GetAccount(User), "stallioneer.exported", new
        {
            type = "activity-log-csv",
            count = events.Count,
            from = startDate.ToString("yyyy-MM-dd"),
            to = endDate.ToString("yyyy-MM-dd"),
            fileName,
            elements = events.Select(inventoryEvent => new
            {
                inventoryEvent.EventType,
                inventoryEvent.QuantityDelta,
                inventoryEvent.Note,
                inventoryEvent.CreatedAt,
                BookId = inventoryEvent.BookId,
                Title = inventoryEvent.Book?.Title,
                Isbn13 = inventoryEvent.Book?.Isbn13
            }).ToArray()
        });
        return File(Encoding.UTF8.GetBytes(csv), "text/csv", fileName);
    }

    public async Task<IActionResult> OnPostCreateTagAsync()
    {
        var tagDefinitions = InventoryText.ParseTagDefinitions(NewTag.Name);
        if (tagDefinitions.Count == 0)
        {
            ModelState.AddModelError($"{nameof(NewTag)}.{nameof(NewTag.Name)}", "Enter at least one tag name.");
        }

        if (!ModelState.IsValid)
        {
            await LoadPageAsync();
            return Page();
        }

        var normalizedNames = tagDefinitions.Select(definition => InventoryText.NormalizeName(definition.Name)).ToList();
        var account = inventoryAccess.GetAccount(User);
        var existingNames = await inventoryAccess.ScopeTags(dbContext.Tags, User)
            .Where(tag => normalizedNames.Contains(tag.NormalizedName))
            .Select(tag => tag.NormalizedName)
            .ToListAsync();

        var fallbackDescription = string.IsNullOrWhiteSpace(NewTag.Description) ? null : NewTag.Description.Trim();
        var createdCount = 0;

        for (var i = 0; i < tagDefinitions.Count; i++)
        {
            var tagDefinition = tagDefinitions[i];
            var tagName = tagDefinition.Name;
            var normalized = normalizedNames[i];
            if (existingNames.Contains(normalized))
            {
                continue;
            }

            dbContext.Tags.Add(new Tag
            {
                Name = tagName.Trim(),
                NormalizedName = normalized,
                Color = string.IsNullOrWhiteSpace(NewTag.Color) ? InventoryText.DefaultTagColor(tagName) : NewTag.Color,
                Description = tagDefinition.Description ?? fallbackDescription,
                OwnerAuthId = account.AuthId,
                OwnerUsername = account.Username
            });

            createdCount++;
        }

        if (createdCount > 0)
        {
            await dbContext.SaveChangesAsync();
            StatusMessage = createdCount == 1 ? "Created 1 tag." : $"Created {createdCount} tags.";
        }
        else
        {
            StatusMessage = "Those tags already exist.";
        }

        return RedirectToPage();
    }

    public async Task<IActionResult> OnPostUpdateTagAsync(int id, string name, string color, string? description)
    {
        var tag = await inventoryAccess.ScopeTags(dbContext.Tags, User).FirstOrDefaultAsync(tag => tag.Id == id);
        if (tag is null)
        {
            return NotFound();
        }

        if (!string.IsNullOrWhiteSpace(name))
        {
            var trimmedName = name.Trim();
            var normalizedName = InventoryText.NormalizeName(trimmedName);
            var duplicateExists = await inventoryAccess.ScopeTags(dbContext.Tags, User).AnyAsync(other => other.Id != id && other.NormalizedName == normalizedName);
            if (duplicateExists)
            {
                StatusMessage = $"Tag \"{trimmedName}\" already exists.";
                return RedirectToPage();
            }

            tag.Name = trimmedName;
            tag.NormalizedName = normalizedName;
        }

        if (!string.IsNullOrWhiteSpace(color))
        {
            tag.Color = color;
        }

        tag.Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
        await dbContext.SaveChangesAsync();
        StatusMessage = "Tag updated.";
        return RedirectToPage();
    }

    public async Task<IActionResult> OnPostDeleteTagAsync(int id)
    {
        var tag = await inventoryAccess.ScopeTags(dbContext.Tags, User).FirstOrDefaultAsync(tag => tag.Id == id);
        if (tag is null)
        {
            return NotFound();
        }

        dbContext.Tags.Remove(tag);
        await dbContext.SaveChangesAsync();
        StatusMessage = "Tag deleted.";
        return RedirectToPage();
    }

    public async Task<IActionResult> OnPostCreateCollectionAsync()
    {
        if (!TryValidateModel(NewCollection, nameof(NewCollection)))
        {
            await LoadPageAsync();
            return Page();
        }

        var normalized = InventoryText.NormalizeName(NewCollection.Name);
        var account = inventoryAccess.GetAccount(User);
        var exists = await inventoryAccess.ScopeCollections(dbContext.Collections, User).AnyAsync(collection => collection.NormalizedName == normalized);
        if (!exists)
        {
            dbContext.Collections.Add(new Collection
            {
                Name = NewCollection.Name.Trim(),
                NormalizedName = normalized,
                Description = string.IsNullOrWhiteSpace(NewCollection.Description) ? null : NewCollection.Description.Trim(),
                OwnerAuthId = account.AuthId,
                OwnerUsername = account.Username
            });
            await dbContext.SaveChangesAsync();
            StatusMessage = "Collection created.";
        }
        else
        {
            StatusMessage = "That collection already exists.";
        }

        return RedirectToPage();
    }

    public async Task<IActionResult> OnPostUpdateCollectionAsync(int id, string name, string? description)
    {
        var collection = await inventoryAccess.ScopeCollections(dbContext.Collections, User).FirstOrDefaultAsync(item => item.Id == id);
        if (collection is null)
        {
            return NotFound();
        }

        if (!string.IsNullOrWhiteSpace(name))
        {
            var trimmedName = name.Trim();
            var normalized = InventoryText.NormalizeName(trimmedName);
            var duplicateExists = await inventoryAccess.ScopeCollections(dbContext.Collections, User).AnyAsync(other => other.Id != id && other.NormalizedName == normalized);
            if (duplicateExists)
            {
                StatusMessage = $"Collection \"{trimmedName}\" already exists.";
                return RedirectToPage();
            }

            collection.Name = trimmedName;
            collection.NormalizedName = normalized;
        }

        collection.Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
        await dbContext.SaveChangesAsync();
        StatusMessage = "Collection updated.";
        return RedirectToPage();
    }

    public async Task<IActionResult> OnPostDeleteCollectionAsync(int id)
    {
        var collection = await inventoryAccess.ScopeCollections(dbContext.Collections, User).FirstOrDefaultAsync(item => item.Id == id);
        if (collection is null)
        {
            return NotFound();
        }

        dbContext.Collections.Remove(collection);
        await dbContext.SaveChangesAsync();
        StatusMessage = "Collection deleted.";
        return RedirectToPage();
    }

    public async Task<IActionResult> OnPostCreateLocationAsync()
    {
        if (!TryValidateModel(NewLocation, nameof(NewLocation)))
        {
            await LoadPageAsync();
            return Page();
        }

        var normalized = InventoryText.NormalizeName(NewLocation.Name);
        var account = inventoryAccess.GetAccount(User);
        var exists = await inventoryAccess.ScopeLocations(dbContext.Locations, User).AnyAsync(location => location.NormalizedName == normalized);
        if (!exists)
        {
            dbContext.Locations.Add(new Location
            {
                Name = NewLocation.Name.Trim(),
                NormalizedName = normalized,
                Description = string.IsNullOrWhiteSpace(NewLocation.Description) ? null : NewLocation.Description.Trim(),
                OwnerAuthId = account.AuthId,
                OwnerUsername = account.Username
            });
            await dbContext.SaveChangesAsync();
            StatusMessage = "Location created.";
        }
        else
        {
            StatusMessage = "That location already exists.";
        }

        return RedirectToPage();
    }

    public async Task<IActionResult> OnPostUpdateLocationAsync(int id, string name, string? description)
    {
        var location = await inventoryAccess.ScopeLocations(dbContext.Locations, User).FirstOrDefaultAsync(location => location.Id == id);
        if (location is null)
        {
            return NotFound();
        }

        if (!string.IsNullOrWhiteSpace(name))
        {
            var trimmedName = name.Trim();
            var normalized = InventoryText.NormalizeName(trimmedName);
            var duplicateExists = await inventoryAccess.ScopeLocations(dbContext.Locations, User).AnyAsync(other => other.Id != id && other.NormalizedName == normalized);
            if (duplicateExists)
            {
                StatusMessage = $"Location \"{trimmedName}\" already exists.";
                return RedirectToPage();
            }

            location.Name = trimmedName;
            location.NormalizedName = normalized;
        }

        location.Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
        await dbContext.SaveChangesAsync();
        StatusMessage = "Location updated.";
        return RedirectToPage();
    }

    public async Task<IActionResult> OnPostDeleteLocationAsync(int id)
    {
        var location = await inventoryAccess.ScopeLocations(dbContext.Locations, User)
            .Include(location => location.Books)
            .Include(location => location.Copies)
            .FirstOrDefaultAsync(location => location.Id == id);
        if (location is null)
        {
            return NotFound();
        }

        foreach (var book in location.Books)
        {
            book.LocationId = null;
        }

        foreach (var copy in location.Copies)
        {
            copy.LocationId = null;
        }

        dbContext.Locations.Remove(location);
        await dbContext.SaveChangesAsync();
        StatusMessage = "Location deleted.";
        return RedirectToPage();
    }

    private async Task LoadPageAsync()
    {
        CurrentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        Users = await LoadUsersAsync();
        Snapshot = await LoadSnapshotAsync();
        await LoadInventoryControlsAsync();
    }

    private void ApplyDefaultLogRange()
    {
        LogEndDate ??= DateOnly.FromDateTime(DateTime.Today);
        LogStartDate ??= DateOnly.FromDateTime(DateTime.Today.AddDays(-29));
    }

    private async Task<List<Book>> GetInventoryBooksAsync()
    {
        var books = await inventoryAccess.ScopeBooks(dbContext.Books, User)
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

    private static object[] CreateExportElements(IEnumerable<Book> books)
    {
        return books
            .Select(book => new
            {
                book.Id,
                book.Title,
                book.Authors,
                book.Publisher,
                book.PublishedDate,
                book.Isbn13,
                book.Isbn10,
                Quantity = book.EffectiveQuantity,
                book.Status,
                Location = book.Location?.Name,
                Tags = book.BookTags
                    .OrderBy(bookTag => bookTag.Tag.Name)
                    .Select(bookTag => bookTag.Tag.Name)
                    .ToArray(),
                Collections = book.CollectionBooks
                    .OrderBy(collectionBook => collectionBook.Collection.Name)
                    .Select(collectionBook => collectionBook.Collection.Name)
                    .ToArray()
            })
            .Cast<object>()
            .ToArray();
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

    private async Task LoadInventoryControlsAsync()
    {
        var visibleBookIds = inventoryAccess.ScopeBooks(dbContext.Books, User).Select(book => book.Id);

        Tags = await inventoryAccess.ScopeTags(dbContext.Tags, User)
            .AsNoTracking()
            .OrderBy(tag => tag.Name)
            .Select(tag => new TagRow(
                tag.Id,
                tag.Name,
                tag.Color,
                tag.Description,
                tag.BookTags.Count(bookTag => visibleBookIds.Contains(bookTag.BookId))))
            .ToListAsync();

        Collections = await inventoryAccess.ScopeCollections(dbContext.Collections, User)
            .AsNoTracking()
            .OrderBy(collection => collection.Name)
            .Select(collection => new CollectionRow(
                collection.Id,
                collection.Name,
                collection.Description,
                collection.CollectionBooks.Count(collectionBook => visibleBookIds.Contains(collectionBook.BookId))))
            .ToListAsync();

        var copyLocationCounts = await dbContext.BookCopies
            .AsNoTracking()
            .Where(copy => copy.LocationId != null && visibleBookIds.Contains(copy.BookId))
            .GroupBy(copy => copy.LocationId!.Value)
            .Select(group => new { LocationId = group.Key, Count = group.Select(copy => copy.BookId).Distinct().Count() })
            .ToDictionaryAsync(item => item.LocationId, item => item.Count);

        Locations = await inventoryAccess.ScopeLocations(dbContext.Locations, User)
            .AsNoTracking()
            .OrderBy(location => location.Name)
            .Select(location => new LocationRow(
                location.Id,
                location.Name,
                location.Description,
                location.Books.Count(book => visibleBookIds.Contains(book.Id))))
            .ToListAsync();

        Locations = Locations
            .Select(location => location with
            {
                BookCount = location.BookCount + copyLocationCounts.GetValueOrDefault(location.Id)
            })
            .ToList();
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

    public sealed record TagRow(int Id, string Name, string Color, string? Description, int BookCount);

    public sealed record CollectionRow(int Id, string Name, string? Description, int BookCount);

    public sealed record LocationRow(int Id, string Name, string? Description, int BookCount);

    public class TagInput
    {
        [Required]
        [StringLength(500)]
        public string Name { get; set; } = string.Empty;

        [StringLength(20)]
        public string Color { get; set; } = "#245f4c";

        [StringLength(1000)]
        public string? Description { get; set; }
    }

    public class CollectionInput
    {
        [Required]
        [StringLength(120)]
        public string Name { get; set; } = string.Empty;

        [StringLength(1000)]
        public string? Description { get; set; }
    }

    public class LocationInput
    {
        [Required]
        [StringLength(120)]
        public string Name { get; set; } = string.Empty;

        [StringLength(1000)]
        public string? Description { get; set; }
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
