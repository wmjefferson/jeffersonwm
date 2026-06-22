using LibraryScanner.Web.Data;
using LibraryScanner.Web.Models;
using LibraryScanner.Web.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.EntityFrameworkCore;
using System.Text;

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
    public string? DispositionStatus { get; set; }

    [BindProperty]
    public string? DispositionNote { get; set; }

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

    [TempData]
    public string? StatusMessage { get; set; }

    public async Task OnGetAsync()
    {
        await LoadPageAsync();
    }

    public async Task<IActionResult> OnPostAddTagsAsync()
    {
        var books = await LoadSelectedBooksForEditingAsync();
        if (books is null)
        {
            return RedirectWithStatus("Select at least one book first.");
        }

        var requestedTagNames = InventoryText.ParseTags(AddTagNames);
        if (requestedTagNames.Count == 0)
        {
            return RedirectWithStatus("Enter at least one tag to add.");
        }

        var tags = await ResolveTagsAsync(requestedTagNames);
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
            .Select(InventoryText.NormalizeName)
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

    public async Task<IActionResult> OnPostMarkDispositionAsync()
    {
        var books = await LoadSelectedBooksForEditingAsync();
        if (books is null)
        {
            return RedirectWithStatus("Select at least one book first.");
        }

        if (string.IsNullOrWhiteSpace(DispositionStatus) ||
            (DispositionStatus != "Sold" && DispositionStatus != "Disposed"))
        {
            return RedirectWithStatus("Choose Sold or Disposed first.");
        }

        var disposition = DispositionStatus.Trim();
        var note = string.IsNullOrWhiteSpace(DispositionNote) ? null : DispositionNote.Trim();
        var changedCount = 0;
        var now = DateTimeOffset.UtcNow;

        foreach (var book in books)
        {
            var changed = !string.Equals(book.Status, disposition, StringComparison.Ordinal);
            book.Status = disposition;

            foreach (var copy in book.Copies)
            {
                if (!string.Equals(copy.Status, disposition, StringComparison.Ordinal))
                {
                    copy.Status = disposition;
                    copy.UpdatedAt = now;
                    changed = true;
                }
            }

            if (!changed && string.IsNullOrWhiteSpace(note))
            {
                continue;
            }

            book.UpdatedAt = now;
            dbContext.InventoryEvents.Add(new InventoryEvent
            {
                Book = book,
                EventType = disposition == "Sold" ? "Bulk marked sold" : "Bulk marked disposed",
                QuantityDelta = 0,
                Note = note ?? $"Marked {disposition.ToLowerInvariant()} from Bulk tools."
            });
            changedCount++;
        }

        await dbContext.SaveChangesAsync();
        return RedirectWithStatus(changedCount == 0
            ? $"Those books were already marked {disposition.ToLowerInvariant()}."
            : changedCount == 1
                ? $"Marked 1 book as {disposition.ToLowerInvariant()}."
                : $"Marked {changedCount} books as {disposition.ToLowerInvariant()}.");
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

        Books = await GetFilteredBooksAsync();
        FilteredCount = Books.Count;
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

    private async Task<List<Tag>> ResolveTagsAsync(IEnumerable<string> requestedTagNames)
    {
        var requested = requestedTagNames.ToList();
        var normalizedNames = requested
            .Select(InventoryText.NormalizeName)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var existingTags = await dbContext.Tags
            .Where(tag => normalizedNames.Contains(tag.NormalizedName))
            .ToDictionaryAsync(tag => tag.NormalizedName);

        var resolvedTags = new List<Tag>(requested.Count);
        var now = DateTimeOffset.UtcNow;

        foreach (var tagName in requested)
        {
            var normalizedName = InventoryText.NormalizeName(tagName);
            if (!existingTags.TryGetValue(normalizedName, out var tag))
            {
                tag = new Tag
                {
                    Name = tagName.Trim(),
                    NormalizedName = normalizedName,
                    Color = InventoryText.DefaultTagColor(tagName),
                    CreatedAt = now
                };
                dbContext.Tags.Add(tag);
                existingTags[normalizedName] = tag;
            }

            resolvedTags.Add(tag);
        }

        return resolvedTags;
    }

    private RedirectToPageResult RedirectWithStatus(string statusMessage)
    {
        StatusMessage = statusMessage;
        return RedirectToPage(new { Query, CollectionId, TagId });
    }
}
