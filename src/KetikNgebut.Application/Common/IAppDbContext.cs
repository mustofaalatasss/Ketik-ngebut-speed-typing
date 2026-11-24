using KetikNgebut.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace KetikNgebut.Application.Common;

/// <summary>
/// Abstraksi DbContext agar service di Application tidak bergantung pada Infrastructure.
/// Implementasinya AppDbContext (SQLite), didaftarkan lewat dependency injection.
/// </summary>
public interface IAppDbContext
{
    DbSet<Player> Players { get; }
    DbSet<Passage> Passages { get; }
    DbSet<RaceResult> RaceResults { get; }
    DbSet<RefreshToken> RefreshTokens { get; }
    DbSet<KeyStat> KeyStats { get; }
    DbSet<PlayerSettings> PlayerSettings { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
