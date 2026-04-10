using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Rass.Api.Data;
using Rass.Api.Domain.Entities;

namespace Rass.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ReferenceController : ControllerBase
{
    private readonly AppDbContext _db;

    public ReferenceController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet("crops")]
    [AllowAnonymous]
    public async Task<IActionResult> GetCrops()
    {
        var crops = await _db.CropCatalogs
            .Where(c => c.Status == "Active" && (!c.RequiresGovernmentReview || c.IsGovernmentRegistered))
            .OrderBy(c => c.Name)
            .Select(c => c.Name)
            .ToListAsync();

        if (crops.Count == 0)
        {
            crops = await _db.Lots.Select(l => l.Crop)
                .Union(_db.MarketPrices.Select(m => m.Crop))
                .Distinct()
                .OrderBy(c => c)
                .ToListAsync();
        }
        return Ok(crops);
    }

    [HttpGet("markets")]
    [AllowAnonymous]
    public async Task<IActionResult> GetMarkets()
    {
        var markets = await _db.RegisteredMarkets
            .Where(m => m.IsActive)
            .OrderBy(m => m.Name)
            .Select(m => new
            {
                m.Id,
                m.Name,
                m.Province,
                m.District,
                m.Sector,
                m.Cell,
                m.Location
            })
            .ToListAsync();

        if (markets.Count == 0)
        {
            var fallback = await _db.MarketPrices.Select(m => m.Market)
                .Union(_db.StorageFacilities.Select(s => s.Location))
                .Distinct()
                .OrderBy(m => m)
                .ToListAsync();
            return Ok(fallback);
        }

        return Ok(markets);
    }

    [HttpGet("regions")]
    [AllowAnonymous]
    public IActionResult GetRegions()
    {
        return Ok(RwandaGeography.AllRegions);
    }

    [HttpGet("geography")]
    [AllowAnonymous]
    public IActionResult GetGeography()
    {
        return Ok(new
        {
            regions = RwandaGeography.AllRegions,
            markets = _db.RegisteredMarkets.Where(m => m.IsActive).OrderBy(m => m.Name).Select(m => m.Name).ToList(),
            crops = _db.CropCatalogs.Where(c => c.Status == "Active").OrderBy(c => c.Name).Select(c => c.Name).ToList(),
        });
    }

    [HttpGet("provinces")]
    [AllowAnonymous]
    public IActionResult GetProvinces()
    {
        return Ok(RwandaAdminData.GetProvinces());
    }

    [HttpGet("districts")]
    [AllowAnonymous]
    public IActionResult GetDistricts([FromQuery] string? province = null)
    {
        if (!string.IsNullOrWhiteSpace(province))
            return Ok(RwandaAdminData.GetDistricts(province));
        return Ok(RwandaAdminData.GetAllDistricts());
    }

    [HttpGet("sectors")]
    [AllowAnonymous]
    public IActionResult GetSectors([FromQuery] string district)
    {
        return Ok(RwandaAdminData.GetSectors(district));
    }

    [HttpGet("cells")]
    [AllowAnonymous]
    public async Task<IActionResult> GetCells([FromQuery] string district, [FromQuery] string? sector = null)
    {
        var normalizedDistrict = RwandaAdminData.FindDistrict(district);
        if (normalizedDistrict == null)
            return Ok(Array.Empty<string>());

        var query = _db.Cooperatives
            .Where(c => c.District == normalizedDistrict && c.Cell != null && c.Cell != "");

        if (!string.IsNullOrWhiteSpace(sector))
        {
            var normalizedSector = RwandaAdminData.FindSector(normalizedDistrict, sector);
            if (normalizedSector == null)
                return Ok(Array.Empty<string>());
            query = query.Where(c => c.Sector == normalizedSector);
        }

        var cells = await query
            .Select(c => c.Cell!)
            .Distinct()
            .OrderBy(c => c)
            .ToListAsync();

        return Ok(cells);
    }

    [HttpGet("admin-hierarchy")]
    [AllowAnonymous]
    public IActionResult GetAdminHierarchy()
    {
        return Ok(RwandaAdminData.Hierarchy);
    }

    [HttpGet("price-regulations/active")]
    [AllowAnonymous]
    public async Task<IActionResult> GetActivePriceRegulations([FromQuery] string? crop = null, [FromQuery] string? region = null, [FromQuery] bool includeUpcoming = false)
    {
        var now = DateTime.UtcNow;
        var query = _db.PriceRegulations
            .Where(r => r.Status == "Active" && r.EffectiveTo >= now);

        if (!includeUpcoming)
            query = query.Where(r => r.EffectiveFrom <= now);

        if (!string.IsNullOrWhiteSpace(crop))
            query = query.Where(r => r.Crop == crop);
        if (!string.IsNullOrWhiteSpace(region))
            query = query.Where(r => r.Region == region);

        var regulations = await query
            .OrderBy(r => r.Crop)
            .ThenBy(r => r.Region)
            .Select(r => new
            {
                r.Id, r.Crop, r.Region, r.Market, r.District,
                r.MinPricePerKg, r.MaxPricePerKg,
                r.EffectiveFrom, r.EffectiveTo, r.Notes
            })
            .ToListAsync();

        return Ok(regulations);
    }

    [HttpGet("seasonal-guidance")]
    [AllowAnonymous]
    public async Task<IActionResult> GetSeasonalGuidance([FromQuery] string? crop = null, [FromQuery] string? region = null)
    {
        var query = _db.SeasonalGuidances.AsQueryable();

        if (!string.IsNullOrWhiteSpace(crop))
            query = query.Where(g => g.Crop == crop);
        if (!string.IsNullOrWhiteSpace(region))
            query = query.Where(g => g.Region == region);

        var guidance = await query
            .OrderByDescending(g => g.CreatedAt)
            .Select(g => new
            {
                g.Id, g.Crop, g.Region, g.Season,
                g.StabilityStart, g.StabilityEnd, g.ExpectedTrend,
                g.ExpectedMinPrice, g.ExpectedMaxPrice,
                g.Notes, g.RecommendationForFarmers, g.CreatedAt
            })
            .ToListAsync();

        return Ok(guidance);
    }

    [HttpGet("storage-facilities")]
    [AllowAnonymous]
    public async Task<IActionResult> GetStorageFacilities()
    {
        var facilities = await _db.StorageFacilities
            .Select(f => new
            {
                f.Id,
                f.Name,
                f.Location,
                f.CapacityKg,
                f.AvailableKg,
                Features = f.Features.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries)
            }).ToListAsync();
        return Ok(facilities);
    }

    [HttpGet("platform-stats")]
    [AllowAnonymous]
    public async Task<IActionResult> GetPlatformStats()
    {
        var totalFarmers = await _db.Farmers.CountAsync();
        var totalCooperatives = await _db.Cooperatives.CountAsync();
        var totalBuyers = await _db.BuyerProfiles.CountAsync();
        var totalListings = await _db.MarketListings.CountAsync(m => m.Status == "Active");
        var totalTransporters = await _db.TransporterProfiles.CountAsync();
        var completedOrders = await _db.TransportRequests
            .CountAsync(t => t.Status == "Delivered" || t.Status == "Completed");
        var completedPayments = await _db.PaymentLedgers.CountAsync(p => p.Status == "Completed");

        return Ok(new
        {
            totalFarmers,
            totalCooperatives,
            totalBuyers,
            totalListings,
            totalTransporters,
            completedOrders,
            completedPayments,
        });
    }
}

