using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Rass.Api.Data;
using Rass.Api.Domain.Entities;
using Rass.Api.Dtos;

namespace Rass.Api.Controllers;

[ApiController]
[Route("api/market-agents")]
[Authorize(Roles = "MarketAgent,Admin")]
public class MarketAgentController : ControllerBase
{
    private readonly AppDbContext _db;

    public MarketAgentController(AppDbContext db)
    {
        _db = db;
    }

    private Guid? GetUserId()
    {
        var claim = User.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier") ??
                   User.FindFirst(ClaimTypes.NameIdentifier);
        return Guid.TryParse(claim?.Value, out var guid) ? guid : null;
    }

    [HttpGet("dashboard")]
    public async Task<IActionResult> GetDashboard()
    {
        var agentId = GetUserId();
        if (!agentId.HasValue) return Unauthorized();

        var recentPrices = await _db.MarketPrices
            .Where(p => p.AgentId == agentId.Value)
            .OrderByDescending(p => p.ObservedAt)
            .Take(10)
            .Select(p => new
            {
                p.Id,
                p.Market,
                p.Crop,
                p.PricePerKg,
                p.ObservedAt
            })
            .ToListAsync();

        var stats = new
        {
            TotalPriceSubmissions = await _db.MarketPrices.CountAsync(p => p.AgentId == agentId.Value),
            TodaySubmissions = await _db.MarketPrices.CountAsync(p => p.AgentId == agentId.Value && p.ObservedAt.Date == DateTime.UtcNow.Date),
            MarketsCovered = await _db.MarketPrices.Where(p => p.AgentId == agentId.Value).Select(p => p.Market).Distinct().CountAsync(),
            CropsTracked = await _db.MarketPrices.Where(p => p.AgentId == agentId.Value).Select(p => p.Crop).Distinct().CountAsync()
        };

        return Ok(new
        {
            Stats = stats,
            RecentPrices = recentPrices
        });
    }

    [HttpGet("prices")]
    public async Task<IActionResult> GetMyPrices([FromQuery] string? crop, [FromQuery] string? market)
    {
        var agentId = GetUserId();
        if (!agentId.HasValue) return Unauthorized();

        var query = _db.MarketPrices
            .Where(p => p.AgentId == agentId.Value)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(crop))
        {
            query = query.Where(p => p.Crop == crop);
        }

        if (!string.IsNullOrWhiteSpace(market))
        {
            query = query.Where(p => p.Market == market);
        }

        var prices = await query
            .OrderByDescending(p => p.ObservedAt)
            .Select(p => new
            {
                p.Id,
                p.Market,
                p.Crop,
                p.PricePerKg,
                p.ObservedAt
            })
            .ToListAsync();

        return Ok(prices);
    }
}

