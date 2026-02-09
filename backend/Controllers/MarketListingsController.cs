using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Rass.Api.Data;

namespace Rass.Api.Controllers;

[ApiController]
[Route("api/market-listings")]
public class MarketListingsController : ControllerBase
{
    private readonly AppDbContext _db;

    public MarketListingsController(AppDbContext db)
    {
        _db = db;
    }

    /// <summary>
    /// Get all active market listings (public - for homepage)
    /// </summary>
    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> GetAllListings(
        [FromQuery] string? crop,
        [FromQuery] string? region,
        [FromQuery] string? quality,
        [FromQuery] double? minQuantity,
        [FromQuery] decimal? maxPrice,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 20)
    {
        var query = _db.MarketListings
            .Include(l => l.Cooperative)
            .Where(l => l.Status == "Active" && 
                        l.AvailabilityWindowEnd > DateTime.UtcNow);

        // Apply filters
        if (!string.IsNullOrEmpty(crop))
            query = query.Where(l => l.Crop.ToLower().Contains(crop.ToLower()));

        if (!string.IsNullOrEmpty(region))
            query = query.Where(l => l.Cooperative!.Region.ToLower().Contains(region.ToLower()));

        if (!string.IsNullOrEmpty(quality))
            query = query.Where(l => l.QualityGrade == quality);

        if (minQuantity.HasValue)
            query = query.Where(l => l.QuantityKg >= minQuantity.Value);

        if (maxPrice.HasValue)
            query = query.Where(l => l.MinimumPrice <= maxPrice.Value);

        var totalCount = await query.CountAsync();

        var listings = await query
            .OrderByDescending(l => l.CreatedAt)
            .Skip(skip)
            .Take(take)
            .Select(l => new
            {
                l.Id,
                l.Crop,
                l.QuantityKg,
                l.MinimumPrice,
                l.QualityGrade,
                l.Description,
                l.AvailabilityWindowStart,
                l.AvailabilityWindowEnd,
                l.CreatedAt,
                Cooperative = new
                {
                    l.Cooperative!.Id,
                    l.Cooperative.Name,
                    l.Cooperative.Region,
                    l.Cooperative.District,
                    l.Cooperative.Location,
                    l.Cooperative.IsVerified
                }
            })
            .ToListAsync();

        return Ok(new
        {
            listings,
            totalCount,
            hasMore = skip + take < totalCount
        });
    }

    /// <summary>
    /// Get featured/recommended listings for homepage
    /// </summary>
    [HttpGet("featured")]
    [AllowAnonymous]
    public async Task<IActionResult> GetFeaturedListings([FromQuery] int count = 8)
    {
        var listings = await _db.MarketListings
            .Include(l => l.Cooperative)
            .Where(l => l.Status == "Active" && 
                        l.AvailabilityWindowEnd > DateTime.UtcNow &&
                        l.Cooperative!.IsVerified)
            .OrderByDescending(l => l.QuantityKg) // Feature listings with more stock
            .ThenByDescending(l => l.CreatedAt)
            .Take(count)
            .Select(l => new
            {
                l.Id,
                l.Crop,
                l.QuantityKg,
                l.MinimumPrice,
                l.QualityGrade,
                l.Description,
                l.AvailabilityWindowStart,
                l.AvailabilityWindowEnd,
                Cooperative = new
                {
                    l.Cooperative!.Id,
                    l.Cooperative.Name,
                    l.Cooperative.Region,
                    l.Cooperative.IsVerified
                }
            })
            .ToListAsync();

        return Ok(listings);
    }

    /// <summary>
    /// Get single listing details
    /// </summary>
    [HttpGet("{id}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetListing(Guid id)
    {
        var listing = await _db.MarketListings
            .Include(l => l.Cooperative)
            .Where(l => l.Id == id)
            .Select(l => new
            {
                l.Id,
                l.Crop,
                l.QuantityKg,
                l.MinimumPrice,
                l.QualityGrade,
                l.Description,
                l.AvailabilityWindowStart,
                l.AvailabilityWindowEnd,
                l.Status,
                l.CreatedAt,
                Cooperative = new
                {
                    l.Cooperative!.Id,
                    l.Cooperative.Name,
                    l.Cooperative.Region,
                    l.Cooperative.District,
                    l.Cooperative.Location,
                    l.Cooperative.Phone,
                    l.Cooperative.Email,
                    l.Cooperative.IsVerified
                }
            })
            .FirstOrDefaultAsync();

        if (listing == null) return NotFound();

        return Ok(listing);
    }

    /// <summary>
    /// Get available crops for filtering
    /// </summary>
    [HttpGet("crops")]
    [AllowAnonymous]
    public async Task<IActionResult> GetAvailableCrops()
    {
        var crops = await _db.MarketListings
            .Where(l => l.Status == "Active")
            .Select(l => l.Crop)
            .Distinct()
            .OrderBy(c => c)
            .ToListAsync();

        return Ok(crops);
    }

    /// <summary>
    /// Get available regions for filtering
    /// </summary>
    [HttpGet("regions")]
    [AllowAnonymous]
    public async Task<IActionResult> GetAvailableRegions()
    {
        var regions = await _db.MarketListings
            .Include(l => l.Cooperative)
            .Where(l => l.Status == "Active")
            .Select(l => l.Cooperative!.Region)
            .Distinct()
            .OrderBy(r => r)
            .ToListAsync();

        return Ok(regions);
    }
}
