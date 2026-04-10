using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Rass.Api.Data;
using Rass.Api.Domain.Entities;
using Rass.Api.Dtos;
using Rass.Api.Hubs;
using Rass.Api.Services;

namespace Rass.Api.Controllers;

[ApiController]
[Route("api/price-regulations")]
[Authorize(Roles = "Government,Admin")]
public class PriceRegulationController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly CatalogManagementService _catalog;
    private readonly IHubContext<NotificationHub> _hubContext;

    public PriceRegulationController(AppDbContext db, CatalogManagementService catalog, IHubContext<NotificationHub> hubContext)
    {
        _db = db;
        _catalog = catalog;
        _hubContext = hubContext;
    }

    /// <summary>
    /// Get all price regulations with optional filters
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? crop = null,
        [FromQuery] string? region = null,
        [FromQuery] string? status = null)
    {
        var query = _db.PriceRegulations.AsQueryable();

        if (!string.IsNullOrWhiteSpace(crop))
            query = query.Where(r => r.Crop == crop);
        if (!string.IsNullOrWhiteSpace(region))
            query = query.Where(r => r.Region == region);
        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(r => r.Status == status);

        var regulations = await query
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync();

        return Ok(regulations);
    }

    /// <summary>
    /// Create a new price regulation for a crop in a region
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> Create(CreatePriceRegulationRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        if (request.MaxPricePerKg <= 0)
            return BadRequest("Maximum price must be greater than zero.");
        if (request.MinPricePerKg.HasValue && request.MinPricePerKg.Value >= request.MaxPricePerKg)
            return BadRequest("Minimum price must be less than maximum price.");
        if (request.EffectiveTo <= request.EffectiveFrom)
            return BadRequest("End date must be after start date.");

        var normalizedRegion = RwandaAdminData.NormalizeProvince(request.Region) ?? request.Region.Trim();
        var normalizedDistrict = string.IsNullOrWhiteSpace(request.District) ? null : RwandaAdminData.FindDistrict(request.District) ?? request.District.Trim();
        var market = await _catalog.FindMarketAsync(request.Market);
        if (market != null)
        {
            normalizedRegion = market.Province;
            normalizedDistrict = market.District;
        }

        string cropName;
        try
        {
            cropName = await _catalog.EnsureCropAsync(request.Crop, userId, User.IsInRole("Government") ? "Government" : "Admin", true);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }

        // Check for overlapping active regulations
        var normalizedMarketName = market != null ? market.Name : request.Market?.Trim() ?? string.Empty;
        var normalizedDistrictName = normalizedDistrict ?? string.Empty;
        var effFrom = ToUtc(request.EffectiveFrom);
        var effTo = ToUtc(request.EffectiveTo);
        var overlap = await _db.PriceRegulations.AnyAsync(r =>
            r.Crop == cropName &&
            r.Region == normalizedRegion &&
            r.Status == "Active" &&
            r.EffectiveFrom < effTo &&
            r.EffectiveTo > effFrom &&
            (r.Market ?? "") == normalizedMarketName &&
            (r.District ?? "") == normalizedDistrictName);

        if (overlap)
            return BadRequest("An active price regulation already exists for this crop and region in the overlapping period.");

        var regulation = new PriceRegulation
        {
            Crop = cropName,
            Region = normalizedRegion,
            Market = market?.Name ?? request.Market?.Trim(),
            District = normalizedDistrict,
            MinPricePerKg = request.MinPricePerKg,
            MaxPricePerKg = request.MaxPricePerKg,
            EffectiveFrom = ToUtc(request.EffectiveFrom),
            EffectiveTo = ToUtc(request.EffectiveTo),
            Status = "Active",
            Notes = request.Notes,
            CreatedBy = userId.Value,
            CreatedAt = DateTime.UtcNow,
        };

        _db.PriceRegulations.Add(regulation);
        await _db.SaveChangesAsync();

        // Notify cooperative managers who have active listings for this crop
        var affectedListings = await _db.MarketListings
            .Include(l => l.Cooperative).ThenInclude(c => c!.Manager)
            .Where(l => l.Crop == cropName && l.Status == "Active")
            .ToListAsync();

        foreach (var listing in affectedListings)
        {
            var managerId = listing.Cooperative?.ManagerId;
            if (managerId == null) continue;

            var sellerPrice = listing.MinimumPrice;
            var exceedsMax = sellerPrice > regulation.MaxPricePerKg;
            var belowMin = regulation.MinPricePerKg.HasValue && sellerPrice < regulation.MinPricePerKg.Value;

            var title = exceedsMax || belowMin
                ? $"⚠️ Price regulation violation: {cropName}"
                : $"New price regulation: {cropName}";
            var message = exceedsMax
                ? $"Government set max price {regulation.MaxPricePerKg} RWF/kg for {cropName}. Your listing price ({sellerPrice} RWF/kg) exceeds the regulated maximum. Please update your listing price immediately."
                : belowMin
                    ? $"Government set min price {regulation.MinPricePerKg} RWF/kg for {cropName}. Your listing price ({sellerPrice} RWF/kg) is below the regulated minimum. Please update your listing price."
                    : $"Government has set a price regulation for {cropName}: {(regulation.MinPricePerKg.HasValue ? $"{regulation.MinPricePerKg}–" : "")}{regulation.MaxPricePerKg} RWF/kg. Your listing price ({sellerPrice} RWF/kg) is within range.";

            _db.Notifications.Add(new Notification
            {
                UserId = managerId.Value,
                Title = title,
                Message = message,
                Type = exceedsMax || belowMin ? "Warning" : "Info",
                ActionUrl = "/prices",
                CreatedAt = DateTime.UtcNow,
            });

            // Push real-time via SignalR
            await _hubContext.Clients.Group($"user-{managerId.Value}").SendAsync("ReceiveNotification", new
            {
                id = Guid.NewGuid(),
                title,
                message,
                type = exceedsMax || belowMin ? "Warning" : "Info",
                isRead = false,
                createdAt = DateTime.UtcNow,
                actionUrl = "/prices"
            });
        }

        if (affectedListings.Any())
            await _db.SaveChangesAsync();

        return Created("", new { regulation.Id, message = "Price regulation created successfully", affectedListings = affectedListings.Count });
    }

    /// <summary>
    /// Update an existing price regulation
    /// </summary>
    [HttpPut("{id}")]
    public async Task<IActionResult> Update(Guid id, UpdatePriceRegulationRequest request)
    {
        var regulation = await _db.PriceRegulations.FindAsync(id);
        if (regulation == null) return NotFound("Price regulation not found");

        if (request.MinPricePerKg.HasValue) regulation.MinPricePerKg = request.MinPricePerKg;
        if (request.MaxPricePerKg.HasValue)
        {
            if (request.MaxPricePerKg.Value <= 0)
                return BadRequest("Maximum price must be greater than zero.");
            regulation.MaxPricePerKg = request.MaxPricePerKg.Value;
        }
        if (request.EffectiveFrom.HasValue) regulation.EffectiveFrom = ToUtc(request.EffectiveFrom.Value);
        if (request.EffectiveTo.HasValue) regulation.EffectiveTo = ToUtc(request.EffectiveTo.Value);
        if (!string.IsNullOrWhiteSpace(request.Status)) regulation.Status = request.Status;
        if (request.Notes != null) regulation.Notes = request.Notes;

        // Re-validate constraints after partial update
        if (regulation.MinPricePerKg.HasValue && regulation.MinPricePerKg.Value >= regulation.MaxPricePerKg)
            return BadRequest("Minimum price must be less than maximum price.");
        if (regulation.EffectiveTo <= regulation.EffectiveFrom)
            return BadRequest("End date must be after start date.");

        regulation.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return Ok(new { message = "Price regulation updated successfully" });
    }

    /// <summary>
    /// Deactivate/expire a regulation
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> Deactivate(Guid id)
    {
        var regulation = await _db.PriceRegulations.FindAsync(id);
        if (regulation == null) return NotFound();

        regulation.Status = "Expired";
        regulation.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(new { message = "Price regulation deactivated" });
    }

    /// <summary>
    /// Validate a proposed listing price against active regulations.
    /// Returns whether the price is within bounds, and the applicable regulation.
    /// Used by the listing form for real-time validation.
    /// </summary>
    [HttpGet("validate")]
    [AllowAnonymous]
    public async Task<IActionResult> ValidatePrice(
        [FromQuery] string crop,
        [FromQuery] string region,
        [FromQuery] decimal price,
        [FromQuery] string? market = null,
        [FromQuery] string? district = null)
    {
        var normalizedCrop = CatalogManagementService.FormatCropName(crop);
        var marketRecord = await _catalog.FindMarketAsync(market);
        var normalizedRegion = marketRecord?.Province ?? RwandaAdminData.NormalizeProvince(region) ?? region;
        var normalizedDistrict = marketRecord?.District ?? (string.IsNullOrWhiteSpace(district) ? null : RwandaAdminData.FindDistrict(district) ?? district);
        var regulation = await FindApplicableRegulation(normalizedCrop, normalizedRegion, marketRecord?.Name ?? market, normalizedDistrict);

        if (regulation == null)
        {
            return Ok(new
            {
                regulated = false,
                allowed = true,
                message = "No active price regulation found for this crop and region."
            });
        }

        var exceeds = price > regulation.MaxPricePerKg;
        var belowMin = regulation.MinPricePerKg.HasValue && price < regulation.MinPricePerKg.Value;

        return Ok(new
        {
            regulated = true,
            allowed = !exceeds && !belowMin,
            regulation = new
            {
                regulation.Id,
                regulation.Crop,
                regulation.Region,
                regulation.MinPricePerKg,
                regulation.MaxPricePerKg,
                regulation.EffectiveFrom,
                regulation.EffectiveTo,
            },
            message = exceeds
                ? $"Price exceeds the government-regulated maximum of {regulation.MaxPricePerKg:N0} RWF/kg for {normalizedCrop} in {normalizedRegion}. Listing cannot proceed."
                : belowMin
                    ? $"Price is below the government-regulated minimum of {regulation.MinPricePerKg:N0} RWF/kg for {normalizedCrop} in {normalizedRegion}."
                    : $"Price is within the regulated range ({regulation.MinPricePerKg?.ToString("N0") ?? "0"}–{regulation.MaxPricePerKg:N0} RWF/kg)."
        });
    }

    // === Seasonal Guidance ===

    [HttpGet("seasonal-guidance")]
    public async Task<IActionResult> GetSeasonalGuidance(
        [FromQuery] string? crop = null,
        [FromQuery] string? region = null)
    {
        var query = _db.SeasonalGuidances.AsQueryable();
        if (!string.IsNullOrWhiteSpace(crop)) query = query.Where(g => g.Crop == crop);
        if (!string.IsNullOrWhiteSpace(region)) query = query.Where(g => g.Region == region);

        var guidance = await query.OrderByDescending(g => g.CreatedAt).ToListAsync();
        return Ok(guidance);
    }

    [HttpPost("seasonal-guidance")]
    public async Task<IActionResult> CreateSeasonalGuidance(CreateSeasonalGuidanceRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        string cropName;
        try
        {
            cropName = await _catalog.EnsureCropAsync(request.Crop, userId, User.IsInRole("Government") ? "Government" : "Admin", true);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }

        var guidance = new SeasonalGuidance
        {
            Crop = cropName,
            Region = RwandaAdminData.NormalizeProvince(request.Region) ?? request.Region.Trim(),
            Season = request.Season.Trim(),
            StabilityStart = ToUtc(request.StabilityStart),
            StabilityEnd = ToUtc(request.StabilityEnd),
            ExpectedTrend = request.ExpectedTrend,
            ExpectedMinPrice = request.ExpectedMinPrice,
            ExpectedMaxPrice = request.ExpectedMaxPrice,
            Notes = request.Notes,
            RecommendationForFarmers = request.RecommendationForFarmers,
            CreatedBy = userId.Value,
        };

        _db.SeasonalGuidances.Add(guidance);
        await _db.SaveChangesAsync();

        return Created("", new { guidance.Id, message = "Seasonal guidance created successfully" });
    }

    [HttpDelete("seasonal-guidance/{id}")]
    public async Task<IActionResult> DeleteSeasonalGuidance(Guid id)
    {
        var guidance = await _db.SeasonalGuidances.FindAsync(id);
        if (guidance == null) return NotFound();

        _db.SeasonalGuidances.Remove(guidance);
        await _db.SaveChangesAsync();
        return Ok(new { message = "Seasonal guidance removed" });
    }

    /// <summary>
    /// Find the most specific active regulation for a crop+region combination.
    /// Hierarchy: market-specific → district → region → national
    /// </summary>
    private async Task<PriceRegulation?> FindApplicableRegulation(
        string crop, string region, string? market = null, string? district = null)
    {
        var now = DateTime.UtcNow;
        var candidates = await _db.PriceRegulations
            .Where(r => r.Crop == crop && r.Status == "Active" &&
                         r.EffectiveFrom <= now && r.EffectiveTo >= now)
            .ToListAsync();

        // Priority: market-specific → district → region
        if (!string.IsNullOrWhiteSpace(market))
        {
            var marketMatch = candidates.FirstOrDefault(r => r.Market == market);
            if (marketMatch != null) return marketMatch;
        }
        if (!string.IsNullOrWhiteSpace(district))
        {
            var districtMatch = candidates.FirstOrDefault(r => r.District == district);
            if (districtMatch != null) return districtMatch;
        }

        return candidates.FirstOrDefault(r =>
            r.Region == region &&
            string.IsNullOrEmpty(r.Market) &&
            string.IsNullOrEmpty(r.District));
    }

    private static DateTime ToUtc(DateTime value)
    {
        return value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
        };
    }

    private Guid? GetUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier) ??
                    User.FindFirst("sub") ??
                    User.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier");
        return Guid.TryParse(claim?.Value, out var guid) ? guid : null;
    }
}
