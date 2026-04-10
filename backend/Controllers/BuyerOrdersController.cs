using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Rass.Api.Data;
using Rass.Api.Domain.Entities;
using Rass.Api.Dtos;
using Rass.Api.Hubs;

namespace Rass.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class BuyerOrdersController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IHubContext<NotificationHub> _hubContext;

    public BuyerOrdersController(AppDbContext db, IHubContext<NotificationHub> hubContext)
    {
        _db = db;
        _hubContext = hubContext;
    }

    [HttpGet]
    [Authorize(Roles = "Buyer,Admin,CooperativeManager")]
    public async Task<IActionResult> GetOrders()
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var query = _db.BuyerOrders
            .Include(o => o.BuyerProfile).ThenInclude(b => b.User)
            .Include(o => o.MarketListing)
            .Include(o => o.Contracts)
            .AsQueryable();

        if (User.IsInRole("Buyer"))
        {
            query = query.Where(o => o.BuyerProfile.UserId == userId.Value);
        }
        else if (User.IsInRole("CooperativeManager"))
        {
            var cooperative = await _db.Cooperatives
                .FirstOrDefaultAsync(c => c.ManagerId == userId.Value);

            if (cooperative == null) return NotFound("Cooperative not found");

            query = query.Where(o => o.MarketListing != null && o.MarketListing.CooperativeId == cooperative.Id);
        }
        else if (!User.IsInRole("Admin"))
        {
            return Forbid();
        }

        var orders = await query
            .Select(o => new
            {
                o.Id,
                o.MarketListingId,
                o.Crop,
                o.QuantityKg,
                o.PriceOffer,
                o.DeliveryLocation,
                o.Status,
                o.DeliveryWindowStart,
                o.DeliveryWindowEnd,
                Buyer = o.BuyerProfile.User.FullName,
                Contracts = o.Contracts.Select(c => c.Id)
            })
            .ToListAsync();

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
            DeliveryWindowStart = request.DeliveryWindowStart == default ? DateTime.UtcNow.AddDays(2) : NormalizeUtc(request.DeliveryWindowStart),
            DeliveryWindowEnd = request.DeliveryWindowEnd == default ? DateTime.UtcNow.AddDays(4) : NormalizeUtc(request.DeliveryWindowEnd),
            Notes = request.Notes ?? "",
            Status = "Open"
        };

        _db.BuyerOrders.Add(order);
        await _db.SaveChangesAsync();

        // Notify cooperative manager in real-time when a new order is submitted.
        if (order.MarketListingId.HasValue)
        {
            var coopManagerUserId = await _db.MarketListings
                .Where(l => l.Id == order.MarketListingId.Value)
                .Select(l => l.Cooperative.ManagerId)
                .FirstOrDefaultAsync();

            if (coopManagerUserId.HasValue && coopManagerUserId.Value != Guid.Empty)
            {
                var note = new Notification
                {
                    Id = Guid.NewGuid(),
                    UserId = coopManagerUserId.Value,
                    Title = "New buyer order",
                    Message = $"New order for {order.Crop}: {order.QuantityKg:N0} kg at {order.PriceOffer:N0} RWF/kg.",
                    Type = "Info",
                    ActionUrl = "/cooperative-dashboard"
                };
                _db.Notifications.Add(note);
                await _db.SaveChangesAsync();
                await _hubContext.Clients.Group($"user-{coopManagerUserId.Value}")
                    .SendAsync("ReceiveNotification", new
                    {
                        note.Id,
                        note.Title,
                        note.Message,
                        note.Type,
                        note.CreatedAt
                    });
            }
        }

        return CreatedAtAction(nameof(GetOrders), new { id = order.Id }, order);
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Buyer,Admin")]
    public async Task<IActionResult> UpdateOrder(Guid id, CreateBuyerOrderRequest request)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var order = await _db.BuyerOrders
            .Include(o => o.BuyerProfile)
            .Include(o => o.Contracts)
            .FirstOrDefaultAsync(o => o.Id == id);
        if (order == null) return NotFound("Order not found");

        var isAdmin = User.IsInRole("Admin");
        var isOwner = order.BuyerProfile != null && order.BuyerProfile.UserId == userId.Value;
        if (!isAdmin && !isOwner) return Forbid();

        if (!string.Equals(order.Status, "Open", StringComparison.OrdinalIgnoreCase))
            return BadRequest("Only open orders can be updated.");

        order.Crop = request.Crop;
        order.QuantityKg = request.QuantityKg;
        order.PriceOffer = request.PriceOffer;
        order.DeliveryLocation = request.DeliveryLocation;
        if (request.DeliveryWindowStart != default) order.DeliveryWindowStart = NormalizeUtc(request.DeliveryWindowStart);
        if (request.DeliveryWindowEnd != default) order.DeliveryWindowEnd = NormalizeUtc(request.DeliveryWindowEnd);
        order.Notes = request.Notes ?? string.Empty;

        await _db.SaveChangesAsync();
        await NotifyBuyerUrgent(order.BuyerProfileId, "Order updated", $"Your order for {order.Crop} was updated.", "/buyer-dashboard");
        await NotifyCooperativeManagerForOrder(order, "Order updated", $"Buyer updated order for {order.Crop}.");
        return Ok(new { message = "Order updated successfully", order.Id, order.Status });
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Buyer,Admin")]
    public async Task<IActionResult> DeleteOrder(Guid id)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var order = await _db.BuyerOrders
            .Include(o => o.BuyerProfile)
            .FirstOrDefaultAsync(o => o.Id == id);
        if (order == null) return NotFound("Order not found");

        var isAdmin = User.IsInRole("Admin");
        var isOwner = order.BuyerProfile != null && order.BuyerProfile.UserId == userId.Value;
        if (!isAdmin && !isOwner) return Forbid();

        if (!string.Equals(order.Status, "Open", StringComparison.OrdinalIgnoreCase))
            return BadRequest("Only open orders can be deleted.");

        if (order.Contracts.Any())
            return BadRequest("Only orders with no created contracts can be deleted.");

        var buyerProfileId = order.BuyerProfileId;
        var crop = order.Crop;
        _db.BuyerOrders.Remove(order);
        await _db.SaveChangesAsync();
        await NotifyBuyerUrgent(buyerProfileId, "Order deleted", $"Your order for {crop} was deleted.", "/buyer-dashboard");
        return Ok(new { message = "Order deleted successfully" });
    }

    private Guid? GetUserId()
    {
        var sub = User.FindFirstValue(JwtRegisteredClaimNames.Sub) ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(sub, out var guid) ? guid : null;
    }

    private static DateTime NormalizeUtc(DateTime value)
    {
        if (value.Kind == DateTimeKind.Utc) return value;
        if (value.Kind == DateTimeKind.Local) return value.ToUniversalTime();
        return DateTime.SpecifyKind(value, DateTimeKind.Local).ToUniversalTime();
    }

    private async Task NotifyBuyerUrgent(Guid buyerProfileId, string title, string message, string actionUrl)
    {
        var buyerUserId = await _db.BuyerProfiles
            .Where(b => b.Id == buyerProfileId)
            .Select(b => b.UserId)
            .FirstOrDefaultAsync();
        if (buyerUserId == Guid.Empty) return;

        var note = new Notification
        {
            Id = Guid.NewGuid(),
            UserId = buyerUserId,
            Title = title,
            Message = message,
            Type = "Warning",
            IsRead = false,
            CreatedAt = DateTime.UtcNow,
            ActionUrl = actionUrl
        };
        _db.Notifications.Add(note);
        await _db.SaveChangesAsync();
        await _hubContext.Clients.Group($"user-{buyerUserId}")
            .SendAsync("ReceiveNotification", new
            {
                note.Id,
                note.Title,
                note.Message,
                note.Type,
                note.CreatedAt,
                note.ActionUrl
            });
    }

    private async Task NotifyCooperativeManagerForOrder(BuyerOrder order, string title, string message)
    {
        if (!order.MarketListingId.HasValue) return;
        var managerId = await _db.MarketListings
            .Where(l => l.Id == order.MarketListingId.Value)
            .Select(l => l.Cooperative.ManagerId)
            .FirstOrDefaultAsync();
        if (!managerId.HasValue || managerId.Value == Guid.Empty) return;

        var note = new Notification
        {
            Id = Guid.NewGuid(),
            UserId = managerId.Value,
            Title = title,
            Message = message,
            Type = "Info",
            IsRead = false,
            CreatedAt = DateTime.UtcNow,
            ActionUrl = "/cooperative-dashboard"
        };
        _db.Notifications.Add(note);
        await _db.SaveChangesAsync();
        await _hubContext.Clients.Group($"user-{managerId.Value}")
            .SendAsync("ReceiveNotification", new
            {
                note.Id,
                note.Title,
                note.Message,
                note.Type,
                note.CreatedAt,
                note.ActionUrl
            });
    }
}

