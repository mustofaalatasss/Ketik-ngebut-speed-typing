using System.Security.Cryptography;
using System.Text;

namespace KetikNgebut.Application.Common;

/// <summary>Token rahasia acak dan hash-nya. Yang disimpan di database hanya hash, tidak pernah token asli.</summary>
public static class SecureTokens
{
    /// <summary>32 byte acak dari generator kriptografis, dalam base64url (aman untuk header dan URL).</summary>
    public static string Create() =>
        Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    /// <summary>SHA-256 dalam hex huruf besar (64 karakter).</summary>
    public static string Hash(string token) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
}
