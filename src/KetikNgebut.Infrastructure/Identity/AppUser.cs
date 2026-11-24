using Microsoft.AspNetCore.Identity;

namespace KetikNgebut.Infrastructure.Identity;

/// <summary>
/// User aplikasi. IdentityUser sudah berisi Email, PasswordHash (hash PBKDF2, bukan password asli),
/// penghitung login gagal, dan lockout. Kita menambah DisplayName dan IsActive (PRD §11).
/// </summary>
public sealed class AppUser : IdentityUser<Guid>
{
    public const int MinDisplayNameLength = 3;
    public const int MaxDisplayNameLength = 24;

    public string DisplayName { get; set; } = "";
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
}
