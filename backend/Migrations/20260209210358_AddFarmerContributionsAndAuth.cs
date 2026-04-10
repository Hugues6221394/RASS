using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Rass.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddFarmerContributionsAndAuth : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "LotContributions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    LotId = table.Column<Guid>(type: "uuid", nullable: false),
                    FarmerId = table.Column<Guid>(type: "uuid", nullable: false),
                    QuantityKg = table.Column<double>(type: "double precision", nullable: false),
                    ContributedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LotContributions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LotContributions_Farmers_FarmerId",
                        column: x => x.FarmerId,
                        principalTable: "Farmers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_LotContributions_Lots_LotId",
                        column: x => x.LotId,
                        principalTable: "Lots",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_LotContributions_FarmerId",
                table: "LotContributions",
                column: "FarmerId");

            migrationBuilder.CreateIndex(
                name: "IX_LotContributions_LotId",
                table: "LotContributions",
                column: "LotId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "LotContributions");
        }
    }
}
