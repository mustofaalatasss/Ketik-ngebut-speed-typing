using KetikNgebut.Api;
using KetikNgebut.Api.Endpoints;
using KetikNgebut.Application;
using KetikNgebut.Application.Options;
using KetikNgebut.Infrastructure;
using KetikNgebut.Infrastructure.Persistence;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Http.Json;

var builder = WebApplication.CreateBuilder(args);

// Batas ukuran body request (default Kestrel 30 MB terlalu besar untuk VPS 1 GB). Log keystroke terbesar
// yang sah (5000 entri) kurang dari 200 KB.
builder.WebHost.ConfigureKestrel(o =>
    o.Limits.MaxRequestBodySize = builder.Configuration.GetValue<long?>("Limits:MaxRequestBodyBytes") ?? 512 * 1024);

// Dependency injection: layanan didaftarkan di builder.Services, lalu dipakai oleh middleware/endpoint.
builder.Services.AddProblemDetails();
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.Configure<RouteHandlerOptions>(o => o.ThrowOnBadRequest = false); // JSON rusak -> 400, bukan 500
builder.Services.Configure<JsonOptions>(o => o.SerializerOptions.MaxDepth = 16);

builder.Services.AddApplication(builder.Configuration);
builder.Services.AddInfrastructure(builder.Configuration, builder.Environment.ContentRootPath);
builder.Services.AddHealthChecks().AddDbContextCheck<AppDbContext>();

// Gagal start bila Jwt:SigningKey tidak ada: lebih baik ketahuan saat deploy daripada memakai kunci kosong.
var jwtOptions = builder.Configuration.GetSection(JwtOptions.Section).Get<JwtOptions>() ?? new JwtOptions();
builder.Services.AddJwtAuth(jwtOptions);
builder.Services.AddLoginRateLimiting(builder.Configuration);

var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p
    .WithOrigins(allowedOrigins)
    .WithHeaders("Authorization", "Content-Type", PlayerTokenAuthenticationHandler.HeaderName)
    .WithMethods("GET", "POST", "PUT", "DELETE")));

var app = builder.Build();

// Di belakang Nginx (Fase 5): IP asli klien dari X-Forwarded-For, hanya bila proxy-nya localhost (default).
app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto,
});
app.UseExceptionHandler();
app.UseStatusCodePages(); // 401/403/404 tanpa body -> ProblemDetails
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

// GET /health -> 200 "Healthy" selama semua health check (termasuk koneksi database) lulus.
app.MapHealthChecks("/health");
app.MapPlayerEndpoints();
app.MapAuthEndpoints();
app.MapPassageEndpoints();
app.MapResultEndpoints();
app.MapLeaderboardEndpoints();
app.MapStatsEndpoints();
app.MapGhostEndpoints();

// Migration, mode WAL, dan seed (teks dari passages.json, admin dari konfigurasi).
await using (var scope = app.Services.CreateAsyncScope())
{
    await scope.ServiceProvider.GetRequiredService<DbInitializer>().InitializeAsync();
}

await app.RunAsync();

// Membuat kelas Program (dari top-level statements) bisa diakses WebApplicationFactory di proyek test.
public partial class Program;
