using System.Net;
using System.Net.Http.Json;
using KetikNgebut.Application.Ghosts;
using KetikNgebut.Application.Players;
using KetikNgebut.Domain.Entities;
using KetikNgebut.Tests.Infrastructure;

namespace KetikNgebut.Tests.Ghosts;

/// <summary>BOT-3: GET /me/ghost mengembalikan rekaman rekor terbaik pemain sendiri.</summary>
public sealed class GhostTests
{
    private static RaceResult Result(Guid playerId, string passageId, double netWpm, string log, bool isValid = true) => new()
    {
        PlayerId = playerId,
        PassageId = passageId,
        Wpm = netWpm,
        Accuracy = 1,
        NetWpm = netWpm,
        DurationMs = 30_000,
        CorrectChars = 100,
        TotalKeystrokes = 100,
        KeystrokeLog = log,
        CreatedAt = ApiFactory.DefaultNow.UtcDateTime,
        IsValid = isValid,
        RejectReason = isValid ? RejectReason.None : RejectReason.WpmTooHigh,
    };

    private static async Task<(ClaimNicknameResponse Claim, HttpClient Client)> PlayerAsync(ApiFactory f)
    {
        var client = f.CreateClient();
        var claim = await client.ClaimNicknameAsync();
        return (claim, client.WithPlayerToken(claim.PlayerToken));
    }

    private static Task SeedAsync(ApiFactory f, params RaceResult[] results) =>
        f.WithDbAsync(async db =>
        {
            db.RaceResults.AddRange(results);
            await db.SaveChangesAsync();
        });

    private static async Task<GhostResponse> GetGhostAsync(HttpClient client, string passageId)
    {
        var response = await client.GetAsync($"/me/ghost?passageId={passageId}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<GhostResponse>(ApiHelpers.Json))!;
    }

    [Fact]
    public async Task BOT_3_Ghost_RekorTerbaikTeksSama()
    {
        using var f = new ApiFactory();
        var (me, client) = await PlayerAsync(f);
        await SeedAsync(f,
            Result(me.Player.Id, "id-easy-1", 40, """[{"key":"a","t":100}]"""),
            Result(me.Player.Id, "id-easy-1", 55, """[{"key":"P","t":150},{"key":"a","t":300}]"""),
            Result(me.Player.Id, "en-easy-1", 90, """[{"key":"x","t":1}]""")); // lebih cepat, tapi teks lain
        using var _ = client;

        var ghost = await GetGhostAsync(client, "id-easy-1");

        Assert.Equal("id-easy-1", ghost.PassageId);
        Assert.True(ghost.SamePassage);
        Assert.Equal(55, ghost.NetWpm);
        Assert.Equal([("P", 150L), ("a", 300L)], ghost.Log.Select(k => (k.Key, k.T)));
        Assert.StartsWith("Pagi ini", ghost.Text, StringComparison.Ordinal); // teks rekaman ikut dikirim
    }

    [Fact]
    public async Task BOT_3_Ghost_FallbackRekorTerbaikKeseluruhan()
    {
        using var f = new ApiFactory();
        var (me, client) = await PlayerAsync(f);
        await SeedAsync(f,
            Result(me.Player.Id, "en-easy-1", 70, """[{"key":"T","t":120}]"""),
            Result(me.Player.Id, "en-easy-2", 45, """[{"key":"W","t":120}]"""));
        using var _ = client;

        var ghost = await GetGhostAsync(client, "id-hard-1");

        Assert.Equal("en-easy-1", ghost.PassageId);
        Assert.False(ghost.SamePassage);
        Assert.Equal(70, ghost.NetWpm);
    }

    [Fact]
    public async Task BOT_3_Ghost_TanpaRekor404()
    {
        using var f = new ApiFactory();
        var (_, client) = await PlayerAsync(f);
        using var __ = client;

        var response = await client.GetAsync("/me/ghost?passageId=id-easy-1");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task BOT_3_Ghost_TanpaToken401()
    {
        using var f = new ApiFactory();
        using var guest = f.CreateClient();

        var response = await guest.GetAsync("/me/ghost?passageId=id-easy-1");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task BOT_3_Ghost_HasilDitolakDanMilikOrangLainTidakDipakai()
    {
        using var f = new ApiFactory();
        var (me, client) = await PlayerAsync(f);
        var (other, otherClient) = await PlayerAsync(f);
        otherClient.Dispose();
        await SeedAsync(f,
            Result(me.Player.Id, "id-easy-1", 300, """[{"key":"z","t":1}]""", isValid: false), // ditolak (RES-4)
            Result(other.Player.Id, "id-easy-1", 120, """[{"key":"o","t":1}]"""), // milik pemain lain
            Result(me.Player.Id, "id-easy-1", 35, """[{"key":"P","t":200}]"""));
        using var _ = client;

        var ghost = await GetGhostAsync(client, "id-easy-1");

        Assert.Equal(35, ghost.NetWpm);
        Assert.Equal("P", ghost.Log.Single().Key);
    }
}
