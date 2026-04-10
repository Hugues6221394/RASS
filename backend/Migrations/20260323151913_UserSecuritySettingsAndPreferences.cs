using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Rass.Api.Migrations
{
    /// <inheritdoc />
    public partial class UserSecuritySettingsAndPreferences : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "NotifyEmail",
                table: "Users",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "NotifyInApp",
                table: "Users",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "NotifyMarketing",
                table: "Users",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "NotifySecurityAlerts",
                table: "Users",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "PendingEmail",
                table: "Users",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "PendingEmailOtpExpiry",
                table: "Users",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PendingEmailOtpHash",
                table: "Users",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PendingPhone",
                table: "Users",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "PendingPhoneOtpExpiry",
                table: "Users",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PendingPhoneOtpHash",
                table: "Users",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PhoneNumber",
                table: "Users",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "TwoFactorEnabled",
                table: "Users",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "TwoFactorSecret",
                table: "Users",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "NotifyEmail",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "NotifyInApp",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "NotifyMarketing",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "NotifySecurityAlerts",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "PendingEmail",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "PendingEmailOtpExpiry",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "PendingEmailOtpHash",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "PendingPhone",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "PendingPhoneOtpExpiry",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "PendingPhoneOtpHash",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "PhoneNumber",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "TwoFactorEnabled",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "TwoFactorSecret",
                table: "Users");
        }
    }
}
