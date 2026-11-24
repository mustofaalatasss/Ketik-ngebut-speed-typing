using KetikNgebut.Application.Ghosts;
using KetikNgebut.Application.Leaderboard;
using KetikNgebut.Application.Options;
using KetikNgebut.Application.Passages;
using KetikNgebut.Application.Players;
using KetikNgebut.Application.Results;
using KetikNgebut.Application.Stats;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace KetikNgebut.Application;

public static class DependencyInjection
{
    /// <summary>
    /// Mendaftarkan service Application ke container DI. "Scoped" = satu instance per request HTTP,
    /// sama umurnya dengan DbContext yang dipakai service itu.
    /// </summary>
    public static IServiceCollection AddApplication(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<TypingOptions>(configuration.GetSection(TypingOptions.Section));
        services.Configure<ResultValidationOptions>(configuration.GetSection(ResultValidationOptions.Section));
        services.Configure<LeaderboardOptions>(configuration.GetSection(LeaderboardOptions.Section));
        services.Configure<StatsOptions>(configuration.GetSection(StatsOptions.Section));
        services.Configure<JwtOptions>(configuration.GetSection(JwtOptions.Section));

        services.AddScoped<PlayerService>();
        services.AddScoped<KeyStatsService>();
        services.AddScoped<SettingsService>();
        services.AddScoped<PassageService>();
        services.AddScoped<ResultService>();
        services.AddScoped<LeaderboardService>();
        services.AddScoped<StatsService>();
        services.AddScoped<GhostService>();
        return services;
    }
}
