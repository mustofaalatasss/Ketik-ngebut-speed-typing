using KetikNgebut.Application.Common;
using KetikNgebut.Application.Options;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace KetikNgebut.Application.Stats;

public sealed record StatsPoint(DateTime CreatedAt, double Wpm, double NetWpm, double Accuracy);

public sealed record StatsResponse(
    int TotalRaces,
    double AverageWpm,
    double BestWpm,
    double AverageNetWpm,
    double BestNetWpm,
    double AverageAccuracy,
    IReadOnlyList<StatsPoint> History);

/// <summary>STA-1: statistik pribadi dari hasil yang valid saja (RES-4).</summary>
public sealed class StatsService(IAppDbContext db, IOptions<StatsOptions> options)
{
    public async Task<StatsResponse> GetAsync(Guid playerId, CancellationToken ct)
    {
        var mine = db.RaceResults.AsNoTracking().Where(r => r.PlayerId == playerId && r.IsValid);

        // Agregat dihitung di database (SQL COUNT/AVG/MAX), bukan dengan memuat semua baris ke memori.
        var agg = await mine
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Count = g.Count(),
                AvgWpm = g.Average(r => r.Wpm),
                BestWpm = g.Max(r => r.Wpm),
                AvgNet = g.Average(r => r.NetWpm),
                BestNet = g.Max(r => r.NetWpm),
                AvgAcc = g.Average(r => r.Accuracy),
            })
            .FirstOrDefaultAsync(ct);

        if (agg is null) return new StatsResponse(0, 0, 0, 0, 0, 0, []);

        var history = await mine
            .OrderByDescending(r => r.CreatedAt).ThenByDescending(r => r.Id)
            .Take(options.Value.HistorySize)
            .Select(r => new StatsPoint(r.CreatedAt, r.Wpm, r.NetWpm, r.Accuracy))
            .ToListAsync(ct);
        history.Reverse(); // urut dari lama ke baru untuk grafik

        return new StatsResponse(agg.Count, agg.AvgWpm, agg.BestWpm, agg.AvgNet, agg.BestNet, agg.AvgAcc, history);
    }
}
