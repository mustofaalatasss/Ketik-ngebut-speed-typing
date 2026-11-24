using KetikNgebut.Application.Auth;
using KetikNgebut.Application.Common;
using KetikNgebut.Application.Ghosts;
using KetikNgebut.Application.Leaderboard;
using KetikNgebut.Application.Passages;
using KetikNgebut.Application.Players;
using KetikNgebut.Application.Results;
using KetikNgebut.Application.Stats;
using System.Security.Claims;

namespace KetikNgebut.Api.Endpoints;

/// <summary>
/// Endpoint Minimal API (PRD §12). Parameter seperti `IAuthService auth` diisi otomatis oleh DI,
/// body JSON dibaca menjadi record request, dan query string menjadi parameter biasa.
/// </summary>
public static class EndpointMappings
{
    /// <summary>ACC-1: pemain cukup klaim nickname; tidak ada daftar atau login.</summary>
    public static void MapPlayerEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/players", async (ClaimNicknameRequest request, PlayerService service, CancellationToken ct) =>
                (await service.ClaimAsync(request, ct)).ToHttp(v => TypedResults.Created("/players/me", v)))
            .RequireRateLimiting(Policies.PlayersLimit);

        app.MapGet("/players/me", (ClaimsPrincipal user) =>
                TypedResults.Ok(new PlayerDto(user.GetUserId(), user.Identity?.Name ?? "")))
            .RequireAuthorization(Policies.Player);
    }

    /// <summary>Sesi admin (ACC-2). Hanya akun ber-role Admin yang berhasil login.</summary>
    public static void MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var auth = app.MapGroup("/auth");

        auth.MapPost("/login", async (LoginRequest request, IAuthService service, CancellationToken ct) =>
                (await service.LoginAsync(request, ct)).ToHttp(TypedResults.Ok))
            .RequireRateLimiting(Policies.LoginLimit);

        auth.MapPost("/refresh", async (RefreshRequest request, IAuthService service, CancellationToken ct) =>
                (await service.RefreshAsync(request, ct)).ToHttp(TypedResults.Ok))
            .RequireRateLimiting(Policies.AuthLimit);

        auth.MapPost("/logout", async (RefreshRequest request, ClaimsPrincipal user, IAuthService service, CancellationToken ct) =>
            {
                await service.LogoutAsync(user.GetUserId(), request, ct);
                return TypedResults.NoContent();
            })
            .RequireAuthorization(Policies.Admin);
    }

    public static void MapPassageEndpoints(this IEndpointRouteBuilder app)
    {
        // PAS-1: publik.
        app.MapGet("/passages/random", async (string? lang, string? difficulty, PassageService service, CancellationToken ct) =>
            (await service.GetRandomAsync(lang, difficulty, ct)).ToHttp(TypedResults.Ok));

        // PAS-2: hanya Admin.
        var admin = app.MapGroup("/passages").RequireAuthorization(Policies.Admin);

        admin.MapGet("", async (PassageService service, CancellationToken ct) =>
            TypedResults.Ok(await service.ListAsync(ct)));

        admin.MapPost("", async (PassageRequest request, PassageService service, CancellationToken ct) =>
            (await service.CreateAsync(request, ct)).ToHttp(v => TypedResults.Created($"/passages/{v.Id}", v)));

        admin.MapPut("/{id}", async (string id, PassageRequest request, PassageService service, CancellationToken ct) =>
            (await service.UpdateAsync(id, request, ct)).ToHttp(TypedResults.Ok));

        admin.MapDelete("/{id}", async (string id, PassageService service, CancellationToken ct) =>
            (await service.DeleteAsync(id, ct)).ToHttp(TypedResults.Ok));
    }

    public static void MapResultEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/results", async (SubmitResultRequest request, ClaimsPrincipal user, ResultService service, CancellationToken ct) =>
                (await service.SubmitAsync(user.GetUserId(), request, ct)).ToHttp(v => TypedResults.Created($"/results/{v.Id}", v)))
            .RequireAuthorization(Policies.Player)
            .RequireRateLimiting(Policies.ResultsLimit);
    }

    public static void MapLeaderboardEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/leaderboard", async (string? period, int? page, int? pageSize, LeaderboardService service, CancellationToken ct) =>
            (await service.GetAsync(period, page, pageSize, ct)).ToHttp(TypedResults.Ok));
    }

    public static void MapStatsEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/me/stats", async (ClaimsPrincipal user, StatsService service, CancellationToken ct) =>
                TypedResults.Ok(await service.GetAsync(user.GetUserId(), ct)))
            .RequireAuthorization(Policies.Player);

        // POL-2: statistik per huruf (huruf paling sering salah lebih dulu).
        app.MapGet("/me/keys", async (ClaimsPrincipal user, KeyStatsService service, CancellationToken ct) =>
                TypedResults.Ok(await service.GetAsync(user.GetUserId(), ct)))
            .RequireAuthorization(Policies.Player);

        // POL-4: pengaturan per pemain.
        app.MapGet("/me/settings", async (ClaimsPrincipal user, SettingsService service, CancellationToken ct) =>
                TypedResults.Ok(await service.GetAsync(user.GetUserId(), ct)))
            .RequireAuthorization(Policies.Player);

        app.MapPut("/me/settings", async (SettingsRequest request, ClaimsPrincipal user, SettingsService service, CancellationToken ct) =>
                (await service.SaveAsync(user.GetUserId(), request, ct)).ToHttp(TypedResults.Ok))
            .RequireAuthorization(Policies.Player);
    }

    /// <summary>BOT-3: rekaman rekor terbaik pemain sendiri untuk mode ghost.</summary>
    public static void MapGhostEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/me/ghost", async (string? passageId, ClaimsPrincipal user, GhostService service, CancellationToken ct) =>
                (await service.GetBestAsync(user.GetUserId(), passageId, ct)).ToHttp(TypedResults.Ok))
            .RequireAuthorization(Policies.Player);
    }
}

/// <summary>Memetakan Result/AppError ke respons HTTP; error selalu berupa ProblemDetails.</summary>
public static class ResultHttpExtensions
{
    public static IResult ToHttp<T>(this Result<T> result, Func<T, IResult> onSuccess)
    {
        ArgumentNullException.ThrowIfNull(result);
        ArgumentNullException.ThrowIfNull(onSuccess);
        return result.IsSuccess ? onSuccess(result.Value!) : result.Error!.ToProblem();
    }

    public static IResult ToProblem(this AppError error)
    {
        ArgumentNullException.ThrowIfNull(error);
        var status = error.Kind switch
        {
            ErrorKind.Validation => StatusCodes.Status400BadRequest,
            ErrorKind.Unauthorized => StatusCodes.Status401Unauthorized,
            ErrorKind.Forbidden => StatusCodes.Status403Forbidden,
            ErrorKind.NotFound => StatusCodes.Status404NotFound,
            ErrorKind.Conflict => StatusCodes.Status409Conflict,
            _ => StatusCodes.Status500InternalServerError,
        };

        if (error.Errors is not null)
            return TypedResults.ValidationProblem(error.Errors, error.Detail, title: error.Title);

        return TypedResults.Problem(error.Detail, statusCode: status, title: error.Title,
            extensions: error.Extensions?.ToDictionary(kv => kv.Key, kv => kv.Value));
    }
}
