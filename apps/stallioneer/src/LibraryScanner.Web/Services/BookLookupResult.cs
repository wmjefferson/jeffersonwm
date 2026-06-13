namespace LibraryScanner.Web.Services;

public sealed record BookLookupResult(
    string Isbn13,
    string? Isbn10,
    string Title,
    string? Authors,
    string? Publisher,
    string? PublishedDate,
    string? CoverImageUrl,
    string? Description,
    int? PageCount,
    string? Categories,
    string? Language,
    string? InfoUrl,
    string Source);
