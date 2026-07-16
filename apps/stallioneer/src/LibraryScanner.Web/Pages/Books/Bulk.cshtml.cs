using LibraryScanner.Web.Data;
using LibraryScanner.Web.Models;
using LibraryScanner.Web.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.EntityFrameworkCore;
using System.Text;
using System.ComponentModel.DataAnnotations;

namespace LibraryScanner.Web.Pages.Books;

[Authorize]
public class BulkModel(ApplicationDbContext dbContext) : PageModel
{
    private static readonly string[] SharedStatuses =
    [
        "Owned",
        "Reading",
        "Loaned",
        "Wishlist",
        "Archived",
        "Sold",
        "Disposed"
    ];

    public List<Book> Books { get; private set; } = [];

    [BindProperty(SupportsGet = true)]
    public string? Query { get; set; }

    [BindProperty(SupportsGet = true)]
    public int? CollectionId { get; set; }

    [BindProperty(SupportsGet = true)]
    public int? TagId { get; set; }

    [BindProperty(SupportsGet = true)]
    public string? StatusFilter { get; set; }

    [BindProperty]
    public List<int> SelectedBookIds { get; set; } = [];

    [BindProperty]
    public string? AddTagNames { get; set; }

    [BindProperty]
    public string? RemoveTagNames { get; set; }

    [BindProperty]
    public int? SelectedCollectionId { get; set; }

    [BindProperty]
    public int? SelectedLocationId { get; set; }

    [BindProperty]
    public string? SelectedStatus { get; set; }

    [BindProperty]
    public IFormFile? ImportFile { get; set; }

    [BindProperty]
    public string ImportMode { get; set; } = ImportModes.MergeUpdate;

    [BindProperty]
    public List<string> PdfFieldKeys { get; set; } = [];

    [BindProperty]
    [DataType(DataType.Date)]
    public DateOnly? LogStartDate { get; set; }

    [BindProperty]
    [DataType(DataType.Date)]
    public DateOnly? LogEndDate { get; set; }

    public int TotalTitles { get; private set; }

    public int TotalItems { get; private set; }

    public int TotalTags { get; private set; }

    public int TotalCollections { get; private set; }

    public int FilteredCount { get; private set; }

    public List<SelectListItem> CollectionOptions { get; private set; } = [];

    public List<SelectListItem> TagOptions { get; private set; } = [];

    public List<SelectListItem> LocationOptions { get; private set; } = [];

    public List<SelectListItem> StatusOptions { get; } =
        SharedStatuses.Select(status => new SelectListItem(status, status)).ToList();

    public List<SelectListItem> StatusFilterOptions { get; private set; } = [];

    public List<SelectableTagRow> AvailableTags { get; private set; } = [];

    public IReadOnlyList<InventoryExportField> ExportFields => InventoryExportField.All;

    public List<SelectableBookRow> SelectableBooks { get; private set; } = [];

    [TempData]
    public string? StatusMessage { get; set; }

    public async Task OnGetAsync()
    {
        ApplyDefaultLogRange();
        await LoadPageAsync();
    }

    public async Task<IActionResult> OnPostAddTagsAsync()
    {
        var books = await LoadSelectedBooksForEditingAsync();
        if (books is null)
        {
            return RedirectWithStatus("Select at least one book first.");
        }

        var requestedTags = InventoryText.ParseTagDefinitions(AddTagNames);
        if (requestedTags.Count == 0)
        {
            return RedirectWithStatus("Enter at least one tag to add.");
        }

        var tags = await ResolveTagsAsync(requestedTags);
        var changedCount = 0;
        var now = DateTimeOffset.UtcNow;

        foreach (var book in books)
        {
            var existingTagIds = book.BookTags.Select(bookTag => bookTag.TagId).ToHashSet();
            var addedNames = new List<string>();

            foreach (var tag in tags)
            {
                if (existingTagIds.Contains(tag.Id))
                {
                    continue;
                }

                book.BookTags.Add(new BookTag
                {
                    Book = book,
                    Tag = tag
                });
                existingTagIds.Add(tag.Id);
                addedNames.Add(tag.Name);
            }

            if (addedNames.Count == 0)
            {
                continue;
            }

            book.UpdatedAt = now;
            dbContext.InventoryEvents.Add(new InventoryEvent
            {
                Book = book,
                EventType = "Bulk tags added",
                QuantityDelta = 0,
                Note = $"Added tags: {string.Join(", ", addedNames)}"
            });
            changedCount++;
        }

        await dbContext.SaveChangesAsync();
        return RedirectWithStatus(changedCount == 0
            ? "Those tags were already present on the selected books."
            : changedCount == 1
                ? "Updated tags on 1 book."
                : $"Updated tags on {changedCount} books.");
    }

    public async Task<IActionResult> OnPostRemoveTagsAsync()
    {
        var books = await LoadSelectedBooksForEditingAsync();
        if (books is null)
        {
            return RedirectWithStatus("Select at least one book first.");
        }

        var requestedTagNames = InventoryText.ParseTags(RemoveTagNames)
            .Select(tagName => InventoryText.NormalizeName(tagName))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        if (requestedTagNames.Count == 0)
        {
            return RedirectWithStatus("Enter at least one tag to remove.");
        }

        var changedCount = 0;
        var now = DateTimeOffset.UtcNow;

        foreach (var book in books)
        {
            var removable = book.BookTags
                .Where(bookTag => requestedTagNames.Contains(bookTag.Tag.NormalizedName))
                .ToList();
            if (removable.Count == 0)
            {
                continue;
            }

            var removedNames = removable.Select(item => item.Tag.Name).Order().ToList();
            foreach (var item in removable)
            {
                book.BookTags.Remove(item);
            }

            book.UpdatedAt = now;
            dbContext.InventoryEvents.Add(new InventoryEvent
            {
                Book = book,
                EventType = "Bulk tags removed",
                QuantityDelta = 0,
                Note = $"Removed tags: {string.Join(", ", removedNames)}"
            });
            changedCount++;
        }

        await dbContext.SaveChangesAsync();
        return RedirectWithStatus(changedCount == 0
            ? "None of those tags were present on the selected books."
            : changedCount == 1
                ? "Removed tags from 1 book."
                : $"Removed tags from {changedCount} books.");
    }

    public async Task<IActionResult> OnPostAddToCollectionAsync()
    {
        var books = await LoadSelectedBooksForEditingAsync();
        if (books is null)
        {
            return RedirectWithStatus("Select at least one book first.");
        }

        if (SelectedCollectionId is null)
        {
            return RedirectWithStatus("Choose a collection first.");
        }

        var collection = await dbContext.Collections
            .Include(item => item.CollectionBooks)
            .FirstOrDefaultAsync(item => item.Id == SelectedCollectionId);
        if (collection is null)
        {
            return RedirectWithStatus("That collection was not found.");
        }

        var changedCount = 0;
        var now = DateTimeOffset.UtcNow;

        foreach (var book in books)
        {
            if (book.CollectionBooks.Any(item => item.CollectionId == collection.Id))
            {
                continue;
            }

            book.CollectionBooks.Add(new CollectionBook
            {
                Book = book,
                Collection = collection
            });
            book.UpdatedAt = now;
            dbContext.InventoryEvents.Add(new InventoryEvent
            {
                Book = book,
                EventType = "Bulk collection update",
                QuantityDelta = 0,
                Note = $"Added to collection: {collection.Name}"
            });
            changedCount++;
        }

        await dbContext.SaveChangesAsync();
        return RedirectWithStatus(changedCount == 0
            ? "Those books are already in that collection."
            : changedCount == 1
                ? $"Added 1 book to {collection.Name}."
                : $"Added {changedCount} books to {collection.Name}.");
    }

    public async Task<IActionResult> OnPostMoveToLocationAsync()
    {
        var books = await LoadSelectedBooksForEditingAsync();
        if (books is null)
        {
            return RedirectWithStatus("Select at least one book first.");
        }

        if (SelectedLocationId is null)
        {
            return RedirectWithStatus("Choose a location first.");
        }

        var location = await dbContext.Locations.FirstOrDefaultAsync(item => item.Id == SelectedLocationId);
        if (location is null)
        {
            return RedirectWithStatus("That location was not found.");
        }

        var changedCount = 0;
        var now = DateTimeOffset.UtcNow;

        foreach (var book in books)
        {
            var changed = false;
            if (book.LocationId != location.Id)
            {
                book.Location = location;
                book.LocationId = location.Id;
                changed = true;
            }

            foreach (var copy in book.Copies)
            {
                if (copy.LocationId == location.Id)
                {
                    continue;
                }

                copy.Location = location;
                copy.LocationId = location.Id;
                copy.UpdatedAt = now;
                changed = true;
            }

            if (!changed)
            {
                continue;
            }

            book.UpdatedAt = now;
            dbContext.InventoryEvents.Add(new InventoryEvent
            {
                Book = book,
                EventType = "Bulk location move",
                QuantityDelta = 0,
                Note = $"Moved to location: {location.Name}"
            });
            changedCount++;
        }

        await dbContext.SaveChangesAsync();
        return RedirectWithStatus(changedCount == 0
            ? "Those books are already in that location."
            : changedCount == 1
                ? $"Moved 1 book to {location.Name}."
                : $"Moved {changedCount} books to {location.Name}.");
    }

    public async Task<IActionResult> OnPostSetStatusAsync()
    {
        var books = await LoadSelectedBooksForEditingAsync();
        if (books is null)
        {
            return RedirectWithStatus("Select at least one book first.");
        }

        if (string.IsNullOrWhiteSpace(SelectedStatus))
        {
            return RedirectWithStatus("Choose a status first.");
        }

        var status = SelectedStatus.Trim();
        var changedCount = 0;
        var now = DateTimeOffset.UtcNow;

        foreach (var book in books)
        {
            var changed = !string.Equals(book.Status, status, StringComparison.Ordinal);
            book.Status = status;

            foreach (var copy in book.Copies)
            {
                if (string.Equals(copy.Status, status, StringComparison.Ordinal))
                {
                    continue;
                }

                copy.Status = status;
                copy.UpdatedAt = now;
                changed = true;
            }

            if (!changed)
            {
                continue;
            }

            book.UpdatedAt = now;
            dbContext.InventoryEvents.Add(new InventoryEvent
            {
                Book = book,
                EventType = "Bulk status update",
                QuantityDelta = 0,
                Note = $"Set status to {status}"
            });
            changedCount++;
        }

        await dbContext.SaveChangesAsync();
        return RedirectWithStatus(changedCount == 0
            ? "Those books already had that status."
            : changedCount == 1
                ? $"Updated status on 1 book."
                : $"Updated status on {changedCount} books.");
    }

    public async Task<IActionResult> OnPostExportSelectedAsync()
    {
        var selectedIds = SelectedBookIds.Distinct().ToList();
        if (selectedIds.Count == 0)
        {
            return RedirectWithStatus("Select at least one book first.");
        }

        var books = await dbContext.Books
            .AsNoTracking()
            .Include(book => book.Location)
            .Include(book => book.BookTags)
            .ThenInclude(bookTag => bookTag.Tag)
            .Include(book => book.CollectionBooks)
            .ThenInclude(collectionBook => collectionBook.Collection)
            .Where(book => selectedIds.Contains(book.Id))
            .OrderBy(book => book.Title)
            .ToListAsync();

        var csv = InventoryCsv.ExportBooks(books);
        var fileName = $"stallioneer-bulk-export-{DateTime.UtcNow:yyyyMMdd-HHmmss}.csv";
        return File(Encoding.UTF8.GetBytes(csv), "text/csv", fileName);
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

    public async Task<IActionResult> OnPostExportLogAsync()
    {
        var startDate = LogStartDate ?? DateOnly.FromDateTime(DateTime.Today.AddDays(-29));
        var endDate = LogEndDate ?? DateOnly.FromDateTime(DateTime.Today);
        if (endDate < startDate)
        {
            return RedirectWithStatus("Log export end date must be on or after the start date.");
        }

        var start = startDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Local);
        var endExclusive = endDate.AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Local);

        var events = await dbContext.InventoryEvents
            .AsNoTracking()
            .Include(inventoryEvent => inventoryEvent.Book)
            .Where(inventoryEvent => inventoryEvent.CreatedAt >= start && inventoryEvent.CreatedAt < endExclusive)
            .OrderByDescending(inventoryEvent => inventoryEvent.CreatedAt)
            .ToListAsync();

        var csv = InventoryLogCsv.ExportEvents(events);
        var fileName = $"stallioneer-log-{startDate:yyyyMMdd}-to-{endDate:yyyyMMdd}.csv";
        return File(Encoding.UTF8.GetBytes(csv), "text/csv", fileName);
    }

    public async Task<IActionResult> OnPostImportAsync()
    {
        if (ImportFile is null || ImportFile.Length == 0)
        {
            return RedirectWithStatus("Choose a CSV file first.");
        }

        using var reader = new StreamReader(ImportFile.OpenReadStream());
        var content = await reader.ReadToEndAsync();
        var rows = InventoryCsv.Parse(content);
        if (rows.Count == 0)
        {
            return RedirectWithStatus("That CSV file did not contain any import rows.");
        }

        var result = await ImportInventoryAsync(rows, ImportMode);
        return RedirectWithStatus($"Import complete. Added {result.Added}, updated {result.Updated}, skipped {result.Skipped}.");
    }

    private async Task LoadPageAsync()
    {
        TotalTitles = await dbContext.Books.CountAsync();
        var totalCopyCount = await dbContext.BookCopies.CountAsync();
        TotalItems = totalCopyCount > 0
            ? totalCopyCount
            : await dbContext.Books.SumAsync(book => (int?)book.Quantity) ?? 0;
        TotalTags = await dbContext.Tags.CountAsync();
        TotalCollections = await dbContext.Collections.CountAsync();

        var collections = await dbContext.Collections
            .AsNoTracking()
            .OrderBy(collection => collection.Name)
            .ToListAsync();
        CollectionOptions = collections
            .Select(collection => new SelectListItem(collection.Name, collection.Id.ToString()))
            .Prepend(new SelectListItem("All collections", string.Empty))
            .ToList();

        var tags = await dbContext.Tags
            .AsNoTracking()
            .OrderBy(tag => tag.Name)
            .ToListAsync();
        AvailableTags = tags
            .Select(tag => new SelectableTagRow(tag.Id, tag.Name, tag.Description, tag.Color))
            .ToList();
        TagOptions = tags
            .Select(tag => new SelectListItem(tag.Name, tag.Id.ToString()))
            .Prepend(new SelectListItem("All tags", string.Empty))
            .ToList();
        var locations = await dbContext.Locations
            .AsNoTracking()
            .OrderBy(location => location.Name)
            .ToListAsync();
        LocationOptions = locations
            .Select(location => new SelectListItem(location.Name, location.Id.ToString()))
            .Prepend(new SelectListItem("Choose location", string.Empty))
            .ToList();
        StatusFilterOptions = SharedStatuses
            .Select(status => new SelectListItem(status, status))
            .Prepend(new SelectListItem("All availability", string.Empty))
            .ToList();

        Books = await GetFilteredBooksAsync();
        FilteredCount = Books.Count;
        SelectableBooks = Books
            .Select(book => new SelectableBookRow(
                book.Id,
                book.Title,
                book.Status,
                book.Location?.Name,
                book.BookTags
                    .OrderBy(bookTag => bookTag.Tag.Name)
                    .Select(bookTag => new SelectableTagRow(bookTag.TagId, bookTag.Tag.Name, bookTag.Tag.Description, bookTag.Tag.Color))
                    .ToList(),
                book.CollectionBooks
                    .OrderBy(collectionBook => collectionBook.Collection.Name)
                    .Select(collectionBook => new SelectableCollectionRow(collectionBook.CollectionId, collectionBook.Collection.Name, collectionBook.Collection.Description))
                    .ToList()))
            .ToList();
    }

    private void ApplyDefaultLogRange()
    {
        LogStartDate ??= DateOnly.FromDateTime(DateTime.Today.AddDays(-29));
        LogEndDate ??= DateOnly.FromDateTime(DateTime.Today);
    }

    private async Task<List<Book>> GetFilteredBooksAsync()
    {
        IQueryable<Book> booksQuery = dbContext.Books
            .AsNoTracking()
            .Include(book => book.Location)
            .Include(book => book.Identifiers)
            .Include(book => book.Copies)
            .ThenInclude(copy => copy.Location)
            .Include(book => book.BookTags)
            .ThenInclude(bookTag => bookTag.Tag)
            .Include(book => book.CollectionBooks)
            .ThenInclude(collectionBook => collectionBook.Collection);

        if (CollectionId is not null)
        {
            booksQuery = booksQuery.Where(book => book.CollectionBooks.Any(collectionBook => collectionBook.CollectionId == CollectionId));
        }

        if (TagId is not null)
        {
            booksQuery = booksQuery.Where(book => book.BookTags.Any(bookTag => bookTag.TagId == TagId));
        }

        if (!string.IsNullOrWhiteSpace(StatusFilter))
        {
            var statusFilter = StatusFilter.Trim();
            booksQuery = booksQuery.Where(book => book.Status == statusFilter);
        }

        if (!string.IsNullOrWhiteSpace(Query))
        {
            var query = Query.Trim();
            var queryUpper = query.ToUpperInvariant();
            booksQuery = booksQuery.Where(book =>
                book.Title.ToUpper().Contains(queryUpper) ||
                book.Isbn13.Contains(query) ||
                (book.Isbn10 != null && book.Isbn10.Contains(query)) ||
                book.Identifiers.Any(identifier => identifier.Value.Contains(query)) ||
                (book.Authors != null && book.Authors.ToUpper().Contains(queryUpper)) ||
                (book.Publisher != null && book.Publisher.ToUpper().Contains(queryUpper)) ||
                book.Status.ToUpper().Contains(queryUpper) ||
                (book.Location != null && book.Location.Name.ToUpper().Contains(queryUpper)) ||
                book.BookTags.Any(bookTag => bookTag.Tag.Name.ToUpper().Contains(queryUpper)) ||
                book.CollectionBooks.Any(collectionBook => collectionBook.Collection.Name.ToUpper().Contains(queryUpper)));
        }

        return await booksQuery
            .OrderBy(book => book.Title)
            .ThenBy(book => book.Authors ?? string.Empty)
            .ToListAsync();
    }

    private async Task<List<Book>?> LoadSelectedBooksForEditingAsync()
    {
        var selectedIds = SelectedBookIds.Distinct().ToList();
        if (selectedIds.Count == 0)
        {
            return null;
        }

        return await dbContext.Books
            .Include(book => book.Location)
            .Include(book => book.BookTags)
            .ThenInclude(bookTag => bookTag.Tag)
            .Include(book => book.CollectionBooks)
            .ThenInclude(collectionBook => collectionBook.Collection)
            .Include(book => book.Copies)
            .ThenInclude(copy => copy.Location)
            .Where(book => selectedIds.Contains(book.Id))
            .ToListAsync();
    }

    private async Task<List<Tag>> ResolveTagsAsync(IEnumerable<InventoryText.TagDefinition> requestedTags)
    {
        var requested = requestedTags.ToList();
        var normalizedNames = requested
            .Select(tag => InventoryText.NormalizeName(tag.Name))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var existingTags = await dbContext.Tags
            .Where(tag => normalizedNames.Contains(tag.NormalizedName))
            .ToDictionaryAsync(tag => tag.NormalizedName);

        var resolvedTags = new List<Tag>(requested.Count);
        var now = DateTimeOffset.UtcNow;

        foreach (var requestedTag in requested)
        {
            var tagName = requestedTag.Name;
            var normalizedName = InventoryText.NormalizeName(tagName);
            if (!existingTags.TryGetValue(normalizedName, out var tag))
            {
                tag = new Tag
                {
                    Name = tagName.Trim(),
                    NormalizedName = normalizedName,
                    Color = InventoryText.DefaultTagColor(tagName),
                    Description = requestedTag.Description,
                    CreatedAt = now
                };
                dbContext.Tags.Add(tag);
                existingTags[normalizedName] = tag;
            }
            else if (string.IsNullOrWhiteSpace(tag.Description) && !string.IsNullOrWhiteSpace(requestedTag.Description))
            {
                tag.Description = requestedTag.Description;
            }

            resolvedTags.Add(tag);
        }

        return resolvedTags;
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

        foreach (var tagDefinition in InventoryText.ParseTagDefinitions(rawTags))
        {
            var tagName = tagDefinition.Name;
            var normalized = InventoryText.NormalizeName(tagName);
            if (!tags.TryGetValue(normalized, out var tag))
            {
                tag = new Tag
                {
                    Name = tagName.Trim(),
                    NormalizedName = normalized,
                    Color = InventoryText.DefaultTagColor(tagName),
                    Description = tagDefinition.Description,
                    CreatedAt = now
                };
                dbContext.Tags.Add(tag);
                tags[normalized] = tag;
            }
            else if (string.IsNullOrWhiteSpace(tag.Description) && !string.IsNullOrWhiteSpace(tagDefinition.Description))
            {
                tag.Description = tagDefinition.Description;
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

    private RedirectToPageResult RedirectWithStatus(string statusMessage)
    {
        StatusMessage = statusMessage;
        return RedirectToPage(new { Query, CollectionId, TagId, StatusFilter });
    }

    public sealed record SelectableBookRow(
        int Id,
        string Title,
        string Status,
        string? LocationName,
        List<SelectableTagRow> Tags,
        List<SelectableCollectionRow> Collections);

    public sealed record SelectableTagRow(int Id, string Name, string? Description, string Color);

    public sealed record SelectableCollectionRow(int Id, string Name, string? Description);

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
