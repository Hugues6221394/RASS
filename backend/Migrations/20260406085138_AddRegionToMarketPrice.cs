using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Rass.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddRegionToMarketPrice : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Region",
                table: "MarketPrices",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "");

            // Backfill existing rows with correct region based on market name
            migrationBuilder.Sql(@"
                UPDATE ""MarketPrices"" SET ""Region"" = CASE
                    WHEN ""Market"" ILIKE 'Kigali%' OR ""Market"" ILIKE 'Nyarugenge%' OR ""Market"" ILIKE 'Kicukiro%' OR ""Market"" ILIKE 'Gasabo%' THEN 'Kigali City'
                    WHEN ""Market"" ILIKE 'Musanze%' OR ""Market"" ILIKE 'Burera%' OR ""Market"" ILIKE 'Gakenke%' OR ""Market"" ILIKE 'Gicumbi%' OR ""Market"" ILIKE 'Rulindo%' THEN 'Northern'
                    WHEN ""Market"" ILIKE 'Huye%' OR ""Market"" ILIKE 'Muhanga%' OR ""Market"" ILIKE 'Gisagara%' OR ""Market"" ILIKE 'Kamonyi%' OR ""Market"" ILIKE 'Nyamagabe%' OR ""Market"" ILIKE 'Nyanza%' OR ""Market"" ILIKE 'Nyaruguru%' OR ""Market"" ILIKE 'Ruhango%' THEN 'Southern'
                    WHEN ""Market"" ILIKE 'Rwamagana%' OR ""Market"" ILIKE 'Bugesera%' OR ""Market"" ILIKE 'Gatsibo%' OR ""Market"" ILIKE 'Kayonza%' OR ""Market"" ILIKE 'Kirehe%' OR ""Market"" ILIKE 'Ngoma%' OR ""Market"" ILIKE 'Nyagatare%' THEN 'Eastern'
                    WHEN ""Market"" ILIKE 'Rubavu%' OR ""Market"" ILIKE 'Karongi%' OR ""Market"" ILIKE 'Ngororero%' OR ""Market"" ILIKE 'Nyabihu%' OR ""Market"" ILIKE 'Nyamasheke%' OR ""Market"" ILIKE 'Rusizi%' OR ""Market"" ILIKE 'Rutsiro%' THEN 'Western'
                    ELSE 'Unknown'
                END
                WHERE ""Region"" = '';
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Region",
                table: "MarketPrices");
        }
    }
}
