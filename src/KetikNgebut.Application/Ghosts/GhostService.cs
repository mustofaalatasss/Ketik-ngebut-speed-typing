using System.Text.Json;
using KetikNgebut.Application.Common;
using KetikNgebut.Application.Results;
using Microsoft.EntityFrameworkCore;

namespace KetikNgebut.Application.Ghosts;

/// <summary>
/// Rekaman untuk mode ghost (BOT-3): teks yang diketik dan log keystroke-nya, diputar ulang di klien.
/// `SamePassage` = true bila rekaman berasal dari teks yang sama dengan balapan sekarang.
/// </summary>
public sealed record GhostResponse(
    long ResultId,
    string PassageId,
    string Text,
    IReadOnlyList<KeystrokeDto> Log,
    double NetWpm,
    long DurationMs,
    bool SamePassage);

public sealed class GhostService(IAppDbContext db)
{
    private static readonly JsonSerializerOptions LogJson = new(JsonSerializerDefaults.Web);

    /// <summary>
    /// Rekor valid terbaik pemain (WPM bersih tertinggi) pada teks `passageId`; bila belum ada,
    /// rekor valid terbaik pada teks apa pun. Hanya milik pemain sendiri; hasil yang ditolak tidak dipakai.
    /// </summary>
    public async Task<Result<GhostResponse>> GetBestAsync(Guid playerId, string? passageId, CancellationToken ct)
    {
        // Query LINQ diterjemahkan EF Core menjadi SQL; AsNoTracking karena hanya dibaca.
        var mine = db.RaceResults.AsNoTracking().Where(r => r.PlayerId == playerId && r.IsValid);

        var best = string.IsNullOrWhiteSpace(passageId)
            ? null
            : await Best(mine.Where(r => r.PassageId == passageId), ct);
        best ??= await Best(mine, ct);
        if (best is null) return AppError.NotFound("Belum ada rekor untuk ghost");

        var text = await db.Passages.AsNoTracking()
            .Where(p => p.Id == best.PassageId)
            .Select(p => p.Text)
            .FirstOrDefaultAsync(ct);
        if (text is null) return AppError.NotFound("Teks rekor tidak ditemukan");

        var log = JsonSerializer.Deserialize<List<KeystrokeDto>>(best.KeystrokeLog, LogJson) ?? [];
        return new GhostResponse(best.Id, best.PassageId, text, log, best.NetWpm, best.DurationMs,
            SamePassage: best.PassageId == passageId);
    }

    /// <summary>WPM bersih tertinggi; bila seri, durasi tercepat lalu hasil terbaru.</summary>
    private static Task<Domain.Entities.RaceResult?> Best(IQueryable<Domain.Entities.RaceResult> query, CancellationToken ct) =>
        query.OrderByDescending(r => r.NetWpm).ThenBy(r => r.DurationMs).ThenByDescending(r => r.Id).FirstOrDefaultAsync(ct);
}
