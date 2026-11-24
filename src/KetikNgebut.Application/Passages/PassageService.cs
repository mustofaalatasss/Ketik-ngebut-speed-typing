using KetikNgebut.Application.Common;
using KetikNgebut.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace KetikNgebut.Application.Passages;

public sealed record PassageDto(string Id, string Text, string Language, string Difficulty);

public sealed record AdminPassageDto(string Id, string Text, string Language, string Difficulty, bool IsActive, bool IsUsed);

public sealed record PassageRequest(string? Text, string? Language, string? Difficulty, bool? IsActive);

/// <summary>Hasil DELETE: teks yang pernah dipakai hanya dinonaktifkan (PAS-2).</summary>
public sealed record DeletePassageResponse(string Id, bool Deleted, bool IsActive);

/// <summary>PAS-1 dan PAS-2.</summary>
public sealed class PassageService(IAppDbContext db)
{
    public async Task<Result<PassageDto>> GetRandomAsync(string? language, string? difficulty, CancellationToken ct)
    {
        var errors = new Dictionary<string, string[]>();
        if (language is null || !Passage.Languages.Contains(language))
            errors["lang"] = [$"lang harus salah satu dari: {string.Join(", ", Passage.Languages)}."];
        if (difficulty is null || !Passage.Difficulties.Contains(difficulty))
            errors["difficulty"] = [$"difficulty harus salah satu dari: {string.Join(", ", Passage.Difficulties)}."];
        if (errors.Count > 0) return AppError.Validation(errors);

        // LINQ ke EF Core: query ini diterjemahkan menjadi SQL (WHERE ...) dan baru dijalankan saat CountAsync/FirstAsync.
        var query = db.Passages.AsNoTracking()
            .Where(p => p.IsActive && p.Language == language && p.Difficulty == difficulty);
        var count = await query.CountAsync(ct);
        if (count == 0) return AppError.NotFound("Tidak ada teks aktif untuk bahasa dan tingkat ini");

        var picked = await query.OrderBy(p => p.Id).Skip(Random.Shared.Next(count)).FirstAsync(ct);
        return new PassageDto(picked.Id, picked.Text, picked.Language, picked.Difficulty);
    }

    public async Task<IReadOnlyList<AdminPassageDto>> ListAsync(CancellationToken ct) =>
        await db.Passages.AsNoTracking()
            .OrderBy(p => p.Language).ThenBy(p => p.Difficulty).ThenBy(p => p.Id)
            .Select(p => new AdminPassageDto(
                p.Id, p.Text, p.Language, p.Difficulty, p.IsActive,
                db.RaceResults.Any(r => r.PassageId == p.Id)))
            .ToListAsync(ct);

    public async Task<Result<AdminPassageDto>> CreateAsync(PassageRequest request, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(request);
        var errors = Validate(request);
        if (errors.Count > 0) return AppError.Validation(errors);

        var passage = new Passage
        {
            // Contoh: "id-medium-3f9a2c1b". Id string agar sama formatnya dengan teks bawaan dari JSON.
            Id = $"{request.Language}-{request.Difficulty}-{Guid.NewGuid():N}"[..(request.Language!.Length + request.Difficulty!.Length + 10)],
            Text = request.Text!,
            Language = request.Language,
            Difficulty = request.Difficulty,
            IsActive = request.IsActive ?? true,
        };
        db.Passages.Add(passage);
        await db.SaveChangesAsync(ct);
        return ToAdminDto(passage, isUsed: false);
    }

    public async Task<Result<AdminPassageDto>> UpdateAsync(string id, PassageRequest request, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(request);
        var passage = await db.Passages.FirstOrDefaultAsync(p => p.Id == id, ct);
        if (passage is null) return AppError.NotFound("Teks tidak ditemukan");

        var errors = Validate(request);
        if (errors.Count > 0) return AppError.Validation(errors);

        var isUsed = await db.RaceResults.AnyAsync(r => r.PassageId == id, ct);
        var contentChanged = request.Text != passage.Text
            || request.Language != passage.Language
            || request.Difficulty != passage.Difficulty;
        if (isUsed && contentChanged)
        {
            // Mengubah isi teks yang sudah dipakai akan membuat log lama tidak bisa diputar ulang lagi.
            return AppError.Conflict(
                "Teks sudah pernah dipakai",
                "Teks yang pernah dipakai hanya bisa diaktifkan atau dinonaktifkan. Buat teks baru untuk isi yang berbeda.");
        }

        passage.Text = request.Text!;
        passage.Language = request.Language!;
        passage.Difficulty = request.Difficulty!;
        passage.IsActive = request.IsActive ?? passage.IsActive;
        await db.SaveChangesAsync(ct);
        return ToAdminDto(passage, isUsed);
    }

    public async Task<Result<DeletePassageResponse>> DeleteAsync(string id, CancellationToken ct)
    {
        var passage = await db.Passages.FirstOrDefaultAsync(p => p.Id == id, ct);
        if (passage is null) return AppError.NotFound("Teks tidak ditemukan");

        if (await db.RaceResults.AnyAsync(r => r.PassageId == id, ct))
        {
            passage.IsActive = false;
            await db.SaveChangesAsync(ct);
            return new DeletePassageResponse(id, Deleted: false, IsActive: false);
        }

        db.Passages.Remove(passage);
        await db.SaveChangesAsync(ct);
        return new DeletePassageResponse(id, Deleted: true, IsActive: false);
    }

    private static Dictionary<string, string[]> Validate(PassageRequest request)
    {
        var errors = new Dictionary<string, string[]>();
        var text = request.Text;
        if (text is null || text.Length < Passage.MinTextLength || text.Length > Passage.MaxTextLength)
            errors["text"] = [$"Teks wajib {Passage.MinTextLength} sampai {Passage.MaxTextLength} karakter."];
        else if (!Passage.IsTypeable(text) || text != text.Trim() || text.Contains("  ", StringComparison.Ordinal))
            errors["text"] = ["Teks hanya boleh berisi karakter ASCII yang bisa diketik, tanpa spasi di awal/akhir atau spasi ganda."];
        if (request.Language is null || !Passage.Languages.Contains(request.Language))
            errors["language"] = [$"language harus salah satu dari: {string.Join(", ", Passage.Languages)}."];
        if (request.Difficulty is null || !Passage.Difficulties.Contains(request.Difficulty))
            errors["difficulty"] = [$"difficulty harus salah satu dari: {string.Join(", ", Passage.Difficulties)}."];
        return errors;
    }

    private static AdminPassageDto ToAdminDto(Passage p, bool isUsed) =>
        new(p.Id, p.Text, p.Language, p.Difficulty, p.IsActive, isUsed);
}
