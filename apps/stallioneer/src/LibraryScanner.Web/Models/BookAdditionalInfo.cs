using System.ComponentModel.DataAnnotations;

namespace LibraryScanner.Web.Models;

public class BookAdditionalInfo
{
    public int Id { get; set; }

    public int BookId { get; set; }

    public Book Book { get; set; } = null!;

    [Required]
    [StringLength(40)]
    public string Type { get; set; } = BookAdditionalInfoType.Text;

    [StringLength(120)]
    public string? Label { get; set; }

    [Required]
    [StringLength(4000)]
    public string Value { get; set; } = string.Empty;

    public int SortOrder { get; set; }
}
