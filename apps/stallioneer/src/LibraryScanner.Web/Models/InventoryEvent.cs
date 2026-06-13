namespace LibraryScanner.Web.Models;

public class InventoryEvent
{
    public int Id { get; set; }

    public int BookId { get; set; }

    public Book? Book { get; set; }

    public string EventType { get; set; } = string.Empty;

    public int QuantityDelta { get; set; }

    public string? Note { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
