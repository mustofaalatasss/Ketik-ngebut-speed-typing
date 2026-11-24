using KetikNgebut.Application.Common;
using KetikNgebut.Domain.Entities;
using KetikNgebut.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace KetikNgebut.Infrastructure.Persistence;

/// <summary>
/// DbContext EF Core: peta antara kelas C# dan tabel SQLite. IdentityDbContext menambahkan tabel user,
/// role, dan klaim milik ASP.NET Core Identity (AspNetUsers, AspNetRoles, ...).
/// </summary>
public sealed class AppDbContext(DbContextOptions<AppDbContext> options)
    : IdentityDbContext<AppUser, IdentityRole<Guid>, Guid>(options), IAppDbContext
{
    public DbSet<Player> Players => Set<Player>();
    public DbSet<Passage> Passages => Set<Passage>();
    public DbSet<RaceResult> RaceResults => Set<RaceResult>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<KeyStat> KeyStats => Set<KeyStat>();
    public DbSet<PlayerSettings> PlayerSettings => Set<PlayerSettings>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.Entity<AppUser>(e =>
        {
            e.Property(u => u.DisplayName).HasMaxLength(AppUser.MaxDisplayNameLength).UseCollation("NOCASE");
            e.HasIndex(u => u.DisplayName).IsUnique();
        });

        builder.Entity<Player>(e =>
        {
            e.HasKey(p => p.Id);
            // NOCASE: "Rina" dan "rina" dianggap nickname yang sama (unik tanpa membedakan huruf besar/kecil).
            e.Property(p => p.Nickname).HasMaxLength(Player.MaxNicknameLength).UseCollation("NOCASE");
            e.HasIndex(p => p.Nickname).IsUnique();
            e.Property(p => p.TokenHash).HasMaxLength(64);
            e.HasIndex(p => p.TokenHash).IsUnique();
        });

        builder.Entity<KeyStat>(e =>
        {
            // Kunci gabungan: satu baris per pemain per karakter.
            e.HasKey(k => new { k.PlayerId, k.Character });
            e.Property(k => k.Character).HasMaxLength(4);
            e.HasOne<Player>().WithMany().HasForeignKey(k => k.PlayerId).OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<PlayerSettings>(e =>
        {
            e.HasKey(s => s.PlayerId);
            e.Property(s => s.Language).HasMaxLength(8);
            e.Property(s => s.Difficulty).HasMaxLength(16);
            e.Property(s => s.BotLevel).HasMaxLength(16);
            e.Property(s => s.CarColor).HasMaxLength(Domain.Entities.PlayerSettings.CarColorLength);
            e.HasOne<Player>().WithOne().HasForeignKey<PlayerSettings>(s => s.PlayerId).OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<Passage>(e =>
        {
            e.HasKey(p => p.Id);
            e.Property(p => p.Id).HasMaxLength(Passage.MaxIdLength);
            e.Property(p => p.Text).HasMaxLength(Passage.MaxTextLength);
            e.Property(p => p.Language).HasMaxLength(8);
            e.Property(p => p.Difficulty).HasMaxLength(16);
            e.HasIndex(p => new { p.Language, p.Difficulty, p.IsActive });
        });

        builder.Entity<RaceResult>(e =>
        {
            e.HasKey(r => r.Id);
            e.Property(r => r.PassageId).HasMaxLength(Passage.MaxIdLength);
            // Enum disimpan sebagai teks agar mudah dibaca langsung di database.
            e.Property(r => r.Mode).HasConversion<string>().HasMaxLength(16);
            e.Property(r => r.RejectReason).HasConversion<string>().HasMaxLength(32);
            e.HasOne<Passage>().WithMany().HasForeignKey(r => r.PassageId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne<Player>().WithMany().HasForeignKey(r => r.PlayerId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(r => new { r.IsValid, r.CreatedAt, r.NetWpm });
            e.HasIndex(r => new { r.PlayerId, r.CreatedAt });
            e.HasIndex(r => r.PassageId);
        });

        builder.Entity<RefreshToken>(e =>
        {
            e.HasKey(t => t.Id);
            e.Property(t => t.TokenHash).HasMaxLength(64);
            e.HasIndex(t => t.TokenHash).IsUnique();
            e.HasIndex(t => t.UserId);
            e.HasOne<AppUser>().WithMany().HasForeignKey(t => t.UserId).OnDelete(DeleteBehavior.Cascade);
        });
    }
}
