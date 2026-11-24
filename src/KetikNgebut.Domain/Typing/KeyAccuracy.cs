namespace KetikNgebut.Domain.Typing;

public sealed record KeyTally(int Hits, int Misses);

/// <summary>
/// POL-2: ketepatan per karakter dari log keystroke. Yang dihitung hanya "percobaan pertama" di posisi
/// kursor (saat tidak ada kesalahan yang belum dihapus): benar = Hits, salah = Misses untuk karakter
/// yang SEHARUSNYA diketik. Ketikan susulan saat masih ada kesalahan tidak dihitung, agar satu salah ketik
/// tidak dihitung berkali-kali. Huruf disamakan menjadi huruf kecil ("A" dan "a" satu statistik).
/// </summary>
public static class KeyAccuracy
{
    public static IReadOnlyDictionary<string, KeyTally> Compute(string text, IEnumerable<Keystroke> log, int maxErrorBuffer)
    {
        ArgumentNullException.ThrowIfNull(text);
        ArgumentNullException.ThrowIfNull(log);

        var hits = new Dictionary<string, int>();
        var misses = new Dictionary<string, int>();
        var session = new TypingSession(text, maxErrorBuffer);

        foreach (var ks in log)
        {
            if (session.IsFinished) break;
            var firstAttempt = ks.Key != Keystroke.Backspace && session.ErrorBuffer.Length == 0;
            var expected = firstAttempt ? Normalize(text[session.Cursor]) : null;

            var result = session.Apply(ks);
            if (expected is null) continue;
            if (result == KeyResult.Correct) Increment(hits, expected);
            else if (result == KeyResult.Incorrect) Increment(misses, expected);
        }

        return hits.Keys.Union(misses.Keys).ToDictionary(
            c => c,
            c => new KeyTally(hits.GetValueOrDefault(c), misses.GetValueOrDefault(c)));
    }

    public static string Normalize(char c) => char.ToLowerInvariant(c).ToString();

    private static void Increment(Dictionary<string, int> counts, string key) =>
        counts[key] = counts.GetValueOrDefault(key) + 1;
}
