namespace KetikNgebut.Domain.Entities;

/// <summary>Refresh token. Yang disimpan hanya hash SHA-256-nya, bukan token asli.</summary>
public sealed class RefreshToken
{
    public long Id { get; init; }
    public required Guid UserId { get; init; }
    public required string TokenHash { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime ExpiresAt { get; init; }
    public DateTime? RevokedAt { get; set; }

    public bool IsActive(DateTime nowUtc) => RevokedAt is null && nowUtc < ExpiresAt;
}
