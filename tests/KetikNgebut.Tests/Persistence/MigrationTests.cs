using KetikNgebut.Infrastructure.Persistence;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.DependencyInjection;

namespace KetikNgebut.Tests.Persistence;

public sealed class MigrationTests
{
    [Fact]
    public async Task MIGRASI_DataPemainLama_TetapAdaSebagaiNickname()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(connection).Options);
        var migrator = db.GetInfrastructure().GetRequiredService<IMigrator>();
        var userId = Guid.NewGuid();

        // Keadaan lama (Fase 2 versi akun): pemain = akun Identity, hasil menunjuk ke AspNetUsers.
        await migrator.MigrateAsync("20261123054025_InitialCreate");
        await db.Database.ExecuteSqlAsync($"""
            INSERT INTO "AspNetUsers" ("Id", "DisplayName", "IsActive", "CreatedAt", "Email", "UserName", "EmailConfirmed",
                "PhoneNumberConfirmed", "TwoFactorEnabled", "LockoutEnabled", "AccessFailedCount")
            VALUES ({userId}, 'pemain_uji', 1, '2026-11-23 05:00:00', 'uji@contoh.test', 'uji@contoh.test', 0, 0, 0, 1, 0);
            """);
        await db.Database.ExecuteSqlRawAsync("""
            INSERT INTO "Passages" ("Id", "Text", "Language", "Difficulty", "IsActive") VALUES ('id-easy-1', 'Teks uji.', 'id', 'easy', 1);
            """);
        await db.Database.ExecuteSqlAsync($"""
            INSERT INTO "RaceResults" ("UserId", "PassageId", "Mode", "Wpm", "Accuracy", "NetWpm", "DurationMs", "CorrectChars",
                "TotalKeystrokes", "KeystrokeLog", "CreatedAt", "IsValid", "RejectReason")
            VALUES ({userId}, 'id-easy-1', 'Solo', 40, 1, 40, 1000, 9, 9, '[]', '2026-11-23 05:10:00', 1, 'None');
            """);

        await migrator.MigrateAsync();

        var player = await db.Players.SingleAsync();
        var result = await db.RaceResults.SingleAsync();
        Assert.Equal(userId, player.Id);
        Assert.Equal("pemain_uji", player.Nickname);
        Assert.StartsWith("MIGRATED-", player.TokenHash, StringComparison.Ordinal); // tidak cocok dengan token mana pun
        Assert.Equal(userId, result.PlayerId);
        Assert.Equal(1, await db.Users.CountAsync()); // baris lama tidak dihapus
    }
}
