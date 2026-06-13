using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Identity;

namespace LibraryScanner.Web.Models;

public class ApplicationUser : IdentityUser
{
    [StringLength(80)]
    public string? DisplayName { get; set; }
}
