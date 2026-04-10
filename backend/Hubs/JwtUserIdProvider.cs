using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.SignalR;

namespace Rass.Api.Hubs;

public class JwtUserIdProvider : IUserIdProvider
{
    public string? GetUserId(HubConnectionContext connection)
    {
        return connection.User?.FindFirst(JwtRegisteredClaimNames.Sub)?.Value
               ?? connection.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value
               ?? connection.User?.FindFirst("sub")?.Value
               ?? connection.User?.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")?.Value;
    }
}
