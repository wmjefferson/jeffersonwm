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
    private static readonly IReadOnlyList<SelectListItem> AdditionalInfoTypes =
    [
        new("Text note", BookAdditionalInfoType.Text),
        new("Link", BookAdditionalInfoType.Link),
        new("Related title", BookAdditionalInfoType.RelatedTitle),
        new("Reference", BookAdditionalInfoType.Reference)
    ];

    [BindProperty]
    public BookInput Input { get; set; } = new();

    public List<SelectListItem> LocationOptions { get; private set; } = [];

    public IReadOnlyList<Tag> AvailableTags { get; private set; } = [];

    public IReadOnlyList<SelectListItem> AdditionalInfoTypeOptions { get; private set; } = AdditionalInfoTypes;

    [TempData]
    public string? StatusMessage { get; set; }

    public async Task<IActionResult> OnGetAsync(int id)
    {
        var book = await dbContext.Books
            .AsNoTracking()
            .Include(book => book.Location)
            .Include(book => book.AdditionalInfos)
            .Include(book => book.Copies)
            .ThenInclude(copy => copy.Location)
            .Include(book => book.Copies)
            .ThenInclude(copy => copy.BookCopyTags)
            .ThenInclude(copyTag => copyTag.Tag)
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
            .ThenInclude(bookTag => bookTag.Tag)
            .Include(book => book.AdditionalInfos)
            .Include(book => book.Copies)
            .ThenInclude(copy => copy.BookCopyTags)
            .ThenInclude(copyTag => copyTag.Tag)
            .Include(book => book.Copies)
            .FirstOrDefaultAsync(book => book.Id == Input.Id);

        if (book is null)
        {
            return NotFound();
        }

        var previousQuantity = book.Copies.Count > 0 ? book.Copies.Count : book.Quantity;
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
        book.UpdatedAt = DateTimeOffset.UtcNow;

        await SyncCopiesAsync(book);
        await SyncBookTagsAsync(book, Input.TagNames);
        SyncAdditionalInfos(book);

        var quantityDelta = book.Copies.Count - previousQuantity;
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

    public async Task<IActionResult> OnPostDeleteAsync()
    {
        var book = await dbContext.Books.FirstOrDefaultAsync(book => book.Id == Input.Id);
        if (book is null)
        {
            return NotFound();
        }

        dbContext.Books.Remove(book);
        await dbContext.SaveChangesAsync();
        StatusMessage = $"Deleted {book.Title}.";
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
        AdditionalInfoTypeOptions = AdditionalInfoTypes;
    }

    private async Task SyncBookTagsAsync(Book book, string? tagNames)
    {
        var tags = await ResolveTagsAsync(tagNames);

        book.BookTags.Clear();
        foreach (var tag in tags)
        {
            book.BookTags.Add(new BookTag { Book = book, Tag = tag });
        }
    }

    private async Task SyncCopiesAsync(Book book)
    {
        var inputsById = Input.Copies
            .Where(copy => copy.Id != 0)
            .ToDictionary(copy => copy.Id);
        var newCopyInputs = Input.Copies
            .Where(copy => copy.Id == 0 && !copy.Remove)
            .ToList();
        var locationIds = Input.Copies
            .Where(copy => !copy.Remove && copy.LocationId.HasValue)
            .Select(copy => copy.LocationId!.Value)
            .Distinct()
            .ToList();
        var existingLocations = await dbContext.Locations
            .Where(location => locationIds.Contains(location.Id))
            .ToDictionaryAsync(location => location.Id);

        foreach (var copy in book.Copies.OrderBy(copy => copy.Id).ToList())
        {
            if (!inputsById.TryGetValue(copy.Id, out var inputCopy) || inputCopy.Remove)
            {
                book.Copies.Remove(copy);
                dbContext.BookCopies.Remove(copy);
                continue;
            }

            var copyLocation = inputCopy.LocationId is int locationId && existingLocations.TryGetValue(locationId, out var location)
                ? location
                : null;

            copy.Location = copyLocation;
            copy.LocationId = copyLocation?.Id;
            copy.Condition = inputCopy.Condition;
            copy.Status = inputCopy.Status;
            copy.Notes = string.IsNullOrWhiteSpace(inputCopy.Notes) ? null : inputCopy.Notes.Trim();
            copy.UpdatedAt = DateTimeOffset.UtcNow;
            await SyncCopyTagsAsync(copy, inputCopy.TagNames);
        }

        foreach (var source in newCopyInputs)
        {
            var sourceLocation = source.LocationId is int locationId && existingLocations.TryGetValue(locationId, out var resolvedLocation)
                ? resolvedLocation
                : null;

            var newCopy = new BookCopy
            {
                Book = book,
                Location = sourceLocation,
                LocationId = sourceLocation?.Id,
                Condition = string.IsNullOrWhiteSpace(source.Condition) ? "Unspecified" : source.Condition,
                Status = string.IsNullOrWhiteSpace(source.Status) ? "Owned" : source.Status,
                Notes = string.IsNullOrWhiteSpace(source.Notes) ? null : source.Notes.Trim(),
                BookCopyTags = []
            };
            book.Copies.Add(newCopy);
            await SyncCopyTagsAsync(newCopy, source.TagNames);
        }

        if (book.Copies.Count == 0)
        {
            book.Copies.Add(new BookCopy
            {
                Book = book,
                Condition = "Unspecified",
                Status = "Owned",
                BookCopyTags = []
            });
        }

        book.Quantity = Math.Max(1, book.Copies.Count);

        var primaryCopy = book.Copies
            .OrderBy(copy => copy.Id == 0 ? int.MaxValue : copy.Id)
            .FirstOrDefault();

        book.Location = primaryCopy?.Location;
        book.LocationId = primaryCopy?.LocationId;
        book.Condition = primaryCopy?.Condition ?? "Unspecified";
        book.Status = primaryCopy?.Status ?? "Owned";
        book.Notes = primaryCopy?.Notes;
    }

    private async Task SyncCopyTagsAsync(BookCopy copy, string? tagNames)
    {
        var tags = await ResolveTagsAsync(tagNames);

        copy.BookCopyTags.Clear();
        foreach (var tag in tags)
        {
            copy.BookCopyTags.Add(new BookCopyTag
            {
                BookCopy = copy,
                Tag = tag
            });
        }
    }

    private async Task<List<Tag>> ResolveTagsAsync(string? tagNames)
    {
        var requestedTagNames = InventoryText.ParseTags(tagNames);
        if (requestedTagNames.Count == 0)
        {
            return [];
        }

        var normalizedNames = requestedTagNames
            .Select(InventoryText.NormalizeName)
            .ToList();
        var existingTags = await dbContext.Tags
            .Where(tag => normalizedNames.Contains(tag.NormalizedName))
            .ToDictionaryAsync(tag => tag.NormalizedName);

        var resolvedTags = new List<Tag>(requestedTagNames.Count);
        for (var index = 0; index < requestedTagNames.Count; index++)
        {
            var tagName = requestedTagNames[index];
            var normalizedName = normalizedNames[index];

            if (!existingTags.TryGetValue(normalizedName, out var tag))
            {
                tag = new Tag
                {
                    Name = tagName.Trim(),
                    NormalizedName = normalizedName,
                    Color = InventoryText.DefaultTagColor(tagName)
                };
                dbContext.Tags.Add(tag);
                existingTags[normalizedName] = tag;
            }

            resolvedTags.Add(tag);
        }

        return resolvedTags;
    }

    private void SyncAdditionalInfos(Book book)
    {
        if (book.AdditionalInfos.Count > 0)
        {
            dbContext.BookAdditionalInfos.RemoveRange(book.AdditionalInfos);
            book.AdditionalInfos.Clear();
        }

        var nextSortOrder = 0;
        foreach (var info in Input.AdditionalInfos)
        {
            var label = string.IsNullOrWhiteSpace(info.Label) ? null : info.Label.Trim();
            var value = string.IsNullOrWhiteSpace(info.Value) ? null : info.Value.Trim();
            if (value is null)
            {
                continue;
            }

            book.AdditionalInfos.Add(new BookAdditionalInfo
            {
                Book = book,
                Type = string.IsNullOrWhiteSpace(info.Type) ? BookAdditionalInfoType.Text : info.Type,
                Label = label,
                Value = value,
                SortOrder = nextSortOrder++
            });
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

        [Display(Name = "Tags")]
        [StringLength(1000)]
        public string? TagNames { get; set; }

        public List<CopyInput> Copies { get; set; } = [];

        public List<AdditionalInfoInput> AdditionalInfos { get; set; } = [];

        public static BookInput FromBook(Book book)
        {
            var copies = book.Copies
                .OrderBy(copy => copy.Id)
                .ToList();
            var additionalInfos = book.AdditionalInfos
                .OrderBy(info => info.SortOrder)
                .ThenBy(info => info.Id)
                .ToList();
            var primaryCopy = copies
                .OrderBy(copy => copy.Id)
                .FirstOrDefault();

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
                TagNames = string.Join(", ", book.BookTags.Select(bookTag => bookTag.Tag.Name).Order()),
                Copies = (copies.Count > 0 ? copies : [new BookCopy
                {
                    Condition = book.Condition,
                    Status = book.Status,
                    Notes = book.Notes,
                    LocationId = book.LocationId,
                    Location = book.Location,
                    BookCopyTags = []
                }]).Select(copy => new CopyInput
                {
                    Id = copy.Id,
                    LocationId = copy.LocationId,
                    Condition = copy.Condition,
                    Status = copy.Status,
                    Notes = copy.Notes,
                    TagNames = string.Join(", ", copy.BookCopyTags.Select(copyTag => copyTag.Tag.Name).Order())
                }).ToList(),
                AdditionalInfos = additionalInfos.Count > 0
                    ? additionalInfos.Select(info => new AdditionalInfoInput
                    {
                        Id = info.Id,
                        Type = info.Type,
                        Label = info.Label,
                        Value = info.Value
                    }).ToList()
                    : [new AdditionalInfoInput()]
            };
        }
    }

    public class CopyInput
    {
        public int Id { get; set; }

        [Display(Name = "Location")]
        public int? LocationId { get; set; }

        [StringLength(80)]
        public string Condition { get; set; } = "Unspecified";

        [StringLength(80)]
        public string Status { get; set; } = "Owned";

        [StringLength(4000)]
        public string? Notes { get; set; }

        [Display(Name = "Copy tags")]
        [StringLength(1000)]
        public string? TagNames { get; set; }

        public bool Remove { get; set; }
    }

    public class AdditionalInfoInput
    {
        public int Id { get; set; }

        [StringLength(40)]
        public string Type { get; set; } = BookAdditionalInfoType.Text;

        [StringLength(120)]
        public string? Label { get; set; }

        [StringLength(4000)]
        public string? Value { get; set; }
    }
}
