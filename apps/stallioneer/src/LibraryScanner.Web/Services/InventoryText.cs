using System.Text.RegularExpressions;

namespace LibraryScanner.Web.Services;

public static partial class InventoryText
{
    private static readonly HashSet<string> LegacyTagColors = new(StringComparer.OrdinalIgnoreCase)
    {
        "#245f4c",
        "#6f4e7c",
        "#8a5a2b",
        "#2f5f8f",
        "#7d3f3f",
        "#4e6f35"
    };

    private static readonly string[] TagColors =
    [
        "#e11d48", // rose
        "#f97316", // orange
        "#d97706", // amber
        "#65a30d", // lime
        "#16a34a", // green
        "#0d9488", // teal
        "#0891b2", // cyan
        "#2563eb", // blue
        "#4f46e5", // indigo
        "#7c3aed", // violet
        "#c026d3", // fuchsia
        "#db2777", // pink
        "#be123c", // crimson
        "#b45309", // ochre
        "#15803d", // forest
        "#0f766e", // deep teal
        "#0369a1", // steel blue
        "#6d28d9", // royal violet
        "#a21caf", // orchid
        "#b91c1c"  // red
    ];

    public sealed record TagDefinition(string Name, string? Description);

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

    public static IReadOnlyList<TagDefinition> ParseTagDefinitions(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return [];
        }

        return value.Split([','], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(entry =>
            {
                var separatorIndex = entry.IndexOf('|');
                if (separatorIndex < 0)
                {
                    return new TagDefinition(entry.Trim(), null);
                }

                var name = entry[..separatorIndex].Trim();
                var description = entry[(separatorIndex + 1)..].Trim();
                return new TagDefinition(
                    name,
                    string.IsNullOrWhiteSpace(description) ? null : description);
            })
            .Where(definition => !string.IsNullOrWhiteSpace(definition.Name))
            .GroupBy(definition => NormalizeName(definition.Name), StringComparer.OrdinalIgnoreCase)
            .Select(group => group.First())
            .Take(50)
            .ToList();
    }

    public static string DefaultTagColor(string name)
    {
        var index = Math.Abs(StringComparer.OrdinalIgnoreCase.GetHashCode(name)) % TagColors.Length;
        return TagColors[index];
    }

    public static bool IsLegacyDefaultTagColor(string? color)
    {
        return !string.IsNullOrWhiteSpace(color) && LegacyTagColors.Contains(color.Trim());
    }

    [GeneratedRegex(@"\s+")]
    private static partial Regex WhiteSpaceRegex();
}
