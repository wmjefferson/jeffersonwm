using System.Text;
using LibraryScanner.Web.Models;

namespace LibraryScanner.Web.Services;

public static class InventoryLogCsv
{
    private static readonly string[] Headers =
    [
        "timestamp_local",
        "event_type",
        "quantity_delta",
        "title",
        "isbn13",
        "note"
    ];

    public static string ExportEvents(IEnumerable<InventoryEvent> events)
    {
        var builder = new StringBuilder();
        builder.AppendLine(string.Join(",", Headers.Select(Escape)));

        foreach (var inventoryEvent in events)
        {
            var row = new[]
            {
                inventoryEvent.CreatedAt.ToLocalTime().ToString("yyyy-MM-dd HH:mm:ss zzz"),
                inventoryEvent.EventType,
                inventoryEvent.QuantityDelta.ToString(),
                inventoryEvent.Book?.Title,
                inventoryEvent.Book?.Isbn13,
                inventoryEvent.Note
            };

            builder.AppendLine(string.Join(",", row.Select(Escape)));
        }

        return builder.ToString();
    }

    private static string Escape(string? value)
    {
        var text = value ?? string.Empty;
        if (text.Contains('"'))
        {
            text = text.Replace("\"", "\"\"");
        }

        return text.IndexOfAny([',', '"', '\r', '\n']) >= 0
            ? $"\"{text}\""
            : text;
    }
}
