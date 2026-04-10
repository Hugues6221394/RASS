using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Rass.Api.Migrations
{
    /// <inheritdoc />
    public partial class ContractReviewAndDocuments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "BuyerApproved",
                table: "Contracts",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "BuyerApprovedAt",
                table: "Contracts",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ContractSource",
                table: "Contracts",
                type: "character varying(40)",
                maxLength: 40,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "DocumentContent",
                table: "Contracts",
                type: "character varying(8000)",
                maxLength: 8000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DocumentTitle",
                table: "Contracts",
                type: "character varying(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<bool>(
                name: "SellerApproved",
                table: "Contracts",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "SellerApprovedAt",
                table: "Contracts",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BuyerApproved",
                table: "Contracts");

            migrationBuilder.DropColumn(
                name: "BuyerApprovedAt",
                table: "Contracts");

            migrationBuilder.DropColumn(
                name: "ContractSource",
                table: "Contracts");

            migrationBuilder.DropColumn(
                name: "DocumentContent",
                table: "Contracts");

            migrationBuilder.DropColumn(
                name: "DocumentTitle",
                table: "Contracts");

            migrationBuilder.DropColumn(
                name: "SellerApproved",
                table: "Contracts");

            migrationBuilder.DropColumn(
                name: "SellerApprovedAt",
                table: "Contracts");
        }
    }
}
