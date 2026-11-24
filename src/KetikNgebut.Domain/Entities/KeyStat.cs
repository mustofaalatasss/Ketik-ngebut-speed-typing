namespace KetikNgebut.Domain.Entities;

/// <summary>POL-2: agregat ketepatan per karakter per pemain, hanya dari hasil yang valid.</summary>
public sealed class KeyStat
{
    public required Guid PlayerId { get; init; }

    /// <summary>Satu karakter (huruf disimpan sebagai huruf kecil).</summary>
    public required string Character { get; init; }
    public int Hits { get; set; }
    public int Misses { get; set; }
}

/// <summary>POL-4: pengaturan pemain (satu baris per pemain).</summary>
public sealed class PlayerSettings
{
    public const int CarColorLength = 7; // "#rrggbb"
    public static readonly IReadOnlyList<string> BotLevels = ["beginner", "intermediate", "advanced"];

    public required Guid PlayerId { get; init; }
    public required string Language { get; set; }
    public required string Difficulty { get; set; }
    public required string BotLevel { get; set; }
    public required string CarColor { get; set; }
    public bool UseGhost { get; set; }
    public bool Muted { get; set; }
    public DateTime UpdatedAt { get; set; }

    public static bool IsValidColor(string? color) =>
        color is { Length: CarColorLength } && color[0] == '#' && color.Skip(1).All(char.IsAsciiHexDigit);
}
