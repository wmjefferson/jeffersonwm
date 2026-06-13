using System.ComponentModel.DataAnnotations;
using LibraryScanner.Web.Data;
using LibraryScanner.Web.Models;
using LibraryScanner.Web.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.EntityFrameworkCore;

namespace LibraryScanner.Web.Pages.Books;

[Authorize]
public class EditModel(ApplicationDbContext dbContext) : PageModel
{
    [BindProperty]
    public BookInput Input { get; set; } = new();

    public List<SelectListItem> LocationOptions { get; private set; } = [];

    public IReadOnlyList<Tag> AvailableTags { get; private set; } = [];

    public async Task<IActionResult> OnGetAsync(int id)
    {
        var book = await dbContext.Books
            .AsNoTracking()
            .Include(book => book.Location)
            .Include(book => book.BookTags)
            .ThenInclude(bookTag => bookTag.Tag)
            .FirstOrDefaultAsync(book => book.Id == id);

        if (book is null)
        {
            return NotFound();
        }

        Input = BookInput.FromBook(book);
        await LoadOptionsAsync();
        return Page();
    }

    public async Task<IActionResult> OnPostAsync()
    {
        if (!ModelState.IsValid)
        {
            await LoadOptionsAsync();
            return Page();
        }

        var book = await dbContext.Books
            .Include(book => book.BookTags)
            .FirstOrDefaultAsync(book => book.Id == Input.Id);

        if (book is null)
        {
            return NotFound();
        }

        var previousQuantity = book.Quantity;
        var location = await ResolveLocationAsync();

        book.Title = Input.Title;
        book.Authors = Input.Authors;
        book.Publisher = Input.Publisher;
        book.PublishedDate = Input.PublishedDate;
        book.CoverImageUrl = Input.CoverImageUrl;
        book.Description = Input.Description;
        book.PageCount = Input.PageCount;
        book.Categories = Input.Categories;
        book.Language = Input.Language;
        book.InfoUrl = Input.InfoUrl;
        book.Quantity = Input.Quantity;
        book.Location = location;
        book.LocationId = location?.Id;
        book.Condition = Input.Condition;
        book.Status = Input.Status;
        book.Notes = Input.Notes;
        book.UpdatedAt = DateTimeOffset.UtcNow;

        await SyncTagsAsync(book, Input.TagNames);

        var quantityDelta = book.Quantity - previousQuantity;
        if (quantityDelta != 0)
        {
            dbContext.InventoryEvents.Add(new InventoryEvent
            {
                Book = book,
                EventType = "Quantity adjusted",
                QuantityDelta = quantityDelta,
                Note = "Edited from inventory screen"
            });
        }

        await dbContext.SaveChangesAsync();
        return RedirectToPage("/Books/Index");
    }

    private async Task LoadOptionsAsync()
    {
        var locations = await dbContext.Locations.AsNoTracking().OrderBy(location => location.Name).ToListAsync();
        LocationOptions = locations
            .Select(location => new SelectListItem(location.Name, location.Id.ToString()))
            .Prepend(new SelectListItem("No location", string.Empty))
            .ToList();

        AvailableTags = await dbContext.Tags.AsNoTracking().OrderBy(tag => tag.Name).ToListAsync();
    }

    private async Task<Location?> ResolveLocationAsync()
    {
        if (!string.IsNullOrWhiteSpace(Input.NewLocationName))
        {
            var normalized = InventoryText.NormalizeName(Input.NewLocationName);
            var location = await dbContext.Locations.FirstOrDefaultAsync(location => location.NormalizedName == normalized);
            if (location is not null)
            {
                return location;
            }

            location = new Location
            {
                Name = Input.NewLocationName.Trim(),
                NormalizedName = normalized
            };
            dbContext.Locations.Add(location);
            return location;
        }

        return Input.LocationId is null
            ? null
            : await dbContext.Locations.FirstOrDefaultAsync(location => location.Id == Input.LocationId);
    }

    private async Task SyncTagsAsync(Book book, string? tagNames)
    {
        book.BookTags.Clear();
        foreach (var tagName in InventoryText.ParseTags(tagNames))
        {
            var normalized = InventoryText.NormalizeName(tagName);
            var tag = await dbContext.Tags.FirstOrDefaultAsync(tag => tag.NormalizedName == normalized);
            if (tag is null)
            {
                tag = new Tag
                {
                    Name = tagName.Trim(),
                    NormalizedName = normalized,
                    Color = InventoryText.DefaultTagColor(tagName)
                };
                dbContext.Tags.Add(tag);
            }

            book.BookTags.Add(new BookTag { Book = book, Tag = tag });
        }
    }

    public class BookInput
    {
        public int Id { get; set; }

        [Display(Name = "ISBN-13")]
        public string Isbn13 { get; set; } = string.Empty;

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

        [Display(Name = "Cover URL")]
        [StringLength(1000)]
        public string? CoverImageUrl { get; set; }

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

        [Range(0, 100000)]
        public int Quantity { get; set; }

        [Display(Name = "Location")]
        public int? LocationId { get; set; }

        [Display(Name = "New location")]
        [StringLength(120)]
        public string? NewLocationName { get; set; }

        [Display(Name = "Tags")]
        [StringLength(1000)]
        public string? TagNames { get; set; }

        [StringLength(80)]
        public string Condition { get; set; } = "Unspecified";

        [StringLength(80)]
        public string Status { get; set; } = "Owned";

        [StringLength(4000)]
        public string? Notes { get; set; }

        public static BookInput FromBook(Book book)
        {
            return new BookInput
            {
                Id = book.Id,
                Isbn13 = book.Isbn13,
                Title = book.Title,
                Authors = book.Authors,
                Publisher = book.Publisher,
                PublishedDate = book.PublishedDate,
                CoverImageUrl = book.CoverImageUrl,
                Description = book.Description,
                PageCount = book.PageCount,
                Categories = book.Categories,
                Language = book.Language,
                InfoUrl = book.InfoUrl,
                Quantity = book.Quantity,
                LocationId = book.LocationId,
                TagNames = string.Join(", ", book.BookTags.Select(bookTag => bookTag.Tag.Name).Order()),
                Condition = book.Condition,
                Status = book.Status,
                Notes = book.Notes
            };
        }
    }
}
