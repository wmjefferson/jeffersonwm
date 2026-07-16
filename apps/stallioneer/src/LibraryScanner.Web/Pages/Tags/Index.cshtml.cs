using System.ComponentModel.DataAnnotations;
using LibraryScanner.Web.Data;
using LibraryScanner.Web.Models;
using LibraryScanner.Web.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;

namespace LibraryScanner.Web.Pages.Tags;

[Authorize]
public class IndexModel(ApplicationDbContext dbContext) : PageModel
{
    public List<TagRow> Tags { get; private set; } = [];

    public List<CollectionRow> Collections { get; private set; } = [];

    [BindProperty]
    public TagInput Input { get; set; } = new();

    [BindProperty]
    public CollectionInput NewCollection { get; set; } = new();

    [TempData]
    public string? StatusMessage { get; set; }

    public async Task OnGetAsync()
    {
        await LoadPageAsync();
    }

    public async Task<IActionResult> OnPostCreateAsync()
    {
        var tagDefinitions = InventoryText.ParseTagDefinitions(Input.Name);
        if (tagDefinitions.Count == 0)
        {
            ModelState.AddModelError($"{nameof(Input)}.{nameof(Input.Name)}", "Enter at least one tag name.");
        }

        if (!ModelState.IsValid)
        {
            await LoadPageAsync();
            return Page();
        }

        var normalizedNames = tagDefinitions.Select(definition => InventoryText.NormalizeName(definition.Name)).ToList();
        var existingNames = await dbContext.Tags
            .Where(tag => normalizedNames.Contains(tag.NormalizedName))
            .Select(tag => tag.NormalizedName)
            .ToListAsync();

        var fallbackDescription = string.IsNullOrWhiteSpace(Input.Description) ? null : Input.Description.Trim();
        var createdCount = 0;

        for (var i = 0; i < tagDefinitions.Count; i++)
        {
            var tagDefinition = tagDefinitions[i];
            var tagName = tagDefinition.Name;
            var normalized = normalizedNames[i];
            if (existingNames.Contains(normalized))
            {
                continue;
            }

            dbContext.Tags.Add(new Tag
            {
                Name = tagName.Trim(),
                NormalizedName = normalized,
                Color = string.IsNullOrWhiteSpace(Input.Color) ? InventoryText.DefaultTagColor(tagName) : Input.Color,
                Description = tagDefinition.Description ?? fallbackDescription
            });

            createdCount++;
        }

        if (createdCount > 0)
        {
            await dbContext.SaveChangesAsync();
            StatusMessage = createdCount == 1 ? "Created 1 tag." : $"Created {createdCount} tags.";
        }
        else
        {
            StatusMessage = "Those tags already exist.";
        }

        return RedirectToPage();
    }

    public async Task<IActionResult> OnPostCreateCollectionAsync()
    {
        if (!TryValidateModel(NewCollection, nameof(NewCollection)))
        {
            await LoadPageAsync();
            return Page();
        }

        var normalized = InventoryText.NormalizeName(NewCollection.Name);
        var exists = await dbContext.Collections.AnyAsync(collection => collection.NormalizedName == normalized);
        if (!exists)
        {
            dbContext.Collections.Add(new Collection
            {
                Name = NewCollection.Name.Trim(),
                NormalizedName = normalized,
                Description = string.IsNullOrWhiteSpace(NewCollection.Description) ? null : NewCollection.Description.Trim()
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

    public async Task<IActionResult> OnPostUpdateAsync(int id, string name, string color, string? description)
    {
        var tag = await dbContext.Tags.FirstOrDefaultAsync(tag => tag.Id == id);
        if (tag is null)
        {
            return NotFound();
        }

        if (!string.IsNullOrWhiteSpace(name))
        {
            var trimmedName = name.Trim();
            var normalizedName = InventoryText.NormalizeName(trimmedName);
            var duplicateExists = await dbContext.Tags.AnyAsync(other => other.Id != id && other.NormalizedName == normalizedName);
            if (duplicateExists)
            {
                StatusMessage = $"Tag \"{trimmedName}\" already exists.";
                return RedirectToPage();
            }

            tag.Name = trimmedName;
            tag.NormalizedName = normalizedName;
        }

        if (!string.IsNullOrWhiteSpace(color))
        {
            tag.Color = color;
        }

        tag.Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
        await dbContext.SaveChangesAsync();
        StatusMessage = "Tag updated.";
        return RedirectToPage();
    }

    public async Task<IActionResult> OnPostDeleteAsync(int id)
    {
        var tag = await dbContext.Tags.FirstOrDefaultAsync(tag => tag.Id == id);
        if (tag is null)
        {
            return NotFound();
        }

        dbContext.Tags.Remove(tag);
        await dbContext.SaveChangesAsync();
        StatusMessage = "Tag deleted.";
        return RedirectToPage();
    }

    public async Task<IActionResult> OnPostUpdateCollectionAsync(int id, string name, string? description)
    {
        var collection = await dbContext.Collections.FirstOrDefaultAsync(item => item.Id == id);
        if (collection is null)
        {
            return NotFound();
        }

        if (!string.IsNullOrWhiteSpace(name))
        {
            var trimmedName = name.Trim();
            var normalized = InventoryText.NormalizeName(trimmedName);
            var duplicateExists = await dbContext.Collections.AnyAsync(other => other.Id != id && other.NormalizedName == normalized);
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

    public async Task<IActionResult> OnPostDeleteCollectionAsync(int id)
    {
        var collection = await dbContext.Collections.FirstOrDefaultAsync(item => item.Id == id);
        if (collection is null)
        {
            return NotFound();
        }

        dbContext.Collections.Remove(collection);
        await dbContext.SaveChangesAsync();
        StatusMessage = "Collection deleted.";
        return RedirectToPage();
    }

    private async Task LoadPageAsync()
    {
        Tags = await dbContext.Tags
            .AsNoTracking()
            .OrderBy(tag => tag.Name)
            .Select(tag => new TagRow(tag.Id, tag.Name, tag.Color, tag.Description, tag.BookTags.Count))
            .ToListAsync();

        Collections = await dbContext.Collections
            .AsNoTracking()
            .OrderBy(collection => collection.Name)
            .Select(collection => new CollectionRow(
                collection.Id,
                collection.Name,
                collection.Description,
                collection.CollectionBooks.Count))
            .ToListAsync();
    }

    public sealed record TagRow(int Id, string Name, string Color, string? Description, int BookCount);

    public sealed record CollectionRow(int Id, string Name, string? Description, int BookCount);

    public class TagInput
    {
        [Required]
        [StringLength(500)]
        public string Name { get; set; } = string.Empty;

        [StringLength(20)]
        public string Color { get; set; } = "#245f4c";

        [StringLength(1000)]
        public string? Description { get; set; }
    }

    public class CollectionInput
    {
        [Required]
        [StringLength(120)]
        public string Name { get; set; } = string.Empty;

        [StringLength(1000)]
        public string? Description { get; set; }
    }
}
