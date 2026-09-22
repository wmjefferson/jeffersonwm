using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LibraryScanner.Web.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddAccountScopedInventory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(name: "IX_Books_Isbn13", table: "Books");
            migrationBuilder.DropIndex(name: "IX_BookIdentifiers_Type_NormalizedValue", table: "BookIdentifiers");
            migrationBuilder.DropIndex(name: "IX_Collections_NormalizedName", table: "Collections");
            migrationBuilder.DropIndex(name: "IX_Locations_NormalizedName", table: "Locations");
            migrationBuilder.DropIndex(name: "IX_Tags_NormalizedName", table: "Tags");

            migrationBuilder.AddColumn<string>(
                name: "OwnerAuthId",
                table: "Books",
                type: "TEXT",
                maxLength: 120,
                nullable: false,
                defaultValue: "wm");

            migrationBuilder.AddColumn<string>(
                name: "OwnerUsername",
                table: "Books",
                type: "TEXT",
                maxLength: 80,
                nullable: false,
                defaultValue: "wm");

            migrationBuilder.AddColumn<string>(
                name: "OwnerAuthId",
                table: "Collections",
                type: "TEXT",
                maxLength: 120,
                nullable: false,
                defaultValue: "wm");

            migrationBuilder.AddColumn<string>(
                name: "OwnerUsername",
                table: "Collections",
                type: "TEXT",
                maxLength: 80,
                nullable: false,
                defaultValue: "wm");

            migrationBuilder.AddColumn<string>(
                name: "OwnerAuthId",
                table: "Locations",
                type: "TEXT",
                maxLength: 120,
                nullable: false,
                defaultValue: "wm");

            migrationBuilder.AddColumn<string>(
                name: "OwnerUsername",
                table: "Locations",
                type: "TEXT",
                maxLength: 80,
                nullable: false,
                defaultValue: "wm");

            migrationBuilder.AddColumn<string>(
                name: "OwnerAuthId",
                table: "Tags",
                type: "TEXT",
                maxLength: 120,
                nullable: false,
                defaultValue: "wm");

            migrationBuilder.AddColumn<string>(
                name: "OwnerUsername",
                table: "Tags",
                type: "TEXT",
                maxLength: 80,
                nullable: false,
                defaultValue: "wm");

            migrationBuilder.CreateIndex(
                name: "IX_Books_OwnerAuthId_Isbn13",
                table: "Books",
                columns: new[] { "OwnerAuthId", "Isbn13" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_BookIdentifiers_BookId_Type_NormalizedValue",
                table: "BookIdentifiers",
                columns: new[] { "BookId", "Type", "NormalizedValue" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Collections_OwnerAuthId_NormalizedName",
                table: "Collections",
                columns: new[] { "OwnerAuthId", "NormalizedName" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Locations_OwnerAuthId_NormalizedName",
                table: "Locations",
                columns: new[] { "OwnerAuthId", "NormalizedName" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Tags_OwnerAuthId_NormalizedName",
                table: "Tags",
                columns: new[] { "OwnerAuthId", "NormalizedName" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(name: "IX_Books_OwnerAuthId_Isbn13", table: "Books");
            migrationBuilder.DropIndex(name: "IX_BookIdentifiers_BookId_Type_NormalizedValue", table: "BookIdentifiers");
            migrationBuilder.DropIndex(name: "IX_Collections_OwnerAuthId_NormalizedName", table: "Collections");
            migrationBuilder.DropIndex(name: "IX_Locations_OwnerAuthId_NormalizedName", table: "Locations");
            migrationBuilder.DropIndex(name: "IX_Tags_OwnerAuthId_NormalizedName", table: "Tags");

            migrationBuilder.DropColumn(name: "OwnerAuthId", table: "Books");
            migrationBuilder.DropColumn(name: "OwnerUsername", table: "Books");
            migrationBuilder.DropColumn(name: "OwnerAuthId", table: "Collections");
            migrationBuilder.DropColumn(name: "OwnerUsername", table: "Collections");
            migrationBuilder.DropColumn(name: "OwnerAuthId", table: "Locations");
            migrationBuilder.DropColumn(name: "OwnerUsername", table: "Locations");
            migrationBuilder.DropColumn(name: "OwnerAuthId", table: "Tags");
            migrationBuilder.DropColumn(name: "OwnerUsername", table: "Tags");

            migrationBuilder.CreateIndex(name: "IX_Books_Isbn13", table: "Books", column: "Isbn13", unique: true);
            migrationBuilder.CreateIndex(name: "IX_BookIdentifiers_Type_NormalizedValue", table: "BookIdentifiers", columns: new[] { "Type", "NormalizedValue" }, unique: true);
            migrationBuilder.CreateIndex(name: "IX_Collections_NormalizedName", table: "Collections", column: "NormalizedName", unique: true);
            migrationBuilder.CreateIndex(name: "IX_Locations_NormalizedName", table: "Locations", column: "NormalizedName", unique: true);
            migrationBuilder.CreateIndex(name: "IX_Tags_NormalizedName", table: "Tags", column: "NormalizedName", unique: true);
        }
    }
}
