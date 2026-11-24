using System.Text.Json;
using KetikNgebut.Application.Common;
using KetikNgebut.Application.Options;
using KetikNgebut.Application.Players;
using KetikNgebut.Domain.Entities;
using KetikNgebut.Domain.Typing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace KetikNgebut.Application.Results;

/// <summary>
/// RES-1 sampai RES-4. Dependency injection: semua yang dibutuhkan (database, konfigurasi, jam) diterima
/// lewat constructor (primary constructor), bukan dibuat sendiri, sehingga mudah diganti saat test.
/// </summary>
public sealed class ResultService(
    IAppDbContext db,
    IOptions<TypingOptions> typingOptions,
    IOptions<ResultValidationOptions> validationOptions,
    KeyStatsService keyStats,
    TimeProvider time)
{
    private static readonly JsonSerializerOptions LogJson = new(JsonSerializerDefaults.Web);

    private static readonly Dictionary<RejectReason, string> RejectMessages = new()
    {
        [RejectReason.NotFinished] = "Log keystroke tidak menghasilkan teks yang sama sampai selesai.",
        [RejectReason.TimeNotMonotonic] = "Waktu keystroke tidak berurutan.",
        [RejectReason.TimeLimitExceeded] = "Waktu keystroke melewati batas waktu balapan.",
        [RejectReason.DurationMismatch] = "Durasi tidak cocok dengan log keystroke.",
        [RejectReason.WpmTooHigh] = "WPM melebihi batas kewajaran.",
        [RejectReason.InhumanRhythm] = "Jeda antar keystroke tidak wajar untuk manusia.",
    };

    public async Task<Result<ResultResponse>> SubmitAsync(Guid playerId, SubmitResultRequest request, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(request);
        var rules = validationOptions.Value;
        var typing = typingOptions.Value;

        var errors = new Dictionary<string, string[]>();
        if (string.IsNullOrWhiteSpace(request.PassageId) || request.PassageId.Length > Passage.MaxIdLength)
            errors["passageId"] = ["passageId wajib diisi."];
        if (request.DurationMs is null or < 0)
            errors["durationMs"] = ["durationMs wajib diisi dan tidak boleh negatif."];
        if (request.Log is null || request.Log.Count == 0)
            errors["log"] = ["Log keystroke wajib diisi."];
        else if (request.Log.Count > rules.MaxLogEntries)
            errors["log"] = [$"Log keystroke maksimal {rules.MaxLogEntries} entri."];
        else if (request.Log.Any(k => k is null || k.Key is null || !TypingSession.IsAcceptedKey(k.Key) || k.T < 0))
            errors["log"] = ["Setiap keystroke harus berisi key (1 karakter atau Backspace) dan t >= 0."];

        var mode = RaceMode.Solo;
        if (request.Mode is not null && !TryParseMode(request.Mode, out mode))
            errors["mode"] = ["Mode harus solo atau bot."];

        if (errors.Count > 0) return AppError.Validation(errors);

        var passage = await db.Passages.AsNoTracking().FirstOrDefaultAsync(p => p.Id == request.PassageId, ct);
        if (passage is null) return AppError.NotFound("Teks tidak ditemukan");

        var log = request.Log!.Select(k => new Keystroke(k.Key!, k.T)).ToList();
        var evaluation = ResultValidator.Evaluate(passage.Text, log, request.DurationMs!.Value, typing, rules);
        var stats = evaluation.Stats;

        var entity = new RaceResult
        {
            PlayerId = playerId,
            PassageId = passage.Id,
            Mode = mode,
            Wpm = stats.Wpm,
            Accuracy = stats.Accuracy,
            NetWpm = stats.NetWpm,
            DurationMs = stats.ElapsedMs,
            CorrectChars = stats.CorrectChars,
            TotalKeystrokes = evaluation.Session.TotalKeystrokes,
            KeystrokeLog = JsonSerializer.Serialize(evaluation.Session.Log, LogJson),
            CreatedAt = time.GetUtcNow().UtcDateTime,
            IsValid = evaluation.IsValid,
            RejectReason = evaluation.Reason,
        };
        db.RaceResults.Add(entity);

        // POL-2: statistik per huruf hanya dari hasil yang valid (RES-4). Disimpan bersama hasilnya.
        if (evaluation.IsValid)
            await keyStats.AddAsync(playerId, KeyAccuracy.Compute(passage.Text, log, typing.MaxErrorBuffer), ct);

        await db.SaveChangesAsync(ct);

        if (!evaluation.IsValid)
        {
            // RES-4: tetap disimpan (IsValid = false) untuk audit, tapi klien menerima penolakan.
            return new AppError(
                ErrorKind.Validation,
                "Hasil ditolak",
                RejectMessages[evaluation.Reason],
                Extensions: new Dictionary<string, object?>
                {
                    ["reason"] = evaluation.Reason.ToString(),
                    ["resultId"] = entity.Id,
                });
        }

        return ToResponse(entity);
    }

    private static bool TryParseMode(string value, out RaceMode mode)
    {
        mode = value.ToLowerInvariant() switch
        {
            "solo" => RaceMode.Solo,
            "bot" => RaceMode.Bot,
            _ => (RaceMode)(-1),
        };
        return Enum.IsDefined(mode);
    }

    private static ResultResponse ToResponse(RaceResult r) => new(
        r.Id, r.PassageId, r.Mode.ToString().ToLowerInvariant(), r.Wpm, r.Accuracy, r.NetWpm, r.DurationMs,
        r.CorrectChars, r.TotalKeystrokes, r.CreatedAt, r.IsValid);
}
