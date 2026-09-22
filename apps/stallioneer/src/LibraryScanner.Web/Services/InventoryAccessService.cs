using System.Security.Claims;
using LibraryScanner.Web.Models;

namespace LibraryScanner.Web.Services;

public sealed class InventoryAccessService
{
    public InventoryAccount GetAccount(ClaimsPrincipal user)
    {
        var authId = user.FindFirstValue(ClaimTypes.NameIdentifier);
        var username = user.FindFirstValue("username") ?? user.Identity?.Name;
        var accountType = user.FindFirstValue("account_type");

        return new InventoryAccount(
            string.IsNullOrWhiteSpace(authId) ? "wm" : authId,
            string.IsNullOrWhiteSpace(username) ? "wm" : username,
            string.Equals(accountType, "owner", StringComparison.OrdinalIgnoreCase));
    }

    public bool CanAccessBook(Book book, ClaimsPrincipal user)
    {
        var account = GetAccount(user);
        return account.IsPreferredAdmin || string.Equals(book.OwnerAuthId, account.AuthId, StringComparison.Ordinal);
    }

    public IQueryable<Book> ScopeBooks(IQueryable<Book> query, ClaimsPrincipal user)
    {
        var account = GetAccount(user);
        return account.IsPreferredAdmin
            ? query
            : query.Where(book => book.OwnerAuthId == account.AuthId);
    }

    public IQueryable<Tag> ScopeTags(IQueryable<Tag> query, ClaimsPrincipal user)
    {
        var account = GetAccount(user);
        return account.IsPreferredAdmin
            ? query
            : query.Where(tag => tag.OwnerAuthId == account.AuthId);
    }

    public IQueryable<Location> ScopeLocations(IQueryable<Location> query, ClaimsPrincipal user)
    {
        var account = GetAccount(user);
        return account.IsPreferredAdmin
            ? query
            : query.Where(location => location.OwnerAuthId == account.AuthId);
    }

    public IQueryable<Collection> ScopeCollections(IQueryable<Collection> query, ClaimsPrincipal user)
    {
        var account = GetAccount(user);
        return account.IsPreferredAdmin
            ? query
            : query.Where(collection => collection.OwnerAuthId == account.AuthId);
    }
}

public sealed record InventoryAccount(string AuthId, string Username, bool IsPreferredAdmin);
