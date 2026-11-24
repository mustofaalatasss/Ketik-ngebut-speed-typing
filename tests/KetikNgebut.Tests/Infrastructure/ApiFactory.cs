using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using KetikNgebut.Application.Auth;
using KetikNgebut.Application.Players;
using KetikNgebut.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Time.Testing;

namespace KetikNgebut.Tests.Infrastructure;

/// <summary>
/// Server in-memory untuk integration test. Setiap instance memakai database SQLite in-memory sendiri
/// (tetap hidup selama koneksi _keepAlive terbuka) dan jam palsu (FakeTimeProvider).
/// </summary>
public class ApiFactory : WebApplicationFactory<Program>
{
    public const string SigningKey = "test-signing-key-yang-panjangnya-lebih-dari-32-byte!";
    public const string AdminEmail = "admin@ketikngebut.test";
    public const string AdminPassword = "AdminRahasia123";

    /// <summary>Selasa 15 Januari 2030, 10.00 WIB.</summary>
    public static readonly DateTimeOffset DefaultNow = new(2030, 1, 15, 3, 0, 0, TimeSpan.Zero);

    private readonly string _connectionString = $"Data Source=kn-{Guid.NewGuid():N};Mode=Memory;Cache=Shared";
    private readonly SqliteConnection _keepAlive;

    public ApiFactory()
    {
        _keepAlive = new SqliteConnection(_connectionString);
        _keepAlive.Open();
    }

    public FakeTimeProvider Time { get; } = new(DefaultNow);

    /// <summary>Pengaturan tambahan atau pengganti (dipakai subclass untuk test tertentu).</summary>
    protected virtual IReadOnlyDictionary<string, string?> ExtraSettings => new Dictionary<string, string?>();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        var settings = new Dictionary<string, string?>
        {
            ["ConnectionStrings:Default"] = _connectionString,
            ["Jwt:SigningKey"] = SigningKey,
            ["Seed:AdminEmail"] = AdminEmail,
            ["Seed:AdminPassword"] = AdminPassword,
            ["RateLimit:Login:PermitLimit"] = "10000",
            ["RateLimit:Auth:PermitLimit"] = "10000",
            ["RateLimit:Results:PermitLimit"] = "10000",
            ["RateLimit:Players:PermitLimit"] = "10000",
        };
        foreach (var (key, value) in ExtraSettings) settings[key] = value;

        builder.UseEnvironment("Testing");
        foreach (var (key, value) in settings) builder.UseSetting(key, value);

        builder.ConfigureServices(services =>
        {
            services.RemoveAll<TimeProvider>();
            services.AddSingleton<TimeProvider>(Time);
        });
    }

    public async Task WithDbAsync(Func<AppDbContext, Task> action)
    {
        ArgumentNullException.ThrowIfNull(action);
        await using var scope = Services.CreateAsyncScope();
        await action(scope.ServiceProvider.GetRequiredService<AppDbContext>());
    }

    public async Task<T> WithDbAsync<T>(Func<AppDbContext, Task<T>> action)
    {
        ArgumentNullException.ThrowIfNull(action);
        await using var scope = Services.CreateAsyncScope();
        return await action(scope.ServiceProvider.GetRequiredService<AppDbContext>());
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (disposing) _keepAlive.Dispose();
    }
}

public static class ApiHelpers
{
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private static int _counter;

    public static string UniqueName(string prefix = "user") => $"{prefix}{Interlocked.Increment(ref _counter)}_{Guid.NewGuid():N}"[..20];

    /// <summary>Klaim nickname (ACC-1) dan kembalikan token pemain.</summary>
    public static async Task<ClaimNicknameResponse> ClaimNicknameAsync(this HttpClient client, string? nickname = null)
    {
        var response = await client.PostAsJsonAsync("/players", new { nickname = nickname ?? UniqueName() });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<ClaimNicknameResponse>(Json))!;
    }

    public static HttpClient WithPlayerToken(this HttpClient client, string playerToken)
    {
        client.DefaultRequestHeaders.Remove("X-Player-Token");
        client.DefaultRequestHeaders.Add("X-Player-Token", playerToken);
        return client;
    }

    public static async Task<AuthResponse> LoginAsync(this HttpClient client, string email, string password)
    {
        var response = await client.PostAsJsonAsync("/auth/login", new { email, password });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<AuthResponse>(Json))!;
    }

    public static HttpClient WithToken(this HttpClient client, string accessToken)
    {
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        return client;
    }

    public static async Task<HttpClient> CreatePlayerClientAsync(this ApiFactory factory, string? nickname = null)
    {
        var client = factory.CreateClient();
        var claimed = await client.ClaimNicknameAsync(nickname);
        return client.WithPlayerToken(claimed.PlayerToken);
    }

    public static async Task<HttpClient> CreateAdminClientAsync(this ApiFactory factory)
    {
        var client = factory.CreateClient();
        var auth = await client.LoginAsync(ApiFactory.AdminEmail, ApiFactory.AdminPassword);
        return client.WithToken(auth.AccessToken);
    }

    public static async Task<JsonElement> ReadJsonAsync(this HttpResponseMessage response) =>
        await response.Content.ReadFromJsonAsync<JsonElement>(Json);
}
