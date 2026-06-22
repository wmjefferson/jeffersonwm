using System.ComponentModel.DataAnnotations;

namespace LibraryScanner.Web.Models;

public class Book
{
    public int Id { get; set; }

    [Required]
    [Display(Name = "ISBN-13")]
    public string Isbn13 { get; set; } = string.Empty;

    [Display(Name = "ISBN-10")]
    public string? Isbn10 { get; set; }

    [Required]
    [StringLength(300)]
    public string Title { get; set; } = string.Empty;

    [StringLength(500)]
    public string? Authors { get; set; }

    [StringLength(200)]
    public string? Publisher { get; set; }

    [Display(Name = "Published")]
    [StringLength(50)]
    public string? PublishedDate { get; set; }

    [Display(Name = "Cover")]
    [StringLength(1000)]
    public string? CoverImageUrl { get; set; }

    [Display(Name = "Metadata source")]
    [StringLength(80)]
    public string? MetadataSource { get; set; }

    [StringLength(4000)]
    public string? Description { get; set; }

    [Display(Name = "Pages")]
    public int? PageCount { get; set; }

    [StringLength(500)]
    public string? Categories { get; set; }

    [StringLength(40)]
    public string? Language { get; set; }

    [Display(Name = "More info URL")]
    [StringLength(1000)]
    public string? InfoUrl { get; set; }

    // Transitional cached aggregate while the UI moves from book quantity to copy records.
    [Range(0, 100000)]
    public int Quantity { get; set; } = 1;

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

    public List<InventoryEvent> InventoryEvents { get; set; } = [];

    public List<BookTag> BookTags { get; set; } = [];

    public List<CollectionBook> CollectionBooks { get; set; } = [];

    public List<BookIdentifier> Identifiers { get; set; } = [];

    public List<BookCopy> Copies { get; set; } = [];

    public List<BookAdditionalInfo> AdditionalInfos { get; set; } = [];

    public List<BookCover> Covers { get; set; } = [];

    public int EffectiveQuantity => Copies.Count > 0 ? Copies.Count : Quantity;
}
