using LibraryScanner.Web.Data;
using LibraryScanner.Web.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.EntityFrameworkCore;

namespace LibraryScanner.Web.Pages.Books;

[Authorize]
public class IndexModel(ApplicationDbContext dbContext) : PageModel
{
    public List<Book> Books { get; private set; } = [];

    [BindProperty(SupportsGet = true)]
    public string? Query { get; set; }

    [BindProperty(SupportsGet = true)]
    public int? CollectionId { get; set; }

    [BindProperty(SupportsGet = true)]
    public int? TagId { get; set; }

    [BindProperty(SupportsGet = true)]
    public string Sort { get; set; } = "title";

    [BindProperty]
    public List<int> SelectedBookIds { get; set; } = [];

    [BindProperty]
    public int? SelectedCollectionId { get; set; }

    public int TotalTitles { get; private set; }

    public int TotalQuantity { get; private set; }

    public int TotalTags { get; private set; }

    public int TotalCollections { get; private set; }

    public List<SelectListItem> CollectionOptions { get; private set; } = [];

    public List<SelectListItem> TagOptions { get; private set; } = [];

    public List<SelectListItem> SortOptions { get; } =
    [
        new("Title", "title"),
        new("Author", "author"),
        new("Publisher", "publisher"),
        new("ISBN", "isbn"),
        new("Year / edition", "year"),
        new("Collection", "collection")
    ];

    [TempData]
    public string? StatusMessage { get; set; }

    public async Task OnGetAsync()
    {
        await LoadInventoryAsync();
    }

    public async Task<IActionResult> OnPostDeleteSelectedAsync()
    {
        if (SelectedBookIds.Count == 0)
        {
            StatusMessage = "Select at least one book first.";
            return RedirectToPage(new { Query, CollectionId, TagId, Sort });
        }

        var books = await dbContext.Books
            .Where(book => SelectedBookIds.Contains(book.Id))
            .ToListAsync();

        if (books.Count == 0)
        {
            StatusMessage = "Those books were already removed.";
            return RedirectToPage(new { Query, CollectionId, TagId, Sort });
        }

        dbContext.Books.RemoveRange(books);
        await dbContext.SaveChangesAsync();
        StatusMessage = books.Count == 1 ? "Deleted 1 book." : $"Deleted {books.Count} books.";
        return RedirectToPage(new { Query, CollectionId, TagId, Sort });
    }

    public async Task<IActionResult> OnPostAddToCollectionAsync()
    {
        if (SelectedBookIds.Count == 0)
        {
            StatusMessage = "Select at least one book first.";
            return RedirectToPage(new { Query, CollectionId, TagId, Sort });
        }

        if (SelectedCollectionId is null)
        {
            StatusMessage = "Choose a collection first.";
            return RedirectToPage(new { Query, CollectionId, TagId, Sort });
        }

        var collection = await dbContext.Collections
            .Include(item => item.CollectionBooks)
            .FirstOrDefaultAsync(item => item.Id == SelectedCollectionId);

        if (collection is null)
        {
            StatusMessage = "That collection was not found.";
            return RedirectToPage(new { Query, CollectionId, TagId, Sort });
        }

        var selectedIds = await dbContext.Books
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

        return RedirectToPage(new { Query, CollectionId, TagId, Sort });
    }

    private async Task LoadInventoryAsync()
    {
        TotalTitles = await dbContext.Books.CountAsync();
        TotalQuantity = await dbContext.Books.SumAsync(book => (int?)book.Quantity) ?? 0;
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

        IQueryable<Book> booksQuery = dbContext.Books
            .AsNoTracking()
            .Include(book => book.Location)
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
                (book.Authors != null && book.Authors.ToUpper().Contains(queryUpper)) ||
                (book.Publisher != null && book.Publisher.ToUpper().Contains(queryUpper)) ||
                (book.PublishedDate != null && book.PublishedDate.ToUpper().Contains(queryUpper)) ||
                (book.Categories != null && book.Categories.ToUpper().Contains(queryUpper)) ||
                (book.Description != null && book.Description.ToUpper().Contains(queryUpper)) ||
                (book.Language != null && book.Language.ToUpper().Contains(queryUpper)) ||
                (book.Notes != null && book.Notes.ToUpper().Contains(queryUpper)) ||
                (book.Location != null && book.Location.Name.ToUpper().Contains(queryUpper)) ||
                book.BookTags.Any(bookTag => bookTag.Tag.Name.ToUpper().Contains(queryUpper)) ||
                book.CollectionBooks.Any(collectionBook => collectionBook.Collection.Name.ToUpper().Contains(queryUpper)));
        }

        var filteredBooks = await booksQuery.ToListAsync();

        Books = Sort switch
        {
            "author" => filteredBooks
                .OrderBy(book => book.Authors ?? string.Empty)
                .ThenBy(book => book.Title)
                .ToList(),
            "publisher" => filteredBooks
                .OrderBy(book => book.Publisher ?? string.Empty)
                .ThenBy(book => book.Title)
                .ToList(),
            "isbn" => filteredBooks
                .OrderBy(book => book.Isbn13)
                .ThenBy(book => book.Title)
                .ToList(),
            "year" => filteredBooks
                .OrderBy(book => book.PublishedDate ?? string.Empty)
                .ThenBy(book => book.Title)
                .ToList(),
            "collection" => filteredBooks
                .OrderBy(book => book.CollectionBooks.Select(collectionBook => collectionBook.Collection.Name).OrderBy(name => name).FirstOrDefault() ?? string.Empty)
                .ThenBy(book => book.Title)
                .ToList(),
            _ => filteredBooks
                .OrderBy(book => book.Title)
                .ThenBy(book => book.Authors ?? string.Empty)
                .ToList()
        };

        Books = Books.Take(200).ToList();
    }
}
