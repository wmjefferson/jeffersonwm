using System.ComponentModel.DataAnnotations;
using LibraryScanner.Web.Data;
using LibraryScanner.Web.Models;
using LibraryScanner.Web.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;

namespace LibraryScanner.Web.Pages.Locations;

[Authorize]
public class IndexModel(ApplicationDbContext dbContext, InventoryAccessService inventoryAccess) : PageModel
{
    public List<LocationRow> Locations { get; private set; } = [];

    [BindProperty]
    public LocationInput Input { get; set; } = new();

    public async Task OnGetAsync()
    {
        await LoadLocationsAsync();
    }

    public async Task<IActionResult> OnPostCreateAsync()
    {
        if (!ModelState.IsValid)
        {
            await LoadLocationsAsync();
            return Page();
        }

        var normalized = InventoryText.NormalizeName(Input.Name);
        var account = inventoryAccess.GetAccount(User);
        var exists = await inventoryAccess.ScopeLocations(dbContext.Locations, User).AnyAsync(location => location.NormalizedName == normalized);
        if (!exists)
        {
            dbContext.Locations.Add(new Location
            {
                Name = Input.Name.Trim(),
                NormalizedName = normalized,
                Description = Input.Description,
                OwnerAuthId = account.AuthId,
                OwnerUsername = account.Username
            });
            await dbContext.SaveChangesAsync();
        }

        return RedirectToPage();
    }

    public async Task<IActionResult> OnPostUpdateAsync(int id, string name, string? description)
    {
        var location = await inventoryAccess.ScopeLocations(dbContext.Locations, User).FirstOrDefaultAsync(location => location.Id == id);
        if (location is null)
        {
            return NotFound();
        }

        if (!string.IsNullOrWhiteSpace(name))
        {
            location.Name = name.Trim();
            location.NormalizedName = InventoryText.NormalizeName(name);
        }

        location.Description = description;
        await dbContext.SaveChangesAsync();
        return RedirectToPage();
    }

    public async Task<IActionResult> OnPostDeleteAsync(int id)
    {
        var location = await inventoryAccess.ScopeLocations(dbContext.Locations, User).Include(location => location.Books).FirstOrDefaultAsync(location => location.Id == id);
        if (location is null)
        {
            return NotFound();
        }

        foreach (var book in location.Books)
        {
            book.LocationId = null;
        }

        dbContext.Locations.Remove(location);
        await dbContext.SaveChangesAsync();
        return RedirectToPage();
    }

    private async Task LoadLocationsAsync()
    {
        var visibleBookIds = inventoryAccess.ScopeBooks(dbContext.Books, User).Select(book => book.Id);
        Locations = await inventoryAccess.ScopeLocations(dbContext.Locations, User)
            .AsNoTracking()
            .OrderBy(location => location.Name)
            .Select(location => new LocationRow(location.Id, location.Name, location.Description, location.Books.Count(book => visibleBookIds.Contains(book.Id))))
            .ToListAsync();
    }

    public sealed record LocationRow(int Id, string Name, string? Description, int BookCount);

    public class LocationInput
    {
        [Required]
        [StringLength(120)]
        public string Name { get; set; } = string.Empty;

        [StringLength(1000)]
        public string? Description { get; set; }
    }
}
