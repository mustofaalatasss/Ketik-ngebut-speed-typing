namespace KetikNgebut.Domain.Entities;

public enum RaceMode
{
    Solo = 0,
    Bot = 1,
    Multiplayer = 2,
}

/// <summary>Alasan hasil ditolak (RES-3). None berarti valid.</summary>
public enum RejectReason
{
    None = 0,
    NotFinished = 1,
    TimeNotMonotonic = 2,
    TimeLimitExceeded = 3,
    DurationMismatch = 4,
    WpmTooHigh = 5,
    InhumanRhythm = 6,
}

/// <summary>Hasil balapan. Semua angka dihitung ulang server dari KeystrokeLog (RES-2).</summary>
public sealed class RaceResult
{
    public long Id { get; init; }
    public required Guid PlayerId { get; init; }
    public required string PassageId { get; init; }
    public RaceMode Mode { get; init; }
    public double Wpm { get; init; }
    public double Accuracy { get; init; }
    public double NetWpm { get; init; }
    public long DurationMs { get; init; }
    public int CorrectChars { get; init; }
    public int TotalKeystrokes { get; init; }

    /// <summary>Log keystroke sebagai JSON: [{"key":"a","t":120}, ...].</summary>
    public required string KeystrokeLog { get; init; }

    /// <summary>Waktu UTC.</summary>
    public DateTime CreatedAt { get; init; }

    /// <summary>Hasil yang ditolak tetap disimpan untuk audit, tapi tidak masuk leaderboard dan statistik (RES-4).</summary>
    public bool IsValid { get; init; }
    public RejectReason RejectReason { get; init; }
}
