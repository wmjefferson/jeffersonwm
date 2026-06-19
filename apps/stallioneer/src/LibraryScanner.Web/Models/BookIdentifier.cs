using System.ComponentModel.DataAnnotations;

namespace LibraryScanner.Web.Models;

public class BookIdentifier
{
    public int Id { get; set; }

    public int BookId { get; set; }

    public Book Book { get; set; } = null!;

    [Required]
    [StringLength(20)]
    public string Type { get; set; } = BookIdentifierType.Internal;

    [Required]
    [StringLength(120)]
    public string Value { get; set; } = string.Empty;

    [Required]
    [StringLength(120)]
    public string NormalizedValue { get; set; } = string.Empty;

    public bool IsPrimary { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
