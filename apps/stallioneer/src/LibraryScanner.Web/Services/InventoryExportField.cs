using LibraryScanner.Web.Models;

namespace LibraryScanner.Web.Services;

public sealed record InventoryExportField(string Key, string Label, Func<Book, string?> Value)
{
    public static readonly IReadOnlyList<InventoryExportField> All =
    [
        new(InventoryCsv.Isbn13, "ISBN-13", book => book.Isbn13),
        new(InventoryCsv.Isbn10, "ISBN-10", book => book.Isbn10),
        new(InventoryCsv.Title, "Title", book => book.Title),
        new(InventoryCsv.Authors, "Authors", book => book.Authors),
        new(InventoryCsv.Publisher, "Publisher", book => book.Publisher),
        new(InventoryCsv.PublishedDate, "Published", book => book.PublishedDate),
        new(InventoryCsv.PageCount, "Pages", book => book.PageCount?.ToString()),
        new(InventoryCsv.Language, "Language", book => book.Language),
        new(InventoryCsv.Tags, "Tags", book => string.Join("; ", book.BookTags.OrderBy(item => item.Tag.Name).Select(item => item.Tag.Name))),
        new(InventoryCsv.Notes, "Notes", book => book.Notes),
        new(InventoryCsv.Quantity, "Quantity", book => book.Quantity.ToString()),
        new(InventoryCsv.Location, "Location", book => book.Location?.Name),
        new(InventoryCsv.Status, "Status", book => book.Status),
        new(InventoryCsv.Collections, "Collections", book => string.Join("; ", book.CollectionBooks.OrderBy(item => item.Collection.Name).Select(item => item.Collection.Name)))
    ];

    public static readonly IReadOnlySet<string> DefaultPdfKeys = new HashSet<string>
    {
        InventoryCsv.Title,
        InventoryCsv.Authors,
        InventoryCsv.Isbn13,
        InventoryCsv.Quantity,
        InventoryCsv.Location,
        InventoryCsv.Tags,
        InventoryCsv.Collections,
        InventoryCsv.Status
    };

    public static IReadOnlyList<InventoryExportField> Select(IEnumerable<string>? keys)
    {
        var selectedKeys = keys?.Where(key => !string.IsNullOrWhiteSpace(key)).ToHashSet(StringComparer.OrdinalIgnoreCase)
            ?? [];

        return selectedKeys.Count == 0
            ? All.Where(field => DefaultPdfKeys.Contains(field.Key)).ToList()
            : All.Where(field => selectedKeys.Contains(field.Key)).ToList();
    }
}
