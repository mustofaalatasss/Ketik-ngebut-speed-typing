using System.Net;
using KetikNgebut.Tests.Infrastructure;

namespace KetikNgebut.Tests;

// IClassFixture: satu ApiFactory (server in-memory) dipakai bersama oleh semua test di kelas ini.
public sealed class HealthTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    [Fact]
    public async Task SETUP_Health_Get_Mengembalikan200Healthy()
    {
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/health");
        var body = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("Healthy", body);
    }
}
