using System.Security.Claims;
using System.Threading.RateLimiting;
using KetikNgebut.Application.Auth;
using KetikNgebut.Application.Options;
using KetikNgebut.Infrastructure.Identity;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace KetikNgebut.Api;

public static class Policies
{
    public const string Player = "Player";
    public const string Admin = "Admin";

    public const string LoginLimit = "login";
    public const string AuthLimit = "auth";
    public const string PlayersLimit = "players";
    public const string ResultsLimit = "results";
}

public sealed class RateLimitRule
{
    public int PermitLimit { get; set; }
    public int WindowSeconds { get; set; } = 60;
}

public sealed class RateLimitOptions
{
    public const string Section = "RateLimit";
    public RateLimitRule Login { get; set; } = new() { PermitLimit = 5 };
    public RateLimitRule Auth { get; set; } = new() { PermitLimit = 20 };
    public RateLimitRule Results { get; set; } = new() { PermitLimit = 30 };
    public RateLimitRule Players { get; set; } = new() { PermitLimit = 5, WindowSeconds = 3600 };
}

public static class SecurityExtensions
{
    public static IServiceCollection AddJwtAuth(this IServiceCollection services, JwtOptions jwt)
    {
        var signingKey = TokenService.CreateSigningKey(jwt); // melempar exception bila kunci tidak ada / terlalu pendek

        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(o =>
            {
                o.MapInboundClaims = false; // klaim tetap bernama "sub", "role", "name"
                o.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidIssuer = jwt.Issuer,
                    ValidateAudience = true,
                    ValidAudience = jwt.Audience,
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = signingKey,
                    ValidAlgorithms = [SecurityAlgorithms.HmacSha256],
                    ValidateLifetime = true,
                    RequireExpirationTime = true,
                    ClockSkew = TimeSpan.Zero, // token kedaluwarsa langsung ditolak
                    NameClaimType = TokenService.NameClaim,
                    RoleClaimType = TokenService.RoleClaim,
                };
            })
            .AddScheme<AuthenticationSchemeOptions, PlayerTokenAuthenticationHandler>(PlayerTokenAuthenticationHandler.SchemeName, null);

        // Role dicek di server. Pemain = token nickname; Admin = JWT. Policy Admin juga membaca token pemain
        // agar pemain yang mencoba endpoint admin mendapat 403 (dikenali tapi tidak berhak), bukan 401.
        services.AddAuthorizationBuilder()
            .AddPolicy(Policies.Player, p => p
                .AddAuthenticationSchemes(PlayerTokenAuthenticationHandler.SchemeName)
                .RequireAuthenticatedUser()
                .RequireRole(Roles.Player))
            .AddPolicy(Policies.Admin, p => p
                .AddAuthenticationSchemes(JwtBearerDefaults.AuthenticationScheme, PlayerTokenAuthenticationHandler.SchemeName)
                .RequireAuthenticatedUser()
                .RequireRole(Roles.Admin));
        return services;
    }

    /// <summary>ACC-4: batas percobaan per IP (login admin, refresh, klaim nickname) dan per pemain (kirim hasil).</summary>
    public static IServiceCollection AddLoginRateLimiting(this IServiceCollection services, IConfiguration configuration)
    {
        var limits = configuration.GetSection(RateLimitOptions.Section).Get<RateLimitOptions>() ?? new RateLimitOptions();

        services.AddRateLimiter(o =>
        {
            o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            o.AddPolicy(Policies.LoginLimit, ctx => FixedWindow(ClientIp(ctx), limits.Login));
            o.AddPolicy(Policies.AuthLimit, ctx => FixedWindow(ClientIp(ctx), limits.Auth));
            o.AddPolicy(Policies.PlayersLimit, ctx => FixedWindow(ClientIp(ctx), limits.Players));
            o.AddPolicy(Policies.ResultsLimit, ctx => FixedWindow(ctx.User.FindFirstValue(JwtRegisteredClaimNames.Sub) ?? ClientIp(ctx), limits.Results));
            o.OnRejected = async (context, ct) =>
            {
                var http = context.HttpContext;
                if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
                    http.Response.Headers.RetryAfter = ((int)Math.Ceiling(retryAfter.TotalSeconds)).ToString(System.Globalization.CultureInfo.InvariantCulture);

                var problems = http.RequestServices.GetRequiredService<IProblemDetailsService>();
                await problems.WriteAsync(new ProblemDetailsContext
                {
                    HttpContext = http,
                    ProblemDetails = new ProblemDetails
                    {
                        Status = StatusCodes.Status429TooManyRequests,
                        Title = "Terlalu banyak percobaan",
                        Detail = "Coba lagi beberapa saat lagi.",
                    },
                });
            };
        });
        return services;
    }

    public static Guid GetUserId(this ClaimsPrincipal user)
    {
        ArgumentNullException.ThrowIfNull(user);
        return Guid.Parse(user.FindFirstValue(JwtRegisteredClaimNames.Sub)
            ?? throw new InvalidOperationException("Token tanpa klaim sub."));
    }

    private static string ClientIp(HttpContext ctx) => ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown";

    private static RateLimitPartition<string> FixedWindow(string key, RateLimitRule rule) =>
        RateLimitPartition.GetFixedWindowLimiter(key, _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = rule.PermitLimit,
            Window = TimeSpan.FromSeconds(rule.WindowSeconds),
            QueueLimit = 0,
        });
}
