namespace KetikNgebut.Domain.Entities;

/// <summary>Teks balapan. Id berupa string agar sama dengan id di web/src/data/passages.json.</summary>
public sealed class Passage
{
    public const int MaxIdLength = 64;
    public const int MinTextLength = 10;
    public const int MaxTextLength = 1000;

    public static readonly IReadOnlyList<string> Languages = ["id", "en"];
    public static readonly IReadOnlyList<string> Difficulties = ["easy", "medium", "hard"];

    public required string Id { get; init; }
    public required string Text { get; set; }
    public required string Language { get; set; }
    public required string Difficulty { get; set; }
    public bool IsActive { get; set; } = true;

    /// <summary>Hanya karakter yang bisa diketik langsung di keyboard QWERTY (ASCII cetak), sama dengan TYPEABLE di frontend.</summary>
    public static bool IsTypeable(string text) =>
        text.Length > 0 && text.All(c => c >= 0x20 && c <= 0x7e);
}
