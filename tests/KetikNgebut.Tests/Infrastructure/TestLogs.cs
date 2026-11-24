using KetikNgebut.Application.Results;
using KetikNgebut.Domain.Entities;
using KetikNgebut.Infrastructure.Persistence;

namespace KetikNgebut.Tests.Infrastructure;

/// <summary>Pembuat log keystroke untuk test, dengan jeda acak berseed agar deterministik.</summary>
public static class TestLogs
{
    public static Passage SeedPassage(string id = "id-easy-1") =>
        DbInitializer.LoadSeedPassages().Single(p => p.Id == id);

    /// <summary>Mengetik teks dengan benar pada kira-kira targetWpm, jeda bervariasi ±jitter.</summary>
    public static List<KeystrokeDto> Human(string text, double targetWpm, int seed = 7, double jitter = 0.4)
    {
        var random = new Random(seed);
        var baseInterval = 60_000.0 / (targetWpm * 5);
        var log = new List<KeystrokeDto>(text.Length);
        var t = 0.0;
        foreach (var ch in text)
        {
            t += baseInterval * (1 + (random.NextDouble() * 2 - 1) * jitter);
            log.Add(new KeystrokeDto(ch.ToString(), (long)Math.Round(t)));
        }
        return log;
    }

    /// <summary>Jeda yang persis sama setiap ketikan: ciri skrip.</summary>
    public static List<KeystrokeDto> Constant(string text, long intervalMs) =>
        text.Select((ch, i) => new KeystrokeDto(ch.ToString(), (i + 1) * intervalMs)).ToList();

    public static List<KeystrokeDto> Scale(IEnumerable<KeystrokeDto> log, double factor) =>
        log.Select(k => k with { T = (long)Math.Round(k.T * factor) }).ToList();

    /// <summary>Body POST /results. Selalu menyertakan angka klaim palsu yang harus diabaikan server (RES-2).</summary>
    public static object Request(string passageId, IReadOnlyList<KeystrokeDto> log, long? durationMs = null) => new
    {
        passageId,
        durationMs = durationMs ?? log[^1].T,
        log = log.Select(k => new { key = k.Key, t = k.T }),
        wpm = 999.0,
        accuracy = 1.0,
        netWpm = 999.0,
    };
}
