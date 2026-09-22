using System.ComponentModel.DataAnnotations;
using LibraryScanner.Web.Data;
using LibraryScanner.Web.Models;
using LibraryScanner.Web.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;

namespace LibraryScanner.Web.Pages.Collections;

[Authorize]
public class IndexModel(ApplicationDbContext dbContext, InventoryAccessService inventoryAccess) : PageModel
{
    public List<CollectionRow> Collections { get; private set; } = [];

    [BindProperty]
    public CollectionInput Input { get; set; } = new();

    [TempData]
    public string? StatusMessage { get; set; }

    public async Task OnGetAsync()
    {
        await LoadCollectionsAsync();
    }

    public async Task<IActionResult> OnPostCreateAsync()
    {
        if (!ModelState.IsValid)
        {
            await LoadCollectionsAsync();
            return Page();
        }

        var normalized = InventoryText.NormalizeName(Input.Name);
        var account = inventoryAccess.GetAccount(User);
        var exists = await inventoryAccess.ScopeCollections(dbContext.Collections, User).AnyAsync(collection => collection.NormalizedName == normalized);
        if (!exists)
        {
            dbContext.Collections.Add(new Collection
            {
                Name = Input.Name.Trim(),
                NormalizedName = normalized,
                Description = string.IsNullOrWhiteSpace(Input.Description) ? null : Input.Description.Trim(),
                OwnerAuthId = account.AuthId,
                OwnerUsername = account.Username
            });
            await dbContext.SaveChangesAsync();
            StatusMessage = "Collection created.";
        }
        else
        {
            StatusMessage = "That collection already exists.";
        }

        return RedirectToPage();
    }

    public async Task<IActionResult> OnPostUpdateAsync(int id, string name, string? description)
    {
        var collection = await inventoryAccess.ScopeCollections(dbContext.Collections, User).FirstOrDefaultAsync(item => item.Id == id);
        if (collection is null)
        {
            return NotFound();
        }

        if (!string.IsNullOrWhiteSpace(name))
        {
            var trimmedName = name.Trim();
            var normalized = InventoryText.NormalizeName(trimmedName);
            var duplicateExists = await inventoryAccess.ScopeCollections(dbContext.Collections, User).AnyAsync(other => other.Id != id && other.NormalizedName == normalized);
            if (duplicateExists)
            {
                StatusMessage = $"Collection \"{trimmedName}\" already exists.";
                return RedirectToPage();
            }

            collection.Name = trimmedName;
            collection.NormalizedName = normalized;
        }

        collection.Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
        await dbContext.SaveChangesAsync();
        StatusMessage = "Collection updated.";
        return RedirectToPage();
    }

    public async Task<IActionResult> OnPostDeleteAsync(int id)
    {
        var collection = await inventoryAccess.ScopeCollections(dbContext.Collections, User).FirstOrDefaultAsync(item => item.Id == id);
        if (collection is null)
        {
            return NotFound();
        }

        dbContext.Collections.Remove(collection);
        await dbContext.SaveChangesAsync();
        StatusMessage = "Collection deleted.";
        return RedirectToPage();
    }

    private async Task LoadCollectionsAsync()
    {
        var visibleBookIds = inventoryAccess.ScopeBooks(dbContext.Books, User).Select(book => book.Id);
        Collections = await inventoryAccess.ScopeCollections(dbContext.Collections, User)
            .AsNoTracking()
            .OrderBy(collection => collection.Name)
            .Select(collection => new CollectionRow(
                collection.Id,
                collection.Name,
                collection.Description,
                collection.CollectionBooks.Count(collectionBook => visibleBookIds.Contains(collectionBook.BookId))))
            .ToListAsync();
    }

    public sealed record CollectionRow(int Id, string Name, string? Description, int BookCount);

    public class CollectionInput
    {
        [Required]
        [StringLength(120)]
        public string Name { get; set; } = string.Empty;

        [StringLength(1000)]
        public string? Description { get; set; }
    }
}
