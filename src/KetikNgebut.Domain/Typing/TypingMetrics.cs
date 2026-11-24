namespace KetikNgebut.Domain.Typing;

public sealed record TypingStats(int CorrectChars, double Wpm, double Accuracy, double NetWpm, double Progress, long ElapsedMs);

/// <summary>Port C# dari web/src/core/typing/metrics.ts. Urutan operasi aritmetika sengaja sama agar hasil double identik.</summary>
public static class TypingMetrics
{
    private const double MsPerMinute = 60_000;

    /// <summary>WPM = (karakter benar / charsPerWord) / menit berlalu.</summary>
    public static double ComputeWpm(int correctChars, long elapsedMs, int charsPerWord)
    {
        if (elapsedMs <= 0) return 0;
        return (double)correctChars / charsPerWord / (elapsedMs / MsPerMinute);
    }

    /// <summary>Akurasi = keystroke benar / total (tanpa Backspace). 1 bila belum ada keystroke.</summary>
    public static double ComputeAccuracy(int correctKeystrokes, int totalKeystrokes)
    {
        if (totalKeystrokes <= 0) return 1;
        return (double)correctKeystrokes / totalKeystrokes;
    }

    /// <summary>Statistik pada waktu nowMs; setelah selesai, waktu dibekukan di waktu finis.</summary>
    public static TypingStats ComputeStats(TypingSession session, long nowMs, int charsPerWord)
    {
        ArgumentNullException.ThrowIfNull(session);
        var elapsedMs = session.FinishedAtMs ?? Math.Max(0, nowMs);
        var wpm = ComputeWpm(session.Cursor, elapsedMs, charsPerWord);
        var accuracy = ComputeAccuracy(session.CorrectKeystrokes, session.TotalKeystrokes);
        return new TypingStats(
            session.Cursor,
            wpm,
            accuracy,
            wpm * accuracy,
            session.Text.Length == 0 ? 1 : (double)session.Cursor / session.Text.Length,
            elapsedMs);
    }
}
