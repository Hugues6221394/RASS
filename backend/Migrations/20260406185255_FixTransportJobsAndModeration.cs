using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Rass.Api.Migrations
{
    /// <inheritdoc />
    public partial class FixTransportJobsAndModeration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Idempotent: only create tables/columns that don't already exist.
            // The previous migration was partially applied (CropCatalogs already existed).

            migrationBuilder.Sql(@"
-- =============================================
-- CropCatalogs (may already exist from manual migration)
-- =============================================
CREATE TABLE IF NOT EXISTS ""CropCatalogs"" (
    ""Id"" uuid NOT NULL,
    ""Name"" character varying(120) NOT NULL,
    ""NormalizedName"" character varying(160) NOT NULL,
    ""Status"" character varying(40) NOT NULL,
    ""IsGovernmentRegistered"" boolean NOT NULL,
    ""RequiresGovernmentReview"" boolean NOT NULL,
    ""SourceRole"" character varying(40) NOT NULL,
    ""CreatedByUserId"" uuid,
    ""CreatedAt"" timestamp with time zone NOT NULL,
    ""UpdatedAt"" timestamp with time zone,
    CONSTRAINT ""PK_CropCatalogs"" PRIMARY KEY (""Id""),
    CONSTRAINT ""FK_CropCatalogs_Users_CreatedByUserId"" FOREIGN KEY (""CreatedByUserId"") REFERENCES ""Users""(""Id"")
);
CREATE UNIQUE INDEX IF NOT EXISTS ""IX_CropCatalogs_NormalizedName"" ON ""CropCatalogs""(""NormalizedName"");
CREATE INDEX IF NOT EXISTS ""IX_CropCatalogs_CreatedByUserId"" ON ""CropCatalogs""(""CreatedByUserId"");

-- =============================================
-- RegisteredMarkets (may already exist from manual migration)
-- =============================================
CREATE TABLE IF NOT EXISTS ""RegisteredMarkets"" (
    ""Id"" uuid NOT NULL,
    ""Name"" character varying(150) NOT NULL,
    ""NormalizedName"" character varying(180) NOT NULL,
    ""Province"" character varying(80) NOT NULL,
    ""District"" character varying(100) NOT NULL,
    ""Sector"" character varying(100) NOT NULL,
    ""Cell"" character varying(100),
    ""Location"" character varying(250),
    ""IsActive"" boolean NOT NULL,
    ""CreatedByUserId"" uuid,
    ""CreatedAt"" timestamp with time zone NOT NULL,
    ""UpdatedAt"" timestamp with time zone,
    CONSTRAINT ""PK_RegisteredMarkets"" PRIMARY KEY (""Id""),
    CONSTRAINT ""FK_RegisteredMarkets_Users_CreatedByUserId"" FOREIGN KEY (""CreatedByUserId"") REFERENCES ""Users""(""Id"")
);
CREATE UNIQUE INDEX IF NOT EXISTS ""IX_RegisteredMarkets_NormalizedName"" ON ""RegisteredMarkets""(""NormalizedName"");
CREATE INDEX IF NOT EXISTS ""IX_RegisteredMarkets_CreatedByUserId"" ON ""RegisteredMarkets""(""CreatedByUserId"");

-- =============================================
-- TransportJobs
-- =============================================
CREATE TABLE IF NOT EXISTS ""TransportJobs"" (
    ""Id"" uuid NOT NULL,
    ""CooperativeId"" uuid NOT NULL,
    ""PostedByUserId"" uuid NOT NULL,
    ""Title"" character varying(200) NOT NULL,
    ""Description"" character varying(2000),
    ""Crop"" character varying(100) NOT NULL,
    ""QuantityKg"" double precision NOT NULL,
    ""QualityGrade"" character varying(50),
    ""PickupLocation"" character varying(250) NOT NULL,
    ""DeliveryLocation"" character varying(250) NOT NULL,
    ""DistanceKm"" double precision,
    ""PickupDate"" timestamp with time zone,
    ""DeliveryDeadline"" timestamp with time zone,
    ""MinPaymentRwf"" numeric,
    ""MaxPaymentRwf"" numeric,
    ""PaymentTerms"" character varying(50) NOT NULL,
    ""RequiredVehicleType"" character varying(50),
    ""RequiresColdChain"" boolean NOT NULL,
    ""SpecialInstructions"" character varying(1000),
    ""Status"" character varying(40) NOT NULL,
    ""AssignedTransporterId"" uuid,
    ""TransportRequestId"" uuid,
    ""CreatedAt"" timestamp with time zone NOT NULL,
    ""UpdatedAt"" timestamp with time zone NOT NULL,
    CONSTRAINT ""PK_TransportJobs"" PRIMARY KEY (""Id""),
    CONSTRAINT ""FK_TransportJobs_Cooperatives_CooperativeId"" FOREIGN KEY (""CooperativeId"") REFERENCES ""Cooperatives""(""Id"") ON DELETE RESTRICT,
    CONSTRAINT ""FK_TransportJobs_TransportRequests_TransportRequestId"" FOREIGN KEY (""TransportRequestId"") REFERENCES ""TransportRequests""(""Id""),
    CONSTRAINT ""FK_TransportJobs_Users_AssignedTransporterId"" FOREIGN KEY (""AssignedTransporterId"") REFERENCES ""Users""(""Id""),
    CONSTRAINT ""FK_TransportJobs_Users_PostedByUserId"" FOREIGN KEY (""PostedByUserId"") REFERENCES ""Users""(""Id"") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ""IX_TransportJobs_Status_CreatedAt"" ON ""TransportJobs""(""Status"", ""CreatedAt"");
CREATE INDEX IF NOT EXISTS ""IX_TransportJobs_CooperativeId"" ON ""TransportJobs""(""CooperativeId"");
CREATE INDEX IF NOT EXISTS ""IX_TransportJobs_AssignedTransporterId"" ON ""TransportJobs""(""AssignedTransporterId"");
CREATE INDEX IF NOT EXISTS ""IX_TransportJobs_PostedByUserId"" ON ""TransportJobs""(""PostedByUserId"");
CREATE INDEX IF NOT EXISTS ""IX_TransportJobs_TransportRequestId"" ON ""TransportJobs""(""TransportRequestId"");

-- =============================================
-- TransportJobApplications
-- =============================================
CREATE TABLE IF NOT EXISTS ""TransportJobApplications"" (
    ""Id"" uuid NOT NULL,
    ""TransportJobId"" uuid NOT NULL,
    ""TransporterUserId"" uuid NOT NULL,
    ""ProposedPriceRwf"" numeric NOT NULL,
    ""VehicleType"" character varying(50),
    ""PlateNumber"" character varying(30),
    ""VehicleCapacityKg"" double precision,
    ""CoverLetter"" character varying(2000),
    ""EstimatedDeliveryHours"" integer,
    ""DriverPhone"" character varying(20),
    ""DrivingLicenseUrl"" character varying(500),
    ""InsuranceDocUrl"" character varying(500),
    ""VehicleInspectionUrl"" character varying(500),
    ""Status"" character varying(40) NOT NULL,
    ""ReviewNote"" character varying(500),
    ""CreatedAt"" timestamp with time zone NOT NULL,
    ""UpdatedAt"" timestamp with time zone NOT NULL,
    CONSTRAINT ""PK_TransportJobApplications"" PRIMARY KEY (""Id""),
    CONSTRAINT ""FK_TransportJobApplications_TransportJobs_TransportJobId"" FOREIGN KEY (""TransportJobId"") REFERENCES ""TransportJobs""(""Id"") ON DELETE CASCADE,
    CONSTRAINT ""FK_TransportJobApplications_Users_TransporterUserId"" FOREIGN KEY (""TransporterUserId"") REFERENCES ""Users""(""Id"") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS ""IX_TransportJobApplications_TransportJobId_TransporterUserId"" ON ""TransportJobApplications""(""TransportJobId"", ""TransporterUserId"");
CREATE INDEX IF NOT EXISTS ""IX_TransportJobApplications_TransporterUserId"" ON ""TransportJobApplications""(""TransporterUserId"");

-- =============================================
-- MarketPrices: Add moderation columns (idempotent)
-- =============================================
ALTER TABLE ""MarketPrices"" ADD COLUMN IF NOT EXISTS ""VerificationStatus"" character varying(30) NOT NULL DEFAULT 'Approved';
ALTER TABLE ""MarketPrices"" ADD COLUMN IF NOT EXISTS ""ModerationNote"" character varying(500);
ALTER TABLE ""MarketPrices"" ADD COLUMN IF NOT EXISTS ""ModeratedByUserId"" uuid;
ALTER TABLE ""MarketPrices"" ADD COLUMN IF NOT EXISTS ""ModeratedAt"" timestamp with time zone;
ALTER TABLE ""MarketPrices"" ADD COLUMN IF NOT EXISTS ""District"" character varying(100);
ALTER TABLE ""MarketPrices"" ADD COLUMN IF NOT EXISTS ""Sector"" character varying(100);
ALTER TABLE ""MarketPrices"" ADD COLUMN IF NOT EXISTS ""Cell"" character varying(100);
ALTER TABLE ""MarketPrices"" ADD COLUMN IF NOT EXISTS ""RegisteredMarketId"" uuid;
CREATE INDEX IF NOT EXISTS ""IX_MarketPrices_VerificationStatus_ObservedAt"" ON ""MarketPrices""(""VerificationStatus"", ""ObservedAt"");
CREATE INDEX IF NOT EXISTS ""IX_MarketPrices_RegisteredMarketId"" ON ""MarketPrices""(""RegisteredMarketId"");

-- Add FK if not exists
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'FK_MarketPrices_RegisteredMarkets_RegisteredMarketId') THEN
        ALTER TABLE ""MarketPrices"" ADD CONSTRAINT ""FK_MarketPrices_RegisteredMarkets_RegisteredMarketId"" FOREIGN KEY (""RegisteredMarketId"") REFERENCES ""RegisteredMarkets""(""Id"");
    END IF;
END $$;

-- =============================================
-- RoleApplicationDocuments: Add file metadata columns
-- =============================================
ALTER TABLE ""RoleApplicationDocuments"" ADD COLUMN IF NOT EXISTS ""ContentType"" character varying(120);
ALTER TABLE ""RoleApplicationDocuments"" ADD COLUMN IF NOT EXISTS ""OriginalFileName"" character varying(250);
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DROP TABLE IF EXISTS ""TransportJobApplications"";
DROP TABLE IF EXISTS ""TransportJobs"";
ALTER TABLE ""MarketPrices"" DROP COLUMN IF EXISTS ""VerificationStatus"";
ALTER TABLE ""MarketPrices"" DROP COLUMN IF EXISTS ""ModerationNote"";
ALTER TABLE ""MarketPrices"" DROP COLUMN IF EXISTS ""ModeratedByUserId"";
ALTER TABLE ""MarketPrices"" DROP COLUMN IF EXISTS ""ModeratedAt"";
            ");
        }
    }
}
