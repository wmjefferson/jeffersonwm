using System.ComponentModel.DataAnnotations;

namespace LibraryScanner.Web.Models;

public class BookCover
{
    public int Id { get; set; }

    public int BookId { get; set; }

    public Book Book { get; set; } = null!;

    [Required]
    [StringLength(1000)]
    public string Url { get; set; } = string.Empty;

    [StringLength(80)]
    public string? Source { get; set; }

    [StringLength(120)]
    public string? Label { get; set; }

    public bool IsPrimary { get; set; }

    public int SortOrder { get; set; }
}
