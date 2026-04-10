using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Rass.Api.Migrations
{
    /// <inheritdoc />
    public partial class GovernmentRegulationAndCropSharing : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ConditionGrade",
                table: "HarvestDeclarations",
                type: "character varying(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ConditionNote",
                table: "HarvestDeclarations",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Cell",
                table: "Cooperatives",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Sector",
                table: "Cooperatives",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "CropShareRequests",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    RequesterCooperativeId = table.Column<Guid>(type: "uuid", nullable: false),
                    SupplierCooperativeId = table.Column<Guid>(type: "uuid", nullable: true),
                    Crop = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    QuantityKg = table.Column<double>(type: "double precision", nullable: false),
                    OfferedPricePerKg = table.Column<decimal>(type: "numeric", nullable: true),
                    UrgencyLevel = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    ResponseNotes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    AgreedPricePerKg = table.Column<decimal>(type: "numeric", nullable: true),
                    AgreedQuantityKg = table.Column<double>(type: "double precision", nullable: true),
                    DeliveryTerms = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    RespondedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    FulfilledAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CropShareRequests", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CropShareRequests_Cooperatives_RequesterCooperativeId",
                        column: x => x.RequesterCooperativeId,
                        principalTable: "Cooperatives",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CropShareRequests_Cooperatives_SupplierCooperativeId",
                        column: x => x.SupplierCooperativeId,
                        principalTable: "Cooperatives",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "PriceRegulations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Crop = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Region = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Market = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    District = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    MinPricePerKg = table.Column<decimal>(type: "numeric", nullable: true),
                    MaxPricePerKg = table.Column<decimal>(type: "numeric", nullable: false),
                    EffectiveFrom = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EffectiveTo = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PriceRegulations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PriceRegulations_Users_CreatedByUserId",
                        column: x => x.CreatedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "SeasonalGuidances",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Crop = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Region = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Season = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    StabilityStart = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    StabilityEnd = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ExpectedTrend = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    ExpectedMinPrice = table.Column<decimal>(type: "numeric", nullable: true),
                    ExpectedMaxPrice = table.Column<decimal>(type: "numeric", nullable: true),
                    Notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    RecommendationForFarmers = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SeasonalGuidances", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CropShareRequests_RequesterCooperativeId",
                table: "CropShareRequests",
                column: "RequesterCooperativeId");

            migrationBuilder.CreateIndex(
                name: "IX_CropShareRequests_Status_Crop",
                table: "CropShareRequests",
                columns: new[] { "Status", "Crop" });

            migrationBuilder.CreateIndex(
                name: "IX_CropShareRequests_SupplierCooperativeId",
                table: "CropShareRequests",
                column: "SupplierCooperativeId");

            migrationBuilder.CreateIndex(
                name: "IX_PriceRegulations_CreatedByUserId",
                table: "PriceRegulations",
                column: "CreatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_PriceRegulations_Crop_Region_Status",
                table: "PriceRegulations",
                columns: new[] { "Crop", "Region", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_SeasonalGuidances_Crop_Region_Season",
                table: "SeasonalGuidances",
                columns: new[] { "Crop", "Region", "Season" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CropShareRequests");

            migrationBuilder.DropTable(
                name: "PriceRegulations");

            migrationBuilder.DropTable(
                name: "SeasonalGuidances");

            migrationBuilder.DropColumn(
                name: "ConditionGrade",
                table: "HarvestDeclarations");

            migrationBuilder.DropColumn(
                name: "ConditionNote",
                table: "HarvestDeclarations");

            migrationBuilder.DropColumn(
                name: "Cell",
                table: "Cooperatives");

            migrationBuilder.DropColumn(
                name: "Sector",
                table: "Cooperatives");
        }
    }
}
