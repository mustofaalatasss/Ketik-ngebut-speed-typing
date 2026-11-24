using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace KetikNgebut.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class KeyStatsAndSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "KeyStats",
                columns: table => new
                {
                    PlayerId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Character = table.Column<string>(type: "TEXT", maxLength: 4, nullable: false),
                    Hits = table.Column<int>(type: "INTEGER", nullable: false),
                    Misses = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_KeyStats", x => new { x.PlayerId, x.Character });
                    table.ForeignKey(
                        name: "FK_KeyStats_Players_PlayerId",
                        column: x => x.PlayerId,
                        principalTable: "Players",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PlayerSettings",
                columns: table => new
                {
                    PlayerId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Language = table.Column<string>(type: "TEXT", maxLength: 8, nullable: false),
                    Difficulty = table.Column<string>(type: "TEXT", maxLength: 16, nullable: false),
                    BotLevel = table.Column<string>(type: "TEXT", maxLength: 16, nullable: false),
                    CarColor = table.Column<string>(type: "TEXT", maxLength: 7, nullable: false),
                    UseGhost = table.Column<bool>(type: "INTEGER", nullable: false),
                    Muted = table.Column<bool>(type: "INTEGER", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlayerSettings", x => x.PlayerId);
                    table.ForeignKey(
                        name: "FK_PlayerSettings_Players_PlayerId",
                        column: x => x.PlayerId,
                        principalTable: "Players",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "KeyStats");

            migrationBuilder.DropTable(
                name: "PlayerSettings");
        }
    }
}
