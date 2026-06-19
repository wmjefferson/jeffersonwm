using System.ComponentModel.DataAnnotations;

namespace LibraryScanner.Web.Models;

public class BookCopy
{
    public int Id { get; set; }

    public int BookId { get; set; }

    public Book Book { get; set; } = null!;

    public int? LocationId { get; set; }

    public Location? Location { get; set; }

    [StringLength(80)]
    public string Condition { get; set; } = "Unspecified";

    [StringLength(80)]
    public string Status { get; set; } = "Owned";

    [StringLength(4000)]
    public string? Notes { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public List<BookCopyTag> BookCopyTags { get; set; } = [];
}
