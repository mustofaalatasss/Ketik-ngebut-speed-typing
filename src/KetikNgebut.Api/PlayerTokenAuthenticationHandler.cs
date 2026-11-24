using System.Security.Claims;
using System.Text.Encodings.Web;
using KetikNgebut.Application.Auth;
using KetikNgebut.Application.Players;
using KetikNgebut.Infrastructure.Identity;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;

namespace KetikNgebut.Api;

/// <summary>
/// Skema autentikasi pemain (ACC-1): header X-Player-Token berisi token rahasia nickname.
/// Server meng-hash token lalu mencocokkannya dengan tabel Players. Bila cocok, request dianggap
/// milik pemain itu dengan role "Player". Admin memakai skema lain (JWT Bearer).
/// </summary>
public sealed class PlayerTokenAuthenticationHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder,
    PlayerService players)
    : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string SchemeName = "PlayerToken";
    public const string HeaderName = "X-Player-Token";
    private const int MaxTokenLength = 128;

    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!Request.Headers.TryGetValue(HeaderName, out var values)) return AuthenticateResult.NoResult();

        var token = values.ToString();
        if (string.IsNullOrWhiteSpace(token) || token.Length > MaxTokenLength)
            return AuthenticateResult.Fail("Token pemain tidak valid.");

        var player = await players.FindByTokenAsync(token, Context.RequestAborted);
        if (player is null) return AuthenticateResult.Fail("Token pemain tidak valid.");

        var identity = new ClaimsIdentity(
            [
                new Claim(JwtRegisteredClaimNames.Sub, player.Id.ToString()),
                new Claim(TokenService.NameClaim, player.Nickname),
                new Claim(TokenService.RoleClaim, Roles.Player),
            ],
            SchemeName,
            TokenService.NameClaim,
            TokenService.RoleClaim);
        return AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity), SchemeName));
    }
}
