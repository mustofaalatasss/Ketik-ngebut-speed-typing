using KetikNgebut.Application.Common;
using KetikNgebut.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace KetikNgebut.Application.Players;

public sealed record ClaimNicknameRequest(string? Nickname);

public sealed record PlayerDto(Guid Id, string Nickname);

/// <summary>PlayerToken hanya dikirim sekali, saat nickname diklaim. Klien menyimpannya di localStorage.</summary>
public sealed record ClaimNicknameResponse(PlayerDto Player, string PlayerToken);

/// <summary>ACC-1 dan ACC-2: pemain cukup memilih nickname unik; kepemilikannya dibuktikan dengan token rahasia.</summary>
public sealed class PlayerService(IAppDbContext db, TimeProvider time)
{
    public async Task<Result<ClaimNicknameResponse>> ClaimAsync(ClaimNicknameRequest request, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(request);
        var nickname = request.Nickname?.Trim();
        if (!Player.IsValidNickname(nickname))
        {
            return AppError.Validation("nickname",
                $"Nickname {Player.MinNicknameLength}-{Player.MaxNicknameLength} karakter: huruf, angka, spasi, _ - .");
        }

        // Kolom Nickname memakai collation NOCASE: "Rina" dan "rina" dianggap sama.
        if (await db.Players.AnyAsync(p => p.Nickname == nickname, ct))
            return AppError.Conflict("Nickname sudah dipakai", "Pilih nickname lain.");

        var token = SecureTokens.Create();
        var player = new Player
        {
            Id = Guid.NewGuid(),
            Nickname = nickname!,
            TokenHash = SecureTokens.Hash(token),
            CreatedAt = time.GetUtcNow().UtcDateTime,
        };
        db.Players.Add(player);
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            // Dua klaim bersamaan untuk nickname yang sama: indeks unik di database menolak yang kedua.
            return AppError.Conflict("Nickname sudah dipakai", "Pilih nickname lain.");
        }

        return new ClaimNicknameResponse(new PlayerDto(player.Id, player.Nickname), token);
    }

    /// <summary>Mencari pemain aktif dari token (dipakai authentication handler). Null bila token tidak dikenal.</summary>
    public async Task<PlayerDto?> FindByTokenAsync(string token, CancellationToken ct)
    {
        var hash = SecureTokens.Hash(token);
        return await db.Players.AsNoTracking()
            .Where(p => p.TokenHash == hash && p.IsActive)
            .Select(p => new PlayerDto(p.Id, p.Nickname))
            .FirstOrDefaultAsync(ct);
    }
}
