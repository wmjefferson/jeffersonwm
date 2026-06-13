namespace LibraryScanner.Web.Services;

public interface IIsbnLookupService
{
    Task<BookLookupResponse> LookupAsync(string isbn, CancellationToken cancellationToken = default);
}
