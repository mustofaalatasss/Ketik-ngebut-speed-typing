using KetikNgebut.Application.Common;
using KetikNgebut.Application.Options;
using KetikNgebut.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace KetikNgebut.Application.Leaderboard;

public sealed record LeaderboardEntry(int Rank, string Nickname, double NetWpm, double Wpm, double Accuracy, DateTime CreatedAt);

public sealed record LeaderboardResponse(
    string Period,
    DateTime? From,
    int Page,
    int PageSize,
    int TotalCount,
    IReadOnlyList<LeaderboardEntry> Items);

/// <summary>LBD-1 dan LBD-2: peringkat WPM bersih terbaik per pemain per periode.</summary>
public sealed class LeaderboardService(
    IAppDbContext db,
    IOptions<LeaderboardOptions> options,
    TimeProvider time)
{
    public static readonly IReadOnlyList<string> Periods = ["daily", "weekly", "all"];

    public async Task<Result<LeaderboardResponse>> GetAsync(string? period, int? page, int? pageSize, CancellationToken ct)
    {
        var opts = options.Value;
        period ??= "all";
        var p = page ?? 1;
        var size = pageSize ?? opts.DefaultPageSize;

        var errors = new Dictionary<string, string[]>();
        if (!Periods.Contains(period)) errors["period"] = ["period harus daily, weekly, atau all."];
        if (p < 1) errors["page"] = ["page minimal 1."];
        if (size < 1 || size > opts.MaxPageSize) errors["pageSize"] = [$"pageSize harus 1 sampai {opts.MaxPageSize}."];
        if (errors.Count > 0) return AppError.Validation(errors);

        var from = PeriodStartUtc(period, time.GetUtcNow().UtcDateTime, opts.TimeZone);

        // RES-4: hanya hasil valid.
        var results = db.RaceResults.AsNoTracking().Where(r => r.IsValid);
        if (from is not null) results = results.Where(r => r.CreatedAt >= from);

        // LBD-2: satu baris per pemain = hasil terbaiknya. Sebuah hasil dipilih bila TIDAK ADA hasil lain
        // milik pemain yang sama (di periode yang sama) yang lebih baik: NetWpm lebih tinggi, atau sama
        // tetapi lebih dulu dibuat. EF Core menerjemahkan `!results.Any(...)` menjadi SQL NOT EXISTS.
        var bestPerPlayer = results.Where(r => !results.Any(o =>
            o.PlayerId == r.PlayerId &&
            (o.NetWpm > r.NetWpm ||
             (o.NetWpm == r.NetWpm && (o.CreatedAt < r.CreatedAt || (o.CreatedAt == r.CreatedAt && o.Id < r.Id))))));

        var totalCount = await results.Select(r => r.PlayerId).Distinct().CountAsync(ct);
        var rows = await bestPerPlayer
            .OrderByDescending(r => r.NetWpm).ThenBy(r => r.CreatedAt).ThenBy(r => r.Id)
            .Skip((p - 1) * size)
            .Take(size)
            .Select(r => new { r.PlayerId, r.NetWpm, r.Wpm, r.Accuracy, r.CreatedAt })
            .ToListAsync(ct);

        var ids = rows.Select(r => r.PlayerId).ToArray();
        var names = await db.Players.AsNoTracking()
            .Where(pl => ids.Contains(pl.Id))
            .ToDictionaryAsync(pl => pl.Id, pl => pl.Nickname, ct);
        var items = rows
            .Select((r, i) => new LeaderboardEntry(
                (p - 1) * size + i + 1,
                names.GetValueOrDefault(r.PlayerId, "?"),
                r.NetWpm, r.Wpm, r.Accuracy, r.CreatedAt))
            .ToList();

        return new LeaderboardResponse(period, from, p, size, totalCount, items);
    }

    /// <summary>Awal periode dalam UTC: harian = 00.00 hari ini, mingguan = Senin 00.00, di zona waktu konfigurasi.</summary>
    public static DateTime? PeriodStartUtc(string period, DateTime nowUtc, string timeZoneId)
    {
        if (period == "all") return null;
        var tz = TimeZoneInfo.FindSystemTimeZoneById(timeZoneId);
        var localToday = TimeZoneInfo.ConvertTimeFromUtc(nowUtc, tz).Date;
        var start = period == "weekly"
            ? localToday.AddDays(-(((int)localToday.DayOfWeek + 6) % 7))
            : localToday;
        return TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(start, DateTimeKind.Unspecified), tz);
    }
}
