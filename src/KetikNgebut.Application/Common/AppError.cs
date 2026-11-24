namespace KetikNgebut.Application.Common;

/// <summary>Jenis error; lapisan Api memetakan ini ke status HTTP dan ProblemDetails.</summary>
public enum ErrorKind
{
    Validation, // 400
    Unauthorized, // 401
    Forbidden, // 403
    NotFound, // 404
    Conflict, // 409
}

public sealed record AppError(
    ErrorKind Kind,
    string Title,
    string? Detail = null,
    IReadOnlyDictionary<string, string[]>? Errors = null,
    IReadOnlyDictionary<string, object?>? Extensions = null)
{
    public static AppError Validation(string field, string message) =>
        new(ErrorKind.Validation, "Input tidak valid", Errors: new Dictionary<string, string[]> { [field] = [message] });

    public static AppError Validation(IReadOnlyDictionary<string, string[]> errors) =>
        new(ErrorKind.Validation, "Input tidak valid", Errors: errors);

    public static AppError NotFound(string title) => new(ErrorKind.NotFound, title);

    public static AppError Conflict(string title, string? detail = null) => new(ErrorKind.Conflict, title, detail);

    public static AppError Unauthorized(string title) => new(ErrorKind.Unauthorized, title);
}

/// <summary>
/// Hasil operasi: berisi Value bila berhasil, atau Error bila gagal. Dipakai sebagai pengganti exception
/// untuk kegagalan yang "wajar" (input salah, data tidak ada), sehingga alurnya terlihat jelas di kode.
/// </summary>
public sealed class Result<T>
{
    private Result(T? value, AppError? error)
    {
        Value = value;
        Error = error;
    }

    public T? Value { get; }
    public AppError? Error { get; }
    public bool IsSuccess => Error is null;

    public static Result<T> Ok(T value) => new(value, null);
    public static Result<T> Fail(AppError error) => new(default, error);

    // Konversi implisit: `return value;` atau `return error;` langsung menjadi Result<T>.
    public static implicit operator Result<T>(T value) => Ok(value);
    public static implicit operator Result<T>(AppError error) => Fail(error);
}
