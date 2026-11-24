namespace KetikNgebut.Domain.Typing;

/// <summary>
/// Satu penekanan tombol: karakter (1 huruf) atau "Backspace", dan waktu dalam ms sejak balapan mulai.
/// Sama dengan tipe <c>Keystroke</c> di web/src/core/typing/types.ts.
/// </summary>
/// <remarks>
/// <c>record</c> = kelas yang nilainya dibandingkan per isi (bukan per referensi) dan tidak bisa diubah setelah dibuat.
/// Cocok untuk data sederhana seperti ini.
/// </remarks>
public sealed record Keystroke(string Key, long T)
{
    public const string Backspace = "Backspace";
}

public enum KeyResult
{
    Ignored,
    Correct,
    Incorrect,
    Backspace,
}
