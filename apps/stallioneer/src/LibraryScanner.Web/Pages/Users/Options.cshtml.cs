using System.ComponentModel.DataAnnotations;
using System.Text;
using System.Text.Json;
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
    public List<string> ExportFieldKeys { get; set; } = [];

    [BindProperty]
    public string? DeleteConfirmationCount { get; set; }

    public string DeleteConfirmationWord => NumberToWords(Snapshot.TotalBooks);

    [TempData]
    public string? StatusMessage { get; set; }

    public async Task OnGetAsync()
    {
        Snapshot = await LoadSnapshotAsync();
    }

    public async Task<IActionResult> OnPostExportAsync()
    {
        var fields = InventoryExportField.Select(ExportFieldKeys);
        var books = await GetInventoryBooksAsync();
        var csv = InventoryCsv.ExportBooks(books, fields);
        var fileName = $"stallioneer-inventory-{DateTime.UtcNow:yyyyMMdd-HHmmss}.csv";
        await authHistoryLog.LogAsync(inventoryAccess.GetAccount(User), "stallioneer.exported", new
        {
            type = "inventory-csv",
            count = books.Count,
            fields = fields.Select(field => field.Key).ToArray(),
            fileName,
            books = CreateExportElements(books)
        });
        return File(Encoding.UTF8.GetBytes(csv), "text/csv", fileName);
    }

    public async Task<IActionResult> OnPostExportPdfAsync()
    {
        var fields = InventoryExportField.Select(ExportFieldKeys);
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

    public async Task<IActionResult> OnPostExportJsonAsync()
    {
        var fields = InventoryExportField.Select(ExportFieldKeys);
        var books = await GetInventoryBooksAsync();
        var fileName = $"stallioneer-inventory-{DateTime.UtcNow:yyyyMMdd-HHmmss}.json";
        var payload = new
        {
            exportedAt = DateTimeOffset.UtcNow,
            type = "inventory-json",
            count = books.Count,
            fields = fields.Select(field => new { field.Key, field.Label }).ToArray(),
            books = books.Select(book => new
            {
                book.Id,
                values = fields.ToDictionary(field => field.Key, field => field.Value(book) ?? string.Empty)
            }).ToArray()
        };
        var json = JsonSerializer.Serialize(payload, new JsonSerializerOptions { WriteIndented = true });
        await authHistoryLog.LogAsync(inventoryAccess.GetAccount(User), "stallioneer.exported", new
        {
            type = "inventory-json",
            count = books.Count,
            fields = fields.Select(field => field.Key).ToArray(),
            fileName,
            books = CreateExportElements(books)
        });
        return File(Encoding.UTF8.GetBytes(json), "application/json", fileName);
    }

    public async Task<IActionResult> OnPostDeleteLibraryAsync()
    {
        Snapshot = await LoadSnapshotAsync();
        var expectedConfirmation = DeleteConfirmationWord;
        if (!string.Equals(NormalizeConfirmation(DeleteConfirmationCount), NormalizeConfirmation(expectedConfirmation), StringComparison.OrdinalIgnoreCase))
        {
            ModelState.AddModelError(nameof(DeleteConfirmationCount), $"Enter {expectedConfirmation} to confirm.");
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

    private static string NormalizeConfirmation(string? value)
    {
        return string.Join(string.Empty, (value ?? string.Empty)
            .Where(char.IsLetterOrDigit));
    }

    private static string NumberToWords(int number)
    {
        if (number == 0)
        {
            return "Zero";
        }

        if (number < 0)
        {
            return $"Negative {NumberToWords(Math.Abs(number))}";
        }

        return string.Join(" ", NumberToWordsParts(number));
    }

    private static IEnumerable<string> NumberToWordsParts(int number)
    {
        string[] smallNumbers =
        [
            "Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
            "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
            "Seventeen", "Eighteen", "Nineteen"
        ];
        string[] tens =
        [
            string.Empty, string.Empty, "Twenty", "Thirty", "Forty", "Fifty",
            "Sixty", "Seventy", "Eighty", "Ninety"
        ];

        if (number < 20)
        {
            yield return smallNumbers[number];
            yield break;
        }

        if (number < 100)
        {
            yield return tens[number / 10];
            if (number % 10 > 0)
            {
                yield return smallNumbers[number % 10];
            }
            yield break;
        }

        if (number < 1000)
        {
            yield return smallNumbers[number / 100];
            yield return "Hundred";
            if (number % 100 > 0)
            {
                foreach (var part in NumberToWordsParts(number % 100))
                {
                    yield return part;
                }
            }
            yield break;
        }

        if (number < 1_000_000)
        {
            foreach (var part in NumberToWordsParts(number / 1000))
            {
                yield return part;
            }
            yield return "Thousand";
            if (number % 1000 > 0)
            {
                foreach (var part in NumberToWordsParts(number % 1000))
                {
                    yield return part;
                }
            }
            yield break;
        }

        foreach (var part in NumberToWordsParts(number / 1_000_000))
        {
            yield return part;
        }
        yield return "Million";
        if (number % 1_000_000 > 0)
        {
            foreach (var part in NumberToWordsParts(number % 1_000_000))
            {
                yield return part;
            }
        }
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
