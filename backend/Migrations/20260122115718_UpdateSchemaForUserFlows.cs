using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Rass.Api.Migrations
{
    /// <inheritdoc />
    public partial class UpdateSchemaForUserFlows : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Market",
                table: "BuyerOrders");

            migrationBuilder.AddColumn<DateTime>(
                name: "AssignedAt",
                table: "TransportRequests",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedAt",
                table: "TransportRequests",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<DateTime>(
                name: "DeliveredAt",
                table: "TransportRequests",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DriverPhone",
                table: "TransportRequests",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Notes",
                table: "TransportRequests",
                type: "character varying(500)",
                maxLength: 500,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "PickedUpAt",
                table: "TransportRequests",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TransporterId",
                table: "TransportRequests",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedAt",
                table: "Farmers",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<double>(
                name: "FarmSizeHectares",
                table: "Farmers",
                type: "double precision",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<bool>(
                name: "IsActive",
                table: "Farmers",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "NationalId",
                table: "Farmers",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Sector",
                table: "Farmers",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedAt",
                table: "Cooperatives",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<string>(
                name: "District",
                table: "Cooperatives",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Email",
                table: "Cooperatives",
                type: "character varying(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<bool>(
                name: "IsActive",
                table: "Cooperatives",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsVerified",
                table: "Cooperatives",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "BusinessType",
                table: "BuyerProfiles",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedAt",
                table: "BuyerProfiles",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<bool>(
                name: "IsActive",
                table: "BuyerProfiles",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsVerified",
                table: "BuyerProfiles",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "Phone",
                table: "BuyerProfiles",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "TaxId",
                table: "BuyerProfiles",
                type: "character varying(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedAt",
                table: "BuyerOrders",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<string>(
                name: "DeliveryLocation",
                table: "BuyerOrders",
                type: "character varying(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<Guid>(
                name: "MarketListingId",
                table: "BuyerOrders",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Notes",
                table: "BuyerOrders",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "HarvestDeclarations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FarmerId = table.Column<Guid>(type: "uuid", nullable: false),
                    Crop = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    ExpectedQuantityKg = table.Column<double>(type: "double precision", nullable: false),
                    ExpectedHarvestDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    QualityIndicators = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Status = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ReviewedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HarvestDeclarations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_HarvestDeclarations_Farmers_FarmerId",
                        column: x => x.FarmerId,
                        principalTable: "Farmers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "MarketListings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CooperativeId = table.Column<Guid>(type: "uuid", nullable: false),
                    Crop = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    QuantityKg = table.Column<double>(type: "double precision", nullable: false),
                    MinimumPrice = table.Column<decimal>(type: "numeric", nullable: false),
                    AvailabilityWindowStart = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    AvailabilityWindowEnd = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    QualityGrade = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Status = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MarketListings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MarketListings_Cooperatives_CooperativeId",
                        column: x => x.CooperativeId,
                        principalTable: "Cooperatives",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TransporterProfiles",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    LicenseNumber = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Phone = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    CapacityKg = table.Column<double>(type: "double precision", nullable: false),
                    VehicleType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    LicensePlate = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    OperatingRegions = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    IsVerified = table.Column<bool>(type: "boolean", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TransporterProfiles", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TransporterProfiles_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TransportRequests_TransporterId",
                table: "TransportRequests",
                column: "TransporterId");

            migrationBuilder.CreateIndex(
                name: "IX_BuyerOrders_MarketListingId",
                table: "BuyerOrders",
                column: "MarketListingId");

            migrationBuilder.CreateIndex(
                name: "IX_HarvestDeclarations_FarmerId",
                table: "HarvestDeclarations",
                column: "FarmerId");

            migrationBuilder.CreateIndex(
                name: "IX_MarketListings_CooperativeId",
                table: "MarketListings",
                column: "CooperativeId");

            migrationBuilder.CreateIndex(
                name: "IX_TransporterProfiles_UserId",
                table: "TransporterProfiles",
                column: "UserId");

            migrationBuilder.AddForeignKey(
                name: "FK_BuyerOrders_MarketListings_MarketListingId",
                table: "BuyerOrders",
                column: "MarketListingId",
                principalTable: "MarketListings",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_TransportRequests_TransporterProfiles_TransporterId",
                table: "TransportRequests",
                column: "TransporterId",
                principalTable: "TransporterProfiles",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_BuyerOrders_MarketListings_MarketListingId",
                table: "BuyerOrders");

            migrationBuilder.DropForeignKey(
                name: "FK_TransportRequests_TransporterProfiles_TransporterId",
                table: "TransportRequests");

            migrationBuilder.DropTable(
                name: "HarvestDeclarations");

            migrationBuilder.DropTable(
                name: "MarketListings");

            migrationBuilder.DropTable(
                name: "TransporterProfiles");

            migrationBuilder.DropIndex(
                name: "IX_TransportRequests_TransporterId",
                table: "TransportRequests");

            migrationBuilder.DropIndex(
                name: "IX_BuyerOrders_MarketListingId",
                table: "BuyerOrders");

            migrationBuilder.DropColumn(
                name: "AssignedAt",
                table: "TransportRequests");

            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "TransportRequests");

            migrationBuilder.DropColumn(
                name: "DeliveredAt",
                table: "TransportRequests");

            migrationBuilder.DropColumn(
                name: "DriverPhone",
                table: "TransportRequests");

            migrationBuilder.DropColumn(
                name: "Notes",
                table: "TransportRequests");

            migrationBuilder.DropColumn(
                name: "PickedUpAt",
                table: "TransportRequests");

            migrationBuilder.DropColumn(
                name: "TransporterId",
                table: "TransportRequests");

            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "Farmers");

            migrationBuilder.DropColumn(
                name: "FarmSizeHectares",
                table: "Farmers");

            migrationBuilder.DropColumn(
                name: "IsActive",
                table: "Farmers");

            migrationBuilder.DropColumn(
                name: "NationalId",
                table: "Farmers");

            migrationBuilder.DropColumn(
                name: "Sector",
                table: "Farmers");

            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "Cooperatives");

            migrationBuilder.DropColumn(
                name: "District",
                table: "Cooperatives");

            migrationBuilder.DropColumn(
                name: "Email",
                table: "Cooperatives");

            migrationBuilder.DropColumn(
                name: "IsActive",
                table: "Cooperatives");

            migrationBuilder.DropColumn(
                name: "IsVerified",
                table: "Cooperatives");

            migrationBuilder.DropColumn(
                name: "BusinessType",
                table: "BuyerProfiles");

            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "BuyerProfiles");

            migrationBuilder.DropColumn(
                name: "IsActive",
                table: "BuyerProfiles");

            migrationBuilder.DropColumn(
                name: "IsVerified",
                table: "BuyerProfiles");

            migrationBuilder.DropColumn(
                name: "Phone",
                table: "BuyerProfiles");

            migrationBuilder.DropColumn(
                name: "TaxId",
                table: "BuyerProfiles");

            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "BuyerOrders");

            migrationBuilder.DropColumn(
                name: "DeliveryLocation",
                table: "BuyerOrders");

            migrationBuilder.DropColumn(
                name: "MarketListingId",
                table: "BuyerOrders");

            migrationBuilder.DropColumn(
                name: "Notes",
                table: "BuyerOrders");

            migrationBuilder.AddColumn<string>(
                name: "Market",
                table: "BuyerOrders",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");
        }
    }
}
