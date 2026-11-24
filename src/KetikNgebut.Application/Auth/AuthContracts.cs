using KetikNgebut.Application.Common;

namespace KetikNgebut.Application.Auth;

public static class Roles
{
    public const string Player = "Player";
    public const string Admin = "Admin";
}

public sealed record LoginRequest(string? Email, string? Password);

public sealed record RefreshRequest(string? RefreshToken);

public sealed record UserDto(Guid Id, string Email, string DisplayName, IReadOnlyList<string> Roles);

public sealed record AuthResponse(
    string AccessToken,
    DateTime AccessTokenExpiresAt,
    string RefreshToken,
    DateTime RefreshTokenExpiresAt,
    UserDto User);

/// <summary>Sesi admin (ACC-2, ACC-3, ACC-4). Hanya akun ber-role Admin yang bisa login; pemain memakai nickname.
/// Implementasi memakai ASP.NET Core Identity di Infrastructure.</summary>
public interface IAuthService
{
    Task<Result<AuthResponse>> LoginAsync(LoginRequest request, CancellationToken ct);
    Task<Result<AuthResponse>> RefreshAsync(RefreshRequest request, CancellationToken ct);
    Task LogoutAsync(Guid userId, RefreshRequest request, CancellationToken ct);
}
