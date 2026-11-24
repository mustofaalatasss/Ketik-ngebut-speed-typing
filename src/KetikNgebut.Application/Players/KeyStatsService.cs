using KetikNgebut.Application.Common;
using KetikNgebut.Domain.Entities;
using KetikNgebut.Domain.Typing;
using Microsoft.EntityFrameworkCore;

namespace KetikNgebut.Application.Players;

/// <summary>MissRate = Misses / (Hits + Misses), 0..1.</summary>
public sealed record KeyStatDto(string Character, int Hits, int Misses, double MissRate);

/// <summary>POL-2: statistik per huruf. Diperbarui hanya dari hasil yang valid (RES-4).</summary>
public sealed class KeyStatsService(IAppDbContext db)
{
    /// <summary>Menambah tally ke agregat pemain. Pemanggil yang memanggil SaveChangesAsync.</summary>
    public async Task AddAsync(Guid playerId, IReadOnlyDictionary<string, KeyTally> tallies, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(tallies);
        if (tallies.Count == 0) return;

        var chars = tallies.Keys.ToArray();
        var existing = await db.KeyStats
            .Where(k => k.PlayerId == playerId && chars.Contains(k.Character))
            .ToDictionaryAsync(k => k.Character, ct);

        foreach (var (character, tally) in tallies)
        {
            if (!existing.TryGetValue(character, out var stat))
            {
                stat = new KeyStat { PlayerId = playerId, Character = character };
                db.KeyStats.Add(stat);
            }
            stat.Hits += tally.Hits;
            stat.Misses += tally.Misses;
        }
    }

    /// <summary>Urut dari rasio salah tertinggi; bila sama, yang lebih sering salah dulu.</summary>
    public async Task<IReadOnlyList<KeyStatDto>> GetAsync(Guid playerId, CancellationToken ct)
    {
        var rows = await db.KeyStats.AsNoTracking()
            .Where(k => k.PlayerId == playerId)
            .Select(k => new { k.Character, k.Hits, k.Misses })
            .ToListAsync(ct);

        return rows
            .Select(k => new KeyStatDto(k.Character, k.Hits, k.Misses,
                k.Hits + k.Misses == 0 ? 0 : (double)k.Misses / (k.Hits + k.Misses)))
            .OrderByDescending(k => k.MissRate)
            .ThenByDescending(k => k.Misses)
            .ThenBy(k => k.Character, StringComparer.Ordinal)
            .ToList();
    }
}
