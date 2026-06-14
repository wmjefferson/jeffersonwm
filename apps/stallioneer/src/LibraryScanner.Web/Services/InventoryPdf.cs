using System.Text;
using LibraryScanner.Web.Models;

namespace LibraryScanner.Web.Services;

public static class InventoryPdf
{
    private const int PageWidth = 612;
    private const int PageHeight = 792;
    private const int LeftMargin = 48;
    private const int TopMargin = 56;
    private const int LineHeight = 14;
    private const int BottomMargin = 48;
    private const int MaxLineCharacters = 96;

    public static byte[] ExportBooks(IEnumerable<Book> books, IReadOnlyList<InventoryExportField> fields)
    {
        var pages = BuildPageStreams(books, fields);
        return BuildPdf(pages);
    }

    private static List<string> BuildPageStreams(IEnumerable<Book> books, IReadOnlyList<InventoryExportField> fields)
    {
        var pages = new List<string>();
        var builder = new StringBuilder();
        var y = PageHeight - TopMargin;

        void StartPage()
        {
            builder = new StringBuilder();
            y = PageHeight - TopMargin;
            WriteLine("Stallioneer Inventory Export", 14, true);
            WriteLine($"Generated {DateTime.Now:yyyy-MM-dd HH:mm}", 9);
            y -= 8;
        }

        void FinishPage()
        {
            if (builder.Length > 0)
            {
                pages.Add(builder.ToString());
            }
        }

        void EnsureSpace(int neededLines)
        {
            if (y - neededLines * LineHeight >= BottomMargin)
            {
                return;
            }

            FinishPage();
            StartPage();
        }

        void WriteLine(string text, int fontSize = 10, bool bold = false)
        {
            EnsureRawLineSpace();
            builder.AppendLine($"BT /{(bold ? "F2" : "F1")} {fontSize} Tf {LeftMargin} {y} Td ({EscapePdfText(text)}) Tj ET");
            y -= LineHeight;
        }

        void EnsureRawLineSpace()
        {
            if (y - LineHeight < BottomMargin)
            {
                FinishPage();
                StartPage();
            }
        }

        StartPage();
        foreach (var book in books)
        {
            EnsureSpace(fields.Count + 2);
            WriteLine(book.Title, 11, true);

            foreach (var field in fields)
            {
                var value = field.Value(book);
                if (string.IsNullOrWhiteSpace(value))
                {
                    continue;
                }

                foreach (var line in Wrap($"{field.Label}: {value.Trim()}"))
                {
                    WriteLine(line);
                }
            }

            y -= 6;
        }

        FinishPage();
        return pages.Count == 0 ? [""] : pages;
    }

    private static IReadOnlyList<string> Wrap(string text)
    {
        if (text.Length <= MaxLineCharacters)
        {
            return [text];
        }

        var lines = new List<string>();
        var remaining = text;
        while (remaining.Length > MaxLineCharacters)
        {
            var breakAt = remaining.LastIndexOf(' ', MaxLineCharacters);
            if (breakAt <= 0)
            {
                breakAt = MaxLineCharacters;
            }

            lines.Add(remaining[..breakAt].Trim());
            remaining = remaining[breakAt..].Trim();
        }

        if (!string.IsNullOrWhiteSpace(remaining))
        {
            lines.Add(remaining);
        }

        return lines;
    }

    private static byte[] BuildPdf(IReadOnlyList<string> pageStreams)
    {
        var objects = new List<string>
        {
            "<< /Type /Catalog /Pages 2 0 R >>",
            string.Empty,
            "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
            "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"
        };

        var pageObjectNumbers = new List<int>();
        foreach (var stream in pageStreams)
        {
            var contentObjectNumber = objects.Count + 1;
            objects.Add($"<< /Length {Encoding.ASCII.GetByteCount(stream)} >>\nstream\n{stream}endstream");

            var pageObjectNumber = objects.Count + 1;
            pageObjectNumbers.Add(pageObjectNumber);
            objects.Add($"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {PageWidth} {PageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents {contentObjectNumber} 0 R >>");
        }

        objects[1] = $"<< /Type /Pages /Kids [{string.Join(" ", pageObjectNumbers.Select(number => $"{number} 0 R"))}] /Count {pageObjectNumbers.Count} >>";

        using var memory = new MemoryStream();
        WriteAscii(memory, "%PDF-1.4\n");
        var offsets = new List<long> { 0 };

        for (var index = 0; index < objects.Count; index++)
        {
            offsets.Add(memory.Position);
            WriteAscii(memory, $"{index + 1} 0 obj\n{objects[index]}\nendobj\n");
        }

        var xrefOffset = memory.Position;
        WriteAscii(memory, $"xref\n0 {objects.Count + 1}\n");
        WriteAscii(memory, "0000000000 65535 f \n");
        foreach (var offset in offsets.Skip(1))
        {
            WriteAscii(memory, $"{offset:0000000000} 00000 n \n");
        }

        WriteAscii(memory, $"trailer\n<< /Size {objects.Count + 1} /Root 1 0 R >>\nstartxref\n{xrefOffset}\n%%EOF\n");
        return memory.ToArray();
    }

    private static string EscapePdfText(string value)
    {
        var ascii = Encoding.ASCII.GetString(Encoding.ASCII.GetBytes(value));
        return ascii
            .Replace("\\", "\\\\", StringComparison.Ordinal)
            .Replace("(", "\\(", StringComparison.Ordinal)
            .Replace(")", "\\)", StringComparison.Ordinal);
    }

    private static void WriteAscii(Stream stream, string value)
    {
        var bytes = Encoding.ASCII.GetBytes(value);
        stream.Write(bytes, 0, bytes.Length);
    }
}
