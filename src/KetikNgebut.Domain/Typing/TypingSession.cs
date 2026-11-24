using System.Text;

namespace KetikNgebut.Domain.Typing;

/// <summary>
/// Port C# dari web/src/core/typing/typingEngine.ts. Perilakunya harus identik (diuji dengan
/// shared/fixtures/typing-replay.json di kedua sisi). Bedanya hanya gaya: versi TS membuat state baru
/// setiap keystroke (immutable), versi ini mengubah dirinya sendiri agar replay di server hemat memori.
/// </summary>
public sealed class TypingSession
{
    private readonly StringBuilder _errorBuffer = new();
    private readonly List<long> _correctCharTimes = [];
    private readonly List<Keystroke> _log = [];
    private readonly int _maxErrorBuffer;

    public TypingSession(string text, int maxErrorBuffer)
    {
        ArgumentNullException.ThrowIfNull(text);
        Text = text;
        _maxErrorBuffer = maxErrorBuffer;
        FinishedAtMs = text.Length == 0 ? 0 : null;
    }

    public string Text { get; }

    /// <summary>Jumlah karakter benar yang sudah terkunci (indeks karakter berikutnya).</summary>
    public int Cursor { get; private set; }

    /// <summary>Karakter salah yang belum dihapus; selama tidak kosong kursor tidak maju.</summary>
    public string ErrorBuffer => _errorBuffer.ToString();

    public int CorrectKeystrokes { get; private set; }

    /// <summary>Total penekanan tombol karakter (Backspace tidak dihitung).</summary>
    public int TotalKeystrokes { get; private set; }

    public IReadOnlyList<long> CorrectCharTimes => _correctCharTimes;

    /// <summary>Keystroke yang diterima mesin, berurutan (yang diabaikan tidak dicatat).</summary>
    public IReadOnlyList<Keystroke> Log => _log;

    public long? FinishedAtMs { get; private set; }

    public bool IsFinished => FinishedAtMs is not null;

    /// <summary>
    /// Kunci yang diterima: tepat satu karakter (dihitung per code point, seperti <c>[...key].length</c> di JS)
    /// atau Backspace.
    /// </summary>
    public static bool IsAcceptedKey(string key)
    {
        if (key == Keystroke.Backspace) return true;
        var count = 0;
        // EnumerateRunes: menelusuri string per code point Unicode, bukan per char UTF-16.
        foreach (var _ in key.EnumerateRunes())
        {
            if (++count > 1) return false;
        }
        return count == 1;
    }

    public KeyResult Apply(Keystroke keystroke)
    {
        ArgumentNullException.ThrowIfNull(keystroke);
        if (IsFinished || !IsAcceptedKey(keystroke.Key)) return KeyResult.Ignored;

        _log.Add(keystroke);

        if (keystroke.Key == Keystroke.Backspace)
        {
            // TYP-3: Backspace hanya menghapus kesalahan; karakter benar sudah terkunci.
            if (_errorBuffer.Length > 0) _errorBuffer.Length--;
            return KeyResult.Backspace;
        }

        TotalKeystrokes++;

        // Sama dengan `keystroke.key === state.text[state.cursor]` di JS: satu char UTF-16.
        if (_errorBuffer.Length == 0 && keystroke.Key.Length == 1 && keystroke.Key[0] == Text[Cursor])
        {
            Cursor++;
            CorrectKeystrokes++;
            _correctCharTimes.Add(keystroke.T);
            if (Cursor == Text.Length) FinishedAtMs = keystroke.T;
            return KeyResult.Correct;
        }

        if (_errorBuffer.Length < _maxErrorBuffer) _errorBuffer.Append(keystroke.Key);
        return KeyResult.Incorrect;
    }

    /// <summary>Memutar ulang log dari awal (TYP-2, RES-2). Port dari replay.ts.</summary>
    public static TypingSession Replay(string text, IEnumerable<Keystroke> log, int maxErrorBuffer)
    {
        ArgumentNullException.ThrowIfNull(log);
        var session = new TypingSession(text, maxErrorBuffer);
        foreach (var ks in log) session.Apply(ks);
        return session;
    }
}
