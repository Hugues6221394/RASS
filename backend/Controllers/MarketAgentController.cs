using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Rass.Api.Data;
using Rass.Api.Domain.Entities;
using Rass.Api.Dtos;
using Rass.Api.Services;

namespace Rass.Api.Controllers;

[ApiController]
[Route("api/market-agents")]
[Authorize(Roles = "MarketAgent,Admin")]
public class MarketAgentController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ISmsService _smsService;
    private readonly CatalogManagementService _catalog;

    public MarketAgentController(AppDbContext db, ISmsService smsService, CatalogManagementService catalog)
    {
        _db = db;
        _smsService = smsService;
        _catalog = catalog;
    }

    private Guid? GetUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier) ??
                    User.FindFirst(JwtRegisteredClaimNames.Sub) ??
                    User.FindFirst("sub") ??
                    User.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier");
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
                p.ObservedAt,
                p.VerificationStatus,
                p.ModerationNote,
            })
            .ToListAsync();

        return Ok(prices);
    }

    /// <summary>
    /// Submit a new market price observation
    /// </summary>
    [HttpPost("prices")]
    public async Task<IActionResult> SubmitPrice(SubmitMarketPriceRequest request)
    {
        var agentId = GetUserId();
        if (!agentId.HasValue) return Unauthorized();
        if (string.IsNullOrWhiteSpace(request.Market) || string.IsNullOrWhiteSpace(request.Crop))
            return BadRequest("Market and crop are required.");
        if (request.PricePerKg <= 0)
            return BadRequest("Price per kg must be greater than zero.");

        var market = await _catalog.FindMarketAsync(request.Market);
        if (market == null)
            return BadRequest("Select a registered market before submitting a price.");

        string cropName;
        try
        {
            cropName = await _catalog.EnsureCropAsync(request.Crop, agentId, "MarketAgent", false);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }

        var price = new MarketPrice
        {
            Id = Guid.NewGuid(),
            AgentId = agentId.Value,
            RegisteredMarketId = market.Id,
            Market = market.Name,
            Region = market.Province,
            District = market.District,
            Sector = market.Sector,
            Cell = market.Cell,
            Crop = cropName,
            PricePerKg = request.PricePerKg,
            ObservedAt = request.ObservedAt.HasValue ? NormalizeUtc(request.ObservedAt.Value) : DateTime.UtcNow
        };

        // Auto-moderate: check against government regulations
        var regulation = await _db.PriceRegulations
            .Where(r => r.Crop == cropName && r.Status == "Active" &&
                         (r.EffectiveTo == null || r.EffectiveTo > DateTime.UtcNow))
            .Where(r => r.Region == market.Province || r.District == market.District || r.Market == market.Name)
            .OrderByDescending(r => r.Market != null ? 3 : r.District != null ? 2 : 1)
            .FirstOrDefaultAsync();

        if (regulation != null)
        {
            var withinRange = true;
            if (regulation.MinPricePerKg.HasValue && price.PricePerKg < regulation.MinPricePerKg.Value) withinRange = false;
            if (regulation.MaxPricePerKg > 0 && price.PricePerKg > regulation.MaxPricePerKg) withinRange = false;
            price.VerificationStatus = withinRange ? "Approved" : "Flagged";
            if (!withinRange)
                price.ModerationNote = $"Price {price.PricePerKg} RWF/kg outside regulated range ({regulation.MinPricePerKg ?? 0}–{regulation.MaxPricePerKg} RWF/kg).";
        }
        else
        {
            price.VerificationStatus = "Pending"; // No regulation — pending government review
        }

        _db.MarketPrices.Add(price);
        AddAuditLog(
            action: "PriceSubmission",
            actor: agentId.Value.ToString(),
            entityType: "MarketPrice",
            entityId: price.Id.ToString(),
            beforeState: null,
            afterState: new { price.Market, price.Crop, price.PricePerKg, price.ObservedAt, price.VerificationStatus }
        );
        await _db.SaveChangesAsync();

        // Broadcast price alert to farmers and cooperatives via SMS + in-app notifications
        try
        {
            var smsSent = await _smsService.BroadcastPriceAlertAsync(price.Crop, price.Market, price.Region, price.PricePerKg);
            return Created("", new { price.Id, smsSent, message = "Price submitted successfully" });
        }
        catch
        {
            // Don't fail price submission if notification fails
            return Created("", new { price.Id, smsSent = 0, message = "Price submitted successfully" });
        }
    }

    /// <summary>
    /// Update/correct a price entry (only own entries, within 24 hours)
    /// </summary>
    [HttpPut("prices/{id}")]
    public async Task<IActionResult> UpdatePrice(Guid id, UpdateMarketPriceRequest request)
    {
        var agentId = GetUserId();
        if (!agentId.HasValue) return Unauthorized();

        var price = await _db.MarketPrices
            .FirstOrDefaultAsync(p => p.Id == id && p.AgentId == agentId.Value);

        if (price == null) return NotFound("Price record not found or not owned by you");

        // Can only update within 24 hours of submission
        if ((DateTime.UtcNow - price.ObservedAt).TotalHours > 24)
        {
            return BadRequest("Price records can only be corrected within 24 hours of submission");
        }

        var beforeState = new
        {
            price.Market,
            price.Crop,
            price.PricePerKg,
            price.ObservedAt
        };

        if (!string.IsNullOrWhiteSpace(request.Market))
        {
            var market = await _catalog.FindMarketAsync(request.Market);
            if (market == null) return BadRequest("Select a registered market before updating a price.");
            price.RegisteredMarketId = market.Id;
            price.Market = market.Name;
            price.Region = market.Province;
            price.District = market.District;
            price.Sector = market.Sector;
            price.Cell = market.Cell;
        }
        if (!string.IsNullOrWhiteSpace(request.Crop))
        {
            try
            {
                price.Crop = await _catalog.EnsureCropAsync(request.Crop, agentId, "MarketAgent", false);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }
        if (request.PricePerKg.HasValue)
        {
            if (request.PricePerKg.Value <= 0) return BadRequest("Price per kg must be greater than zero.");
            price.PricePerKg = request.PricePerKg.Value;
        }
        if (request.ObservedAt.HasValue) price.ObservedAt = NormalizeUtc(request.ObservedAt.Value);

        // Log the correction
        AddAuditLog(
            action: "PriceCorrection",
            actor: agentId.Value.ToString(),
            entityType: "MarketPrice",
            entityId: id.ToString(),
            beforeState: beforeState,
            afterState: new
            {
                price.Market,
                price.Crop,
                price.PricePerKg,
                price.ObservedAt,
                request.Notes
            }
        );

        await _db.SaveChangesAsync();

        return Ok(new { message = "Price corrected successfully" });
    }

    /// <summary>
    /// Delete an invalid price record (only own entries, within 1 hour)
    /// </summary>
    [HttpDelete("prices/{id}")]
    public async Task<IActionResult> DeletePrice(Guid id)
    {
        var agentId = GetUserId();
        if (!agentId.HasValue) return Unauthorized();

        var price = await _db.MarketPrices
            .FirstOrDefaultAsync(p => p.Id == id && p.AgentId == agentId.Value);

        if (price == null) return NotFound("Price record not found or not owned by you");

        // Can only delete within 1 hour of submission
        if ((DateTime.UtcNow - price.ObservedAt).TotalHours > 1)
        {
            return BadRequest("Price records can only be deleted within 1 hour of submission");
        }

        _db.MarketPrices.Remove(price);
        AddAuditLog(
            action: "PriceDeleted",
            actor: agentId.Value.ToString(),
            entityType: "MarketPrice",
            entityId: id.ToString(),
            beforeState: new { price.Market, price.Crop, price.PricePerKg, price.ObservedAt },
            afterState: null
        );
        await _db.SaveChangesAsync();

        return Ok(new { message = "Price record deleted" });
    }

    /// <summary>
    /// Get historical prices for comparison
    /// </summary>
    [HttpGet("historical")]
    public async Task<IActionResult> GetHistoricalPrices([FromQuery] string crop, [FromQuery] string? market, [FromQuery] int days = 30)
    {
        var query = _db.MarketPrices
            .Where(p => p.Crop == crop && p.ObservedAt >= DateTime.UtcNow.AddDays(-days))
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(market))
        {
            query = query.Where(p => p.Market == market);
        }

        var prices = await query
            .OrderBy(p => p.ObservedAt)
            .Select(p => new
            {
                p.Market,
                p.Crop,
                p.PricePerKg,
                p.ObservedAt
            })
            .ToListAsync();

        return Ok(prices);
    }

    /// <summary>
    /// Get AI forecast data for comparison
    /// </summary>
    [HttpGet("forecasts")]
    [Authorize(Roles = "MarketAgent,Admin")]
    public async Task<IActionResult> GetForecastData([FromQuery] string crop, [FromQuery] string market)
    {
        // Get recent actual prices
        var recentPrices = await _db.MarketPrices
            .Where(p => p.Crop == crop && p.Market == market)
            .OrderByDescending(p => p.ObservedAt)
            .Take(30)
            .ToListAsync();

        return Ok(new
        {
            RecentPrices = recentPrices,
            ForecastEndpoint = "/api/forecast" // Reference to forecasting service
        });
    }

    [HttpGet("regional-comparison")]
    [Authorize(Roles = "MarketAgent,Admin,Government")]
    public async Task<IActionResult> GetRegionalComparison([FromQuery] string? crop = null, [FromQuery] string? region = null)
    {
        var cutoff = DateTime.UtcNow.AddDays(-30);
        var query = _db.MarketPrices.Where(p => p.ObservedAt >= cutoff);

        if (!string.IsNullOrWhiteSpace(crop))
            query = query.Where(p => p.Crop == crop);
        if (!string.IsNullOrWhiteSpace(region))
            query = query.Where(p => p.Region == region);

        var data = await query
            .GroupBy(p => new { p.Region, p.Market })
            .Select(g => new
            {
                region = g.Key.Region,
                market = g.Key.Market,
                avgPrice = g.Average(p => p.PricePerKg),
                minPrice = g.Min(p => p.PricePerKg),
                maxPrice = g.Max(p => p.PricePerKg),
                priceCount = g.Count()
            })
            .OrderBy(x => x.region)
            .ThenBy(x => x.market)
            .ToListAsync();

        return Ok(data);
    }

    [HttpPost("reports")]
    [Authorize(Roles = "MarketAgent,Admin")]
    public async Task<IActionResult> SubmitMarketReport([FromBody] MarketReportRequest request)
    {
        var agentId = GetUserId();
        if (!agentId.HasValue) return Unauthorized();

        var report = new Domain.Entities.MarketReport
        {
            Id = Guid.NewGuid(),
            Market = request.Market,
            ReportType = request.ReportType,
            Severity = request.Severity,
            Description = request.Description,
            AffectedCrops = request.AffectedCrops ?? string.Empty,
            AgentUserId = agentId.Value,
            CreatedAt = DateTime.UtcNow
        };

        _db.MarketReports.Add(report);
        await _db.SaveChangesAsync();

        return Created("", new { report.Id, message = "Report submitted successfully" });
    }

    [HttpGet("reports")]
    [Authorize(Roles = "MarketAgent,Admin,Government")]
    public async Task<IActionResult> GetMarketReports()
    {
        var agentId = GetUserId();
        if (!agentId.HasValue) return Unauthorized();

        var isAdmin = User.IsInRole("Admin");

        var query = _db.MarketReports.AsQueryable();
        if (!isAdmin)
            query = query.Where(r => r.AgentUserId == agentId.Value);

        var reports = await query
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => new
            {
                r.Id,
                r.Market,
                r.ReportType,
                r.Severity,
                r.Description,
                r.AffectedCrops,
                r.AgentUserId,
                r.CreatedAt
            })
            .ToListAsync();

        return Ok(reports);
    }

    /// <summary>National-level trend analytics with district breakdown and time-series</summary>
    [HttpGet("national-trends")]
    [Authorize(Roles = "MarketAgent,Admin,Government")]
    public async Task<IActionResult> GetNationalTrends(
        [FromQuery] string? crop = null,
        [FromQuery] string? region = null,
        [FromQuery] int days = 90)
    {
        var cutoff = DateTime.UtcNow.AddDays(-days);
        var query = _db.MarketPrices.Where(p => p.ObservedAt >= cutoff);
        if (!string.IsNullOrWhiteSpace(crop)) query = query.Where(p => p.Crop == crop);
        if (!string.IsNullOrWhiteSpace(region)) query = query.Where(p => p.Region == region);

        // Time-series (weekly averages)
        var timeSeries = await query
            .GroupBy(p => new { Week = p.ObservedAt.Date })
            .Select(g => new { date = g.Key.Week, avgPrice = g.Average(p => p.PricePerKg), count = g.Count() })
            .OrderBy(x => x.date)
            .ToListAsync();

        // By region
        var byRegion = await query
            .GroupBy(p => p.Region)
            .Select(g => new { region = g.Key, avgPrice = g.Average(p => p.PricePerKg), minPrice = g.Min(p => p.PricePerKg), maxPrice = g.Max(p => p.PricePerKg), count = g.Count() })
            .OrderByDescending(x => x.avgPrice)
            .ToListAsync();

        // By district
        var byDistrict = await query
            .Where(p => p.District != null)
            .GroupBy(p => new { p.Region, p.District })
            .Select(g => new { region = g.Key.Region, district = g.Key.District, avgPrice = g.Average(p => p.PricePerKg), minPrice = g.Min(p => p.PricePerKg), maxPrice = g.Max(p => p.PricePerKg), count = g.Count() })
            .OrderByDescending(x => x.avgPrice)
            .ToListAsync();

        // By crop
        var byCrop = await query
            .GroupBy(p => p.Crop)
            .Select(g => new { crop = g.Key, avgPrice = g.Average(p => p.PricePerKg), minPrice = g.Min(p => p.PricePerKg), maxPrice = g.Max(p => p.PricePerKg), count = g.Count() })
            .OrderByDescending(x => x.count)
            .ToListAsync();

        // Top volatile crops
        var volatility = byCrop.Select(c => new
        {
            c.crop,
            c.avgPrice,
            c.minPrice,
            c.maxPrice,
            volatilityPct = c.maxPrice > 0 ? Math.Round((double)(c.maxPrice - c.minPrice) / (double)c.maxPrice * 100, 1) : 0
        }).OrderByDescending(x => x.volatilityPct).Take(10).ToList();

        var totalSubmissions = await query.CountAsync();
        var totalMarkets = await query.Select(p => p.Market).Distinct().CountAsync();
        var totalAgents = await query.Where(p => p.AgentId != null).Select(p => p.AgentId).Distinct().CountAsync();

        return Ok(new
        {
            summary = new { totalSubmissions, totalMarkets, totalAgents, periodDays = days },
            timeSeries,
            byRegion,
            byDistrict,
            byCrop,
            volatility
        });
    }

    [HttpPost("validate-price/{id}")]
    [Authorize(Roles = "MarketAgent,Admin")]
    public async Task<IActionResult> ValidatePrice(Guid id)
    {
        var price = await _db.MarketPrices.FirstOrDefaultAsync(p => p.Id == id);
        if (price == null) return NotFound("Price record not found");

        // MarketPrice has no IsValidated field; log the validation action
        AddAuditLog(
            action: "PriceValidated",
            actor: GetUserId()?.ToString() ?? "Unknown",
            entityType: "MarketPrice",
            entityId: id.ToString(),
            beforeState: null,
            afterState: new { validatedAt = DateTime.UtcNow }
        );

        await _db.SaveChangesAsync();
        return Ok(new { message = "Price validated successfully" });
    }

    private void AddAuditLog(string action, string actor, string entityType, string? entityId, object? beforeState, object? afterState)
    {
        var metadata = new JsonObject
        {
            ["before_state"] = beforeState is null ? null : System.Text.Json.JsonSerializer.SerializeToNode(beforeState),
            ["after_state"] = afterState is null ? null : System.Text.Json.JsonSerializer.SerializeToNode(afterState),
            ["ip_address"] = HttpContext.Connection.RemoteIpAddress?.ToString()
        };

        _db.AuditLogs.Add(new AuditLog
        {
            Action = action,
            Actor = actor,
            EntityType = entityType,
            EntityId = entityId,
            Metadata = metadata.ToJsonString(),
            Timestamp = DateTime.UtcNow
        });
    }

    private static DateTime NormalizeUtc(DateTime value)
    {
        if (value.Kind == DateTimeKind.Utc) return value;
        if (value.Kind == DateTimeKind.Local) return value.ToUniversalTime();
        return DateTime.SpecifyKind(value, DateTimeKind.Local).ToUniversalTime();
    }
}
