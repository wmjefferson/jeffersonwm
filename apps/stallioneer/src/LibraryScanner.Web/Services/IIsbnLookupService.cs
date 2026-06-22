namespace LibraryScanner.Web.Services;

public interface IIsbnLookupService
{
    Task<BookLookupResponse> LookupAsync(
        string isbn,
        LookupProviderPreference preferredProvider = LookupProviderPreference.OpenLibrary,
        CancellationToken cancellationToken = default);
}
