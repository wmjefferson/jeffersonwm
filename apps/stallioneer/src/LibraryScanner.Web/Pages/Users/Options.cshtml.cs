using System.ComponentModel.DataAnnotations;
using System.Text;
using LibraryScanner.Web.Data;
using LibraryScanner.Web.Models;
using LibraryScanner.Web.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;

namespace LibraryScanner.Web.Pages.Users;

[Authorize(Roles = AppRoles.Admin)]
public class OptionsModel(
    ApplicationDbContext dbContext,
    InventoryAccessService inventoryAccess,
    AuthHistoryLogService authHistoryLog) : PageModel
{
    public AppSnapshot Snapshot { get; private set; } = new();

    public IReadOnlyList<InventoryExportField> ExportFields => InventoryExportField.All;

    [BindProperty]
    public List<string> PdfFieldKeys { get; set; } = [];

    [BindProperty]
    [Range(0, int.MaxValue)]
    public int? DeleteConfirmationCount { get; set; }

    [TempData]
    public string? StatusMessage { get; set; }

    public async Task OnGetAsync()
    {
        Snapshot = await LoadSnapshotAsync();
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

    public async Task<IActionResult> OnPostDeleteLibraryAsync()
    {
        Snapshot = await LoadSnapshotAsync();
        if (DeleteConfirmationCount != Snapshot.TotalBooks)
        {
            ModelState.AddModelError(nameof(DeleteConfirmationCount), $"Enter {Snapshot.TotalBooks} to confirm.");
            return Page();
        }

        var account = inventoryAccess.GetAccount(User);
        var bookIds = await inventoryAccess.ScopeBooks(dbContext.Books, User)
            .Select(book => book.Id)
            .ToListAsync();
        var deletedBooks = bookIds.Count;

        var books = await dbContext.Books
            .Where(book => bookIds.Contains(book.Id))
            .ToListAsync();
        dbContext.Books.RemoveRange(books);

        var tags = await inventoryAccess.ScopeTags(dbContext.Tags, User).ToListAsync();
        var collections = await inventoryAccess.ScopeCollections(dbContext.Collections, User).ToListAsync();
        var locations = await inventoryAccess.ScopeLocations(dbContext.Locations, User).ToListAsync();
        dbContext.Tags.RemoveRange(tags);
        dbContext.Collections.RemoveRange(collections);
        dbContext.Locations.RemoveRange(locations);

        await dbContext.SaveChangesAsync();
        await authHistoryLog.LogAsync(account, "stallioneer.library_deleted", new
        {
            books = deletedBooks,
            tags = tags.Count,
            collections = collections.Count,
            locations = locations.Count
        });

        StatusMessage = $"Deleted {deletedBooks} book entries from the library.";
        return RedirectToPage();
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

    private async Task<AppSnapshot> LoadSnapshotAsync()
    {
        var visibleBooks = inventoryAccess.ScopeBooks(dbContext.Books, User);
        return new AppSnapshot
        {
            TotalBooks = await visibleBooks.CountAsync(),
            TotalItems = await visibleBooks.SumAsync(book => (int?)book.Quantity) ?? 0,
            TotalTags = await inventoryAccess.ScopeTags(dbContext.Tags, User).CountAsync(),
            TotalCollections = await inventoryAccess.ScopeCollections(dbContext.Collections, User).CountAsync(),
            TotalLocations = await inventoryAccess.ScopeLocations(dbContext.Locations, User).CountAsync()
        };
    }

    public sealed class AppSnapshot
    {
        public int TotalBooks { get; set; }

        public int TotalItems { get; set; }

        public int TotalTags { get; set; }

        public int TotalCollections { get; set; }

        public int TotalLocations { get; set; }
    }
}
