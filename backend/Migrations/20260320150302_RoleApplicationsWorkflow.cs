using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Rass.Api.Migrations
{
    /// <inheritdoc />
    public partial class RoleApplicationsWorkflow : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "RoleApplications",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ApplicantUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    TargetRole = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Status = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    FormDataJson = table.Column<string>(type: "text", nullable: true),
                    AdminNote = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RoleApplications", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RoleApplications_Users_ApplicantUserId",
                        column: x => x.ApplicantUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "RoleApplicationDocuments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    RoleApplicationId = table.Column<Guid>(type: "uuid", nullable: false),
                    DocumentName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    DocumentUrl = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    UploadedBy = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RoleApplicationDocuments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RoleApplicationDocuments_RoleApplications_RoleApplicationId",
                        column: x => x.RoleApplicationId,
                        principalTable: "RoleApplications",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "RoleApplicationMessages",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    RoleApplicationId = table.Column<Guid>(type: "uuid", nullable: false),
                    SenderType = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    SenderName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Message = table.Column<string>(type: "character varying(3000)", maxLength: 3000, nullable: false),
                    IsReadByAdmin = table.Column<bool>(type: "boolean", nullable: false),
                    IsReadByApplicant = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RoleApplicationMessages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RoleApplicationMessages_RoleApplications_RoleApplicationId",
                        column: x => x.RoleApplicationId,
                        principalTable: "RoleApplications",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_RoleApplicationDocuments_RoleApplicationId",
                table: "RoleApplicationDocuments",
                column: "RoleApplicationId");

            migrationBuilder.CreateIndex(
                name: "IX_RoleApplicationMessages_RoleApplicationId",
                table: "RoleApplicationMessages",
                column: "RoleApplicationId");

            migrationBuilder.CreateIndex(
                name: "IX_RoleApplications_ApplicantUserId",
                table: "RoleApplications",
                column: "ApplicantUserId");

            migrationBuilder.CreateIndex(
                name: "IX_RoleApplications_Status_UpdatedAt",
                table: "RoleApplications",
                columns: new[] { "Status", "UpdatedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RoleApplicationDocuments");

            migrationBuilder.DropTable(
                name: "RoleApplicationMessages");

            migrationBuilder.DropTable(
                name: "RoleApplications");
        }
    }
}
