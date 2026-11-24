namespace KetikNgebut.Application.Results;

public sealed record KeystrokeDto(string? Key, long T);

/// <summary>
/// RES-1: yang dikirim klien hanya id teks, log keystroke, dan durasi. Field lain (wpm, accuracy, ...)
/// tidak ada di record ini, sehingga otomatis diabaikan saat JSON dibaca (RES-2).
/// </summary>
public sealed record SubmitResultRequest(string? PassageId, long? DurationMs, IReadOnlyList<KeystrokeDto>? Log, string? Mode);

public sealed record ResultResponse(
    long Id,
    string PassageId,
    string Mode,
    double Wpm,
    double Accuracy,
    double NetWpm,
    long DurationMs,
    int CorrectChars,
    int TotalKeystrokes,
    DateTime CreatedAt,
    bool IsValid);
