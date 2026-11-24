using System.Security.Claims;
using System.Text;
using KetikNgebut.Application.Options;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace KetikNgebut.Infrastructure.Identity;

/// <summary>Membuat access token JWT dan refresh token acak.</summary>
public sealed class TokenService(IOptions<JwtOptions> options, TimeProvider time)
{
    public const string RoleClaim = "role";
    public const string NameClaim = "name";

    public static SymmetricSecurityKey CreateSigningKey(JwtOptions options)
    {
        ArgumentNullException.ThrowIfNull(options);
        var bytes = Encoding.UTF8.GetBytes(options.SigningKey ?? "");
        if (bytes.Length < JwtOptions.MinKeyBytes)
        {
            throw new InvalidOperationException(
                $"Jwt:SigningKey wajib diisi (minimal {JwtOptions.MinKeyBytes} byte) lewat environment variable Jwt__SigningKey atau user-secrets.");
        }
        return new SymmetricSecurityKey(bytes);
    }

    public (string Token, DateTime ExpiresAt) CreateAccessToken(Guid userId, string email, string displayName, IEnumerable<string> roles)
    {
        var opts = options.Value;
        var now = time.GetUtcNow().UtcDateTime;
        var expires = now.AddMinutes(opts.AccessTokenMinutes);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, userId.ToString()),
            new(JwtRegisteredClaimNames.Email, email),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("N")),
            new(NameClaim, displayName),
        };
        claims.AddRange(roles.Select(r => new Claim(RoleClaim, r)));

        var descriptor = new SecurityTokenDescriptor
        {
            Issuer = opts.Issuer,
            Audience = opts.Audience,
            Subject = new ClaimsIdentity(claims),
            IssuedAt = now,
            Expires = expires,
            SigningCredentials = new SigningCredentials(CreateSigningKey(opts), SecurityAlgorithms.HmacSha256),
        };
        // SetDefaultTimesOnTokenCreation = false: waktu token mengikuti TimeProvider (bisa dipalsukan di test).
        var handler = new JsonWebTokenHandler { SetDefaultTimesOnTokenCreation = false };
        return (handler.CreateToken(descriptor), expires);
    }
}
