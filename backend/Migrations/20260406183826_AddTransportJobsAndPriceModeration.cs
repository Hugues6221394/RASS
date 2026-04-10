using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Rass.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddTransportJobsAndPriceModeration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ContentType",
                table: "RoleApplicationDocuments",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OriginalFileName",
                table: "RoleApplicationDocuments",
                type: "character varying(250)",
                maxLength: 250,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Cell",
                table: "MarketPrices",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "District",
                table: "MarketPrices",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ModeratedAt",
                table: "MarketPrices",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ModeratedByUserId",
                table: "MarketPrices",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ModerationNote",
                table: "MarketPrices",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "RegisteredMarketId",
                table: "MarketPrices",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Sector",
                table: "MarketPrices",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "VerificationStatus",
                table: "MarketPrices",
                type: "character varying(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "CropCatalogs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    NormalizedName = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Status = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    IsGovernmentRegistered = table.Column<bool>(type: "boolean", nullable: false),
                    RequiresGovernmentReview = table.Column<bool>(type: "boolean", nullable: false),
                    SourceRole = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CropCatalogs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CropCatalogs_Users_CreatedByUserId",
                        column: x => x.CreatedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "RegisteredMarkets",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    NormalizedName = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    Province = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    District = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Sector = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Cell = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Location = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RegisteredMarkets", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RegisteredMarkets_Users_CreatedByUserId",
                        column: x => x.CreatedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "TransportJobs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CooperativeId = table.Column<Guid>(type: "uuid", nullable: false),
                    PostedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    Crop = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    QuantityKg = table.Column<double>(type: "double precision", nullable: false),
                    QualityGrade = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    PickupLocation = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: false),
                    DeliveryLocation = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: false),
                    DistanceKm = table.Column<double>(type: "double precision", nullable: true),
                    PickupDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeliveryDeadline = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    MinPaymentRwf = table.Column<decimal>(type: "numeric", nullable: true),
                    MaxPaymentRwf = table.Column<decimal>(type: "numeric", nullable: true),
                    PaymentTerms = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    RequiredVehicleType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    RequiresColdChain = table.Column<bool>(type: "boolean", nullable: false),
                    SpecialInstructions = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    Status = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    AssignedTransporterId = table.Column<Guid>(type: "uuid", nullable: true),
                    TransportRequestId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TransportJobs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TransportJobs_Cooperatives_CooperativeId",
                        column: x => x.CooperativeId,
                        principalTable: "Cooperatives",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TransportJobs_TransportRequests_TransportRequestId",
                        column: x => x.TransportRequestId,
                        principalTable: "TransportRequests",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_TransportJobs_Users_AssignedTransporterId",
                        column: x => x.AssignedTransporterId,
                        principalTable: "Users",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_TransportJobs_Users_PostedByUserId",
                        column: x => x.PostedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TransportJobApplications",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TransportJobId = table.Column<Guid>(type: "uuid", nullable: false),
                    TransporterUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProposedPriceRwf = table.Column<decimal>(type: "numeric", nullable: false),
                    VehicleType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    PlateNumber = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    VehicleCapacityKg = table.Column<double>(type: "double precision", nullable: true),
                    CoverLetter = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    EstimatedDeliveryHours = table.Column<int>(type: "integer", nullable: true),
                    DriverPhone = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    DrivingLicenseUrl = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    InsuranceDocUrl = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    VehicleInspectionUrl = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Status = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    ReviewNote = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TransportJobApplications", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TransportJobApplications_TransportJobs_TransportJobId",
                        column: x => x.TransportJobId,
                        principalTable: "TransportJobs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_TransportJobApplications_Users_TransporterUserId",
                        column: x => x.TransporterUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_MarketPrices_RegisteredMarketId",
                table: "MarketPrices",
                column: "RegisteredMarketId");

            migrationBuilder.CreateIndex(
                name: "IX_MarketPrices_VerificationStatus_ObservedAt",
                table: "MarketPrices",
                columns: new[] { "VerificationStatus", "ObservedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_CropCatalogs_CreatedByUserId",
                table: "CropCatalogs",
                column: "CreatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_CropCatalogs_NormalizedName",
                table: "CropCatalogs",
                column: "NormalizedName",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RegisteredMarkets_CreatedByUserId",
                table: "RegisteredMarkets",
                column: "CreatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_RegisteredMarkets_NormalizedName",
                table: "RegisteredMarkets",
                column: "NormalizedName",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TransportJobApplications_TransporterUserId",
                table: "TransportJobApplications",
                column: "TransporterUserId");

            migrationBuilder.CreateIndex(
                name: "IX_TransportJobApplications_TransportJobId_TransporterUserId",
                table: "TransportJobApplications",
                columns: new[] { "TransportJobId", "TransporterUserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TransportJobs_AssignedTransporterId",
                table: "TransportJobs",
                column: "AssignedTransporterId");

            migrationBuilder.CreateIndex(
                name: "IX_TransportJobs_CooperativeId",
                table: "TransportJobs",
                column: "CooperativeId");

            migrationBuilder.CreateIndex(
                name: "IX_TransportJobs_PostedByUserId",
                table: "TransportJobs",
                column: "PostedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_TransportJobs_Status_CreatedAt",
                table: "TransportJobs",
                columns: new[] { "Status", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_TransportJobs_TransportRequestId",
                table: "TransportJobs",
                column: "TransportRequestId");

            migrationBuilder.AddForeignKey(
                name: "FK_MarketPrices_RegisteredMarkets_RegisteredMarketId",
                table: "MarketPrices",
                column: "RegisteredMarketId",
                principalTable: "RegisteredMarkets",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_MarketPrices_RegisteredMarkets_RegisteredMarketId",
                table: "MarketPrices");

            migrationBuilder.DropTable(
                name: "CropCatalogs");

            migrationBuilder.DropTable(
                name: "RegisteredMarkets");

            migrationBuilder.DropTable(
                name: "TransportJobApplications");

            migrationBuilder.DropTable(
                name: "TransportJobs");

            migrationBuilder.DropIndex(
                name: "IX_MarketPrices_RegisteredMarketId",
                table: "MarketPrices");

            migrationBuilder.DropIndex(
                name: "IX_MarketPrices_VerificationStatus_ObservedAt",
                table: "MarketPrices");

            migrationBuilder.DropColumn(
                name: "ContentType",
                table: "RoleApplicationDocuments");

            migrationBuilder.DropColumn(
                name: "OriginalFileName",
                table: "RoleApplicationDocuments");

            migrationBuilder.DropColumn(
                name: "Cell",
                table: "MarketPrices");

            migrationBuilder.DropColumn(
                name: "District",
                table: "MarketPrices");

            migrationBuilder.DropColumn(
                name: "ModeratedAt",
                table: "MarketPrices");

            migrationBuilder.DropColumn(
                name: "ModeratedByUserId",
                table: "MarketPrices");

            migrationBuilder.DropColumn(
                name: "ModerationNote",
                table: "MarketPrices");

            migrationBuilder.DropColumn(
                name: "RegisteredMarketId",
                table: "MarketPrices");

            migrationBuilder.DropColumn(
                name: "Sector",
                table: "MarketPrices");

            migrationBuilder.DropColumn(
                name: "VerificationStatus",
                table: "MarketPrices");
        }
    }
}
