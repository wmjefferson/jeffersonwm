using System.ComponentModel.DataAnnotations;

namespace LibraryScanner.Web.Models;

public class Tag
{
    public int Id { get; set; }

    [Required]
    [StringLength(80)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [StringLength(80)]
    public string NormalizedName { get; set; } = string.Empty;

    [Required]
    [StringLength(20)]
    public string Color { get; set; } = "#245f4c";

    [StringLength(1000)]
    public string? Description { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public List<BookTag> BookTags { get; set; } = [];

    public List<BookCopyTag> BookCopyTags { get; set; } = [];
}
