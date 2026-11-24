using System.Net;
using System.Net.Http.Json;
using KetikNgebut.Application.Players;
using KetikNgebut.Application.Leaderboard;
using KetikNgebut.Application.Stats;
using KetikNgebut.Domain.Entities;
using KetikNgebut.Tests.Infrastructure;

namespace KetikNgebut.Tests.Leaderboard;

/// <summary>Setiap test memakai ApiFactory sendiri agar isi leaderboard terkendali.</summary>
public sealed class LeaderboardAndStatsTests
{
    // Jam palsu: Selasa 15 Jan 2030 10.00 WIB (03.00 UTC). Hari ini mulai 14 Jan 17.00 UTC,
    // minggu ini (Senin) mulai 13 Jan 17.00 UTC.
    private static readonly DateTime Today = new(2030, 1, 15, 2, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime StartOfToday = new(2030, 1, 14, 17, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime MondayThisWeek = new(2030, 1, 14, 1, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime LastWeek = new(2030, 1, 10, 5, 0, 0, DateTimeKind.Utc);

    private static RaceResult Result(Guid userId, double netWpm, DateTime createdAt, bool isValid = true, double accuracy = 1) => new()
    {
        PlayerId = userId,
        PassageId = "id-easy-1",
        Wpm = netWpm / accuracy,
        Accuracy = accuracy,
        NetWpm = netWpm,
        DurationMs = 30_000,
        CorrectChars = 100,
        TotalKeystrokes = 100,
        KeystrokeLog = "[]",
        CreatedAt = createdAt,
        IsValid = isValid,
        RejectReason = isValid ? RejectReason.None : RejectReason.WpmTooHigh,
    };

    private static async Task<ClaimNicknameResponse> UserAsync(ApiFactory f, string name)
    {
        using var client = f.CreateClient();
        return await client.ClaimNicknameAsync(name);
    }

    private static async Task SeedAsync(ApiFactory f, params RaceResult[] results) =>
        await f.WithDbAsync(async db =>
        {
            db.RaceResults.AddRange(results);
            await db.SaveChangesAsync();
        });

    private static async Task<LeaderboardResponse> GetAsync(HttpClient client, string query) =>
        (await client.GetFromJsonAsync<LeaderboardResponse>($"/leaderboard?{query}", ApiHelpers.Json))!;

    [Fact]
    public async Task LBD_1_PublikTanpaLogin()
    {
        using var f = new ApiFactory();
        using var guest = f.CreateClient();

        var response = await guest.GetAsync("/leaderboard?period=daily");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task LBD_1_PeriodeHarianMingguanSepanjangMasa()
    {
        using var f = new ApiFactory();
        var today = await UserAsync(f, "hari_ini");
        var monday = await UserAsync(f, "senin");
        var old = await UserAsync(f, "lama");
        var lateYesterday = await UserAsync(f, "kemarin_malam");
        await SeedAsync(f,
            Result(today.Player.Id, 50, Today),
            Result(monday.Player.Id, 70, MondayThisWeek),
            Result(old.Player.Id, 90, LastWeek),
            Result(lateYesterday.Player.Id, 60, StartOfToday.AddSeconds(-1)), // Senin 23.59.59 WIB
            Result(today.Player.Id, 40, StartOfToday)); // tepat 00.00 WIB hari ini
        using var guest = f.CreateClient();

        var daily = await GetAsync(guest, "period=daily");
        var weekly = await GetAsync(guest, "period=weekly");
        var all = await GetAsync(guest, "period=all");

        Assert.Equal(["hari_ini"], daily.Items.Select(i => i.Nickname));
        Assert.Equal(StartOfToday, daily.From);
        Assert.Equal(["senin", "kemarin_malam", "hari_ini"], weekly.Items.Select(i => i.Nickname));
        Assert.Equal(["lama", "senin", "kemarin_malam", "hari_ini"], all.Items.Select(i => i.Nickname));
        Assert.Equal([1, 2, 3, 4], all.Items.Select(i => i.Rank));
        Assert.Null(all.From);
    }

    [Fact]
    public async Task LBD_1_Paginasi()
    {
        using var f = new ApiFactory();
        var results = new List<RaceResult>();
        for (var i = 1; i <= 7; i++)
        {
            var u = await UserAsync(f, $"pemain_{i}");
            results.Add(Result(u.Player.Id, 10 * i, Today));
        }
        await SeedAsync(f, [.. results]);
        using var guest = f.CreateClient();

        var page1 = await GetAsync(guest, "period=all&page=1&pageSize=3");
        var page3 = await GetAsync(guest, "period=all&page=3&pageSize=3");

        Assert.Equal(7, page1.TotalCount);
        Assert.Equal(["pemain_7", "pemain_6", "pemain_5"], page1.Items.Select(i => i.Nickname));
        Assert.Equal(["pemain_1"], page3.Items.Select(i => i.Nickname));
        Assert.Equal(7, page3.Items.Single().Rank);
    }

    [Theory]
    [InlineData("period=bulanan")]
    [InlineData("page=0")]
    [InlineData("pageSize=500")]
    public async Task LBD_1_ParameterTidakValid_400(string query)
    {
        using var f = new ApiFactory();
        using var guest = f.CreateClient();

        var response = await guest.GetAsync($"/leaderboard?{query}");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task LBD_2_DuaHasilSehari_MunculSekaliDenganTerbaik()
    {
        using var f = new ApiFactory();
        var rina = await UserAsync(f, "rina");
        var budi = await UserAsync(f, "budi");
        await SeedAsync(f,
            Result(rina.Player.Id, 45, Today.AddMinutes(-30)),
            Result(rina.Player.Id, 62, Today),
            Result(rina.Player.Id, 300, Today, isValid: false), // ditolak: tidak dihitung (RES-4)
            Result(budi.Player.Id, 55, Today));
        using var guest = f.CreateClient();

        var daily = await GetAsync(guest, "period=daily");

        Assert.Equal(2, daily.TotalCount);
        Assert.Equal(["rina", "budi"], daily.Items.Select(i => i.Nickname));
        Assert.Equal(62, daily.Items[0].NetWpm);
    }

    [Fact]
    public async Task LBD_1_TidakMenampilkanIdAtauTokenPemain()
    {
        using var f = new ApiFactory();
        var u = await UserAsync(f, "rahasia");
        await SeedAsync(f, Result(u.Player.Id, 50, Today));
        using var guest = f.CreateClient();

        var raw = await guest.GetStringAsync("/leaderboard?period=all");

        Assert.DoesNotContain(u.Player.Id.ToString(), raw, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain(u.PlayerToken, raw, StringComparison.Ordinal);
    }

    [Fact]
    public async Task STA_1_RataRataWpm_SesuaiPerhitunganManual()
    {
        using var f = new ApiFactory();
        var auth = await UserAsync(f, "statistik");
        var other = await UserAsync(f, "orang_lain");
        await SeedAsync(f,
            Result(auth.Player.Id, 36, Today.AddHours(-3), accuracy: 0.9), // wpm 40
            Result(auth.Player.Id, 57, Today.AddHours(-2), accuracy: 0.95), // wpm 60
            Result(auth.Player.Id, 80, Today.AddHours(-1), accuracy: 1.0), // wpm 80
            Result(auth.Player.Id, 500, Today, isValid: false), // ditolak
            Result(other.Player.Id, 120, Today)); // milik pemain lain
        using var client = f.CreateClient().WithPlayerToken(auth.PlayerToken);

        var stats = await client.GetFromJsonAsync<StatsResponse>("/me/stats", ApiHelpers.Json);

        // Manual: WPM (40 + 60 + 80) / 3 = 60; bersih (36 + 57 + 80) / 3 = 57,67; akurasi (0,9 + 0,95 + 1) / 3 = 0,95.
        Assert.Equal(3, stats!.TotalRaces);
        Assert.Equal(60, stats.AverageWpm, 9);
        Assert.Equal(80, stats.BestWpm, 9);
        Assert.Equal(173.0 / 3, stats.AverageNetWpm, 9);
        Assert.Equal(80, stats.BestNetWpm, 9);
        Assert.Equal(0.95, stats.AverageAccuracy, 9);
        Assert.Equal([36.0, 57.0, 80.0], stats.History.Select(h => h.NetWpm)); // urut lama -> baru, untuk grafik
    }

    [Fact]
    public async Task STA_1_BelumAdaHasil_SemuaNol()
    {
        using var f = new ApiFactory();
        using var client = await f.CreatePlayerClientAsync();

        var stats = await client.GetFromJsonAsync<StatsResponse>("/me/stats", ApiHelpers.Json);

        Assert.Equal(0, stats!.TotalRaces);
        Assert.Empty(stats.History);
    }

    [Fact]
    public async Task STA_1_TanpaLogin_401()
    {
        using var f = new ApiFactory();
        using var guest = f.CreateClient();

        var response = await guest.GetAsync("/me/stats");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
