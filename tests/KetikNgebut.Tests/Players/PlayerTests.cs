using System.Net;
using System.Net.Http.Json;
using KetikNgebut.Application.Common;
using KetikNgebut.Application.Players;
using KetikNgebut.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace KetikNgebut.Tests.Players;

/// <summary>ACC-1: pemain cukup memasukkan nickname, tanpa daftar atau login.</summary>
public sealed class PlayerTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    [Fact]
    public async Task ACC_1_KlaimNickname_DapatTokenTanpaPassword()
    {
        using var client = factory.CreateClient();
        var nickname = ApiHelpers.UniqueName("rina");

        var response = await client.PostAsJsonAsync("/players", new { nickname });
        var body = await response.Content.ReadFromJsonAsync<ClaimNicknameResponse>(ApiHelpers.Json);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal(nickname, body!.Player.Nickname);
        Assert.True(body.PlayerToken.Length >= 40);
    }

    [Fact]
    public async Task ACC_1_TokenPemain_BisaDipakaiUntukStatistikDanCekNickname()
    {
        using var client = factory.CreateClient();
        var claimed = await client.ClaimNicknameAsync();
        client.WithPlayerToken(claimed.PlayerToken);

        var me = await client.GetFromJsonAsync<PlayerDto>("/players/me", ApiHelpers.Json);
        var stats = await client.GetAsync("/me/stats");

        Assert.Equal(claimed.Player, me);
        Assert.Equal(HttpStatusCode.OK, stats.StatusCode);
    }

    [Theory]
    [InlineData("Budi_Cepat", "budi_cepat")]
    [InlineData("Sari", "SARI")]
    public async Task ACC_1_NicknameSudahDipakai_409_TermasukBedaHurufBesarKecil(string first, string second)
    {
        using var f = new ApiFactory();
        using var browserA = f.CreateClient();
        using var browserB = f.CreateClient();
        await browserA.ClaimNicknameAsync(first);

        var response = await browserB.PostAsJsonAsync("/players", new { nickname = second });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    [Theory]
    [InlineData("ab")]
    [InlineData("nama_yang_terlalu_panjang_sekali")]
    [InlineData("<script>")]
    [InlineData("dua  spasi")]
    [InlineData("")]
    public async Task ACC_1_NicknameTidakValid_400(string nickname)
    {
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync("/players", new { nickname });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task ACC_1_TokenPemainSalah_401()
    {
        using var client = factory.CreateClient().WithPlayerToken("token-karangan-yang-tidak-pernah-dibuat");

        var stats = await client.GetAsync("/me/stats");
        var me = await client.GetAsync("/players/me");

        Assert.Equal(HttpStatusCode.Unauthorized, stats.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, me.StatusCode);
    }

    [Fact]
    public async Task ACC_1_PemainNonaktif_TokenDitolak401()
    {
        using var client = factory.CreateClient();
        var claimed = await client.ClaimNicknameAsync();
        await factory.WithDbAsync(async db =>
        {
            var player = await db.Players.SingleAsync(p => p.Id == claimed.Player.Id);
            player.IsActive = false;
            await db.SaveChangesAsync();
        });

        var response = await client.WithPlayerToken(claimed.PlayerToken).GetAsync("/me/stats");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task ACC_2_TokenPemainDisimpanSebagaiHash()
    {
        using var client = factory.CreateClient();
        var claimed = await client.ClaimNicknameAsync();

        var stored = await factory.WithDbAsync(db => db.Players.SingleAsync(p => p.Id == claimed.Player.Id));

        Assert.NotEqual(claimed.PlayerToken, stored.TokenHash);
        Assert.Equal(SecureTokens.Hash(claimed.PlayerToken), stored.TokenHash);
    }

    [Fact]
    public async Task ACC_3_TokenPemainTidakBisaDipakaiSebagaiJwt_401()
    {
        using var client = factory.CreateClient();
        var claimed = await client.ClaimNicknameAsync();

        var response = await client.WithToken(claimed.PlayerToken).GetAsync("/me/stats");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
