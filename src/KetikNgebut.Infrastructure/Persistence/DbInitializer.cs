using System.Text.Json;
using KetikNgebut.Application.Auth;
using KetikNgebut.Domain.Entities;
using KetikNgebut.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace KetikNgebut.Infrastructure.Persistence;

/// <summary>Akun admin awal. Nilainya dari environment variable (Seed__AdminEmail, ...) atau user-secrets.</summary>
public sealed class SeedOptions
{
    public const string Section = "Seed";
    public string? AdminEmail { get; set; }
    public string? AdminPassword { get; set; }
    public string AdminDisplayName { get; set; } = "Admin";
}

/// <summary>Dijalankan sekali saat startup: migration, mode WAL, lalu seed role, teks, dan admin (idempoten).</summary>
public sealed class DbInitializer(
    AppDbContext db,
    UserManager<AppUser> users,
    RoleManager<IdentityRole<Guid>> roles,
    IOptions<SeedOptions> seed,
    TimeProvider time,
    ILogger<DbInitializer> logger)
{
    internal const string PassagesResource = "KetikNgebut.Seed.passages.json";

    public async Task InitializeAsync(CancellationToken ct = default)
    {
        await db.Database.MigrateAsync(ct);

        // WAL: pembaca tidak memblokir penulis. Setelan ini tersimpan di file database.
        if (db.Database.IsSqlite())
            await db.Database.ExecuteSqlRawAsync("PRAGMA journal_mode=WAL;", ct);

        await SeedRolesAsync();
        await SeedPassagesAsync(ct);
        await SeedAdminAsync();
    }

    private async Task SeedRolesAsync()
    {
        // Role Identity hanya untuk akun admin; role "Player" diberikan lewat token nickname, bukan Identity.
        if (!await roles.RoleExistsAsync(Roles.Admin))
            Ensure(await roles.CreateAsync(new IdentityRole<Guid>(Roles.Admin)), "membuat role Admin");
    }

    private async Task SeedPassagesAsync(CancellationToken ct)
    {
        var seedPassages = LoadSeedPassages();
        var existing = await db.Passages.Select(p => p.Id).ToHashSetAsync(ct);
        var added = 0;
        foreach (var p in seedPassages.Where(p => !existing.Contains(p.Id)))
        {
            db.Passages.Add(p);
            added++;
        }
        if (added > 0)
        {
            await db.SaveChangesAsync(ct);
            logger.LogInformation("Seed: {Count} teks ditambahkan dari passages.json", added);
        }
    }

    /// <summary>Membaca web/src/data/passages.json yang ditanam (EmbeddedResource) di assembly ini.</summary>
    public static IReadOnlyList<Passage> LoadSeedPassages()
    {
        using var stream = typeof(DbInitializer).Assembly.GetManifestResourceStream(PassagesResource)
            ?? throw new InvalidOperationException($"Resource {PassagesResource} tidak ditemukan.");
        var items = JsonSerializer.Deserialize<List<SeedPassage>>(stream, new JsonSerializerOptions(JsonSerializerDefaults.Web))
            ?? throw new InvalidOperationException("passages.json kosong.");

        return items.Select((p, i) =>
        {
            if (string.IsNullOrWhiteSpace(p.Id) || p.Id.Length > Passage.MaxIdLength
                || p.Language is null || !Passage.Languages.Contains(p.Language)
                || p.Difficulty is null || !Passage.Difficulties.Contains(p.Difficulty)
                || p.Text is null || !Passage.IsTypeable(p.Text) || p.Text != p.Text.Trim())
            {
                throw new InvalidOperationException($"Teks ke-{i} di passages.json tidak valid.");
            }
            return new Passage { Id = p.Id, Text = p.Text, Language = p.Language, Difficulty = p.Difficulty, IsActive = true };
        }).ToList();
    }

    private async Task SeedAdminAsync()
    {
        var opts = seed.Value;
        if (string.IsNullOrWhiteSpace(opts.AdminEmail) || string.IsNullOrWhiteSpace(opts.AdminPassword))
        {
            logger.LogWarning("Seed:AdminEmail / Seed:AdminPassword tidak diisi; akun admin tidak dibuat.");
            return;
        }

        var admin = await users.FindByEmailAsync(opts.AdminEmail);
        if (admin is null)
        {
            admin = new AppUser
            {
                Email = opts.AdminEmail,
                UserName = opts.AdminEmail,
                DisplayName = opts.AdminDisplayName,
                CreatedAt = time.GetUtcNow().UtcDateTime,
            };
            Ensure(await users.CreateAsync(admin, opts.AdminPassword), "membuat akun admin");
            logger.LogInformation("Seed: akun admin dibuat.");
        }

        if (!await users.IsInRoleAsync(admin, Roles.Admin))
            Ensure(await users.AddToRoleAsync(admin, Roles.Admin), "menambah role Admin");
    }

    private static void Ensure(IdentityResult result, string action)
    {
        if (!result.Succeeded)
            throw new InvalidOperationException($"Gagal {action}: {string.Join("; ", result.Errors.Select(e => e.Description))}");
    }

    private sealed record SeedPassage(string? Id, string? Language, string? Difficulty, string? Text);
}
