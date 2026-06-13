using System.ComponentModel.DataAnnotations;

namespace LibraryScanner.Web.Models;

public class Location
{
    public int Id { get; set; }

    [Required]
    [StringLength(120)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [StringLength(120)]
    public string NormalizedName { get; set; } = string.Empty;

    [StringLength(1000)]
    public string? Description { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public List<Book> Books { get; set; } = [];
}
