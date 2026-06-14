using System.Text;
using LibraryScanner.Web.Models;

namespace LibraryScanner.Web.Services;

public static class InventoryCsv
{
    public const string Isbn13 = "isbn13";
    public const string Isbn10 = "isbn10";
    public const string Title = "title";
    public const string Authors = "authors";
    public const string Publisher = "publisher";
    public const string PublishedDate = "published_date";
    public const string CoverImageUrl = "cover_image_url";
    public const string MetadataSource = "metadata_source";
    public const string Description = "description";
    public const string PageCount = "page_count";
    public const string Categories = "categories";
    public const string Language = "language";
    public const string InfoUrl = "info_url";
    public const string Quantity = "quantity";
    public const string Location = "location";
    public const string Condition = "condition";
    public const string Status = "status";
    public const string Notes = "notes";
    public const string Tags = "tags";
    public const string Collections = "collections";

    public static readonly string[] Headers =
        InventoryExportField.All.Select(field => field.Key).ToArray();

    public static string ExportBooks(IEnumerable<Book> books)
    {
        var builder = new StringBuilder();
        builder.AppendLine(string.Join(",", Headers.Select(Escape)));

        foreach (var book in books)
        {
            var row = InventoryExportField.All.Select(field => field.Value(book));

            builder.AppendLine(string.Join(",", row.Select(Escape)));
        }

        return builder.ToString();
    }

    public static IReadOnlyList<Dictionary<string, string>> Parse(string content)
    {
        var rows = ParseRows(content);
        if (rows.Count == 0)
        {
            return [];
        }

        var headerRow = rows[0]
            .Select(header => header.Trim().ToLowerInvariant())
            .ToList();

        var data = new List<Dictionary<string, string>>();
        foreach (var row in rows.Skip(1))
        {
            if (row.All(cell => string.IsNullOrWhiteSpace(cell)))
            {
                continue;
            }

            var entry = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            for (var index = 0; index < headerRow.Count; index++)
            {
                var header = headerRow[index];
                if (string.IsNullOrWhiteSpace(header))
                {
                    continue;
                }

                entry[header] = index < row.Count ? row[index].Trim() : string.Empty;
            }

            data.Add(entry);
        }

        return data;
    }

    private static List<List<string>> ParseRows(string content)
    {
        var rows = new List<List<string>>();
        var row = new List<string>();
        var field = new StringBuilder();
        var inQuotes = false;

        for (var index = 0; index < content.Length; index++)
        {
            var ch = content[index];
            if (inQuotes)
            {
                if (ch == '"')
                {
                    if (index + 1 < content.Length && content[index + 1] == '"')
                    {
                        field.Append('"');
                        index++;
                    }
                    else
                    {
                        inQuotes = false;
                    }
                }
                else
                {
                    field.Append(ch);
                }

                continue;
            }

            switch (ch)
            {
                case '"':
                    inQuotes = true;
                    break;
                case ',':
                    row.Add(field.ToString());
                    field.Clear();
                    break;
                case '\r':
                    break;
                case '\n':
                    row.Add(field.ToString());
                    rows.Add(row);
                    row = [];
                    field.Clear();
                    break;
                default:
                    field.Append(ch);
                    break;
            }
        }

        if (field.Length > 0 || row.Count > 0)
        {
            row.Add(field.ToString());
            rows.Add(row);
        }

        return rows;
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
