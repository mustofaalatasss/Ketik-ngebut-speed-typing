using KetikNgebut.Application.Auth;
using KetikNgebut.Application.Common;
using KetikNgebut.Application.Options;
using KetikNgebut.Domain.Entities;
using KetikNgebut.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace KetikNgebut.Infrastructure.Identity;

/// <summary>Login khusus admin (ACC-2, ACC-4). Password di-hash oleh UserManager (ASP.NET Core Identity).</summary>
public sealed class AuthService(
    AppDbContext db,
    UserManager<AppUser> users,
    TokenService tokens,
    IOptions<JwtOptions> jwtOptions,
    TimeProvider time) : IAuthService
{
    /// <summary>Satu pesan untuk semua kegagalan login, agar penyerang tidak tahu email mana yang terdaftar (ACC-2).</summary>
    public const string InvalidCredentialsMessage = "Email atau password salah.";

    // Hash palsu untuk menyamakan waktu respons saat email tidak terdaftar (mengurangi timing attack).
    private static readonly Lazy<string> DummyHash =
        new(() => new PasswordHasher<AppUser>().HashPassword(new AppUser(), "dummy-password-for-timing"));

    public async Task<Result<AuthResponse>> LoginAsync(LoginRequest request, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(request);
        var invalid = AppError.Unauthorized(InvalidCredentialsMessage);
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrEmpty(request.Password)) return invalid;

        var user = await users.FindByEmailAsync(request.Email.Trim());
        if (user is null)
        {
            users.PasswordHasher.VerifyHashedPassword(new AppUser(), DummyHash.Value, request.Password);
            return invalid;
        }

        // Akun nonaktif dan akun terkunci (ACC-4) memberi pesan yang sama dengan password salah.
        if (!user.IsActive || await users.IsLockedOutAsync(user)) return invalid;

        if (!await users.CheckPasswordAsync(user, request.Password))
        {
            await users.AccessFailedAsync(user); // menambah hitungan gagal; mengunci akun bila melewati batas
            return invalid;
        }

        // Hanya admin yang login. Pesannya sama agar tidak membocorkan bahwa akun itu ada.
        if (!await users.IsInRoleAsync(user, Roles.Admin)) return invalid;

        await users.ResetAccessFailedCountAsync(user);
        return await IssueTokensAsync(user, ct);
    }

    public async Task<Result<AuthResponse>> RefreshAsync(RefreshRequest request, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(request);
        var invalid = AppError.Unauthorized("Refresh token tidak valid.");
        if (string.IsNullOrWhiteSpace(request.RefreshToken)) return invalid;

        var hash = SecureTokens.Hash(request.RefreshToken);
        var stored = await db.RefreshTokens.FirstOrDefaultAsync(t => t.TokenHash == hash, ct);
        if (stored is null) return invalid;

        var now = time.GetUtcNow().UtcDateTime;
        if (stored.RevokedAt is not null)
        {
            // Token yang sudah dicabut dipakai lagi: kemungkinan dicuri. Cabut semua sesi user ini.
            await RevokeAllAsync(stored.UserId, now, ct);
            return invalid;
        }
        if (!stored.IsActive(now)) return invalid;

        var user = await users.FindByIdAsync(stored.UserId.ToString());
        if (user is null || !user.IsActive || !await users.IsInRoleAsync(user, Roles.Admin)) return invalid;

        // Rotasi: token lama dicabut, token baru diterbitkan.
        stored.RevokedAt = now;
        return await IssueTokensAsync(user, ct);
    }

    public async Task LogoutAsync(Guid userId, RefreshRequest request, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(request);
        if (string.IsNullOrWhiteSpace(request.RefreshToken)) return;

        var hash = SecureTokens.Hash(request.RefreshToken);
        var stored = await db.RefreshTokens.FirstOrDefaultAsync(t => t.TokenHash == hash && t.UserId == userId, ct);
        if (stored is null || stored.RevokedAt is not null) return;

        stored.RevokedAt = time.GetUtcNow().UtcDateTime;
        await db.SaveChangesAsync(ct);
    }

    private async Task RevokeAllAsync(Guid userId, DateTime now, CancellationToken ct)
    {
        var active = await db.RefreshTokens.Where(t => t.UserId == userId && t.RevokedAt == null).ToListAsync(ct);
        foreach (var t in active) t.RevokedAt = now;
        await db.SaveChangesAsync(ct);
    }

    private async Task<AuthResponse> IssueTokensAsync(AppUser user, CancellationToken ct)
    {
        var now = time.GetUtcNow().UtcDateTime;
        var roles = (await users.GetRolesAsync(user)).Order().ToList();
        var (access, accessExpires) = tokens.CreateAccessToken(user.Id, user.Email!, user.DisplayName, roles);

        var refresh = SecureTokens.Create();
        var refreshExpires = now.AddDays(jwtOptions.Value.RefreshTokenDays);

        // Hapus token lama yang sudah kedaluwarsa agar tabel tidak terus membesar (disk VPS terbatas).
        await db.RefreshTokens.Where(t => t.UserId == user.Id && t.ExpiresAt < now).ExecuteDeleteAsync(ct);

        db.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id,
            TokenHash = SecureTokens.Hash(refresh),
            CreatedAt = now,
            ExpiresAt = refreshExpires,
        });
        await db.SaveChangesAsync(ct);

        return new AuthResponse(access, accessExpires, refresh, refreshExpires,
            new UserDto(user.Id, user.Email!, user.DisplayName, roles));
    }
}
