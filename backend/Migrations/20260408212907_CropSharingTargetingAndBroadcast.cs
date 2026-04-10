using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Rass.Api.Migrations
{
    /// <inheritdoc />
    public partial class CropSharingTargetingAndBroadcast : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "BroadcastToAll",
                table: "CropShareRequests",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<Guid>(
                name: "TargetCooperativeId",
                table: "CropShareRequests",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_CropShareRequests_TargetCooperativeId",
                table: "CropShareRequests",
                column: "TargetCooperativeId");

            migrationBuilder.AddForeignKey(
                name: "FK_CropShareRequests_Cooperatives_TargetCooperativeId",
                table: "CropShareRequests",
                column: "TargetCooperativeId",
                principalTable: "Cooperatives",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_CropShareRequests_Cooperatives_TargetCooperativeId",
                table: "CropShareRequests");

            migrationBuilder.DropIndex(
                name: "IX_CropShareRequests_TargetCooperativeId",
                table: "CropShareRequests");

            migrationBuilder.DropColumn(
                name: "BroadcastToAll",
                table: "CropShareRequests");

            migrationBuilder.DropColumn(
                name: "TargetCooperativeId",
                table: "CropShareRequests");
        }
    }
}
