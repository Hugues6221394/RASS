using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Rass.Api.Data;
using Rass.Api.Services;
using System.Security.Claims;
using System.Text.Json;

namespace Rass.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AIChatController : ControllerBase
{
    private readonly AIChatService _chatService;
    private readonly AppDbContext _db;

    public AIChatController(AIChatService chatService, AppDbContext db)
    {
        _chatService = chatService;
        _db = db;
    }

    public class ChatQueryRequest
    {
        public string Message { get; set; } = string.Empty;
    }

    [HttpPost("query")]
    [AllowAnonymous]
    public async Task<IActionResult> Query([FromBody] ChatQueryRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Message))
        {
            return BadRequest("Message cannot be empty.");
        }

        var isAuthenticated = User?.Identity?.IsAuthenticated == true;
        var userRole = isAuthenticated
            ? User.Claims.FirstOrDefault(c => c.Type == System.Security.Claims.ClaimTypes.Role)?.Value ?? "General"
            : "Guest";
        var userId = isAuthenticated ? User.FindFirstValue(ClaimTypes.NameIdentifier) : null;
        try
        {
            var context = await BuildAppContextAsync(userRole, userId);
            var response = await _chatService.ProcessRoleQueryAsync(request.Message, userRole, context);
            return Ok(new { response });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    private async Task<string> BuildAppContextAsync(string role, string? userId)
    {
        var activeListings = await _db.MarketListings.CountAsync(l => l.Status == "Active");
        var openOrders = await _db.BuyerOrders.CountAsync(o => o.Status == "Open" || o.Status == "Accepted");
        var pendingContracts = await _db.Contracts.CountAsync(c => c.Status == "PendingApproval" || c.Status == "PendingSignature");
        var recentAlerts = await _db.PlatformAlerts.CountAsync(a => a.Status == "Open");
        var latestPrices = await _db.MarketPrices
            .OrderByDescending(p => p.ObservedAt)
            .Take(20)
            .Select(p => new { p.Crop, p.Market, p.PricePerKg, p.ObservedAt })
            .ToListAsync();

        object roleContext = new { };
        if (Guid.TryParse(userId, out var uid))
        {
            if (string.Equals(role, "CooperativeManager", StringComparison.OrdinalIgnoreCase))
            {
                var coop = await _db.Cooperatives.FirstOrDefaultAsync(c => c.ManagerId == uid);
                if (coop != null)
                {
                    roleContext = new
                    {
                        cooperative = coop.Name,
                        inventoryKg = await _db.Lots.Where(l => l.CooperativeId == coop.Id).SumAsync(l => (double?)l.QuantityKg) ?? 0,
                        cooperativeListings = await _db.MarketListings.CountAsync(l => l.CooperativeId == coop.Id && l.Status == "Active"),
                        cooperativeOrders = await _db.BuyerOrders.CountAsync(o => o.MarketListing != null && o.MarketListing.CooperativeId == coop.Id && (o.Status == "Open" || o.Status == "Accepted"))
                    };
                }
            }
            else if (string.Equals(role, "Buyer", StringComparison.OrdinalIgnoreCase))
            {
                var buyer = await _db.BuyerProfiles.FirstOrDefaultAsync(b => b.UserId == uid);
                if (buyer != null)
                {
                    roleContext = new
                    {
                        buyerOrders = await _db.BuyerOrders.CountAsync(o => o.BuyerProfileId == buyer.Id),
                        buyerOpenOrders = await _db.BuyerOrders.CountAsync(o => o.BuyerProfileId == buyer.Id && (o.Status == "Open" || o.Status == "Accepted")),
                        buyerPendingContracts = await _db.Contracts.CountAsync(c => c.BuyerOrder != null && c.BuyerOrder.BuyerProfileId == buyer.Id && (c.Status == "PendingApproval" || c.Status == "PendingSignature"))
                    };
                }
            }
        }

        return JsonSerializer.Serialize(new
        {
            generatedAt = DateTime.UtcNow,
            role,
            platform = new
            {
                activeListings,
                openOrders,
                pendingContracts,
                recentAlerts
            },
            latestPrices,
            roleContext
        });
    }
}
