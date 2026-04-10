using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Rass.Api.Migrations
{
    /// <inheritdoc />
    public partial class CropShareBidsWorkflow : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CropShareBids",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CropShareRequestId = table.Column<Guid>(type: "uuid", nullable: false),
                    SupplierCooperativeId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProposedPricePerKg = table.Column<decimal>(type: "numeric", nullable: false),
                    ProposedQuantityKg = table.Column<double>(type: "double precision", nullable: false),
                    DeliveryTerms = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CropShareBids", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CropShareBids_Cooperatives_SupplierCooperativeId",
                        column: x => x.SupplierCooperativeId,
                        principalTable: "Cooperatives",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CropShareBids_CropShareRequests_CropShareRequestId",
                        column: x => x.CropShareRequestId,
                        principalTable: "CropShareRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CropShareBids_CropShareRequestId_SupplierCooperativeId",
                table: "CropShareBids",
                columns: new[] { "CropShareRequestId", "SupplierCooperativeId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CropShareBids_Status_CreatedAt",
                table: "CropShareBids",
                columns: new[] { "Status", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_CropShareBids_SupplierCooperativeId",
                table: "CropShareBids",
                column: "SupplierCooperativeId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CropShareBids");
        }
    }
}
