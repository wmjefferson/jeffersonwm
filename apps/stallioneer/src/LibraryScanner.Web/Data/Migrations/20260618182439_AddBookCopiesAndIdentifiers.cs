using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LibraryScanner.Web.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddBookCopiesAndIdentifiers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "BookCopies",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    BookId = table.Column<int>(type: "INTEGER", nullable: false),
                    LocationId = table.Column<int>(type: "INTEGER", nullable: true),
                    Condition = table.Column<string>(type: "TEXT", maxLength: 80, nullable: false),
                    Status = table.Column<string>(type: "TEXT", maxLength: 80, nullable: false),
                    Notes = table.Column<string>(type: "TEXT", maxLength: 4000, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BookCopies", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BookCopies_Books_BookId",
                        column: x => x.BookId,
                        principalTable: "Books",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_BookCopies_Locations_LocationId",
                        column: x => x.LocationId,
                        principalTable: "Locations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "BookIdentifiers",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    BookId = table.Column<int>(type: "INTEGER", nullable: false),
                    Type = table.Column<string>(type: "TEXT", maxLength: 20, nullable: false),
                    Value = table.Column<string>(type: "TEXT", maxLength: 120, nullable: false),
                    NormalizedValue = table.Column<string>(type: "TEXT", maxLength: 120, nullable: false),
                    IsPrimary = table.Column<bool>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BookIdentifiers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BookIdentifiers_Books_BookId",
                        column: x => x.BookId,
                        principalTable: "Books",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_BookCopies_BookId",
                table: "BookCopies",
                column: "BookId");

            migrationBuilder.CreateIndex(
                name: "IX_BookCopies_LocationId",
                table: "BookCopies",
                column: "LocationId");

            migrationBuilder.CreateIndex(
                name: "IX_BookIdentifiers_BookId",
                table: "BookIdentifiers",
                column: "BookId");

            migrationBuilder.CreateIndex(
                name: "IX_BookIdentifiers_Type_NormalizedValue",
                table: "BookIdentifiers",
                columns: new[] { "Type", "NormalizedValue" },
                unique: true);

            migrationBuilder.Sql(
                """
                INSERT INTO "BookIdentifiers" ("BookId", "Type", "Value", "NormalizedValue", "IsPrimary", "CreatedAt")
                SELECT
                    "Id",
                    CASE
                        WHEN UPPER(TRIM("Isbn13")) LIKE 'M%' THEN 'Internal'
                        ELSE 'ISBN13'
                    END,
                    TRIM("Isbn13"),
                    CASE
                        WHEN UPPER(TRIM("Isbn13")) LIKE 'M%' THEN UPPER(TRIM("Isbn13"))
                        ELSE REPLACE(REPLACE(REPLACE(REPLACE(TRIM("Isbn13"), '-', ''), ' ', ''), 'X', ''), 'x', '')
                    END,
                    1,
                    "CreatedAt"
                FROM "Books"
                WHERE IFNULL(TRIM("Isbn13"), '') <> '';
                """);

            migrationBuilder.Sql(
                """
                INSERT INTO "BookIdentifiers" ("BookId", "Type", "Value", "NormalizedValue", "IsPrimary", "CreatedAt")
                SELECT
                    b."Id",
                    'ISBN10',
                    TRIM(b."Isbn10"),
                    REPLACE(REPLACE(REPLACE(REPLACE(TRIM(b."Isbn10"), '-', ''), ' ', ''), 'X', ''), 'x', ''),
                    0,
                    b."CreatedAt"
                FROM "Books" AS b
                WHERE IFNULL(TRIM(b."Isbn10"), '') <> ''
                  AND REPLACE(REPLACE(REPLACE(REPLACE(TRIM(b."Isbn10"), '-', ''), ' ', ''), 'X', ''), 'x', '') <> ''
                  AND b."Id" = (
                      SELECT MIN(b2."Id")
                      FROM "Books" AS b2
                      WHERE REPLACE(REPLACE(REPLACE(REPLACE(TRIM(b2."Isbn10"), '-', ''), ' ', ''), 'X', ''), 'x', '') =
                            REPLACE(REPLACE(REPLACE(REPLACE(TRIM(b."Isbn10"), '-', ''), ' ', ''), 'X', ''), 'x', '')
                  );
                """);

            migrationBuilder.Sql(
                """
                WITH RECURSIVE "sequence"("Value") AS (
                    SELECT 1
                    UNION ALL
                    SELECT "Value" + 1
                    FROM "sequence"
                    WHERE "Value" < (
                        SELECT COALESCE(MAX(CASE WHEN "Quantity" > 0 THEN "Quantity" ELSE 0 END), 0)
                        FROM "Books"
                    )
                )
                INSERT INTO "BookCopies" ("BookId", "LocationId", "Condition", "Status", "Notes", "CreatedAt", "UpdatedAt")
                SELECT
                    b."Id",
                    b."LocationId",
                    COALESCE(NULLIF(TRIM(b."Condition"), ''), 'Unspecified'),
                    COALESCE(NULLIF(TRIM(b."Status"), ''), 'Owned'),
                    NULLIF(TRIM(b."Notes"), ''),
                    b."CreatedAt",
                    b."UpdatedAt"
                FROM "Books" AS b
                INNER JOIN "sequence" AS s
                    ON s."Value" <= CASE WHEN b."Quantity" > 0 THEN b."Quantity" ELSE 0 END;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "BookCopies");

            migrationBuilder.DropTable(
                name: "BookIdentifiers");
        }
    }
}
