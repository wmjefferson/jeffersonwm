using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LibraryScanner.Web.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddBookAdditionalInfos : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "BookAdditionalInfos",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    BookId = table.Column<int>(type: "INTEGER", nullable: false),
                    Type = table.Column<string>(type: "TEXT", maxLength: 40, nullable: false),
                    Label = table.Column<string>(type: "TEXT", maxLength: 120, nullable: true),
                    Value = table.Column<string>(type: "TEXT", maxLength: 4000, nullable: false),
                    SortOrder = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BookAdditionalInfos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BookAdditionalInfos_Books_BookId",
                        column: x => x.BookId,
                        principalTable: "Books",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_BookAdditionalInfos_BookId",
                table: "BookAdditionalInfos",
                column: "BookId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "BookAdditionalInfos");
        }
    }
}
