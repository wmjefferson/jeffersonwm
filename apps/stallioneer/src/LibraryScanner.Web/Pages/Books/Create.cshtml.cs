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
public class CreateModel(ApplicationDbContext dbContext, IIsbnLookupService isbnLookupService) : PageModel
{
    [BindProperty]
    public BookInput Input { get; set; } = new();

    public string? LookupMessage { get; private set; }

    public string LookupMessageCssClass { get; private set; } = "alert-info";

    public IReadOnlyList<BookLookupCandidate> CandidateMatches { get; private set; } = [];

    public bool HasSelectedBook => !string.IsNullOrWhiteSpace(Input.Title);

    [TempData]
    public string? StatusMessage { get; set; }

    public List<SelectListItem> LocationOptions { get; private set; } = [];

    public IReadOnlyList<Tag> AvailableTags { get; private set; } = [];

    public async Task OnGetAsync(string? isbn)
    {
        if (!string.IsNullOrWhiteSpace(isbn))
        {
            Input.Isbn = isbn.Trim();
            await LookupCandidatesAsync(Input.Isbn);
        }

        await LoadOptionsAsync();
    }

    public async Task<IActionResult> OnPostLookupAsync()
    {
        ModelState.Clear();
        await LookupCandidatesAsync(Input.Isbn);
        await LoadOptionsAsync();
        return Page();
    }

    public async Task<IActionResult> OnPostReviewAsync()
    {
        ModelState.Clear();
        await LoadSelectedBookAsync(Input.Isbn);
        await LoadOptionsAsync();
        return Page();
    }

    public async Task<IActionResult> OnPostChooseCandidateAsync(string candidateIsbn)
    {
        ModelState.Clear();
        Input.Isbn = candidateIsbn;
        await LoadSelectedBookAsync(candidateIsbn);
        LookupMessage = "Selected match loaded into the book details below.";
        LookupMessageCssClass = "alert-info";
        await LoadOptionsAsync();
        return Page();
    }

    public IActionResult OnPostClear()
    {
        return RedirectToPage("/Books/Create");
    }

    public async Task<IActionResult> OnPostSaveAsync()
    {
        var isbn13 = IsbnNormalizer.ToIsbn13(Input.Isbn);
        if (isbn13 is null)
        {
            ModelState.AddModelError($"{nameof(Input)}.{nameof(Input.Isbn)}", "Enter a valid ISBN-10 or ISBN-13.");
        }

        if (string.IsNullOrWhiteSpace(Input.Title))
        {
            ModelState.AddModelError($"{nameof(Input)}.{nameof(Input.Title)}", "The Title field is required.");
        }

        if (!ModelState.IsValid)
        {
            await LoadOptionsAsync();
            return Page();
        }

        var location = await ResolveLocationAsync();
        var existingBook = await dbContext.Books
            .Include(book => book.BookTags)
            .FirstOrDefaultAsync(book => book.Isbn13 == isbn13);

        if (existingBook is not null)
        {
            var newQuantity = existingBook.Quantity + Input.Quantity;
            ApplyInput(existingBook, location);
            existingBook.Quantity = newQuantity;
            await SyncTagsAsync(existingBook, Input.TagNames);
            dbContext.InventoryEvents.Add(new InventoryEvent
            {
                Book = existingBook,
                EventType = "Quantity added",
                QuantityDelta = Input.Quantity,
                Note = "Added from ISBN entry"
            });
        }
        else
        {
            var book = new Book { Isbn13 = isbn13! };
            ApplyInput(book, location);
            dbContext.Books.Add(book);
            await SyncTagsAsync(book, Input.TagNames);
            dbContext.InventoryEvents.Add(new InventoryEvent
            {
                Book = book,
                EventType = "Created",
                QuantityDelta = Input.Quantity,
                Note = "Initial inventory entry"
            });
        }

        await dbContext.SaveChangesAsync();
        StatusMessage = $"Saved {Input.Title}.";
        return RedirectToPage("/Books/Index");
    }

    private void ApplyInput(Book book, Location? location)
    {
        book.Isbn10 = Input.Isbn10;
        book.Title = Input.Title;
        book.Authors = Input.Authors;
        book.Publisher = Input.Publisher;
        book.PublishedDate = Input.PublishedDate;
        book.CoverImageUrl = Input.CoverImageUrl;
        book.MetadataSource = Input.MetadataSource;
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
    }

    private async Task LookupCandidatesAsync(string? isbn)
    {
        var lookup = await isbnLookupService.LookupAsync(isbn ?? string.Empty);
        ApplyLookupOutcome(lookup, populateInput: false, showSuccessAsCandidate: true);
    }

    private async Task LoadSelectedBookAsync(string? isbn)
    {
        var isbn13 = IsbnNormalizer.ToIsbn13(isbn ?? string.Empty);
        if (isbn13 is null)
        {
            ApplyLookupOutcome(
                new BookLookupResponse(BookLookupStatus.InvalidCode, null, null, "Enter a valid ISBN-10, ISBN-13, or UPC code."),
                populateInput: false,
                showSuccessAsCandidate: false);
            return;
        }

        var existingBook = await dbContext.Books
            .AsNoTracking()
            .Include(book => book.Location)
            .Include(book => book.BookTags)
            .ThenInclude(bookTag => bookTag.Tag)
            .FirstOrDefaultAsync(book => book.Isbn13 == isbn13);

        if (existingBook is not null)
        {
            Input = BookInput.FromBook(existingBook);
            Input.Quantity = 1;
            CandidateMatches = [CreateCandidateFromBook(existingBook)];
            LookupMessage = "This ISBN is already in your inventory. Its details are loaded below.";
            LookupMessageCssClass = "alert-info";
            return;
        }

        var lookup = await isbnLookupService.LookupAsync(isbn13);
        ApplyLookupOutcome(lookup, populateInput: true, showSuccessAsCandidate: false);
    }

    private void ApplyLookupOutcome(BookLookupResponse lookup, bool populateInput, bool showSuccessAsCandidate)
    {
        CandidateMatches = lookup.Candidates ?? [];
        LookupMessage = lookup.Message;

        switch (lookup.Status)
        {
            case BookLookupStatus.Success when lookup.Result is not null:
                Input.Isbn = lookup.NormalizedCode ?? lookup.Result.Isbn13;
                if (populateInput)
                {
                    ApplyLookupResultToInput(lookup.Result);
                    CandidateMatches = [CreateCandidateFromResult(lookup.Result)];
                    LookupMessage = $"Loaded metadata from {lookup.Result.Source}.";
                }
                else if (showSuccessAsCandidate)
                {
                    ClearMetadataFields();
                    CandidateMatches = [CreateCandidateFromResult(lookup.Result)];
                    LookupMessage = "Match found. Select the cover or title to load the book details.";
                }
                else
                {
                    LookupMessage = $"Found metadata from {lookup.Result.Source}.";
                }

                LookupMessageCssClass = "alert-info";
                break;
            case BookLookupStatus.NotFound:
                ClearMetadataFields();
                Input.Isbn = lookup.NormalizedCode ?? Input.Isbn;
                LookupMessage ??= "No online match found. You can enter the details manually.";
                LookupMessageCssClass = "alert-warning";
                break;
            case BookLookupStatus.Ambiguous:
                ClearMetadataFields();
                Input.Isbn = lookup.NormalizedCode ?? Input.Isbn;
                LookupMessage ??= "More than one possible book matched that code.";
                LookupMessageCssClass = "alert-warning";
                break;
            default:
                ClearMetadataFields();
                Input.Isbn = lookup.NormalizedCode ?? Input.Isbn;
                LookupMessage ??= "Enter a valid ISBN-10, ISBN-13, or UPC code.";
                LookupMessageCssClass = "alert-danger";
                break;
        }
    }

    private static BookLookupCandidate CreateCandidateFromResult(BookLookupResult result)
    {
        return new BookLookupCandidate(
            result.Isbn13,
            result.Title,
            result.Authors,
            result.Publisher,
            result.PublishedDate,
            result.CoverImageUrl,
            result.Source);
    }

    private static BookLookupCandidate CreateCandidateFromBook(Book book)
    {
        return new BookLookupCandidate(
            book.Isbn13,
            book.Title,
            book.Authors,
            book.Publisher,
            book.PublishedDate,
            book.CoverImageUrl,
            book.MetadataSource ?? "Inventory");
    }

    private void ApplyLookupResultToInput(BookLookupResult result)
    {
        Input.Isbn = result.Isbn13;
        Input.Isbn10 = result.Isbn10;
        Input.Title = result.Title;
        Input.Authors = result.Authors;
        Input.Publisher = result.Publisher;
        Input.PublishedDate = result.PublishedDate;
        Input.CoverImageUrl = result.CoverImageUrl;
        Input.Description = result.Description;
        Input.PageCount = result.PageCount;
        Input.Categories = result.Categories;
        Input.Language = result.Language;
        Input.InfoUrl = result.InfoUrl;
        Input.MetadataSource = result.Source;
    }

    private void ClearMetadataFields()
    {
        Input.Isbn10 = null;
        Input.Title = string.Empty;
        Input.Authors = null;
        Input.Publisher = null;
        Input.PublishedDate = null;
        Input.CoverImageUrl = null;
        Input.Description = null;
        Input.PageCount = null;
        Input.Categories = null;
        Input.Language = null;
        Input.InfoUrl = null;
        Input.MetadataSource = null;
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
        [Required]
        [Display(Name = "ISBN")]
        public string Isbn { get; set; } = string.Empty;

        [Display(Name = "ISBN-10")]
        public string? Isbn10 { get; set; }

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

        [Display(Name = "Metadata source")]
        [StringLength(80)]
        public string? MetadataSource { get; set; }

        [Range(1, 100000)]
        public int Quantity { get; set; } = 1;

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
                Isbn = book.Isbn13,
                Isbn10 = book.Isbn10,
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
                MetadataSource = book.MetadataSource,
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
