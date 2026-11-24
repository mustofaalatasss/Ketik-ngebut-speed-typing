using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace KetikNgebut.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class NicknamePlayers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_RaceResults_AspNetUsers_UserId",
                table: "RaceResults");

            migrationBuilder.RenameColumn(
                name: "UserId",
                table: "RaceResults",
                newName: "PlayerId");

            migrationBuilder.RenameIndex(
                name: "IX_RaceResults_UserId_CreatedAt",
                table: "RaceResults",
                newName: "IX_RaceResults_PlayerId_CreatedAt");

            migrationBuilder.CreateTable(
                name: "Players",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Nickname = table.Column<string>(type: "TEXT", maxLength: 24, nullable: false, collation: "NOCASE"),
                    TokenHash = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    IsActive = table.Column<bool>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Players", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Players_Nickname",
                table: "Players",
                column: "Nickname",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Players_TokenHash",
                table: "Players",
                column: "TokenHash",
                unique: true);

            // Pindahkan pemain lama (akun Identity non-admin, atau akun yang punya hasil) menjadi Player dengan
            // Id dan nickname yang sama, sehingga hasil balapan lama tetap ada. Data lama tidak dihapus.
            // TokenHash diisi nilai acak yang bukan hash dari token mana pun: nickname lama tidak bisa diklaim
            // ulang lewat token (pemilik lama tidak punya token karena dulu memakai email dan password).
            migrationBuilder.Sql("""
                INSERT INTO "Players" ("Id", "Nickname", "TokenHash", "CreatedAt", "IsActive")
                SELECT u."Id", u."DisplayName", 'MIGRATED-' || lower(hex(randomblob(27))), u."CreatedAt", u."IsActive"
                FROM "AspNetUsers" u
                WHERE u."Id" NOT IN (
                        SELECT ur."UserId" FROM "AspNetUserRoles" ur
                        JOIN "AspNetRoles" r ON r."Id" = ur."RoleId"
                        WHERE r."Name" = 'Admin')
                   OR EXISTS (SELECT 1 FROM "RaceResults" rr WHERE rr."PlayerId" = u."Id");
                """);

            migrationBuilder.AddForeignKey(
                name: "FK_RaceResults_Players_PlayerId",
                table: "RaceResults",
                column: "PlayerId",
                principalTable: "Players",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Peringatan: Down hanya berhasil bila semua hasil dimiliki pemain yang juga ada di AspNetUsers.
            // Hasil dari pemain nickname baru akan melanggar foreign key ke AspNetUsers.
            migrationBuilder.DropForeignKey(
                name: "FK_RaceResults_Players_PlayerId",
                table: "RaceResults");

            migrationBuilder.DropTable(
                name: "Players");

            migrationBuilder.RenameColumn(
                name: "PlayerId",
                table: "RaceResults",
                newName: "UserId");

            migrationBuilder.RenameIndex(
                name: "IX_RaceResults_PlayerId_CreatedAt",
                table: "RaceResults",
                newName: "IX_RaceResults_UserId_CreatedAt");

            migrationBuilder.AddForeignKey(
                name: "FK_RaceResults_AspNetUsers_UserId",
                table: "RaceResults",
                column: "UserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
