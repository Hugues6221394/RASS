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
[Route("api/[controller]")]
public class BuyerOrdersController : ControllerBase
{
    private readonly AppDbContext _db;

    public BuyerOrdersController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    [Authorize(Roles = "Buyer,Admin,CooperativeManager")]
    public async Task<IActionResult> GetOrders()
    {
        var orders = await _db.BuyerOrders
            .Include(o => o.BuyerProfile).ThenInclude(b => b.User)
            .Include(o => o.Contracts)
            .Select(o => new
            {
                o.Id,
                o.Crop,
                o.QuantityKg,
                o.PriceOffer,
                o.DeliveryLocation,
                o.Status,
                o.DeliveryWindowStart,
                o.DeliveryWindowEnd,
                Buyer = o.BuyerProfile.User.FullName,
                Contracts = o.Contracts.Select(c => c.Id)
            }).ToListAsync();

        return Ok(orders);
    }

    [HttpPost]
    [Authorize(Roles = "Buyer,Admin")]
    public async Task<IActionResult> CreateOrder(CreateBuyerOrderRequest request)
    {
        var userId = GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var profile = await _db.BuyerProfiles.FirstOrDefaultAsync(b => b.UserId == userId);
        if (profile == null)
        {
            profile = new BuyerProfile
            {
                Id = Guid.NewGuid(),
                UserId = userId.Value,
                Organization = "Buyer Org",
                Location = request.DeliveryLocation
            };
            _db.BuyerProfiles.Add(profile);
        }

        var order = new BuyerOrder
        {
            Id = Guid.NewGuid(),
            BuyerProfileId = profile.Id,
            MarketListingId = request.MarketListingId,
            Crop = request.Crop,
            QuantityKg = request.QuantityKg,
            PriceOffer = request.PriceOffer,
            DeliveryLocation = request.DeliveryLocation,
            DeliveryWindowStart = request.DeliveryWindowStart == default ? DateTime.UtcNow.AddDays(2) : request.DeliveryWindowStart,
            DeliveryWindowEnd = request.DeliveryWindowEnd == default ? DateTime.UtcNow.AddDays(4) : request.DeliveryWindowEnd,
            Notes = request.Notes ?? "",
            Status = "Open"
        };

        _db.BuyerOrders.Add(order);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetOrders), new { id = order.Id }, order);
    }

    private Guid? GetUserId()
    {
        var sub = User.FindFirstValue(JwtRegisteredClaimNames.Sub) ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(sub, out var guid) ? guid : null;
    }
}

