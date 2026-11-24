using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using KetikNgebut.Application.Auth;
using KetikNgebut.Infrastructure.Identity;
using KetikNgebut.Tests.Infrastructure;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace KetikNgebut.Tests.Auth;

/// <summary>ACC-2: hanya admin yang login (email + password), dengan JWT dan refresh token.</summary>
public sealed class AdminAuthTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static string CreateJwt(string signingKey, Guid userId, string role, DateTime expires) =>
        new JsonWebTokenHandler { SetDefaultTimesOnTokenCreation = false }.CreateToken(new SecurityTokenDescriptor
        {
            Issuer = "KetikNgebut",
            Audience = "KetikNgebut.Web",
            Subject = new ClaimsIdentity([new Claim("sub", userId.ToString()), new Claim("role", role)]),
            IssuedAt = expires.AddMinutes(-30),
            Expires = expires,
            SigningCredentials = new SigningCredentials(
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey)), SecurityAlgorithms.HmacSha256),
        });

    [Fact]
    public async Task ACC_2_LoginAdmin_MengembalikanAccessDanRefreshToken()
    {
        using var client = factory.CreateClient();

        var auth = await client.LoginAsync(ApiFactory.AdminEmail, ApiFactory.AdminPassword);

        Assert.Equal(3, auth.AccessToken.Split('.').Length); // JWT = header.payload.signature
        Assert.False(string.IsNullOrWhiteSpace(auth.RefreshToken));
        Assert.Equal([Roles.Admin], auth.User.Roles);
        // Access token berumur pendek (15 menit), refresh token lebih lama.
        Assert.Equal(ApiFactory.DefaultNow.UtcDateTime.AddMinutes(15), auth.AccessTokenExpiresAt);
        Assert.True(auth.RefreshTokenExpiresAt > auth.AccessTokenExpiresAt);
    }

    [Fact]
    public async Task ACC_2_EndpointDaftarPemainTidakAda_404()
    {
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync("/auth/register", new { email = "a@contoh.test", password = "Password123", displayName = "abc" });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task ACC_2_AkunNonAdmin_TidakBisaLogin_PesanSama()
    {
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var users = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
            var created = await users.CreateAsync(new AppUser { Email = "lama@contoh.test", UserName = "lama@contoh.test", DisplayName = "pemain_lama" }, "Password123");
            Assert.True(created.Succeeded);
        }
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync("/auth/login", new { email = "lama@contoh.test", password = "Password123" });
        var body = await response.ReadJsonAsync();

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal(AuthService.InvalidCredentialsMessage, body.GetProperty("title").GetString());
    }

    [Fact]
    public async Task ACC_2_EmailSalahDanPasswordSalah_PesanSama()
    {
        using var client = factory.CreateClient();

        var wrongEmail = await client.PostAsJsonAsync("/auth/login", new { email = "tidak-ada@contoh.test", password = ApiFactory.AdminPassword });
        var wrongPassword = await client.PostAsJsonAsync("/auth/login", new { email = ApiFactory.AdminEmail, password = "SalahSekali1" });
        var body1 = await wrongEmail.ReadJsonAsync();
        var body2 = await wrongPassword.ReadJsonAsync();

        Assert.Equal(HttpStatusCode.Unauthorized, wrongEmail.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, wrongPassword.StatusCode);
        Assert.Equal(body1.GetProperty("title").GetString(), body2.GetProperty("title").GetString());
        Assert.Equal(AuthService.InvalidCredentialsMessage, body1.GetProperty("title").GetString());
    }

    [Fact]
    public async Task ACC_2_PasswordAdminDisimpanSebagaiHash()
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
        var admin = await users.FindByEmailAsync(ApiFactory.AdminEmail);

        Assert.NotNull(admin?.PasswordHash);
        Assert.DoesNotContain(ApiFactory.AdminPassword, admin.PasswordHash, StringComparison.Ordinal);
        Assert.Equal(PasswordVerificationResult.Success, users.PasswordHasher.VerifyHashedPassword(admin, admin.PasswordHash, ApiFactory.AdminPassword));
    }

    [Fact]
    public async Task ACC_2_TanpaToken_401()
    {
        using var client = factory.CreateClient();

        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/passages")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/me/stats")).StatusCode);
    }

    [Fact]
    public async Task ACC_2_TokenAdminKedaluwarsa_401()
    {
        using var client = factory.CreateClient();
        var auth = await client.LoginAsync(ApiFactory.AdminEmail, ApiFactory.AdminPassword);
        var expired = CreateJwt(ApiFactory.SigningKey, auth.User.Id, Roles.Admin, DateTime.UtcNow.AddMinutes(-1));

        var response = await client.WithToken(expired).GetAsync("/passages");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task ACC_2_TokenDitandatanganiKunciLain_401()
    {
        using var client = factory.CreateClient();
        var forged = CreateJwt("kunci-penyerang-yang-juga-panjang-32-byte++", Guid.NewGuid(), Roles.Admin, DateTime.UtcNow.AddHours(1));

        var response = await client.WithToken(forged).GetAsync("/passages");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task ACC_2_Refresh_RotasiDanTokenLamaDitolak()
    {
        using var localFactory = new ApiFactory();
        using var client = localFactory.CreateClient();
        var first = await client.LoginAsync(ApiFactory.AdminEmail, ApiFactory.AdminPassword);

        var refreshed = await client.PostAsJsonAsync("/auth/refresh", new { refreshToken = first.RefreshToken });
        var second = await refreshed.Content.ReadFromJsonAsync<AuthResponse>(ApiHelpers.Json);
        var reuse = await client.PostAsJsonAsync("/auth/refresh", new { refreshToken = first.RefreshToken });
        // Pemakaian ulang token lama dianggap pencurian: token baru juga ikut dicabut.
        var afterReuse = await client.PostAsJsonAsync("/auth/refresh", new { refreshToken = second!.RefreshToken });

        Assert.Equal(HttpStatusCode.OK, refreshed.StatusCode);
        Assert.NotEqual(first.RefreshToken, second.RefreshToken);
        Assert.Equal(HttpStatusCode.Unauthorized, reuse.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, afterReuse.StatusCode);
    }

    [Fact]
    public async Task ACC_2_LogoutAdmin_RefreshTokenTidakBisaDipakaiLagi()
    {
        using var client = factory.CreateClient();
        var auth = await client.LoginAsync(ApiFactory.AdminEmail, ApiFactory.AdminPassword);
        client.WithToken(auth.AccessToken);

        var logout = await client.PostAsJsonAsync("/auth/logout", new { refreshToken = auth.RefreshToken });
        var refresh = await client.PostAsJsonAsync("/auth/refresh", new { refreshToken = auth.RefreshToken });

        Assert.Equal(HttpStatusCode.NoContent, logout.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, refresh.StatusCode);
    }

    [Fact]
    public async Task ACC_2_RefreshTokenKedaluwarsa_401()
    {
        using var localFactory = new ApiFactory();
        using var client = localFactory.CreateClient();
        var auth = await client.LoginAsync(ApiFactory.AdminEmail, ApiFactory.AdminPassword);

        localFactory.Time.Advance(TimeSpan.FromDays(15));
        var refresh = await client.PostAsJsonAsync("/auth/refresh", new { refreshToken = auth.RefreshToken });

        Assert.Equal(HttpStatusCode.Unauthorized, refresh.StatusCode);
    }
}
