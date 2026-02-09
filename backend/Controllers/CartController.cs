using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Rass.Api.Data;
using Rass.Api.Domain.Entities;

namespace Rass.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Buyer")]
public class CartController : ControllerBase
{
    private readonly AppDbContext _db;

    public CartController(AppDbContext db)
    {
        _db = db;
    }

    /// <summary>
    /// Get current user's cart items
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetCart()
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var cartItems = await _db.CartItems
            .Include(c => c.MarketListing)
                .ThenInclude(m => m!.Cooperative)
            .Where(c => c.UserId == userId.Value)
            .OrderByDescending(c => c.AddedAt)
            .Select(c => new
            {
                c.Id,
                c.QuantityKg,
                c.AddedAt,
                Listing = new
                {
                    c.MarketListing!.Id,
                    c.MarketListing.Crop,
                    c.MarketListing.MinimumPrice,
                    c.MarketListing.QualityGrade,
                    c.MarketListing.AvailabilityWindowStart,
                    c.MarketListing.AvailabilityWindowEnd,
                    AvailableQuantity = c.MarketListing.QuantityKg,
                    Cooperative = new
                    {
                        c.MarketListing.Cooperative!.Id,
                        c.MarketListing.Cooperative.Name,
                        c.MarketListing.Cooperative.Region
                    }
                },
                Subtotal = c.QuantityKg * (double)c.MarketListing.MinimumPrice
            })
            .ToListAsync();

        var total = cartItems.Sum(c => c.Subtotal);

        return Ok(new
        {
            items = cartItems,
            itemCount = cartItems.Count,
            total
        });
    }

    /// <summary>
    /// Add item to cart
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> AddToCart(AddToCartRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        // Validate listing exists and is active
        var listing = await _db.MarketListings
            .FirstOrDefaultAsync(l => l.Id == request.ListingId && l.Status == "Active");

        if (listing == null)
            return NotFound("Listing not found or not available");

        if (request.QuantityKg > listing.QuantityKg)
            return BadRequest("Requested quantity exceeds available stock");

        // Check if already in cart
        var existingItem = await _db.CartItems
            .FirstOrDefaultAsync(c => c.UserId == userId.Value && c.MarketListingId == request.ListingId);

        if (existingItem != null)
        {
            // Update quantity
            existingItem.QuantityKg += request.QuantityKg;
            if (existingItem.QuantityKg > listing.QuantityKg)
            {
                existingItem.QuantityKg = listing.QuantityKg;
            }
        }
        else
        {
            // Add new item
            var cartItem = new CartItem
            {
                Id = Guid.NewGuid(),
                UserId = userId.Value,
                MarketListingId = request.ListingId,
                QuantityKg = Math.Min(request.QuantityKg, listing.QuantityKg)
            };
            _db.CartItems.Add(cartItem);
        }

        await _db.SaveChangesAsync();

        return Ok(new { message = "Added to cart" });
    }

    /// <summary>
    /// Update cart item quantity
    /// </summary>
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateCartItem(Guid id, UpdateCartItemRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var cartItem = await _db.CartItems
            .Include(c => c.MarketListing)
            .FirstOrDefaultAsync(c => c.Id == id && c.UserId == userId.Value);

        if (cartItem == null) return NotFound();

        if (request.QuantityKg > cartItem.MarketListing!.QuantityKg)
            return BadRequest("Quantity exceeds available stock");

        cartItem.QuantityKg = request.QuantityKg;
        await _db.SaveChangesAsync();

        return Ok();
    }

    /// <summary>
    /// Remove item from cart
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> RemoveFromCart(Guid id)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var cartItem = await _db.CartItems
            .FirstOrDefaultAsync(c => c.Id == id && c.UserId == userId.Value);

        if (cartItem == null) return NotFound();

        _db.CartItems.Remove(cartItem);
        await _db.SaveChangesAsync();

        return Ok();
    }

    /// <summary>
    /// Clear entire cart
    /// </summary>
    [HttpDelete]
    public async Task<IActionResult> ClearCart()
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        await _db.CartItems
            .Where(c => c.UserId == userId.Value)
            .ExecuteDeleteAsync();

        return Ok();
    }

    /// <summary>
    /// Checkout - Convert cart to orders
    /// </summary>
    [HttpPost("checkout")]
    public async Task<IActionResult> Checkout(CheckoutRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var buyerProfile = await _db.BuyerProfiles
            .FirstOrDefaultAsync(b => b.UserId == userId.Value);

        if (buyerProfile == null)
            return BadRequest("Buyer profile not found");

        var cartItems = await _db.CartItems
            .Include(c => c.MarketListing)
            .Where(c => c.UserId == userId.Value)
            .ToListAsync();

        if (!cartItems.Any())
            return BadRequest("Cart is empty");

        var orders = new List<BuyerOrder>();

        foreach (var item in cartItems)
        {
            var order = new BuyerOrder
            {
                Id = Guid.NewGuid(),
                BuyerProfileId = buyerProfile.Id,
                MarketListingId = item.MarketListingId,
                Crop = item.MarketListing!.Crop,
                QuantityKg = item.QuantityKg,
                PriceOffer = item.MarketListing.MinimumPrice,
                DeliveryLocation = request.DeliveryLocation,
                DeliveryWindowStart = request.DeliveryWindowStart,
                DeliveryWindowEnd = request.DeliveryWindowEnd,
                Status = "Open",
                CreatedAt = DateTime.UtcNow
            };
            orders.Add(order);
            _db.BuyerOrders.Add(order);
        }

        // Clear cart after checkout
        _db.CartItems.RemoveRange(cartItems);
        await _db.SaveChangesAsync();

        return Ok(new
        {
            message = "Checkout successful",
            orderCount = orders.Count,
            orderIds = orders.Select(o => o.Id)
        });
    }

    private Guid? GetUserId()
    {
        var claim = User.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier") ??
                   User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
        return Guid.TryParse(claim?.Value, out var guid) ? guid : null;
    }
}

public record AddToCartRequest(Guid ListingId, double QuantityKg);
public record UpdateCartItemRequest(double QuantityKg);
public record CheckoutRequest(string DeliveryLocation, DateTime DeliveryWindowStart, DateTime DeliveryWindowEnd);
