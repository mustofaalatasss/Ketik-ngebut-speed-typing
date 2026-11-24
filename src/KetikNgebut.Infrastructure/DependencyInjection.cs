using KetikNgebut.Application.Auth;
using KetikNgebut.Application.Common;
using KetikNgebut.Infrastructure.Identity;
using KetikNgebut.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace KetikNgebut.Infrastructure;

public sealed class AuthLockoutOptions
{
    public const string Section = "Auth:Lockout";
    public int MaxFailedAttempts { get; set; } = 5;
    public int LockoutMinutes { get; set; } = 5;
}

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services, IConfiguration configuration, string contentRootPath)
    {
        var connectionString = ResolveConnectionString(
            configuration.GetConnectionString("Default")
                ?? throw new InvalidOperationException("ConnectionStrings:Default wajib diisi."),
            contentRootPath);

        // AddDbContext mendaftarkan AppDbContext sebagai "scoped": satu instance per request HTTP.
        services.AddDbContext<AppDbContext>(o => o.UseSqlite(connectionString));
        services.AddScoped<IAppDbContext>(sp => sp.GetRequiredService<AppDbContext>());

        services.Configure<SeedOptions>(configuration.GetSection(SeedOptions.Section));
        var lockout = configuration.GetSection(AuthLockoutOptions.Section).Get<AuthLockoutOptions>() ?? new AuthLockoutOptions();

        // AddIdentityCore: hanya bagian inti Identity (user, password hash, role, lockout) tanpa cookie/UI,
        // karena autentikasi kita memakai JWT.
        services.AddIdentityCore<AppUser>(o =>
            {
                o.User.RequireUniqueEmail = true;
                o.Password.RequiredLength = 8;
                o.Password.RequireDigit = true;
                o.Password.RequireLowercase = false;
                o.Password.RequireUppercase = false;
                o.Password.RequireNonAlphanumeric = false;
                o.Lockout.AllowedForNewUsers = true;
                o.Lockout.MaxFailedAccessAttempts = lockout.MaxFailedAttempts;
                o.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(lockout.LockoutMinutes);
            })
            .AddRoles<IdentityRole<Guid>>()
            .AddEntityFrameworkStores<AppDbContext>();

        services.AddScoped<TokenService>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<DbInitializer>();
        return services;
    }

    /// <summary>Path relatif di connection string dianggap relatif terhadap folder aplikasi, dan foldernya dibuat bila belum ada.</summary>
    private static string ResolveConnectionString(string connectionString, string contentRootPath)
    {
        var builder = new SqliteConnectionStringBuilder(connectionString);
        var dataSource = builder.DataSource;
        var isMemory = builder.Mode == SqliteOpenMode.Memory
            || dataSource == ":memory:"
            || dataSource.StartsWith("file:", StringComparison.OrdinalIgnoreCase);
        if (isMemory || string.IsNullOrEmpty(dataSource)) return connectionString;

        var fullPath = Path.IsPathRooted(dataSource) ? dataSource : Path.GetFullPath(Path.Combine(contentRootPath, dataSource));
        Directory.CreateDirectory(Path.GetDirectoryName(fullPath)!);
        builder.DataSource = fullPath;
        return builder.ToString();
    }
}
