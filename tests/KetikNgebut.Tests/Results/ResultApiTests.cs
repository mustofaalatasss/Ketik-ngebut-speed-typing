using System.Net;
using System.Net.Http.Json;
using KetikNgebut.Application.Leaderboard;
using KetikNgebut.Application.Results;
using KetikNgebut.Application.Stats;
using KetikNgebut.Domain.Entities;
using KetikNgebut.Domain.Typing;
using KetikNgebut.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace KetikNgebut.Tests.Results;

public sealed class ResultApiTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static readonly Passage Passage = TestLogs.SeedPassage();

    private async Task<(HttpClient Client, string Name)> PlayerAsync()
    {
        var name = ApiHelpers.UniqueName("res");
        return (await factory.CreatePlayerClientAsync(name), name);
    }

    private static async Task<LeaderboardResponse> LeaderboardAsync(HttpClient client) =>
        (await client.GetFromJsonAsync<LeaderboardResponse>("/leaderboard?period=all&pageSize=50", ApiHelpers.Json))!;

    [Fact]
    public async Task RES_1_TamuKirimHasil_401()
    {
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync("/results", TestLogs.Request(Passage.Id, TestLogs.Human(Passage.Text, 60)));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task RES_1_PemainKirimHasilValid_201()
    {
        var (client, _) = await PlayerAsync();

        var response = await client.PostAsJsonAsync("/results", TestLogs.Request(Passage.Id, TestLogs.Human(Passage.Text, 60)));
        var body = await response.Content.ReadFromJsonAsync<ResultResponse>(ApiHelpers.Json);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.True(body!.IsValid);
        Assert.Equal(Passage.Id, body.PassageId);
        Assert.Equal(Passage.Text.Length, body.CorrectChars);
    }

    [Fact]
    public async Task BOT_4_HasilBalapanLawanBot_DisimpanDenganModeBot()
    {
        var (client, _) = await PlayerAsync();
        var log = TestLogs.Human(Passage.Text, 60);
        var body = new
        {
            passageId = Passage.Id,
            mode = "bot",
            durationMs = log[^1].T,
            log = log.Select(k => new { key = k.Key, t = k.T }),
        };

        var response = await client.PostAsJsonAsync("/results", body);
        var saved = await response.Content.ReadFromJsonAsync<ResultResponse>(ApiHelpers.Json);
        var stored = await factory.WithDbAsync(db => db.RaceResults.SingleAsync(r => r.Id == saved!.Id));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal("bot", saved!.Mode);
        Assert.Equal(RaceMode.Bot, stored.Mode);
    }

    [Theory]
    [InlineData("""{"durationMs":1000,"log":[{"key":"a","t":1}]}""")] // passageId hilang
    [InlineData("""{"passageId":"id-easy-1","durationMs":1000,"log":[]}""")] // log kosong
    [InlineData("""{"passageId":"id-easy-1","durationMs":1000,"log":[{"key":"Shift","t":1}]}""")] // kunci tidak dikenal
    [InlineData("""{"passageId":"id-easy-1","durationMs":1000,"log":[{"key":"a","t":-5}]}""")] // waktu negatif
    [InlineData("""{"passageId":"id-easy-1","durationMs":1000,"log":[{"key":"a","t":1.5}]}""")] // waktu bukan bilangan bulat
    [InlineData("""{"passageId":"id-easy-1","log":[{"key":"a","t":1}]}""")] // durationMs hilang
    [InlineData("""{"passageId":"id-easy-1","durationMs":1000,"mode":"multiplayer","log":[{"key":"a","t":1}]}""")]
    [InlineData("""bukan json""")]
    public async Task RES_1_InputTidakValid_400(string json)
    {
        var (client, _) = await PlayerAsync();

        var response = await client.PostAsync("/results", new StringContent(json, System.Text.Encoding.UTF8, "application/json"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task RES_1_LogTerlaluPanjang_400()
    {
        var (client, _) = await PlayerAsync();
        var log = Enumerable.Range(1, 5001).Select(i => new KeystrokeDto("a", i * 100)).ToList();

        var response = await client.PostAsJsonAsync("/results", TestLogs.Request(Passage.Id, log));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task RES_1_PassageTidakAda_404()
    {
        var (client, _) = await PlayerAsync();

        var response = await client.PostAsJsonAsync("/results", TestLogs.Request("tidak-ada", TestLogs.Human(Passage.Text, 60)));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task RES_2_AngkaKlienDiabaikan_ServerHitungUlang()
    {
        var (client, _) = await PlayerAsync();
        var log = TestLogs.Human(Passage.Text, 55);
        // Klien mengklaim wpm 999 dan accuracy 1 (lihat TestLogs.Request); server memakai hasil replay.
        var expected = TypingMetrics.ComputeWpm(Passage.Text.Length, log[^1].T, 5);

        var response = await client.PostAsJsonAsync("/results", TestLogs.Request(Passage.Id, log));
        var body = await response.Content.ReadFromJsonAsync<ResultResponse>(ApiHelpers.Json);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal(expected, body!.Wpm);
        Assert.NotEqual(999, body.Wpm);
    }

    [Fact]
    public async Task RES_2_AkurasiDihitungDariLog()
    {
        var (client, _) = await PlayerAsync();
        var log = TestLogs.Human(Passage.Text, 50);
        // Satu salah ketik + Backspace di awal: 1 salah dari (n + 1) total keystroke.
        var withTypo = new List<KeystrokeDto> { new("#", 50), new("Backspace", 120) };
        withTypo.AddRange(log.Select(k => k with { T = k.T + 150 }));

        var response = await client.PostAsJsonAsync("/results", TestLogs.Request(Passage.Id, withTypo));
        var body = await response.Content.ReadFromJsonAsync<ResultResponse>(ApiHelpers.Json);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal((double)Passage.Text.Length / (Passage.Text.Length + 1), body!.Accuracy);
        Assert.Equal(body.Wpm * body.Accuracy, body.NetWpm);
    }

    [Fact]
    public async Task RES_3_Wpm400_DitolakDanTidakMasukLeaderboard()
    {
        var (client, name) = await PlayerAsync();

        var response = await client.PostAsJsonAsync("/results", TestLogs.Request(Passage.Id, TestLogs.Human(Passage.Text, 400)));
        var problem = await response.ReadJsonAsync();
        var board = await LeaderboardAsync(client);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("WpmTooHigh", problem.GetProperty("reason").GetString());
        Assert.DoesNotContain(board.Items, e => e.Nickname == name);
    }

    [Fact]
    public async Task RES_3_WaktuDiperkecilSedikit_WpmDihitungUlangBukanKlaim()
    {
        var (client, _) = await PlayerAsync();
        var honest = TestLogs.Human(Passage.Text, 50);
        var shrunk = TestLogs.Scale(honest, 0.5); // pemain "mempercepat" log 2x

        var response = await client.PostAsJsonAsync("/results", TestLogs.Request(Passage.Id, shrunk));
        var body = await response.Content.ReadFromJsonAsync<ResultResponse>(ApiHelpers.Json);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal(TypingMetrics.ComputeWpm(Passage.Text.Length, shrunk[^1].T, 5), body!.Wpm);
        Assert.NotEqual(999, body.Wpm);
    }

    [Fact]
    public async Task RES_3_WaktuDiperkecilBanyak_Ditolak()
    {
        var (client, _) = await PlayerAsync();
        var shrunk = TestLogs.Scale(TestLogs.Human(Passage.Text, 60), 0.1); // ~600 WPM

        var response = await client.PostAsJsonAsync("/results", TestLogs.Request(Passage.Id, shrunk));
        var problem = await response.ReadJsonAsync();

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("WpmTooHigh", problem.GetProperty("reason").GetString());
    }

    [Fact]
    public async Task RES_3_WaktuDiperkecilTanpaUbahDurasi_DitolakDurationMismatch()
    {
        var (client, _) = await PlayerAsync();
        var honest = TestLogs.Human(Passage.Text, 60);
        var shrunk = TestLogs.Scale(honest, 0.5);

        var response = await client.PostAsJsonAsync("/results", TestLogs.Request(Passage.Id, shrunk, durationMs: honest[^1].T));
        var problem = await response.ReadJsonAsync();

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("DurationMismatch", problem.GetProperty("reason").GetString());
    }

    [Fact]
    public async Task RES_3_LogTidakMenghasilkanTeks_Ditolak()
    {
        var (client, _) = await PlayerAsync();
        var otherText = TestLogs.SeedPassage("id-easy-2").Text;

        var response = await client.PostAsJsonAsync("/results", TestLogs.Request(Passage.Id, TestLogs.Human(otherText, 60)));
        var problem = await response.ReadJsonAsync();

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("NotFinished", problem.GetProperty("reason").GetString());
    }

    [Fact]
    public async Task RES_3_RitmeKonstanSkrip_Ditolak()
    {
        var (client, _) = await PlayerAsync();

        var response = await client.PostAsJsonAsync("/results", TestLogs.Request(Passage.Id, TestLogs.Constant(Passage.Text, 120)));
        var problem = await response.ReadJsonAsync();

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("InhumanRhythm", problem.GetProperty("reason").GetString());
    }

    [Fact]
    public async Task RES_3_WaktuMundur_Ditolak()
    {
        var (client, _) = await PlayerAsync();
        var log = TestLogs.Human(Passage.Text, 60);
        log[5] = log[5] with { T = 1 };

        var response = await client.PostAsJsonAsync("/results", TestLogs.Request(Passage.Id, log));
        var problem = await response.ReadJsonAsync();

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("TimeNotMonotonic", problem.GetProperty("reason").GetString());
    }

    [Fact]
    public async Task RES_4_HasilDitolak_DisimpanTidakValid_TidakMasukStatistik()
    {
        var (client, _) = await PlayerAsync();

        var valid = await client.PostAsJsonAsync("/results", TestLogs.Request(Passage.Id, TestLogs.Human(Passage.Text, 60)));
        var rejected = await client.PostAsJsonAsync("/results", TestLogs.Request(Passage.Id, TestLogs.Human(Passage.Text, 400)));
        var rejectedId = (await rejected.ReadJsonAsync()).GetProperty("resultId").GetInt64();
        var stats = await client.GetFromJsonAsync<StatsResponse>("/me/stats", ApiHelpers.Json);
        var stored = await factory.WithDbAsync(db => db.RaceResults.SingleAsync(r => r.Id == rejectedId));

        Assert.Equal(HttpStatusCode.Created, valid.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, rejected.StatusCode);
        Assert.Equal(1, stats!.TotalRaces);
        Assert.True(stats.BestWpm < 250);
        Assert.False(stored.IsValid);
        Assert.Equal(RejectReason.WpmTooHigh, stored.RejectReason);
    }
}
