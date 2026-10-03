using LibraryScanner.Web.Data;
using LibraryScanner.Web.Models;
using LibraryScanner.Web.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.EntityFrameworkCore;

namespace LibraryScanner.Web.Pages.Books;

[Authorize]
public class IndexModel(
    ApplicationDbContext dbContext,
    InventoryAccessService inventoryAccess,
    AuthHistoryLogService authHistoryLog) : PageModel
{
    private static readonly int[] AllowedPageSizes = [25, 50, 100, 200];

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
    public List<int> CollectionIds { get; set; } = [];

    [BindProperty(SupportsGet = true)]
    public List<int> TagIds { get; set; } = [];

    [BindProperty(SupportsGet = true)]
    public string TagMode { get; set; } = "and";

    [BindProperty(SupportsGet = true)]
    public List<int> LocationIds { get; set; } = [];

    [BindProperty(SupportsGet = true)]
    public List<string> Statuses { get; set; } = [];

    [BindProperty(SupportsGet = true)]
    public string Sort { get; set; } = "title";

    [BindProperty(SupportsGet = true)]
    public int PageSize { get; set; } = 50;

    [BindProperty(SupportsGet = true)]
    public int PageNumber { get; set; } = 1;

    [BindProperty]
    public List<int> SelectedBookIds { get; set; } = [];

    [BindProperty]
    public int? SelectedCollectionId { get; set; }

    [BindProperty]
    public int? SelectedLocationId { get; set; }

    [BindProperty]
    public string? SelectedStatus { get; set; }

    public int TotalTitles { get; private set; }

    public int TotalQuantity { get; private set; }

    public int TotalTags { get; private set; }

    public int TotalCollections { get; private set; }

    public int FilteredCount { get; private set; }

    public int TotalPages { get; private set; }

    public List<SelectListItem> CollectionOptions { get; private set; } = [];

    public List<SelectListItem> TagOptions { get; private set; } = [];

    public List<SelectListItem> LocationOptions { get; private set; } = [];

    public List<SelectListItem> StatusOptions { get; } =
        SharedStatuses.Select(status => new SelectListItem(status, status)).ToList();

    public List<InventoryTag> AvailableTags { get; private set; } = [];

    public List<InventoryBook> SelectableBooks { get; private set; } = [];

    public List<InventoryFilterOption> CollectionFilters { get; private set; } = [];

    public List<InventoryFilterOption> TagFilters { get; private set; } = [];

    public List<InventoryFilterOption> LocationFilters { get; private set; } = [];

    public List<InventoryTextFilterOption> StatusFilters { get; private set; } = [];

    public List<SelectListItem> PageSizeOptions { get; } =
        AllowedPageSizes
            .Select(size => new SelectListItem($"{size} entries", size.ToString()))
            .ToList();

    public List<SelectListItem> SortOptions { get; } =
    [
        new("Title", "title"),
        new("Author", "author"),
        new("Publisher", "publisher"),
        new("ISBN", "isbn"),
        new("Year / edition", "year"),
        new("Quantity", "quantity"),
        new("Tags", "tag"),
        new("Collection", "collection"),
        new("Status", "status")
    ];

    [TempData]
    public string? StatusMessage { get; set; }

    public async Task OnGetAsync()
    {
        await LoadInventoryAsync();
    }

    public async Task<JsonResult> OnGetInventoryDataAsync()
    {
        await LoadInventoryAsync();

        return new JsonResult(new InventoryResponse(
            Books.Select(ToInventoryBook),
            FilteredCount,
            PageNumber,
            TotalPages));
    }

    public async Task<IActionResult> OnPostDeleteSelectedAsync()
    {
        if (SelectedBookIds.Count == 0)
        {
            StatusMessage = "Select at least one book first.";
            return RedirectToPage(new { Query, CollectionIds, TagIds, TagMode, LocationIds, Statuses, Sort, PageSize, PageNumber });
        }

        var books = await inventoryAccess.ScopeBooks(dbContext.Books, User)
            .Where(book => SelectedBookIds.Contains(book.Id))
            .ToListAsync();

        if (books.Count == 0)
        {
            StatusMessage = "Those books were already removed.";
            return RedirectToPage(new { Query, CollectionIds, TagIds, TagMode, LocationIds, Statuses, Sort, PageSize, PageNumber });
        }

        dbContext.Books.RemoveRange(books);
        await dbContext.SaveChangesAsync();
        var account = inventoryAccess.GetAccount(User);
        await authHistoryLog.LogAsync(account, "stallioneer.book_deleted", new
        {
            count = books.Count,
            titles = books.Select(book => book.Title).Take(12).ToArray()
        });
        StatusMessage = books.Count == 1 ? "Deleted 1 book." : $"Deleted {books.Count} books.";
        return RedirectToPage(new { Query, CollectionIds, TagIds, TagMode, LocationIds, Statuses, Sort, PageSize, PageNumber });
    }

    public async Task<IActionResult> OnPostAddToCollectionAsync()
    {
        if (SelectedBookIds.Count == 0)
        {
            StatusMessage = "Select at least one book first.";
            return RedirectToPage(new { Query, CollectionIds, TagIds, TagMode, LocationIds, Statuses, Sort, PageSize, PageNumber });
        }

        if (SelectedCollectionId is null)
        {
            StatusMessage = "Choose a collection first.";
            return RedirectToPage(new { Query, CollectionIds, TagIds, TagMode, LocationIds, Statuses, Sort, PageSize, PageNumber });
        }

        var collection = await inventoryAccess.ScopeCollections(dbContext.Collections, User)
            .Include(item => item.CollectionBooks)
            .FirstOrDefaultAsync(item => item.Id == SelectedCollectionId);

        if (collection is null)
        {
            StatusMessage = "That collection was not found.";
            return RedirectToPage(new { Query, CollectionIds, TagIds, TagMode, LocationIds, Statuses, Sort, PageSize, PageNumber });
        }

        var selectedIds = await inventoryAccess.ScopeBooks(dbContext.Books, User)
            .Where(book => SelectedBookIds.Contains(book.Id))
            .Select(book => book.Id)
            .ToListAsync();

        var existingIds = collection.CollectionBooks.Select(item => item.BookId).ToHashSet();
        var addedCount = 0;

        foreach (var bookId in selectedIds)
        {
            if (existingIds.Contains(bookId))
            {
                continue;
            }

            dbContext.CollectionBooks.Add(new CollectionBook
            {
                CollectionId = collection.Id,
                BookId = bookId
            });
            addedCount++;
        }

        if (addedCount > 0)
        {
            await dbContext.SaveChangesAsync();
            StatusMessage = addedCount == 1
                ? $"Added 1 book to {collection.Name}."
                : $"Added {addedCount} books to {collection.Name}.";
        }
        else
        {
            StatusMessage = "Those books are already in that collection.";
        }

        return RedirectToPage(new { Query, CollectionIds, TagIds, TagMode, LocationIds, Statuses, Sort, PageSize, PageNumber });
    }

    public async Task<IActionResult> OnPostApplySelectedFieldsAsync()
    {
        if (SelectedBookIds.Count == 0)
        {
            StatusMessage = "Select at least one book first.";
            return RedirectToPage(new { Query, CollectionIds, TagIds, TagMode, LocationIds, Statuses, Sort, PageSize, PageNumber });
        }

        if (SelectedCollectionId is null && SelectedLocationId is null && string.IsNullOrWhiteSpace(SelectedStatus))
        {
            StatusMessage = "Choose a collection, availability, or location first.";
            return RedirectToPage(new { Query, CollectionIds, TagIds, TagMode, LocationIds, Statuses, Sort, PageSize, PageNumber });
        }

        var books = await inventoryAccess.ScopeBooks(dbContext.Books, User)
            .Include(book => book.CollectionBooks)
            .Include(book => book.Copies)
            .Where(book => SelectedBookIds.Contains(book.Id))
            .ToListAsync();

        Collection? collection = null;
        if (SelectedCollectionId is not null)
        {
            collection = await inventoryAccess.ScopeCollections(dbContext.Collections, User)
                .FirstOrDefaultAsync(item => item.Id == SelectedCollectionId);
            if (collection is null)
            {
                StatusMessage = "That collection was not found.";
                return RedirectToPage(new { Query, CollectionIds, TagIds, TagMode, LocationIds, Statuses, Sort, PageSize, PageNumber });
            }
        }

        Location? location = null;
        if (SelectedLocationId is not null)
        {
            location = await inventoryAccess.ScopeLocations(dbContext.Locations, User)
                .FirstOrDefaultAsync(item => item.Id == SelectedLocationId);
            if (location is null)
            {
                StatusMessage = "That location was not found.";
                return RedirectToPage(new { Query, CollectionIds, TagIds, TagMode, LocationIds, Statuses, Sort, PageSize, PageNumber });
            }
        }

        var status = string.IsNullOrWhiteSpace(SelectedStatus) ? null : SelectedStatus.Trim();
        var now = DateTimeOffset.UtcNow;
        var changedBooks = 0;
        foreach (var book in books)
        {
            var bookChanged = false;

            if (collection is not null && book.CollectionBooks.All(item => item.CollectionId != collection.Id))
            {
                book.CollectionBooks.Add(new CollectionBook
                {
                    Book = book,
                    Collection = collection
                });
                bookChanged = true;
            }

            if (status is not null)
            {
                var statusChanged = !string.Equals(book.Status, status, StringComparison.Ordinal);
                book.Status = status;
                foreach (var copy in book.Copies)
                {
                    if (string.Equals(copy.Status, status, StringComparison.Ordinal))
                    {
                        continue;
                    }

                    copy.Status = status;
                    copy.UpdatedAt = now;
                    statusChanged = true;
                }

                bookChanged |= statusChanged;
            }

            if (location is not null)
            {
                var locationChanged = false;
                if (book.LocationId != location.Id)
                {
                    book.Location = location;
                    book.LocationId = location.Id;
                    locationChanged = true;
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
                    locationChanged = true;
                }

                bookChanged |= locationChanged;
            }

            if (!bookChanged)
            {
                continue;
            }

            book.UpdatedAt = now;
            changedBooks++;
        }

        if (changedBooks > 0)
        {
            await dbContext.SaveChangesAsync();
        }

        StatusMessage = changedBooks == 0
            ? "No selected books needed those changes."
            : changedBooks == 1
                ? "Applied selected changes to 1 book."
                : $"Applied selected changes to {changedBooks} books.";
        return RedirectToPage(new { Query, CollectionIds, TagIds, TagMode, LocationIds, Statuses, Sort, PageSize, PageNumber });
    }

    private async Task LoadInventoryAsync()
    {
        NormalizePaging();

        TotalTitles = await inventoryAccess.ScopeBooks(dbContext.Books, User).CountAsync();
        var visibleBookIds = inventoryAccess.ScopeBooks(dbContext.Books, User).Select(book => book.Id);
        var totalCopyCount = await dbContext.BookCopies.Where(copy => visibleBookIds.Contains(copy.BookId)).CountAsync();
        TotalQuantity = totalCopyCount > 0
            ? totalCopyCount
            : await inventoryAccess.ScopeBooks(dbContext.Books, User).SumAsync(book => (int?)book.Quantity) ?? 0;
        TotalTags = await inventoryAccess.ScopeTags(dbContext.Tags, User).CountAsync();
        TotalCollections = await inventoryAccess.ScopeCollections(dbContext.Collections, User).CountAsync();

        var collectionCounts = await dbContext.CollectionBooks
            .AsNoTracking()
            .Where(collectionBook => visibleBookIds.Contains(collectionBook.BookId))
            .GroupBy(collectionBook => collectionBook.CollectionId)
            .Select(group => new { CollectionId = group.Key, Count = group.Count() })
            .ToDictionaryAsync(item => item.CollectionId, item => item.Count);

        var collections = await inventoryAccess.ScopeCollections(dbContext.Collections, User)
            .AsNoTracking()
            .OrderBy(collection => collection.Name)
            .ToListAsync();

        CollectionFilters = collections
            .Select(collection => new InventoryFilterOption(
                collection.Id,
                collection.Name,
                collectionCounts.GetValueOrDefault(collection.Id)))
            .ToList();

        CollectionOptions = CollectionFilters
            .Select(collection => new SelectListItem(collection.Name, collection.Id.ToString()))
            .Prepend(new SelectListItem("All collections", string.Empty))
            .ToList();

        var tagCounts = await dbContext.BookTags
            .AsNoTracking()
            .Where(bookTag => visibleBookIds.Contains(bookTag.BookId))
            .GroupBy(bookTag => bookTag.TagId)
            .Select(group => new { TagId = group.Key, Count = group.Count() })
            .ToDictionaryAsync(item => item.TagId, item => item.Count);

        var tags = await inventoryAccess.ScopeTags(dbContext.Tags, User)
            .AsNoTracking()
            .OrderBy(tag => tag.Name)
            .ToListAsync();

        TagFilters = tags
            .Select(tag => new InventoryFilterOption(
                tag.Id,
                tag.Name,
                tagCounts.GetValueOrDefault(tag.Id)))
            .ToList();
        AvailableTags = tags
            .Select(tag => new InventoryTag(tag.Id, tag.Name, tag.Description, tag.Color))
            .ToList();

        TagOptions = TagFilters
            .Select(tag => new SelectListItem(tag.Name, tag.Id.ToString()))
            .Prepend(new SelectListItem("All tags", string.Empty))
            .ToList();

        var locationCounts = await dbContext.BookCopies
            .AsNoTracking()
            .Where(copy => copy.LocationId != null && visibleBookIds.Contains(copy.BookId))
            .GroupBy(copy => copy.LocationId!.Value)
            .Select(group => new { LocationId = group.Key, Count = group.Select(copy => copy.BookId).Distinct().Count() })
            .ToDictionaryAsync(item => item.LocationId, item => item.Count);

        var bookLocationCounts = await inventoryAccess.ScopeBooks(dbContext.Books, User)
            .AsNoTracking()
            .Where(book => book.LocationId != null)
            .GroupBy(book => book.LocationId!.Value)
            .Select(group => new { LocationId = group.Key, Count = group.Count() })
            .ToListAsync();

        foreach (var item in bookLocationCounts)
        {
            locationCounts[item.LocationId] = locationCounts.GetValueOrDefault(item.LocationId) + item.Count;
        }

        var locations = await inventoryAccess.ScopeLocations(dbContext.Locations, User)
            .AsNoTracking()
            .OrderBy(location => location.Name)
            .ToListAsync();

        LocationFilters = locations
            .Select(location => new InventoryFilterOption(
                location.Id,
                location.Name,
                locationCounts.GetValueOrDefault(location.Id)))
            .ToList();
        LocationOptions = locations
            .Select(location => new SelectListItem(location.Name, location.Id.ToString()))
            .Prepend(new SelectListItem("Move to location", string.Empty))
            .ToList();

        var statusRows = await inventoryAccess.ScopeBooks(dbContext.Books, User)
            .AsNoTracking()
            .Select(book => new
            {
                book.Id,
                book.Status,
                CopyStatuses = book.Copies.Select(copy => copy.Status)
            })
            .ToListAsync();

        StatusFilters = statusRows
            .SelectMany(book => book.CopyStatuses.DefaultIfEmpty(book.Status).Select(status => new { book.Id, Status = string.IsNullOrWhiteSpace(status) ? book.Status : status }))
            .GroupBy(item => item.Status)
            .Select(group => new InventoryTextFilterOption(
                group.Key,
                group.Key,
                group.Select(item => item.Id).Distinct().Count()))
            .OrderBy(option => option.Name)
            .ToList();

        var filteredBooks = await GetFilteredBooksAsync();
        FilteredCount = filteredBooks.Count;
        TotalPages = Math.Max(1, (int)Math.Ceiling(FilteredCount / (double)PageSize));
        PageNumber = Math.Clamp(PageNumber, 1, TotalPages);
        Books = filteredBooks
            .Skip((PageNumber - 1) * PageSize)
            .Take(PageSize)
            .ToList();
        SelectableBooks = Books.Select(ToInventoryBook).ToList();
    }

    private static InventoryBook ToInventoryBook(Book book)
    {
        return new InventoryBook(
            book.Id,
            book.Title,
            book.Authors,
            book.Publisher,
            book.PublishedDate,
            book.Isbn13,
            book.EffectiveQuantity,
            book.Status,
            book.Copies.Select(copy => copy.Location?.Name).FirstOrDefault(name => !string.IsNullOrWhiteSpace(name)) ?? book.Location?.Name,
            book.CoverImageUrl,
            book.CollectionBooks
                .OrderBy(item => item.Collection.Name)
                .Select(item => new InventoryCollection(item.CollectionId, item.Collection.Name, item.Collection.Description))
                .ToList(),
            book.BookTags
                .OrderBy(item => item.Tag.Name)
                .Select(item => new InventoryTag(item.TagId, item.Tag.Name, item.Tag.Description, item.Tag.Color))
                .ToList());
    }

    private async Task<List<Book>> GetFilteredBooksAsync()
    {
        IQueryable<Book> booksQuery = inventoryAccess.ScopeBooks(dbContext.Books, User)
            .AsNoTracking()
            .Include(book => book.Location)
            .Include(book => book.Identifiers)
            .Include(book => book.Copies)
            .ThenInclude(copy => copy.Location)
            .Include(book => book.BookTags)
            .ThenInclude(bookTag => bookTag.Tag)
            .Include(book => book.CollectionBooks)
            .ThenInclude(collectionBook => collectionBook.Collection);

        if (CollectionIds.Count > 0)
        {
            booksQuery = booksQuery.Where(book => book.CollectionBooks.Any(collectionBook => CollectionIds.Contains(collectionBook.CollectionId)));
        }

        if (TagIds.Count > 0)
        {
            var distinctTagIds = TagIds.Distinct().ToList();
            booksQuery = string.Equals(TagMode, "or", StringComparison.OrdinalIgnoreCase)
                ? booksQuery.Where(book => book.BookTags.Any(bookTag => distinctTagIds.Contains(bookTag.TagId)))
                : booksQuery.Where(book => book.BookTags.Count(bookTag => distinctTagIds.Contains(bookTag.TagId)) == distinctTagIds.Count);
        }

        if (LocationIds.Count > 0)
        {
            booksQuery = booksQuery.Where(book =>
                (book.LocationId != null && LocationIds.Contains(book.LocationId.Value)) ||
                book.Copies.Any(copy => copy.LocationId != null && LocationIds.Contains(copy.LocationId.Value)));
        }

        var normalizedStatuses = Statuses
            .Where(status => !string.IsNullOrWhiteSpace(status))
            .Select(status => status.Trim())
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        if (normalizedStatuses.Count > 0)
        {
            booksQuery = booksQuery.Where(book =>
                normalizedStatuses.Contains(book.Status) ||
                book.Copies.Any(copy => normalizedStatuses.Contains(copy.Status)));
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
                (book.PublishedDate != null && book.PublishedDate.ToUpper().Contains(queryUpper)) ||
                (book.Categories != null && book.Categories.ToUpper().Contains(queryUpper)) ||
                (book.Description != null && book.Description.ToUpper().Contains(queryUpper)) ||
                (book.Language != null && book.Language.ToUpper().Contains(queryUpper)) ||
                (book.Notes != null && book.Notes.ToUpper().Contains(queryUpper)) ||
                (book.Location != null && book.Location.Name.ToUpper().Contains(queryUpper)) ||
                book.Copies.Any(copy =>
                    (copy.Notes != null && copy.Notes.ToUpper().Contains(queryUpper)) ||
                    copy.Status.ToUpper().Contains(queryUpper) ||
                    copy.Condition.ToUpper().Contains(queryUpper) ||
                    (copy.Location != null && copy.Location.Name.ToUpper().Contains(queryUpper))) ||
                book.BookTags.Any(bookTag => bookTag.Tag.Name.ToUpper().Contains(queryUpper)) ||
                book.CollectionBooks.Any(collectionBook => collectionBook.Collection.Name.ToUpper().Contains(queryUpper)));
        }

        var filteredBooks = await booksQuery.ToListAsync();

        var sortedBooks = Sort switch
        {
            "title_desc" => filteredBooks
                .OrderByDescending(book => book.Title)
                .ThenBy(book => book.Authors ?? string.Empty)
                .ToList(),
            "author" => filteredBooks
                .OrderBy(book => book.Authors ?? string.Empty)
                .ThenBy(book => book.Title)
                .ToList(),
            "author_desc" => filteredBooks
                .OrderByDescending(book => book.Authors ?? string.Empty)
                .ThenBy(book => book.Title)
                .ToList(),
            "publisher" => filteredBooks
                .OrderBy(book => book.Publisher ?? string.Empty)
                .ThenBy(book => book.Title)
                .ToList(),
            "publisher_desc" => filteredBooks
                .OrderByDescending(book => book.Publisher ?? string.Empty)
                .ThenBy(book => book.Title)
                .ToList(),
            "isbn" => filteredBooks
                .OrderBy(book => book.Isbn13)
                .ThenBy(book => book.Title)
                .ToList(),
            "isbn_desc" => filteredBooks
                .OrderByDescending(book => book.Isbn13)
                .ThenBy(book => book.Title)
                .ToList(),
            "year" => filteredBooks
                .OrderBy(book => book.PublishedDate ?? string.Empty)
                .ThenBy(book => book.Title)
                .ToList(),
            "year_desc" => filteredBooks
                .OrderByDescending(book => book.PublishedDate ?? string.Empty)
                .ThenBy(book => book.Title)
                .ToList(),
            "quantity" => filteredBooks
                .OrderBy(book => book.EffectiveQuantity)
                .ThenBy(book => book.Title)
                .ToList(),
            "quantity_desc" => filteredBooks
                .OrderByDescending(book => book.EffectiveQuantity)
                .ThenBy(book => book.Title)
                .ToList(),
            "location" => filteredBooks
                .OrderBy(book => book.Copies.Select(copy => copy.Location?.Name).FirstOrDefault(name => !string.IsNullOrWhiteSpace(name)) ?? book.Location?.Name ?? string.Empty)
                .ThenBy(book => book.Title)
                .ToList(),
            "location_desc" => filteredBooks
                .OrderByDescending(book => book.Copies.Select(copy => copy.Location?.Name).FirstOrDefault(name => !string.IsNullOrWhiteSpace(name)) ?? book.Location?.Name ?? string.Empty)
                .ThenBy(book => book.Title)
                .ToList(),
            "tag" => filteredBooks
                .OrderBy(book => book.BookTags.Select(bookTag => bookTag.Tag.Name).OrderBy(name => name).FirstOrDefault() ?? string.Empty)
                .ThenBy(book => book.Title)
                .ToList(),
            "tag_desc" => filteredBooks
                .OrderByDescending(book => book.BookTags.Select(bookTag => bookTag.Tag.Name).OrderBy(name => name).FirstOrDefault() ?? string.Empty)
                .ThenBy(book => book.Title)
                .ToList(),
            "collection" => filteredBooks
                .OrderBy(book => book.CollectionBooks.Select(collectionBook => collectionBook.Collection.Name).OrderBy(name => name).FirstOrDefault() ?? string.Empty)
                .ThenBy(book => book.Title)
                .ToList(),
            "collection_desc" => filteredBooks
                .OrderByDescending(book => book.CollectionBooks.Select(collectionBook => collectionBook.Collection.Name).OrderBy(name => name).FirstOrDefault() ?? string.Empty)
                .ThenBy(book => book.Title)
                .ToList(),
            "status" => filteredBooks
                .OrderBy(book => book.Copies.Select(copy => copy.Status).FirstOrDefault(status => !string.IsNullOrWhiteSpace(status)) ?? book.Status)
                .ThenBy(book => book.Title)
                .ToList(),
            "status_desc" => filteredBooks
                .OrderByDescending(book => book.Copies.Select(copy => copy.Status).FirstOrDefault(status => !string.IsNullOrWhiteSpace(status)) ?? book.Status)
                .ThenBy(book => book.Title)
                .ToList(),
            _ => filteredBooks
                .OrderBy(book => book.Title)
                .ThenBy(book => book.Authors ?? string.Empty)
                .ToList()
        };

        return sortedBooks;
    }

    private void NormalizePaging()
    {
        if (string.IsNullOrWhiteSpace(Sort))
        {
            Sort = "title";
        }

        if (!AllowedPageSizes.Contains(PageSize))
        {
            PageSize = 50;
        }

        if (PageNumber < 1)
        {
            PageNumber = 1;
        }
    }

    public string GetNextSort(string sortKey)
    {
        return Sort == sortKey ? $"{sortKey}_desc" : sortKey;
    }

    public bool IsSortedBy(string sortKey)
    {
        return Sort == sortKey || Sort == $"{sortKey}_desc";
    }

    public bool IsSortDescending(string sortKey)
    {
        return Sort == $"{sortKey}_desc";
    }

    public string GetSortIndicator(string sortKey)
    {
        if (!IsSortedBy(sortKey))
        {
            return string.Empty;
        }

        return IsSortDescending(sortKey) ? " v" : " ^";
    }

    public sealed record InventoryResponse(
        IEnumerable<InventoryBook> Books,
        int FilteredCount,
        int PageNumber,
        int TotalPages);

    public sealed record InventoryBook(
        int Id,
        string Title,
        string? Authors,
        string? Publisher,
        string? PublishedDate,
        string Isbn13,
        int Quantity,
        string Status,
        string? LocationName,
        string? CoverImageUrl,
        IReadOnlyList<InventoryCollection> Collections,
        IReadOnlyList<InventoryTag> Tags);

    public sealed record InventoryTag(int Id, string Name, string? Description, string Color);

    public sealed record InventoryCollection(int Id, string Name, string? Description);

    public sealed record InventoryFilterOption(int Id, string Name, int Count);

    public sealed record InventoryTextFilterOption(string Id, string Name, int Count);
}
