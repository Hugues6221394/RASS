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
        [FromQuery] string? district,
        [FromQuery] string? sector,
        [FromQuery] string? quality,
        [FromQuery] double? minQuantity,
        [FromQuery] decimal? maxPrice,
        [FromQuery] bool includeExpired = false,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 20)
    {
        var query = _db.MarketListings
            .Include(l => l.Cooperative)
            .Where(l => l.Status == "Active");

        if (!includeExpired)
            query = query.Where(l => l.AvailabilityWindowEnd > DateTime.UtcNow);

        // Apply filters
        if (!string.IsNullOrEmpty(crop))
            query = query.Where(l => l.Crop.ToLower().Contains(crop.ToLower()));

        if (!string.IsNullOrEmpty(region))
            query = query.Where(l => l.Cooperative!.Region.ToLower().Contains(region.ToLower()));

        if (!string.IsNullOrEmpty(district))
            query = query.Where(l => l.Cooperative!.District.ToLower().Contains(district.ToLower()));

        if (!string.IsNullOrEmpty(sector))
            query = query.Where(l => l.Cooperative!.Sector.ToLower().Contains(sector.ToLower()));

        if (!string.IsNullOrEmpty(quality))
            query = query.Where(l => l.QualityGrade == quality);

        if (minQuantity.HasValue)
            query = query.Where(l => l.QuantityKg >= minQuantity.Value);

        if (maxPrice.HasValue)
            query = query.Where(l => l.MinimumPrice <= maxPrice.Value);

        var totalCount = await query.CountAsync();

        var rows = await query
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
                Images = l.Images.OrderBy(i => i.DisplayOrder).Select(i => i.ImageUrl).ToList(),
                PrimaryImage = l.Images.OrderBy(i => i.DisplayOrder).Select(i => i.ImageUrl).FirstOrDefault(),
                Cooperative = new
                {
                    l.Cooperative!.Id,
                    l.Cooperative.Name,
                    l.Cooperative.Region,
                    l.Cooperative.District,
                    l.Cooperative.Sector,
                    l.Cooperative.Cell,
                    l.Cooperative.Location,
                    l.Cooperative.IsVerified
                }
            })
            .ToListAsync();

        var listings = rows.Select(l =>
        {
            var metadata = ParseStructuredListingMetadata(l.Description);
            return new
            {
                l.Id,
                l.Crop,
                l.QuantityKg,
                l.MinimumPrice,
                l.QualityGrade,
                Description = metadata.Description,
                Location = metadata.Location,
                MarketPriceReference = metadata.MarketPriceReference,
                l.AvailabilityWindowStart,
                l.AvailabilityWindowEnd,
                l.CreatedAt,
                l.Images,
                l.PrimaryImage,
                l.Cooperative
            };
        }).ToList();

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
    public async Task<IActionResult> GetFeaturedListings([FromQuery] int count = 8, [FromQuery] bool includeExpired = false)
    {
        var featuredQuery = _db.MarketListings
            .Include(l => l.Cooperative)
            .Where(l => l.Status == "Active");

        if (!includeExpired)
            featuredQuery = featuredQuery.Where(l => l.AvailabilityWindowEnd > DateTime.UtcNow);

        var rows = await featuredQuery
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
                Images = l.Images.OrderBy(i => i.DisplayOrder).Select(i => i.ImageUrl).ToList(),
                PrimaryImage = l.Images.OrderBy(i => i.DisplayOrder).Select(i => i.ImageUrl).FirstOrDefault(),
                Cooperative = new
                {
                    l.Cooperative!.Id,
                    l.Cooperative.Name,
                    l.Cooperative.Region,
                    l.Cooperative.District,
                    l.Cooperative.Sector,
                    l.Cooperative.Cell,
                    l.Cooperative.IsVerified
                }
            })
            .ToListAsync();

        var listings = rows.Select(l =>
        {
            var metadata = ParseStructuredListingMetadata(l.Description);
            return new
            {
                l.Id,
                l.Crop,
                l.QuantityKg,
                l.MinimumPrice,
                l.QualityGrade,
                Description = metadata.Description,
                Location = metadata.Location,
                MarketPriceReference = metadata.MarketPriceReference,
                l.AvailabilityWindowStart,
                l.AvailabilityWindowEnd,
                l.Images,
                l.PrimaryImage,
                l.Cooperative
            };
        }).ToList();

        return Ok(listings);
    }

    /// <summary>
    /// Get single listing details
    /// </summary>
    [HttpGet("{id}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetListing(Guid id)
    {
        var row = await _db.MarketListings
            .Include(l => l.Cooperative)
            .Where(l => l.Id == id && l.Status == "Active")
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
                Images = l.Images.OrderBy(i => i.DisplayOrder).Select(i => new { i.Id, i.ImageUrl, i.DisplayOrder }).ToList(),
                Cooperative = new
                {
                    l.Cooperative!.Id,
                    l.Cooperative.Name,
                    l.Cooperative.Region,
                    l.Cooperative.District,
                    l.Cooperative.Sector,
                    l.Cooperative.Cell,
                    l.Cooperative.Location,
                    l.Cooperative.Phone,
                    l.Cooperative.Email,
                    l.Cooperative.IsVerified
                }
            })
            .FirstOrDefaultAsync();

        if (row == null) return NotFound();

        var metadata = ParseStructuredListingMetadata(row.Description);

        var listing = new
        {
            row.Id,
            row.Crop,
            row.QuantityKg,
            row.MinimumPrice,
            row.QualityGrade,
            Description = metadata.Description,
            Location = metadata.Location,
            MarketPriceReference = metadata.MarketPriceReference,
            row.AvailabilityWindowStart,
            row.AvailabilityWindowEnd,
            row.Status,
            row.CreatedAt,
            row.Images,
            row.Cooperative
        };

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

    private static (decimal? MarketPriceReference, string? Location, string Description) ParseStructuredListingMetadata(string? rawDescription)
    {
        var value = rawDescription ?? string.Empty;
        decimal? marketPriceReference = null;
        string? location = null;
        var description = value;

        if (value.StartsWith("MarketRef:", StringComparison.OrdinalIgnoreCase))
        {
            var firstSeparator = value.IndexOf(';');
            if (firstSeparator > "MarketRef:".Length)
            {
                var marketRefValue = value.Substring("MarketRef:".Length, firstSeparator - "MarketRef:".Length);
                if (decimal.TryParse(marketRefValue, out var parsedMarketRef))
                {
                    marketPriceReference = parsedMarketRef;
                }

                description = value[(firstSeparator + 1)..];
            }
        }

        if (description.StartsWith("Location:", StringComparison.OrdinalIgnoreCase))
        {
            var secondSeparator = description.IndexOf(';');
            if (secondSeparator > "Location:".Length)
            {
                location = description.Substring("Location:".Length, secondSeparator - "Location:".Length).Trim();
                description = description[(secondSeparator + 1)..];
            }
            else
            {
                location = description["Location:".Length..].Trim();
                description = string.Empty;
            }
        }

        return (marketPriceReference, location, description.Trim());
    }
}
