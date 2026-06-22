using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LibraryScanner.Web.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddBookCoverVariants : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "BookCovers",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    BookId = table.Column<int>(type: "INTEGER", nullable: false),
                    Url = table.Column<string>(type: "TEXT", maxLength: 1000, nullable: false),
                    Source = table.Column<string>(type: "TEXT", maxLength: 80, nullable: true),
                    Label = table.Column<string>(type: "TEXT", maxLength: 120, nullable: true),
                    IsPrimary = table.Column<bool>(type: "INTEGER", nullable: false),
                    SortOrder = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BookCovers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BookCovers_Books_BookId",
                        column: x => x.BookId,
                        principalTable: "Books",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_BookCovers_BookId",
                table: "BookCovers",
                column: "BookId");

            migrationBuilder.Sql("""
                INSERT INTO "BookCovers" ("BookId", "Url", "Source", "Label", "IsPrimary", "SortOrder")
                SELECT "Id", "CoverImageUrl", "MetadataSource", 'Primary cover', 1, 0
                FROM "Books"
                WHERE "CoverImageUrl" IS NOT NULL AND TRIM("CoverImageUrl") <> '';
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "BookCovers");
        }
    }
}
