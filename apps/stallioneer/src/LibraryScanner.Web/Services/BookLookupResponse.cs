namespace LibraryScanner.Web.Services;

public sealed record BookLookupCandidate(
    string Isbn13,
    string Title,
    string? Authors,
    string? Publisher,
    string? PublishedDate,
    string? CoverImageUrl,
    string Source);

public sealed record BookLookupResponse(
    BookLookupStatus Status,
    BookLookupResult? Result,
    string? NormalizedCode,
    string? Message = null,
    IReadOnlyList<BookLookupCandidate>? Candidates = null);
