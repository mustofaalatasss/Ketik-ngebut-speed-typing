using KetikNgebut.Application.Common;
using KetikNgebut.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace KetikNgebut.Application.Players;

public sealed record SettingsDto(string Language, string Difficulty, string BotLevel, string CarColor, bool UseGhost, bool Muted);

public sealed record SettingsRequest(string? Language, string? Difficulty, string? BotLevel, string? CarColor, bool? UseGhost, bool? Muted);

/// <summary>POL-4: pengaturan per pemain (bahasa, tingkat, tingkat lawan, warna mobil, ghost, suara).</summary>
public sealed class SettingsService(IAppDbContext db, TimeProvider time)
{
    /// <summary>Nilai bawaan bila pemain belum pernah menyimpan pengaturan (sama dengan default frontend).</summary>
    public static readonly SettingsDto Defaults = new("id", "easy", "intermediate", "#e63946", UseGhost: false, Muted: false);

    public async Task<SettingsDto> GetAsync(Guid playerId, CancellationToken ct)
    {
        var s = await db.PlayerSettings.AsNoTracking().FirstOrDefaultAsync(x => x.PlayerId == playerId, ct);
        return s is null ? Defaults : ToDto(s);
    }

    public async Task<Result<SettingsDto>> SaveAsync(Guid playerId, SettingsRequest request, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(request);
        var errors = new Dictionary<string, string[]>();
        if (request.Language is null || !Passage.Languages.Contains(request.Language))
            errors["language"] = [$"language harus salah satu dari: {string.Join(", ", Passage.Languages)}."];
        if (request.Difficulty is null || !Passage.Difficulties.Contains(request.Difficulty))
            errors["difficulty"] = [$"difficulty harus salah satu dari: {string.Join(", ", Passage.Difficulties)}."];
        if (request.BotLevel is null || !PlayerSettings.BotLevels.Contains(request.BotLevel))
            errors["botLevel"] = [$"botLevel harus salah satu dari: {string.Join(", ", PlayerSettings.BotLevels)}."];
        if (!PlayerSettings.IsValidColor(request.CarColor))
            errors["carColor"] = ["carColor harus berformat #rrggbb."];
        if (errors.Count > 0) return AppError.Validation(errors);

        var s = await db.PlayerSettings.FirstOrDefaultAsync(x => x.PlayerId == playerId, ct);
        if (s is null)
        {
            s = new PlayerSettings
            {
                PlayerId = playerId,
                Language = request.Language!,
                Difficulty = request.Difficulty!,
                BotLevel = request.BotLevel!,
                CarColor = request.CarColor!.ToLowerInvariant(),
            };
            db.PlayerSettings.Add(s);
        }
        s.Language = request.Language!;
        s.Difficulty = request.Difficulty!;
        s.BotLevel = request.BotLevel!;
        s.CarColor = request.CarColor!.ToLowerInvariant();
        s.UseGhost = request.UseGhost ?? false;
        s.Muted = request.Muted ?? false;
        s.UpdatedAt = time.GetUtcNow().UtcDateTime;
        await db.SaveChangesAsync(ct);
        return ToDto(s);
    }

    private static SettingsDto ToDto(PlayerSettings s) =>
        new(s.Language, s.Difficulty, s.BotLevel, s.CarColor, s.UseGhost, s.Muted);
}
