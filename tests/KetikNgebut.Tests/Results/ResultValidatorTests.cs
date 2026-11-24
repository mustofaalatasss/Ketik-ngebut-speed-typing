using KetikNgebut.Application.Options;
using KetikNgebut.Application.Results;
using KetikNgebut.Domain.Entities;
using KetikNgebut.Domain.Typing;
using KetikNgebut.Tests.Infrastructure;

namespace KetikNgebut.Tests.Results;

/// <summary>Unit test validator tanpa HTTP/database.</summary>
public sealed class ResultValidatorTests
{
    private static readonly TypingOptions Typing = new();
    private static readonly ResultValidationOptions Rules = new();

    private static ResultEvaluation Evaluate(string text, IEnumerable<KeystrokeDto> log, long? duration = null)
    {
        var ks = log.Select(k => new Keystroke(k.Key!, k.T)).ToList();
        return ResultValidator.Evaluate(text, ks, duration ?? ks[^1].T, Typing, Rules);
    }

    [Fact]
    public void RES_2_LogManusiawi_Valid_DenganWpmHitunganServer()
    {
        var text = TestLogs.SeedPassage().Text;
        var log = TestLogs.Human(text, 60);

        var result = Evaluate(text, log);

        Assert.True(result.IsValid);
        Assert.Equal(TypingMetrics.ComputeWpm(text.Length, log[^1].T, 5), result.Stats.Wpm);
        Assert.InRange(result.Stats.Wpm, 50, 70);
    }

    [Fact]
    public void RES_3_Wpm400_DitolakWpmTooHigh()
    {
        var text = TestLogs.SeedPassage().Text;
        var result = Evaluate(text, TestLogs.Human(text, 400));

        Assert.Equal(RejectReason.WpmTooHigh, result.Reason);
        Assert.True(result.Stats.Wpm > 300);
    }

    [Fact]
    public void RES_3_RitmeKonstan_DitolakInhumanRhythm()
    {
        var text = TestLogs.SeedPassage().Text;
        var result = Evaluate(text, TestLogs.Constant(text, 110)); // ±109 WPM, tapi jeda selalu sama persis

        Assert.Equal(RejectReason.InhumanRhythm, result.Reason);
    }

    [Fact]
    public void RES_3_BanyakJedaSuperCepat_DitolakInhumanRhythm()
    {
        var text = TestLogs.SeedPassage().Text;
        // Ketikan berpasangan: jeda 5 ms lalu 400 ms bergantian. WPM wajar (~59), tapi separuh jeda < 25 ms.
        var log = text.Select((ch, i) => new KeystrokeDto(ch.ToString(), i / 2 * 405L + (i % 2) * 5 + 400)).ToList();
        var result = Evaluate(text, log);

        Assert.True(result.Stats.Wpm < Rules.MaxWpm);
        Assert.Equal(RejectReason.InhumanRhythm, result.Reason);
    }

    [Fact]
    public void RES_3_LogTidakSampaiAkhirTeks_DitolakNotFinished()
    {
        var text = TestLogs.SeedPassage().Text;
        var result = Evaluate(text, TestLogs.Human(text[..(text.Length / 2)], 60));

        Assert.Equal(RejectReason.NotFinished, result.Reason);
    }

    [Fact]
    public void RES_3_LogTeksLain_DitolakNotFinished()
    {
        var text = TestLogs.SeedPassage("id-easy-1").Text;
        var other = TestLogs.SeedPassage("id-easy-2").Text;

        var result = Evaluate(text, TestLogs.Human(other, 60));

        Assert.Equal(RejectReason.NotFinished, result.Reason);
    }

    [Fact]
    public void RES_3_WaktuMundur_DitolakTimeNotMonotonic()
    {
        var text = TestLogs.SeedPassage().Text;
        var log = TestLogs.Human(text, 60);
        (log[10], log[11]) = (log[10] with { T = log[11].T }, log[11] with { T = log[10].T });

        Assert.Equal(RejectReason.TimeNotMonotonic, Evaluate(text, log).Reason);
    }

    [Fact]
    public void RES_3_MelewatiBatasWaktu_DitolakTimeLimitExceeded()
    {
        var text = TestLogs.SeedPassage().Text;
        var log = TestLogs.Scale(TestLogs.Human(text, 60), 200); // ~20 menit

        Assert.Equal(RejectReason.TimeLimitExceeded, Evaluate(text, log).Reason);
    }

    [Fact]
    public void RES_3_DurasiKlienTidakCocok_DitolakDurationMismatch()
    {
        var text = TestLogs.SeedPassage().Text;
        var log = TestLogs.Human(text, 60);

        Assert.Equal(RejectReason.DurationMismatch, Evaluate(text, log, log[^1].T - 5_000).Reason);
        Assert.True(Evaluate(text, log, log[^1].T - Rules.DurationToleranceMs).IsValid);
    }
}
