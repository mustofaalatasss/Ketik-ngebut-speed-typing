using System.Net;
using System.Net.Http.Json;
using KetikNgebut.Application.Players;
using KetikNgebut.Application.Results;
using KetikNgebut.Domain.Typing;
using KetikNgebut.Tests.Infrastructure;

namespace KetikNgebut.Tests.Players;

/// <summary>POL-2 (statistik per huruf) dan POL-4 (pengaturan per pemain).</summary>
public sealed class PolishTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    [Fact]
    public void POL_2_KeyAccuracy_HanyaPercobaanPertamaDihitung()
    {
        // Teks "Ab": salah 'x' di posisi A (1 miss untuk 'a'), lalu 'y' susulan saat buffer berisi (tidak dihitung),
        // dua Backspace, 'A' benar (hit 'a'), 'b' benar (hit 'b').
        var log = new[]
        {
            new Keystroke("x", 100), new Keystroke("y", 200), new Keystroke("Backspace", 300),
            new Keystroke("Backspace", 400), new Keystroke("A", 500), new Keystroke("b", 600), new Keystroke("c", 700),
        };

        var tallies = KeyAccuracy.Compute("Ab", log, maxErrorBuffer: 8);

        Assert.Equal(new KeyTally(1, 1), tallies["a"]);
        Assert.Equal(new KeyTally(1, 0), tallies["b"]);
        Assert.Equal(2, tallies.Count);
    }

    [Fact]
    public async Task POL_2_KeyStat_DihitungDariLogHasilValid()
    {
        using var client = await factory.CreatePlayerClientAsync();
        var passage = TestLogs.SeedPassage();
        var log = TestLogs.Human(passage.Text, 50);
        // Satu salah ketik di awal: karakter pertama teks mendapat 1 miss.
        var withTypo = new List<KeystrokeDto> { new("#", 50), new("Backspace", 120) };
        withTypo.AddRange(log.Select(k => k with { T = k.T + 150 }));
        var first = KeyAccuracy.Normalize(passage.Text[0]);

        var submit = await client.PostAsJsonAsync("/results", TestLogs.Request(passage.Id, withTypo));
        var keys = await client.GetFromJsonAsync<List<KeyStatDto>>("/me/keys", ApiHelpers.Json);

        Assert.Equal(HttpStatusCode.Created, submit.StatusCode);
        var expectedHits = passage.Text.Count(c => KeyAccuracy.Normalize(c) == first);
        var stat = keys!.Single(k => k.Character == first);
        Assert.Equal(expectedHits, stat.Hits);
        Assert.Equal(1, stat.Misses);
        Assert.Equal(passage.Text.Length, keys!.Sum(k => k.Hits));
    }

    [Fact]
    public async Task POL_2_HasilDitolak_TidakMenambahKeyStat()
    {
        using var client = await factory.CreatePlayerClientAsync();
        var passage = TestLogs.SeedPassage();

        var rejected = await client.PostAsJsonAsync("/results", TestLogs.Request(passage.Id, TestLogs.Human(passage.Text, 400)));
        var keys = await client.GetFromJsonAsync<List<KeyStatDto>>("/me/keys", ApiHelpers.Json);

        Assert.Equal(HttpStatusCode.BadRequest, rejected.StatusCode);
        Assert.Empty(keys!);
    }

    [Fact]
    public async Task POL_2_MeKeys_UrutHurufPalingSeringSalah()
    {
        using var client = await factory.CreatePlayerClientAsync();
        var passage = TestLogs.SeedPassage();
        // Salah ketik setiap kali harus mengetik huruf 'k' (lebih banyak salah daripada huruf lain).
        var log = new List<KeystrokeDto>();
        long t = 0;
        var random = new Random(3);
        foreach (var ch in passage.Text)
        {
            if (char.ToLowerInvariant(ch) == 'k')
            {
                log.Add(new KeystrokeDto("j", t += 150 + random.Next(100)));
                log.Add(new KeystrokeDto("Backspace", t += 150 + random.Next(100)));
            }
            log.Add(new KeystrokeDto(ch.ToString(), t += 150 + random.Next(100)));
        }
        Assert.Contains('k', passage.Text.ToLowerInvariant());

        var submit = await client.PostAsJsonAsync("/results", TestLogs.Request(passage.Id, log));
        var keys = await client.GetFromJsonAsync<List<KeyStatDto>>("/me/keys", ApiHelpers.Json);

        Assert.Equal(HttpStatusCode.Created, submit.StatusCode);
        Assert.Equal("k", keys![0].Character);
        Assert.Equal(0.5, keys[0].MissRate);
        Assert.All(keys.Skip(1), k => Assert.Equal(0, k.Misses));
    }

    [Theory]
    [InlineData("/me/keys")]
    [InlineData("/me/settings")]
    public async Task POL_2_POL_4_TanpaToken401(string path)
    {
        using var client = factory.CreateClient();

        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync(path)).StatusCode);
    }

    [Fact]
    public async Task POL_4_Settings_DefaultLaluSimpan()
    {
        using var client = await factory.CreatePlayerClientAsync();
        using var other = await factory.CreatePlayerClientAsync();

        var initial = await client.GetFromJsonAsync<SettingsDto>("/me/settings", ApiHelpers.Json);
        var saved = await client.PutAsJsonAsync("/me/settings",
            new { language = "en", difficulty = "hard", botLevel = "advanced", carColor = "#1D7FF2", useGhost = true, muted = true });
        var reloaded = await client.GetFromJsonAsync<SettingsDto>("/me/settings", ApiHelpers.Json);
        var otherSettings = await other.GetFromJsonAsync<SettingsDto>("/me/settings", ApiHelpers.Json);

        Assert.Equal(SettingsService.Defaults, initial);
        Assert.Equal(HttpStatusCode.OK, saved.StatusCode);
        Assert.Equal(new SettingsDto("en", "hard", "advanced", "#1d7ff2", UseGhost: true, Muted: true), reloaded);
        Assert.Equal(SettingsService.Defaults, otherSettings); // pengaturan per pemain
    }

    [Theory]
    [InlineData("jp", "easy", "beginner", "#ffffff")]
    [InlineData("id", "ekstrem", "beginner", "#ffffff")]
    [InlineData("id", "easy", "dewa", "#ffffff")]
    [InlineData("id", "easy", "beginner", "merah")]
    [InlineData("id", "easy", "beginner", "#fff")]
    public async Task POL_4_Settings_InputTidakValid400(string language, string difficulty, string botLevel, string carColor)
    {
        using var client = await factory.CreatePlayerClientAsync();

        var response = await client.PutAsJsonAsync("/me/settings", new { language, difficulty, botLevel, carColor });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
