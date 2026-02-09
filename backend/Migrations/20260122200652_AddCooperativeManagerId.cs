using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Rass.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddCooperativeManagerId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ManagerId",
                table: "Cooperatives",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Cooperatives_ManagerId",
                table: "Cooperatives",
                column: "ManagerId");

            migrationBuilder.AddForeignKey(
                name: "FK_Cooperatives_Users_ManagerId",
                table: "Cooperatives",
                column: "ManagerId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Cooperatives_Users_ManagerId",
                table: "Cooperatives");

            migrationBuilder.DropIndex(
                name: "IX_Cooperatives_ManagerId",
                table: "Cooperatives");

            migrationBuilder.DropColumn(
                name: "ManagerId",
                table: "Cooperatives");
        }
    }
}
