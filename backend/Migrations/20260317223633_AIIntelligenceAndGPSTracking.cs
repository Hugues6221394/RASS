using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Rass.Api.Migrations
{
    /// <inheritdoc />
    public partial class AIIntelligenceAndGPSTracking : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedAt",
                table: "Users",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<DateTime>(
                name: "LastLogin",
                table: "Users",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedAt",
                table: "Lots",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<int>(
                name: "DaysSinceHarvest",
                table: "Lots",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ExpectedPricePerKg",
                table: "Lots",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ExpiryDate",
                table: "Lots",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "LandAreaHectares",
                table: "Lots",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "MarketPriceAtListing",
                table: "Lots",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "MoisturePercent",
                table: "Lots",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ProductionMethod",
                table: "Lots",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "QualityNotes",
                table: "Lots",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Season",
                table: "Lots",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "SourceLatitude",
                table: "Lots",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "SourceLongitude",
                table: "Lots",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "StorageFacilityId",
                table: "Lots",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "UpdatedAt",
                table: "Lots",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "YieldPerHectare",
                table: "Lots",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ActivatedAt",
                table: "Contracts",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BuyerSignatureOtp",
                table: "Contracts",
                type: "character varying(10)",
                maxLength: 10,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "BuyerSigned",
                table: "Contracts",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "BuyerSignedAt",
                table: "Contracts",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "CompletedAt",
                table: "Contracts",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "DeliveryDeadline",
                table: "Contracts",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DeliveryTerms",
                table: "Contracts",
                type: "character varying(500)",
                maxLength: 500,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "DisputeReason",
                table: "Contracts",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DisputeResolution",
                table: "Contracts",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "DisputeResolvedAt",
                table: "Contracts",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "DisputeResolvedBy",
                table: "Contracts",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "DisputedAt",
                table: "Contracts",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "EscrowAmount",
                table: "Contracts",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<DateTime>(
                name: "EscrowFundedAt",
                table: "Contracts",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "EscrowReleasedAt",
                table: "Contracts",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EscrowStatus",
                table: "Contracts",
                type: "character varying(40)",
                maxLength: 40,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "PaymentTerms",
                table: "Contracts",
                type: "character varying(500)",
                maxLength: 500,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "PenaltyClause",
                table: "Contracts",
                type: "character varying(500)",
                maxLength: 500,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "SellerSignatureOtp",
                table: "Contracts",
                type: "character varying(10)",
                maxLength: 10,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "SellerSigned",
                table: "Contracts",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "SellerSignedAt",
                table: "Contracts",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "TotalQuantityKg",
                table: "Contracts",
                type: "double precision",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<decimal>(
                name: "TotalValue",
                table: "Contracts",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.CreateTable(
                name: "DataQualityIssues",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    IssueType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Severity = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    EntityType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    EntityId = table.Column<Guid>(type: "uuid", nullable: true),
                    FieldName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    CurrentValue = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    ExpectedValue = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    SuggestedCorrection = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Crop = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Region = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    ReportedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    Status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    AutoCorrectable = table.Column<bool>(type: "boolean", nullable: false),
                    WasAutoCorrected = table.Column<bool>(type: "boolean", nullable: false),
                    CorrectedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    CorrectedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CorrectionNotes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    DetectedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DataQualityIssues", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "DeliveryTrackingInfos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TransportRequestId = table.Column<Guid>(type: "uuid", nullable: false),
                    OriginLatitude = table.Column<double>(type: "double precision", nullable: false),
                    OriginLongitude = table.Column<double>(type: "double precision", nullable: false),
                    DestinationLatitude = table.Column<double>(type: "double precision", nullable: false),
                    DestinationLongitude = table.Column<double>(type: "double precision", nullable: false),
                    CurrentLatitude = table.Column<double>(type: "double precision", nullable: true),
                    CurrentLongitude = table.Column<double>(type: "double precision", nullable: true),
                    LastLocationUpdate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    TotalDistanceKm = table.Column<double>(type: "double precision", nullable: false),
                    DistanceTraveledKm = table.Column<double>(type: "double precision", nullable: false),
                    ProgressPercent = table.Column<int>(type: "integer", nullable: false),
                    OriginalEta = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CurrentEta = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDelayed = table.Column<bool>(type: "boolean", nullable: false),
                    DelayMinutes = table.Column<int>(type: "integer", nullable: false),
                    TrackingStatus = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DeliveryTrackingInfos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DeliveryTrackingInfos_TransportRequests_TransportRequestId",
                        column: x => x.TransportRequestId,
                        principalTable: "TransportRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ModelPerformanceLogs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ModelName = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    ModelType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Crop = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Market = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Mae = table.Column<double>(type: "double precision", nullable: true),
                    Rmse = table.Column<double>(type: "double precision", nullable: true),
                    Mape = table.Column<double>(type: "double precision", nullable: true),
                    R2Score = table.Column<double>(type: "double precision", nullable: true),
                    ConfidenceLevel = table.Column<double>(type: "double precision", nullable: true),
                    TotalPredictions = table.Column<int>(type: "integer", nullable: false),
                    AccuratePredictions = table.Column<int>(type: "integer", nullable: false),
                    AccuracyRate = table.Column<double>(type: "double precision", nullable: false),
                    DriftDetected = table.Column<bool>(type: "boolean", nullable: false),
                    DriftScore = table.Column<double>(type: "double precision", nullable: true),
                    DriftReason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    LastTrainedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    TrainingDataPoints = table.Column<int>(type: "integer", nullable: false),
                    TrainingDurationSeconds = table.Column<double>(type: "double precision", nullable: true),
                    Status = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    RecordedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EvaluationPeriod = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ModelPerformanceLogs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PlatformAlerts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AlertType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Severity = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    Crop = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Region = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    District = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    RelatedUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    RelatedEntityId = table.Column<Guid>(type: "uuid", nullable: true),
                    RelatedEntityType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    ConfidenceScore = table.Column<double>(type: "double precision", nullable: false),
                    AiRecommendation = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    SupportingData = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    Status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    AcknowledgedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    AcknowledgedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ResolvedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    ResolvedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ResolutionNotes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlatformAlerts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PlatformAlerts_Users_RelatedUserId",
                        column: x => x.RelatedUserId,
                        principalTable: "Users",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "ScheduledTasks",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TaskName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    TaskType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    CronExpression = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    IsEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    LastRunAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    NextRunAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastRunStatus = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    LastRunResult = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    FailureCount = table.Column<int>(type: "integer", nullable: false),
                    Parameters = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScheduledTasks", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SystemConfigurations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Key = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Value = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    ValueType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Category = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    IsEditable = table.Column<bool>(type: "boolean", nullable: false),
                    LastModifiedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    LastModifiedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SystemConfigurations", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TransporterLocations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TransportRequestId = table.Column<Guid>(type: "uuid", nullable: false),
                    TransporterId = table.Column<Guid>(type: "uuid", nullable: false),
                    Latitude = table.Column<double>(type: "double precision", nullable: false),
                    Longitude = table.Column<double>(type: "double precision", nullable: false),
                    Accuracy = table.Column<double>(type: "double precision", nullable: true),
                    Speed = table.Column<double>(type: "double precision", nullable: true),
                    Heading = table.Column<double>(type: "double precision", nullable: true),
                    Altitude = table.Column<double>(type: "double precision", nullable: true),
                    DistanceRemainingKm = table.Column<double>(type: "double precision", nullable: true),
                    EstimatedArrival = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Status = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    RecordedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TransporterLocations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TransporterLocations_TransportRequests_TransportRequestId",
                        column: x => x.TransportRequestId,
                        principalTable: "TransportRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_TransporterLocations_TransporterProfiles_TransporterId",
                        column: x => x.TransporterId,
                        principalTable: "TransporterProfiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Lots_StorageFacilityId",
                table: "Lots",
                column: "StorageFacilityId");

            migrationBuilder.CreateIndex(
                name: "IX_DataQualityIssues_Status_Severity",
                table: "DataQualityIssues",
                columns: new[] { "Status", "Severity" });

            migrationBuilder.CreateIndex(
                name: "IX_DeliveryTrackingInfos_TransportRequestId",
                table: "DeliveryTrackingInfos",
                column: "TransportRequestId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ModelPerformanceLogs_ModelName_RecordedAt",
                table: "ModelPerformanceLogs",
                columns: new[] { "ModelName", "RecordedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_PlatformAlerts_RelatedUserId",
                table: "PlatformAlerts",
                column: "RelatedUserId");

            migrationBuilder.CreateIndex(
                name: "IX_PlatformAlerts_Status_Severity_CreatedAt",
                table: "PlatformAlerts",
                columns: new[] { "Status", "Severity", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_SystemConfigurations_Key",
                table: "SystemConfigurations",
                column: "Key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TransporterLocations_TransporterId",
                table: "TransporterLocations",
                column: "TransporterId");

            migrationBuilder.CreateIndex(
                name: "IX_TransporterLocations_TransportRequestId_RecordedAt",
                table: "TransporterLocations",
                columns: new[] { "TransportRequestId", "RecordedAt" });

            migrationBuilder.AddForeignKey(
                name: "FK_Lots_StorageFacilities_StorageFacilityId",
                table: "Lots",
                column: "StorageFacilityId",
                principalTable: "StorageFacilities",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Lots_StorageFacilities_StorageFacilityId",
                table: "Lots");

            migrationBuilder.DropTable(
                name: "DataQualityIssues");

            migrationBuilder.DropTable(
                name: "DeliveryTrackingInfos");

            migrationBuilder.DropTable(
                name: "ModelPerformanceLogs");

            migrationBuilder.DropTable(
                name: "PlatformAlerts");

            migrationBuilder.DropTable(
                name: "ScheduledTasks");

            migrationBuilder.DropTable(
                name: "SystemConfigurations");

            migrationBuilder.DropTable(
                name: "TransporterLocations");

            migrationBuilder.DropIndex(
                name: "IX_Lots_StorageFacilityId",
                table: "Lots");

            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "LastLogin",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "Lots");

            migrationBuilder.DropColumn(
                name: "DaysSinceHarvest",
                table: "Lots");

            migrationBuilder.DropColumn(
                name: "ExpectedPricePerKg",
                table: "Lots");

            migrationBuilder.DropColumn(
                name: "ExpiryDate",
                table: "Lots");

            migrationBuilder.DropColumn(
                name: "LandAreaHectares",
                table: "Lots");

            migrationBuilder.DropColumn(
                name: "MarketPriceAtListing",
                table: "Lots");

            migrationBuilder.DropColumn(
                name: "MoisturePercent",
                table: "Lots");

            migrationBuilder.DropColumn(
                name: "ProductionMethod",
                table: "Lots");

            migrationBuilder.DropColumn(
                name: "QualityNotes",
                table: "Lots");

            migrationBuilder.DropColumn(
                name: "Season",
                table: "Lots");

            migrationBuilder.DropColumn(
                name: "SourceLatitude",
                table: "Lots");

            migrationBuilder.DropColumn(
                name: "SourceLongitude",
                table: "Lots");

            migrationBuilder.DropColumn(
                name: "StorageFacilityId",
                table: "Lots");

            migrationBuilder.DropColumn(
                name: "UpdatedAt",
                table: "Lots");

            migrationBuilder.DropColumn(
                name: "YieldPerHectare",
                table: "Lots");

            migrationBuilder.DropColumn(
                name: "ActivatedAt",
                table: "Contracts");

            migrationBuilder.DropColumn(
                name: "BuyerSignatureOtp",
                table: "Contracts");

            migrationBuilder.DropColumn(
                name: "BuyerSigned",
                table: "Contracts");

            migrationBuilder.DropColumn(
                name: "BuyerSignedAt",
                table: "Contracts");

            migrationBuilder.DropColumn(
                name: "CompletedAt",
                table: "Contracts");

            migrationBuilder.DropColumn(
                name: "DeliveryDeadline",
                table: "Contracts");

            migrationBuilder.DropColumn(
                name: "DeliveryTerms",
                table: "Contracts");

            migrationBuilder.DropColumn(
                name: "DisputeReason",
                table: "Contracts");

            migrationBuilder.DropColumn(
                name: "DisputeResolution",
                table: "Contracts");

            migrationBuilder.DropColumn(
                name: "DisputeResolvedAt",
                table: "Contracts");

            migrationBuilder.DropColumn(
                name: "DisputeResolvedBy",
                table: "Contracts");

            migrationBuilder.DropColumn(
                name: "DisputedAt",
                table: "Contracts");

            migrationBuilder.DropColumn(
                name: "EscrowAmount",
                table: "Contracts");

            migrationBuilder.DropColumn(
                name: "EscrowFundedAt",
                table: "Contracts");

            migrationBuilder.DropColumn(
                name: "EscrowReleasedAt",
                table: "Contracts");

            migrationBuilder.DropColumn(
                name: "EscrowStatus",
                table: "Contracts");

            migrationBuilder.DropColumn(
                name: "PaymentTerms",
                table: "Contracts");

            migrationBuilder.DropColumn(
                name: "PenaltyClause",
                table: "Contracts");

            migrationBuilder.DropColumn(
                name: "SellerSignatureOtp",
                table: "Contracts");

            migrationBuilder.DropColumn(
                name: "SellerSigned",
                table: "Contracts");

            migrationBuilder.DropColumn(
                name: "SellerSignedAt",
                table: "Contracts");

            migrationBuilder.DropColumn(
                name: "TotalQuantityKg",
                table: "Contracts");

            migrationBuilder.DropColumn(
                name: "TotalValue",
                table: "Contracts");
        }
    }
}
