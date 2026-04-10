using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Rass.Api.Migrations
{
    /// <inheritdoc />
    public partial class EnhanceAuditLogColumns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "EntityId",
                table: "AuditLogs",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(100)",
                oldMaxLength: 100,
                oldNullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ActionType",
                table: "AuditLogs",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ActorRole",
                table: "AuditLogs",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AfterState",
                table: "AuditLogs",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BeforeState",
                table: "AuditLogs",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DeviceInfo",
                table: "AuditLogs",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "DurationMs",
                table: "AuditLogs",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "IpAddress",
                table: "AuditLogs",
                type: "character varying(60)",
                maxLength: 60,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "StatusCode",
                table: "AuditLogs",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_ActorRole",
                table: "AuditLogs",
                column: "ActorRole");

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_Timestamp_ActionType",
                table: "AuditLogs",
                columns: new[] { "Timestamp", "ActionType" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_AuditLogs_ActorRole",
                table: "AuditLogs");

            migrationBuilder.DropIndex(
                name: "IX_AuditLogs_Timestamp_ActionType",
                table: "AuditLogs");

            migrationBuilder.DropColumn(
                name: "ActionType",
                table: "AuditLogs");

            migrationBuilder.DropColumn(
                name: "ActorRole",
                table: "AuditLogs");

            migrationBuilder.DropColumn(
                name: "AfterState",
                table: "AuditLogs");

            migrationBuilder.DropColumn(
                name: "BeforeState",
                table: "AuditLogs");

            migrationBuilder.DropColumn(
                name: "DeviceInfo",
                table: "AuditLogs");

            migrationBuilder.DropColumn(
                name: "DurationMs",
                table: "AuditLogs");

            migrationBuilder.DropColumn(
                name: "IpAddress",
                table: "AuditLogs");

            migrationBuilder.DropColumn(
                name: "StatusCode",
                table: "AuditLogs");

            migrationBuilder.AlterColumn<string>(
                name: "EntityId",
                table: "AuditLogs",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(200)",
                oldMaxLength: 200,
                oldNullable: true);
        }
    }
}
