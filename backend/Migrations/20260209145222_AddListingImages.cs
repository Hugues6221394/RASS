using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Rass.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddListingImages : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ListingImages",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    MarketListingId = table.Column<Guid>(type: "uuid", nullable: false),
                    ImageUrl = table.Column<string>(type: "text", nullable: false),
                    DisplayOrder = table.Column<int>(type: "integer", nullable: false),
                    UploadedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ListingImages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ListingImages_MarketListings_MarketListingId",
                        column: x => x.MarketListingId,
                        principalTable: "MarketListings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ListingImages_MarketListingId",
                table: "ListingImages",
                column: "MarketListingId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ListingImages");
        }
    }
}
