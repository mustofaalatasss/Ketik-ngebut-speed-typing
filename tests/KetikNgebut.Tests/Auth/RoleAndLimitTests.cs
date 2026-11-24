using System.Net;
using System.Net.Http.Json;
using KetikNgebut.Application.Auth;
using KetikNgebut.Infrastructure.Identity;
using KetikNgebut.Tests.Infrastructure;

namespace KetikNgebut.Tests.Auth;

public sealed class RoleTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    [Theory]
    [InlineData("GET", "/passages")]
    [InlineData("POST", "/passages")]
    [InlineData("PUT", "/passages/id-easy-1")]
    [InlineData("DELETE", "/passages/id-easy-1")]
    public async Task ACC_3_TokenPemainKeEndpointAdmin_403(string method, string path)
    {
        using var client = await factory.CreatePlayerClientAsync();

        using var request = new HttpRequestMessage(new HttpMethod(method), path)
        {
            Content = method is "POST" or "PUT"
                ? JsonContent.Create(new { text = "Teks baru yang cukup panjang.", language = "id", difficulty = "easy" })
                : null,
        };
        var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task ACC_3_TamuPanggilEndpointAdmin_401()
    {
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/passages");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task ACC_3_AdminPanggilEndpointAdmin_200()
    {
        using var client = await factory.CreateAdminClientAsync();

        var response = await client.GetAsync("/passages");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task ACC_3_AdminDiSeedDariKonfigurasi_PunyaRoleAdmin()
    {
        using var client = factory.CreateClient();

        var auth = await client.LoginAsync(ApiFactory.AdminEmail, ApiFactory.AdminPassword);

        Assert.Contains(Roles.Admin, auth.User.Roles);
    }

    [Fact]
    public async Task ACC_3_TanpaKonfigurasiSeed_AdminTidakDibuat()
    {
        using var noSeed = new NoSeedFactory();
        using var client = noSeed.CreateClient();

        var response = await client.PostAsJsonAsync("/auth/login", new { email = ApiFactory.AdminEmail, password = ApiFactory.AdminPassword });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    private sealed class NoSeedFactory : ApiFactory
    {
        protected override IReadOnlyDictionary<string, string?> ExtraSettings =>
            new Dictionary<string, string?> { ["Seed:AdminEmail"] = "", ["Seed:AdminPassword"] = "" };
    }
}

public sealed class RateLimitTests
{
    private sealed class StrictLoginFactory : ApiFactory
    {
        protected override IReadOnlyDictionary<string, string?> ExtraSettings =>
            new Dictionary<string, string?> { ["RateLimit:Login:PermitLimit"] = "3" };
    }

    [Fact]
    public async Task ACC_4_LoginGagalBerulang_429()
    {
        using var factory = new StrictLoginFactory();
        using var client = factory.CreateClient();

        var statuses = new List<HttpStatusCode>();
        for (var i = 0; i < 4; i++)
        {
            var r = await client.PostAsJsonAsync("/auth/login", new { email = "siapa@contoh.test", password = "Salah12345" });
            statuses.Add(r.StatusCode);
            if (i == 3) Assert.Equal("application/problem+json", r.Content.Headers.ContentType?.MediaType);
        }

        Assert.Equal([HttpStatusCode.Unauthorized, HttpStatusCode.Unauthorized, HttpStatusCode.Unauthorized, HttpStatusCode.TooManyRequests], statuses);
    }

    private sealed class StrictPlayersFactory : ApiFactory
    {
        protected override IReadOnlyDictionary<string, string?> ExtraSettings =>
            new Dictionary<string, string?> { ["RateLimit:Players:PermitLimit"] = "2" };
    }

    [Fact]
    public async Task ACC_4_KlaimNicknameBerulang_429()
    {
        using var factory = new StrictPlayersFactory();
        using var client = factory.CreateClient();

        var statuses = new List<HttpStatusCode>();
        for (var i = 0; i < 3; i++)
        {
            var r = await client.PostAsJsonAsync("/players", new { nickname = ApiHelpers.UniqueName("klaim") });
            statuses.Add(r.StatusCode);
        }

        Assert.Equal([HttpStatusCode.Created, HttpStatusCode.Created, HttpStatusCode.TooManyRequests], statuses);
    }

    [Fact]
    public async Task ACC_4_AkunAdminTerkunciSetelahGagalBerulang_PesanTetapSama()
    {
        using var factory = new ApiFactory();
        using var client = factory.CreateClient();

        for (var i = 0; i < 5; i++)
            await client.PostAsJsonAsync("/auth/login", new { email = ApiFactory.AdminEmail, password = "SalahSekali1" });
        // Password benar pun ditolak selama akun terkunci, dengan pesan yang sama.
        var locked = await client.PostAsJsonAsync("/auth/login", new { email = ApiFactory.AdminEmail, password = ApiFactory.AdminPassword });
        var body = await locked.ReadJsonAsync();

        Assert.Equal(HttpStatusCode.Unauthorized, locked.StatusCode);
        Assert.Equal(AuthService.InvalidCredentialsMessage, body.GetProperty("title").GetString());
    }
}

public sealed class StartupTests
{
    private sealed class NoSigningKeyFactory : ApiFactory
    {
        protected override IReadOnlyDictionary<string, string?> ExtraSettings =>
            new Dictionary<string, string?> { ["Jwt:SigningKey"] = "" };
    }

    [Fact]
    public void ATURAN_TanpaSigningKey_AplikasiGagalStart()
    {
        using var factory = new NoSigningKeyFactory();

        var ex = Assert.ThrowsAny<Exception>(() => factory.CreateClient());

        Assert.Contains("Jwt:SigningKey", ex.ToString(), StringComparison.Ordinal);
    }
}
