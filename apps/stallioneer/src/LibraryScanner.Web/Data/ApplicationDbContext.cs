using LibraryScanner.Web.Models;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace LibraryScanner.Web.Data;

public class ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : IdentityDbContext<ApplicationUser>(options)
{
    public DbSet<Book> Books => Set<Book>();

    public DbSet<InventoryEvent> InventoryEvents => Set<InventoryEvent>();

    public DbSet<Tag> Tags => Set<Tag>();

    public DbSet<Location> Locations => Set<Location>();

    public DbSet<BookTag> BookTags => Set<BookTag>();

    public DbSet<Collection> Collections => Set<Collection>();

    public DbSet<CollectionBook> CollectionBooks => Set<CollectionBook>();

    public DbSet<BookIdentifier> BookIdentifiers => Set<BookIdentifier>();

    public DbSet<BookCopy> BookCopies => Set<BookCopy>();

    public DbSet<BookAdditionalInfo> BookAdditionalInfos => Set<BookAdditionalInfo>();

    public DbSet<BookCopyTag> BookCopyTags => Set<BookCopyTag>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.Entity<ApplicationUser>(entity =>
        {
            entity.Property(user => user.DisplayName).HasMaxLength(80);
        });

        builder.Entity<Book>(entity =>
        {
            entity.HasIndex(book => book.Isbn13).IsUnique();
            entity.Property(book => book.Isbn13).HasMaxLength(13);
            entity.Property(book => book.Isbn10).HasMaxLength(10);
            entity.Property(book => book.Title).HasMaxLength(300);
            entity.Property(book => book.Authors).HasMaxLength(500);
            entity.Property(book => book.Publisher).HasMaxLength(200);
            entity.Property(book => book.PublishedDate).HasMaxLength(50);
            entity.Property(book => book.CoverImageUrl).HasMaxLength(1000);
            entity.Property(book => book.MetadataSource).HasMaxLength(80);
            entity.Property(book => book.Categories).HasMaxLength(500);
            entity.Property(book => book.Language).HasMaxLength(40);
            entity.Property(book => book.InfoUrl).HasMaxLength(1000);
            entity.Property(book => book.Condition).HasMaxLength(80);
            entity.Property(book => book.Status).HasMaxLength(80);
            entity.Property(book => book.Notes).HasMaxLength(4000);
            entity.HasOne(book => book.Location)
                .WithMany(location => location.Books)
                .HasForeignKey(book => book.LocationId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        builder.Entity<BookIdentifier>(entity =>
        {
            entity.HasIndex(identifier => new { identifier.Type, identifier.NormalizedValue }).IsUnique();
            entity.Property(identifier => identifier.Type).HasMaxLength(20);
            entity.Property(identifier => identifier.Value).HasMaxLength(120);
            entity.Property(identifier => identifier.NormalizedValue).HasMaxLength(120);
            entity.HasOne(identifier => identifier.Book)
                .WithMany(book => book.Identifiers)
                .HasForeignKey(identifier => identifier.BookId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<BookCopy>(entity =>
        {
            entity.Property(copy => copy.Condition).HasMaxLength(80);
            entity.Property(copy => copy.Status).HasMaxLength(80);
            entity.Property(copy => copy.Notes).HasMaxLength(4000);
            entity.HasOne(copy => copy.Book)
                .WithMany(book => book.Copies)
                .HasForeignKey(copy => copy.BookId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(copy => copy.Location)
                .WithMany(location => location.Copies)
                .HasForeignKey(copy => copy.LocationId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        builder.Entity<BookAdditionalInfo>(entity =>
        {
            entity.Property(info => info.Type).HasMaxLength(40);
            entity.Property(info => info.Label).HasMaxLength(120);
            entity.Property(info => info.Value).HasMaxLength(4000);
            entity.HasOne(info => info.Book)
                .WithMany(book => book.AdditionalInfos)
                .HasForeignKey(info => info.BookId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<InventoryEvent>(entity =>
        {
            entity.Property(inventoryEvent => inventoryEvent.EventType).HasMaxLength(80);
            entity.Property(inventoryEvent => inventoryEvent.Note).HasMaxLength(1000);
            entity.HasOne(inventoryEvent => inventoryEvent.Book)
                .WithMany(book => book.InventoryEvents)
                .HasForeignKey(inventoryEvent => inventoryEvent.BookId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<Tag>(entity =>
        {
            entity.HasIndex(tag => tag.NormalizedName).IsUnique();
            entity.Property(tag => tag.Name).HasMaxLength(80);
            entity.Property(tag => tag.NormalizedName).HasMaxLength(80);
            entity.Property(tag => tag.Color).HasMaxLength(20);
            entity.Property(tag => tag.Description).HasMaxLength(1000);
        });

        builder.Entity<Location>(entity =>
        {
            entity.HasIndex(location => location.NormalizedName).IsUnique();
            entity.Property(location => location.Name).HasMaxLength(120);
            entity.Property(location => location.NormalizedName).HasMaxLength(120);
            entity.Property(location => location.Description).HasMaxLength(1000);
        });

        builder.Entity<Collection>(entity =>
        {
            entity.HasIndex(collection => collection.NormalizedName).IsUnique();
            entity.Property(collection => collection.Name).HasMaxLength(120);
            entity.Property(collection => collection.NormalizedName).HasMaxLength(120);
            entity.Property(collection => collection.Description).HasMaxLength(1000);
        });

        builder.Entity<BookTag>(entity =>
        {
            entity.HasKey(bookTag => new { bookTag.BookId, bookTag.TagId });
            entity.HasOne(bookTag => bookTag.Book)
                .WithMany(book => book.BookTags)
                .HasForeignKey(bookTag => bookTag.BookId);
            entity.HasOne(bookTag => bookTag.Tag)
                .WithMany(tag => tag.BookTags)
                .HasForeignKey(bookTag => bookTag.TagId);
        });

        builder.Entity<BookCopyTag>(entity =>
        {
            entity.HasKey(copyTag => new { copyTag.BookCopyId, copyTag.TagId });
            entity.HasOne(copyTag => copyTag.BookCopy)
                .WithMany(copy => copy.BookCopyTags)
                .HasForeignKey(copyTag => copyTag.BookCopyId);
            entity.HasOne(copyTag => copyTag.Tag)
                .WithMany(tag => tag.BookCopyTags)
                .HasForeignKey(copyTag => copyTag.TagId);
        });

        builder.Entity<CollectionBook>(entity =>
        {
            entity.HasKey(collectionBook => new { collectionBook.CollectionId, collectionBook.BookId });
            entity.HasOne(collectionBook => collectionBook.Collection)
                .WithMany(collection => collection.CollectionBooks)
                .HasForeignKey(collectionBook => collectionBook.CollectionId);
            entity.HasOne(collectionBook => collectionBook.Book)
                .WithMany(book => book.CollectionBooks)
                .HasForeignKey(collectionBook => collectionBook.BookId);
        });
    }
}
