using System.Text.Json;
using KetikNgebut.Domain.Typing;

namespace KetikNgebut.Tests.Typing;

/// <summary>
/// Port C# mesin mengetik harus memberi hasil yang sama persis dengan TypeScript. Fixture yang sama
/// (shared/fixtures/typing-replay.json) juga dites oleh Vitest di web/src/core/typing/parity.test.ts.
/// </summary>
public sealed class TypingEngineParityTests
{
    private const int CharsPerWord = 5;

    public static TheoryData<string> CaseNames()
    {
        var data = new TheoryData<string>();
        foreach (var c in LoadCases()) data.Add(c.GetProperty("name").GetString()!);
        return data;
    }

    [Theory]
    [MemberData(nameof(CaseNames))]
    public void RES_2_ReplayFixture_SamaDenganTypeScript(string name)
    {
        var c = LoadCases().Single(x => x.GetProperty("name").GetString() == name);
        var expected = c.GetProperty("expected");
        var log = c.GetProperty("log").EnumerateArray()
            .Select(k => new Keystroke(k.GetProperty("key").GetString()!, k.GetProperty("t").GetInt64()))
            .ToList();

        var session = TypingSession.Replay(c.GetProperty("text").GetString()!, log, c.GetProperty("maxErrorBuffer").GetInt32());
        var stats = TypingMetrics.ComputeStats(session, c.GetProperty("nowMs").GetInt64(), CharsPerWord);

        Assert.Equal(expected.GetProperty("cursor").GetInt32(), session.Cursor);
        Assert.Equal(expected.GetProperty("errorBuffer").GetString(), session.ErrorBuffer);
        Assert.Equal(expected.GetProperty("correctKeystrokes").GetInt32(), session.CorrectKeystrokes);
        Assert.Equal(expected.GetProperty("totalKeystrokes").GetInt32(), session.TotalKeystrokes);
        var finished = expected.GetProperty("finishedAtMs");
        Assert.Equal(finished.ValueKind == JsonValueKind.Null ? null : finished.GetInt64(), session.FinishedAtMs);
        Assert.Equal(expected.GetProperty("logLength").GetInt32(), session.Log.Count);
        Assert.Equal(expected.GetProperty("correctCharTimes").EnumerateArray().Select(x => x.GetInt64()), session.CorrectCharTimes);
        // Double dibandingkan persis (bit-identik), bukan dengan toleransi.
        Assert.Equal(expected.GetProperty("wpm").GetDouble(), stats.Wpm);
        Assert.Equal(expected.GetProperty("accuracy").GetDouble(), stats.Accuracy);
        Assert.Equal(expected.GetProperty("netWpm").GetDouble(), stats.NetWpm);
        Assert.Equal(expected.GetProperty("progress").GetDouble(), stats.Progress);
        Assert.Equal(expected.GetProperty("elapsedMs").GetInt64(), stats.ElapsedMs);
    }

    [Fact]
    public void RES_2_FixtureBersama_PunyaKasus()
    {
        Assert.True(LoadCases().Count >= 10);
    }

    [Fact]
    public void TYP_3_KarakterSalah_KursorTidakMaju_CSharp()
    {
        var session = new TypingSession("ab", maxErrorBuffer: 8);

        Assert.Equal(KeyResult.Incorrect, session.Apply(new Keystroke("x", 100)));
        Assert.Equal(0, session.Cursor);
        Assert.Equal(KeyResult.Incorrect, session.Apply(new Keystroke("a", 200))); // benar tapi buffer masih berisi
        Assert.Equal(0, session.Cursor);
        session.Apply(new Keystroke(Keystroke.Backspace, 300));
        session.Apply(new Keystroke(Keystroke.Backspace, 400));
        Assert.Equal(KeyResult.Correct, session.Apply(new Keystroke("a", 500)));
        Assert.Equal(1, session.Cursor);
    }

    [Fact]
    public void TYP_1_WpmContoh_50KarakterDalam12Detik_50Wpm()
    {
        Assert.Equal(50, TypingMetrics.ComputeWpm(50, 12_000, CharsPerWord));
    }

    private static List<JsonElement> LoadCases()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "Fixtures", "typing-replay.json");
        using var doc = JsonDocument.Parse(File.ReadAllText(path));
        return doc.RootElement.GetProperty("cases").EnumerateArray().Select(e => e.Clone()).ToList();
    }
}
