namespace KetikNgebut.Domain.Entities;

/// <summary>
/// Pemain tanpa akun (ACC-1): cukup nickname unik. Kepemilikan nickname dibuktikan dengan token rahasia
/// acak yang disimpan di browser; server hanya menyimpan hash-nya (ACC-2).
/// </summary>
public sealed class Player
{
    public const int MinNicknameLength = 3;
    public const int MaxNicknameLength = 24;

    public Guid Id { get; init; }
    public required string Nickname { get; init; }
    public required string TokenHash { get; init; }
    public DateTime CreatedAt { get; init; }
    public bool IsActive { get; set; } = true;

    /// <summary>Huruf, angka, spasi, _ - . ; tanpa spasi di awal/akhir atau spasi ganda.</summary>
    public static bool IsValidNickname(string? nickname) =>
        nickname is not null
        && nickname.Length >= MinNicknameLength
        && nickname.Length <= MaxNicknameLength
        && nickname == nickname.Trim()
        && !nickname.Contains("  ", StringComparison.Ordinal)
        && nickname.All(c => char.IsAsciiLetterOrDigit(c) || c is '_' or '-' or '.' or ' ');
}
