namespace KetikNgebut.Application.Options;

/// <summary>Aturan mesin mengetik. Harus sama dengan web/src/config/gameConfig.ts (dites di Vitest).</summary>
public sealed class TypingOptions
{
    public const string Section = "Typing";
    public int CharsPerWord { get; set; } = 5;
    public int MaxErrorBuffer { get; set; } = 8;
    public long TimeLimitMs { get; set; } = 180_000;
}

/// <summary>Batas kewajaran hasil balapan (RES-3).</summary>
public sealed class ResultValidationOptions
{
    public const string Section = "ResultValidation";

    /// <summary>WPM (kotor) di atas ini ditolak.</summary>
    public double MaxWpm { get; set; } = 250;

    /// <summary>Log lebih panjang dari ini dianggap input tidak valid (400).</summary>
    public int MaxLogEntries { get; set; } = 5_000;

    /// <summary>Selisih maksimum durationMs klien dengan waktu finis hasil replay.</summary>
    public long DurationToleranceMs { get; set; } = 50;

    /// <summary>Pemeriksaan ritme hanya dilakukan bila keystroke minimal sebanyak ini.</summary>
    public int RhythmMinKeystrokes { get; set; } = 20;

    /// <summary>Jeda antar keystroke di bawah ini dianggap "terlalu cepat".</summary>
    public long FastIntervalMs { get; set; } = 25;

    /// <summary>Bila proporsi jeda terlalu cepat melebihi ini, hasil ditolak.</summary>
    public double MaxFastIntervalRatio { get; set; } = 0.3;

    /// <summary>Koefisien variasi (simpangan baku / rata-rata) jeda minimal; ritme skrip hampir konstan.</summary>
    public double MinIntervalCoefficientOfVariation { get; set; } = 0.1;
}

public sealed class LeaderboardOptions
{
    public const string Section = "Leaderboard";

    /// <summary>Zona waktu batas harian dan mingguan (ID IANA).</summary>
    public string TimeZone { get; set; } = "Asia/Jakarta";
    public int DefaultPageSize { get; set; } = 20;
    public int MaxPageSize { get; set; } = 50;
}

public sealed class StatsOptions
{
    public const string Section = "Stats";

    /// <summary>Jumlah hasil terakhir untuk grafik WPM per waktu.</summary>
    public int HistorySize { get; set; } = 50;
}

/// <summary>Pengaturan JWT. SigningKey wajib dari environment variable atau user-secrets.</summary>
public sealed class JwtOptions
{
    public const string Section = "Jwt";
    public const int MinKeyBytes = 32;

    public string Issuer { get; set; } = "KetikNgebut";
    public string Audience { get; set; } = "KetikNgebut.Web";
    public string? SigningKey { get; set; }
    public int AccessTokenMinutes { get; set; } = 15;
    public int RefreshTokenDays { get; set; } = 14;
}
