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

    [BindProperty]
    public TagInput Input { get; set; } = new();

    [TempData]
    public string? StatusMessage { get; set; }

    public async Task OnGetAsync()
    {
        await LoadTagsAsync();
    }

    public async Task<IActionResult> OnPostCreateAsync()
    {
        var tagNames = InventoryText.ParseTags(Input.Name);
        if (tagNames.Count == 0)
        {
            ModelState.AddModelError($"{nameof(Input)}.{nameof(Input.Name)}", "Enter at least one tag name.");
        }

        if (!ModelState.IsValid)
        {
            await LoadTagsAsync();
            return Page();
        }

        var normalizedNames = tagNames.Select(InventoryText.NormalizeName).ToList();
        var existingNames = await dbContext.Tags
            .Where(tag => normalizedNames.Contains(tag.NormalizedName))
            .Select(tag => tag.NormalizedName)
            .ToListAsync();

        var description = string.IsNullOrWhiteSpace(Input.Description) ? null : Input.Description.Trim();
        var createdCount = 0;

        for (var i = 0; i < tagNames.Count; i++)
        {
            var tagName = tagNames[i];
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
                Description = description
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

    private async Task LoadTagsAsync()
    {
        Tags = await dbContext.Tags
            .AsNoTracking()
            .OrderBy(tag => tag.Name)
            .Select(tag => new TagRow(tag.Id, tag.Name, tag.Color, tag.Description, tag.BookTags.Count))
            .ToListAsync();
    }

    public sealed record TagRow(int Id, string Name, string Color, string? Description, int BookCount);

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
}
