using BCrypt.Net;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Rass.Api.Data;
using Rass.Api.Domain.Entities;
using Rass.Api.Dtos;

namespace Rass.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class BuyersController : ControllerBase
{
    private readonly AppDbContext _db;

    public BuyersController(AppDbContext db)
    {
        _db = db;
    }

    [HttpPost("register")]
    public async Task<IActionResult> RegisterBuyer(CreateBuyerRequest request)
    {
        if (await _db.Users.AnyAsync(u => u.Email == request.Email))
        {
            return Conflict("User already exists.");
        }

        var buyerRole = await _db.Roles.FirstAsync(r => r.Name == "Buyer");

        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = request.Email,
            FullName = request.FullName,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password)
        };

        var buyerProfile = new BuyerProfile
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            Organization = request.Organization,
            BusinessType = request.BusinessType,
            Location = request.Location,
            Phone = request.Phone,
            TaxId = request.TaxId,
            IsVerified = false,
            IsActive = true
        };

        _db.Users.Add(user);
        _db.BuyerProfiles.Add(buyerProfile);
        _db.UserRoles.Add(new UserRole { UserId = user.Id, RoleId = buyerRole.Id });

        await _db.SaveChangesAsync();

        return Created("", new { buyerProfile.Id, user.FullName, user.Email });
    }

    [HttpGet("profile")]
    [Authorize(Roles = "Buyer")]
    public async Task<IActionResult> GetBuyerProfile()
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var buyer = await _db.BuyerProfiles
            .Include(b => b.User)
            .Include(b => b.Orders)
            .FirstOrDefaultAsync(b => b.UserId == userId.Value);

        if (buyer == null) return NotFound();

        return Ok(new
        {
            buyer.Id,
            buyer.User.FullName,
            buyer.User.Email,
            buyer.Organization,
            buyer.BusinessType,
            buyer.Location,
            buyer.Phone,
            buyer.TaxId,
            buyer.IsVerified,
            buyer.IsActive,
            OrderCount = buyer.Orders.Count,
            ActiveOrders = buyer.Orders.Count(o => o.Status == "Open" || o.Status == "Accepted")
        });
    }

    [HttpGet("marketplace")]
    [Authorize(Roles = "Buyer")]
    public async Task<IActionResult> GetMarketplace(SearchMarketplaceRequest request)
    {
        var query = _db.MarketListings
            .Include(l => l.Cooperative)
            .Where(l => l.Status == "Active" &&
                       l.AvailabilityWindowEnd > DateTime.UtcNow)
            .AsQueryable();

        if (!string.IsNullOrEmpty(request.Crop))
        {
            query = query.Where(l => l.Crop.Contains(request.Crop));
        }

        if (request.MinQuantity.HasValue)
        {
            query = query.Where(l => l.QuantityKg >= request.MinQuantity.Value);
        }

        if (request.MaxPrice.HasValue)
        {
            query = query.Where(l => l.MinimumPrice <= request.MaxPrice.Value);
        }

        if (!string.IsNullOrEmpty(request.Region))
        {
            query = query.Where(l => l.Cooperative.Region.Contains(request.Region));
        }

        var listings = await query
            .OrderByDescending(l => l.CreatedAt)
            .Select(l => new
            {
                l.Id,
                l.Crop,
                l.QuantityKg,
                l.MinimumPrice,
                l.AvailabilityWindowStart,
                l.AvailabilityWindowEnd,
                l.Description,
                l.QualityGrade,
                Cooperative = new
                {
                    l.Cooperative.Id,
                    l.Cooperative.Name,
                    l.Cooperative.Region,
                    l.Cooperative.District,
                    l.Cooperative.Location
                }
            })
            .ToListAsync();

        return Ok(listings);
    }

    [HttpPost("order")]
    [Authorize(Roles = "Buyer")]
    public async Task<IActionResult> PlaceOrder(CreateBuyerOrderRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var buyer = await _db.BuyerProfiles
            .FirstOrDefaultAsync(b => b.UserId == userId.Value);

        if (buyer == null) return NotFound("Buyer profile not found");

        // If ordering from a specific listing, validate it exists
        MarketListing? listing = null;
        if (request.MarketListingId.HasValue)
        {
            listing = await _db.MarketListings
                .FirstOrDefaultAsync(l => l.Id == request.MarketListingId.Value && l.Status == "Active");

            if (listing == null)
            {
                return NotFound("Market listing not found or no longer available");
            }

            if (listing.QuantityKg < request.QuantityKg)
            {
                return BadRequest("Requested quantity exceeds available listing");
            }

            if (listing.MinimumPrice > request.PriceOffer)
            {
                return BadRequest($"Price offer must be at least {listing.MinimumPrice} RWF/kg");
            }
        }

        var order = new BuyerOrder
        {
            Id = Guid.NewGuid(),
            BuyerProfileId = buyer.Id,
            MarketListingId = request.MarketListingId,
            Crop = request.Crop,
            QuantityKg = request.QuantityKg,
            PriceOffer = request.PriceOffer,
            DeliveryLocation = request.DeliveryLocation,
            DeliveryWindowStart = request.DeliveryWindowStart,
            DeliveryWindowEnd = request.DeliveryWindowEnd,
            Status = "Open",
            Notes = request.Notes ?? ""
        };

        _db.BuyerOrders.Add(order);
        await _db.SaveChangesAsync();

        // Notify cooperative if ordering from a listing
        if (listing != null)
        {
            await NotifyCooperative(listing.CooperativeId, order);
        }

        return Created("", new { order.Id, order.Status });
    }

    [HttpGet("orders")]
    [Authorize(Roles = "Buyer")]
    public async Task<IActionResult> GetMyOrders()
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var buyer = await _db.BuyerProfiles
            .FirstOrDefaultAsync(b => b.UserId == userId.Value);

        if (buyer == null) return NotFound();

        var orders = await _db.BuyerOrders
            .Include(o => o.MarketListing)
            .ThenInclude(l => l!.Cooperative)
            .Include(o => o.Contracts)
            .Where(o => o.BuyerProfileId == buyer.Id)
            .OrderByDescending(o => o.CreatedAt)
            .Select(o => new
            {
                o.Id,
                o.Crop,
                o.QuantityKg,
                o.PriceOffer,
                o.DeliveryLocation,
                o.DeliveryWindowStart,
                o.DeliveryWindowEnd,
                o.Status,
                o.CreatedAt,
                o.Notes,
                MarketListing = o.MarketListing != null ? new
                {
                    o.MarketListing.Id,
                    Cooperative = o.MarketListing.Cooperative.Name
                } : null,
                Contract = o.Contracts.FirstOrDefault() != null ? new
                {
                    o.Contracts.First().Id,
                    o.Contracts.First().AgreedPrice,
                    o.Contracts.First().TrackingId
                } : null
            })
            .ToListAsync();

        return Ok(orders);
    }

    [HttpPost("order/{orderId}/payment")]
    [Authorize(Roles = "Buyer")]
    public async Task<IActionResult> InitiatePayment(Guid orderId, InitiatePaymentRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var order = await _db.BuyerOrders
            .Include(o => o.BuyerProfile)
            .Include(o => o.Contracts)
            .FirstOrDefaultAsync(o => o.Id == orderId && o.BuyerProfile.UserId == userId.Value);

        if (order == null) return NotFound("Order not found");

        if (order.Status != "Accepted")
        {
            return BadRequest("Order must be accepted before payment");
        }

        var contract = order.Contracts.FirstOrDefault();
        if (contract == null) return BadRequest("No contract found for this order");

        // Create escrow payment record
        var payment = new PaymentLedger
        {
            Id = Guid.NewGuid(),
            ContractId = contract.Id,
            Amount = (decimal)order.QuantityKg * order.PriceOffer,
            Reference = $"ESCROW-{Random.Shared.Next(100000, 999999)}",
            Status = "Held",
            Type = "Escrow",
            CreatedAt = DateTime.UtcNow
        };

        _db.PaymentLedgers.Add(payment);
        await _db.SaveChangesAsync();

        // In real implementation, integrate with mobile money API
        // For now, simulate immediate escrow hold
        payment.Status = "Completed";
        await _db.SaveChangesAsync();

        return Ok(new { payment.Id, payment.Reference, payment.Status, payment.Amount });
    }

    [HttpPost("order/{orderId}/confirm-delivery")]
    [Authorize(Roles = "Buyer")]
    public async Task<IActionResult> ConfirmDelivery(Guid orderId, ConfirmDeliveryRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var order = await _db.BuyerOrders
            .Include(o => o.BuyerProfile)
            .Include(o => o.Contracts)
            .ThenInclude(c => c.TransportRequests)
            .FirstOrDefaultAsync(o => o.Id == orderId && o.BuyerProfile.UserId == userId.Value);

        if (order == null) return NotFound("Order not found");

        var contract = order.Contracts.FirstOrDefault();
        if (contract == null) return BadRequest("No contract found");

        var transport = contract.TransportRequests.FirstOrDefault();
        if (transport == null || transport.Status != "Delivered")
        {
            return BadRequest("Order has not been delivered yet");
        }

        // Mark as received and release payment
        transport.Status = "Completed";
        contract.Status = "Completed";

        // Release escrow payment to cooperative
        var payment = await _db.PaymentLedgers
            .FirstOrDefaultAsync(p => p.ContractId == contract.Id && p.Type == "Escrow");

        if (payment != null)
        {
            payment.Status = "Released";
        }

        await _db.SaveChangesAsync();

        return Ok(new { contract.Id, contract.Status, message = "Payment released to cooperative" });
    }

    private Guid? GetUserId()
    {
        var claim = User.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier") ??
                   User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
        return Guid.TryParse(claim?.Value, out var guid) ? guid : null;
    }

    private async Task NotifyCooperative(Guid cooperativeId, BuyerOrder order)
    {
        // Mock notification - in real system would send notification to cooperative
        Console.WriteLine($"Order notification sent to cooperative {cooperativeId}: New order for {order.QuantityKg}kg of {order.Crop}");
    }
}
