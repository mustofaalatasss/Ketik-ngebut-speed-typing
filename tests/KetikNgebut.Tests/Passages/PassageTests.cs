using System.Net;
using System.Net.Http.Json;
using KetikNgebut.Application.Passages;
using KetikNgebut.Infrastructure.Persistence;
using KetikNgebut.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace KetikNgebut.Tests.Passages;

public sealed class PassageTests
{
    [Fact]
    public async Task PAS_1_SeedDariPassagesJson()
    {
        using var f = new ApiFactory();
        f.CreateClient().Dispose(); // memicu startup (migration + seed)

        var ids = await f.WithDbAsync(db => db.Passages.Select(p => p.Id).OrderBy(id => id).ToListAsync());

        Assert.Equal(DbInitializer.LoadSeedPassages().Select(p => p.Id).Order(), ids);
        Assert.Contains("id-easy-1", ids);
    }

    [Theory]
    [InlineData("id", "easy")]
    [InlineData("en", "hard")]
    public async Task PAS_1_RandomSesuaiBahasaDanKesulitan_Publik(string lang, string difficulty)
    {
        using var f = new ApiFactory();
        using var guest = f.CreateClient();

        for (var i = 0; i < 5; i++)
        {
            var p = await guest.GetFromJsonAsync<PassageDto>($"/passages/random?lang={lang}&difficulty={difficulty}", ApiHelpers.Json);
            Assert.Equal(lang, p!.Language);
            Assert.Equal(difficulty, p.Difficulty);
            Assert.False(string.IsNullOrEmpty(p.Text));
        }
    }

    [Theory]
    [InlineData("lang=jp&difficulty=easy")]
    [InlineData("lang=id&difficulty=mustahil")]
    [InlineData("")]
    public async Task PAS_1_ParameterTidakValid_400(string query)
    {
        using var f = new ApiFactory();
        using var guest = f.CreateClient();

        var response = await guest.GetAsync($"/passages/random?{query}");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PAS_1_HanyaTeksAktif()
    {
        using var f = new ApiFactory();
        using var admin = await f.CreateAdminClientAsync();
        var all = (await admin.GetFromJsonAsync<List<AdminPassageDto>>("/passages", ApiHelpers.Json))!;
        foreach (var p in all.Where(p => p.Language == "id" && p.Difficulty == "hard"))
        {
            var r = await admin.PutAsJsonAsync($"/passages/{p.Id}", new { p.Text, p.Language, p.Difficulty, isActive = false });
            Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        }

        var none = await admin.GetAsync("/passages/random?lang=id&difficulty=hard");
        var created = await admin.PostAsJsonAsync("/passages", new { text = "Satu-satunya teks sulit yang masih aktif.", language = "id", difficulty = "hard" });
        var createdBody = await created.Content.ReadFromJsonAsync<AdminPassageDto>(ApiHelpers.Json);
        var picked = await admin.GetFromJsonAsync<PassageDto>("/passages/random?lang=id&difficulty=hard", ApiHelpers.Json);

        Assert.Equal(HttpStatusCode.NotFound, none.StatusCode);
        Assert.Equal(createdBody!.Id, picked!.Id);
    }

    [Fact]
    public async Task PAS_2_AdminTambahUbahNonaktifkan()
    {
        using var f = new ApiFactory();
        using var admin = await f.CreateAdminClientAsync();

        var created = await admin.PostAsJsonAsync("/passages", new { text = "Teks latihan baru dari admin.", language = "en", difficulty = "medium" });
        var p = (await created.Content.ReadFromJsonAsync<AdminPassageDto>(ApiHelpers.Json))!;
        var updated = await admin.PutAsJsonAsync($"/passages/{p.Id}", new { text = "Teks latihan baru dari admin, diubah.", language = "en", difficulty = "hard", isActive = true });
        var updatedBody = (await updated.Content.ReadFromJsonAsync<AdminPassageDto>(ApiHelpers.Json))!;
        var deactivated = await admin.PutAsJsonAsync($"/passages/{p.Id}", new { updatedBody.Text, updatedBody.Language, updatedBody.Difficulty, isActive = false });
        var list = (await admin.GetFromJsonAsync<List<AdminPassageDto>>("/passages", ApiHelpers.Json))!;

        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        Assert.StartsWith("en-medium-", p.Id, StringComparison.Ordinal);
        Assert.True(p.IsActive);
        Assert.Equal(HttpStatusCode.OK, updated.StatusCode);
        Assert.Equal("hard", updatedBody.Difficulty);
        Assert.Equal(HttpStatusCode.OK, deactivated.StatusCode);
        Assert.False(list.Single(x => x.Id == p.Id).IsActive);
    }

    [Fact]
    public async Task PAS_2_HapusTeksBelumDipakai_Dihapus()
    {
        using var f = new ApiFactory();
        using var admin = await f.CreateAdminClientAsync();
        var created = await admin.PostAsJsonAsync("/passages", new { text = "Teks yang akan dihapus.", language = "id", difficulty = "easy" });
        var p = (await created.Content.ReadFromJsonAsync<AdminPassageDto>(ApiHelpers.Json))!;

        var deleted = await admin.DeleteAsync($"/passages/{p.Id}");
        var body = (await deleted.Content.ReadFromJsonAsync<DeletePassageResponse>(ApiHelpers.Json))!;
        var exists = await f.WithDbAsync(db => db.Passages.AnyAsync(x => x.Id == p.Id));

        Assert.True(body.Deleted);
        Assert.False(exists);
    }

    [Fact]
    public async Task PAS_2_HapusTeksTerpakai_HanyaDinonaktifkan()
    {
        using var f = new ApiFactory();
        var passage = TestLogs.SeedPassage("id-easy-3");
        using var player = await f.CreatePlayerClientAsync();
        var submitted = await player.PostAsJsonAsync("/results", TestLogs.Request(passage.Id, TestLogs.Human(passage.Text, 60)));
        using var admin = await f.CreateAdminClientAsync();

        var deleted = await admin.DeleteAsync($"/passages/{passage.Id}");
        var body = (await deleted.Content.ReadFromJsonAsync<DeletePassageResponse>(ApiHelpers.Json))!;
        var stored = await f.WithDbAsync(db => db.Passages.SingleAsync(x => x.Id == passage.Id));

        Assert.Equal(HttpStatusCode.Created, submitted.StatusCode);
        Assert.Equal(HttpStatusCode.OK, deleted.StatusCode);
        Assert.False(body.Deleted);
        Assert.False(stored.IsActive);
    }

    [Fact]
    public async Task PAS_2_UbahIsiTeksTerpakai_409_TetapiBolehAktifkanLagi()
    {
        using var f = new ApiFactory();
        var passage = TestLogs.SeedPassage("id-easy-4");
        using var player = await f.CreatePlayerClientAsync();
        await player.PostAsJsonAsync("/results", TestLogs.Request(passage.Id, TestLogs.Human(passage.Text, 60)));
        using var admin = await f.CreateAdminClientAsync();

        var changeText = await admin.PutAsJsonAsync($"/passages/{passage.Id}", new { text = passage.Text + " Tambahan.", passage.Language, passage.Difficulty, isActive = true });
        var deactivate = await admin.PutAsJsonAsync($"/passages/{passage.Id}", new { passage.Text, passage.Language, passage.Difficulty, isActive = false });
        var reactivate = await admin.PutAsJsonAsync($"/passages/{passage.Id}", new { passage.Text, passage.Language, passage.Difficulty, isActive = true });

        Assert.Equal(HttpStatusCode.Conflict, changeText.StatusCode);
        Assert.Equal(HttpStatusCode.OK, deactivate.StatusCode);
        Assert.Equal(HttpStatusCode.OK, reactivate.StatusCode);
    }

    [Theory]
    [InlineData("pendek", "id", "easy")]
    [InlineData("Teks dengan karakter non-ASCII: kopi ☕ pagi.", "id", "easy")]
    [InlineData("  Spasi di awal tidak boleh.", "id", "easy")]
    [InlineData("Bahasa yang tidak dikenal.", "jp", "easy")]
    [InlineData("Tingkat yang tidak dikenal.", "id", "ekstrem")]
    public async Task PAS_2_InputTidakValid_400(string text, string language, string difficulty)
    {
        using var f = new ApiFactory();
        using var admin = await f.CreateAdminClientAsync();

        var response = await admin.PostAsJsonAsync("/passages", new { text, language, difficulty });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PAS_2_UbahTeksTidakAda_404()
    {
        using var f = new ApiFactory();
        using var admin = await f.CreateAdminClientAsync();

        var response = await admin.PutAsJsonAsync("/passages/tidak-ada", new { text = "Teks yang cukup panjang.", language = "id", difficulty = "easy" });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
