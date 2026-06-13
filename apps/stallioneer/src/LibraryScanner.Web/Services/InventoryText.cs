using System.Text.RegularExpressions;

namespace LibraryScanner.Web.Services;

public static partial class InventoryText
{
    public static string NormalizeName(string value)
    {
        return WhiteSpaceRegex().Replace(value.Trim(), " ").ToUpperInvariant();
    }

    public static IReadOnlyList<string> ParseTags(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return [];
        }

        return value.Split([',', ';'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(tag => !string.IsNullOrWhiteSpace(tag))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(50)
            .ToList();
    }

    public static string DefaultTagColor(string name)
    {
        var colors = new[] { "#245f4c", "#6f4e7c", "#8a5a2b", "#2f5f8f", "#7d3f3f", "#4e6f35" };
        var index = Math.Abs(StringComparer.OrdinalIgnoreCase.GetHashCode(name)) % colors.Length;
        return colors[index];
    }

    [GeneratedRegex(@"\s+")]
    private static partial Regex WhiteSpaceRegex();
}
