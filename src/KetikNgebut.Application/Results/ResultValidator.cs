using KetikNgebut.Application.Options;
using KetikNgebut.Domain.Entities;
using KetikNgebut.Domain.Typing;

namespace KetikNgebut.Application.Results;

public sealed record ResultEvaluation(TypingSession Session, TypingStats Stats, RejectReason Reason)
{
    public bool IsValid => Reason == RejectReason.None;
}

/// <summary>
/// RES-2 dan RES-3: memutar ulang log dengan mesin yang sama dengan frontend, lalu menerapkan batas kewajaran.
/// Fungsi murni (tanpa database) agar mudah dites.
/// </summary>
public static class ResultValidator
{
    public static ResultEvaluation Evaluate(
        string passageText,
        IReadOnlyList<Keystroke> log,
        long claimedDurationMs,
        TypingOptions typing,
        ResultValidationOptions rules)
    {
        ArgumentNullException.ThrowIfNull(log);
        ArgumentNullException.ThrowIfNull(typing);
        ArgumentNullException.ThrowIfNull(rules);

        var session = TypingSession.Replay(passageText, log, typing.MaxErrorBuffer);
        var lastT = log.Count == 0 ? 0 : log[^1].T;
        var stats = TypingMetrics.ComputeStats(session, Math.Min(lastT, typing.TimeLimitMs), typing.CharsPerWord);

        return new ResultEvaluation(session, stats, FindRejectReason(session, stats, log, claimedDurationMs, typing, rules));
    }

    private static RejectReason FindRejectReason(
        TypingSession session,
        TypingStats stats,
        IReadOnlyList<Keystroke> log,
        long claimedDurationMs,
        TypingOptions typing,
        ResultValidationOptions rules)
    {
        for (var i = 1; i < log.Count; i++)
        {
            if (log[i].T < log[i - 1].T) return RejectReason.TimeNotMonotonic;
        }

        if (log.Any(k => k.T > typing.TimeLimitMs)) return RejectReason.TimeLimitExceeded;

        // Log harus menghasilkan teks yang sama persis (kursor sampai akhir teks).
        if (!session.IsFinished) return RejectReason.NotFinished;

        if (Math.Abs(claimedDurationMs - session.FinishedAtMs!.Value) > rules.DurationToleranceMs)
            return RejectReason.DurationMismatch;

        if (stats.Wpm > rules.MaxWpm) return RejectReason.WpmTooHigh;

        if (IsInhumanRhythm(session.Log, rules)) return RejectReason.InhumanRhythm;

        return RejectReason.None;
    }

    /// <summary>
    /// Jeda tidak manusiawi secara konsisten: terlalu banyak jeda super cepat, atau jeda yang hampir sama
    /// semuanya (variasi sangat kecil, ciri khas skrip dengan delay tetap).
    /// </summary>
    public static bool IsInhumanRhythm(IReadOnlyList<Keystroke> log, ResultValidationOptions rules)
    {
        ArgumentNullException.ThrowIfNull(log);
        ArgumentNullException.ThrowIfNull(rules);
        if (log.Count < rules.RhythmMinKeystrokes) return false;

        // LINQ: Zip memasangkan elemen ke-i dengan ke-(i+1) lalu Select menghitung selisih waktunya.
        var intervals = log.Zip(log.Skip(1), (a, b) => (double)(b.T - a.T)).ToArray();
        if (intervals.Length == 0) return false;

        var fastRatio = intervals.Count(d => d < rules.FastIntervalMs) / (double)intervals.Length;
        if (fastRatio > rules.MaxFastIntervalRatio) return true;

        var mean = intervals.Average();
        if (mean <= 0) return true;
        var variance = intervals.Sum(d => (d - mean) * (d - mean)) / intervals.Length;
        var coefficientOfVariation = Math.Sqrt(variance) / mean;
        return coefficientOfVariation < rules.MinIntervalCoefficientOfVariation;
    }
}
