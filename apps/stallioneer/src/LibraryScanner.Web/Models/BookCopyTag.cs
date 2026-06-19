namespace LibraryScanner.Web.Models;

public class BookCopyTag
{
    public int BookCopyId { get; set; }

    public BookCopy BookCopy { get; set; } = null!;

    public int TagId { get; set; }

    public Tag Tag { get; set; } = null!;
}
