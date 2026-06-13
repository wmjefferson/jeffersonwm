using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace LibraryScanner.Web.Services;

public sealed class OpenLibraryIsbnLookupService(HttpClient httpClient) : IIsbnLookupService
{
    public async Task<BookLookupResponse> LookupAsync(string isbn, CancellationToken cancellationToken = default)
    {
        var digits = IsbnNormalizer.DigitsOnly(isbn);
        if (string.IsNullOrWhiteSpace(digits))
        {
            return new BookLookupResponse(
                BookLookupStatus.InvalidCode,
                null,
                null,
                "Scan or enter an ISBN or UPC code.");
        }

        var isbn13 = IsbnNormalizer.ToIsbn13(isbn);
        if (isbn13 is not null)
        {
            var openLibraryResult = await LookupOpenLibraryAsync(isbn13, cancellationToken);
            if (openLibraryResult is not null)
            {
                return new BookLookupResponse(BookLookupStatus.Success, openLibraryResult, isbn13);
            }

            var googleIsbnResult = await LookupGoogleBooksAsync(isbn13, cancellationToken);
            if (googleIsbnResult is not null)
            {
                return new BookLookupResponse(BookLookupStatus.Success, googleIsbnResult, isbn13);
            }
        }

        return digits.Length is >= 8 and <= 14
            ? await LookupGoogleBooksByCodeAsync(digits, cancellationToken)
            : new BookLookupResponse(
                BookLookupStatus.InvalidCode,
                null,
                isbn13,
                "Enter a valid ISBN-10, ISBN-13, or UPC code.");
    }

    private async Task<BookLookupResult?> LookupOpenLibraryAsync(string isbn13, CancellationToken cancellationToken)
    {
        var response = await httpClient.GetFromJsonAsync<OpenLibraryResponse>(
            $"api/books?bibkeys=ISBN:{isbn13}&format=json&jscmd=data",
            cancellationToken);

        if (response is null || !response.TryGetValue($"ISBN:{isbn13}", out var book) || string.IsNullOrWhiteSpace(book.Title))
        {
            return null;
        }

        return new BookLookupResult(
            isbn13,
            book.Identifiers?.Isbn10?.FirstOrDefault(),
            book.Title,
            JoinNames(book.Authors),
            JoinNames(book.Publishers),
            book.PublishDate,
            book.Cover?.Large ?? book.Cover?.Medium ?? book.Cover?.Small,
            ExtractDescription(book.Description),
            book.NumberOfPages,
            JoinNames(book.Subjects),
            null,
            book.Url,
            "Open Library");
    }

    private async Task<BookLookupResult?> LookupGoogleBooksAsync(string isbn13, CancellationToken cancellationToken)
    {
        var response = await httpClient.GetFromJsonAsync<GoogleBooksResponse>(
            $"https://www.googleapis.com/books/v1/volumes?q=isbn:{isbn13}",
            cancellationToken);

        var volume = response?.Items?.FirstOrDefault()?.VolumeInfo;
        if (volume is null || string.IsNullOrWhiteSpace(volume.Title))
        {
            return null;
        }

        return MapGoogleVolume(isbn13, volume);
    }

    private async Task<BookLookupResponse> LookupGoogleBooksByCodeAsync(string code, CancellationToken cancellationToken)
    {
        var response = await httpClient.GetFromJsonAsync<GoogleBooksResponse>(
            $"https://www.googleapis.com/books/v1/volumes?q={Uri.EscapeDataString(code)}",
            cancellationToken);

        if (response?.TotalItems is null or 0 || response.Items is null)
        {
            return new BookLookupResponse(
                BookLookupStatus.NotFound,
                null,
                code,
                "No online match found for that code.");
        }

        var candidates = response.Items
            .Select(item => item.VolumeInfo)
            .Where(volume => volume is not null && !string.IsNullOrWhiteSpace(volume.Title))
            .Select(volume => CreateGoogleCandidate(volume!))
            .Where(candidate => candidate is not null)
            .DistinctBy(candidate => candidate!.Isbn13)
            .Cast<BookLookupCandidate>()
            .ToList();

        if (candidates.Count == 0)
        {
            return new BookLookupResponse(
                BookLookupStatus.NotFound,
                null,
                code,
                "No book match with an ISBN was found for that code.");
        }

        if (candidates.Count > 1)
        {
            return new BookLookupResponse(
                BookLookupStatus.Ambiguous,
                null,
                code,
                $"Found multiple possible matches for {code}. Choose the right book below.",
                candidates);
        }

        var candidate = candidates[0];
        var volume = response.Items
            .Select(item => item.VolumeInfo)
            .First(volume => GetIndustryIdentifier(volume?.IndustryIdentifiers, "ISBN_13") == candidate.Isbn13);

        return new BookLookupResponse(
            BookLookupStatus.Success,
            MapGoogleVolume(candidate.Isbn13, volume!),
            candidate.Isbn13);
    }

    private static BookLookupResult MapGoogleVolume(string isbn13, GoogleVolumeInfo volume)
    {
        return new BookLookupResult(
            isbn13,
            volume.IndustryIdentifiers?.FirstOrDefault(identifier => identifier.Type == "ISBN_10")?.Identifier,
            volume.Title!,
            volume.Authors is { Count: > 0 } ? string.Join(", ", volume.Authors) : null,
            volume.Publisher,
            volume.PublishedDate,
            volume.ImageLinks?.Thumbnail?.Replace("http://", "https://", StringComparison.OrdinalIgnoreCase),
            volume.Description,
            volume.PageCount,
            volume.Categories is { Count: > 0 } ? string.Join(", ", volume.Categories) : null,
            volume.Language,
            volume.InfoLink,
            "Google Books");
    }

    private static BookLookupCandidate? CreateGoogleCandidate(GoogleVolumeInfo volume)
    {
        var isbn13 = GetIndustryIdentifier(volume.IndustryIdentifiers, "ISBN_13");
        if (string.IsNullOrWhiteSpace(isbn13) || string.IsNullOrWhiteSpace(volume.Title))
        {
            return null;
        }

        return new BookLookupCandidate(
            isbn13,
            volume.Title,
            volume.Authors is { Count: > 0 } ? string.Join(", ", volume.Authors) : null,
            volume.Publisher,
            volume.PublishedDate,
            volume.ImageLinks?.Thumbnail?.Replace("http://", "https://", StringComparison.OrdinalIgnoreCase),
            "Google Books");
    }

    private static string? GetIndustryIdentifier(IEnumerable<GoogleIndustryIdentifier>? identifiers, string type)
    {
        return identifiers?
            .FirstOrDefault(identifier => identifier.Type == type && identifier.Identifier is not null)
            ?.Identifier;
    }

    private static string? JoinNames(IReadOnlyCollection<NamedValue>? values)
    {
        return values is { Count: > 0 }
            ? string.Join(", ", values.Select(value => value.Name).Where(name => !string.IsNullOrWhiteSpace(name)))
            : null;
    }

    private static string? ExtractDescription(JsonElement? description)
    {
        if (description is null)
        {
            return null;
        }

        var value = description.Value;
        return value.ValueKind switch
        {
            JsonValueKind.String => value.GetString(),
            JsonValueKind.Object when value.TryGetProperty("value", out var text) => text.GetString(),
            _ => null
        };
    }

    private sealed class OpenLibraryResponse : Dictionary<string, OpenLibraryBook>
    {
    }

    private sealed class OpenLibraryBook
    {
        [JsonPropertyName("title")]
        public string? Title { get; set; }

        [JsonPropertyName("authors")]
        public List<NamedValue>? Authors { get; set; }

        [JsonPropertyName("publishers")]
        public List<NamedValue>? Publishers { get; set; }

        [JsonPropertyName("publish_date")]
        public string? PublishDate { get; set; }

        [JsonPropertyName("number_of_pages")]
        public int? NumberOfPages { get; set; }

        [JsonPropertyName("subjects")]
        public List<NamedValue>? Subjects { get; set; }

        [JsonPropertyName("description")]
        public JsonElement? Description { get; set; }

        [JsonPropertyName("url")]
        public string? Url { get; set; }

        [JsonPropertyName("cover")]
        public CoverLinks? Cover { get; set; }

        [JsonPropertyName("identifiers")]
        public Identifiers? Identifiers { get; set; }
    }

    private sealed class NamedValue
    {
        [JsonPropertyName("name")]
        public string? Name { get; set; }
    }

    private sealed class CoverLinks
    {
        [JsonPropertyName("small")]
        public string? Small { get; set; }

        [JsonPropertyName("medium")]
        public string? Medium { get; set; }

        [JsonPropertyName("large")]
        public string? Large { get; set; }
    }

    private sealed class Identifiers
    {
        [JsonPropertyName("isbn_10")]
        public List<string>? Isbn10 { get; set; }
    }

    private sealed class GoogleBooksResponse
    {
        [JsonPropertyName("totalItems")]
        public int TotalItems { get; set; }

        [JsonPropertyName("items")]
        public List<GoogleBookItem>? Items { get; set; }
    }

    private sealed class GoogleBookItem
    {
        [JsonPropertyName("volumeInfo")]
        public GoogleVolumeInfo? VolumeInfo { get; set; }
    }

    private sealed class GoogleVolumeInfo
    {
        [JsonPropertyName("title")]
        public string? Title { get; set; }

        [JsonPropertyName("authors")]
        public List<string>? Authors { get; set; }

        [JsonPropertyName("publisher")]
        public string? Publisher { get; set; }

        [JsonPropertyName("publishedDate")]
        public string? PublishedDate { get; set; }

        [JsonPropertyName("description")]
        public string? Description { get; set; }

        [JsonPropertyName("pageCount")]
        public int? PageCount { get; set; }

        [JsonPropertyName("categories")]
        public List<string>? Categories { get; set; }

        [JsonPropertyName("language")]
        public string? Language { get; set; }

        [JsonPropertyName("infoLink")]
        public string? InfoLink { get; set; }

        [JsonPropertyName("industryIdentifiers")]
        public List<GoogleIndustryIdentifier>? IndustryIdentifiers { get; set; }

        [JsonPropertyName("imageLinks")]
        public GoogleImageLinks? ImageLinks { get; set; }
    }

    private sealed class GoogleIndustryIdentifier
    {
        [JsonPropertyName("type")]
        public string? Type { get; set; }

        [JsonPropertyName("identifier")]
        public string? Identifier { get; set; }
    }

    private sealed class GoogleImageLinks
    {
        [JsonPropertyName("thumbnail")]
        public string? Thumbnail { get; set; }
    }
}
