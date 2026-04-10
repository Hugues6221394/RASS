using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Rass.Api.Data;
using Rass.Api.Domain.Entities;
using Rass.Api.Dtos;
using Rass.Api.Services;

namespace Rass.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class MarketPricesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ForecastingService _forecastingService;
    private readonly CatalogManagementService _catalog;

    public MarketPricesController(AppDbContext db, ForecastingService forecastingService, CatalogManagementService catalog)
    {
        _db = db;
        _forecastingService = forecastingService;
        _catalog = catalog;
    }

    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> Get([FromQuery] string? crop, [FromQuery] string? market, [FromQuery] string? region)
    {
        var query = _db.MarketPrices.AsQueryable();

        if (!string.IsNullOrWhiteSpace(crop))
            query = query.Where(p => p.Crop == crop);
        if (!string.IsNullOrWhiteSpace(market))
            query = query.Where(p => p.Market == market);
        if (!string.IsNullOrWhiteSpace(region))
            query = query.Where(p => p.Region == region);

        var prices = await query
            .OrderByDescending(p => p.ObservedAt)
            .Take(100)
            .ToListAsync();

        return Ok(prices);
    }

    [HttpGet("latest")]
    [AllowAnonymous]
    public async Task<IActionResult> GetLatest()
    {
        // Get latest approved price per crop-market combination
        var allPrices = await _db.MarketPrices
            .Where(p => p.VerificationStatus == "Approved")
            .OrderByDescending(p => p.ObservedAt)
            .ToListAsync();

        var latest = allPrices
            .GroupBy(p => new { p.Crop, p.Market })
            .Select(g => g.First())
            .OrderBy(p => p.Crop)
            .ThenBy(p => p.Market)
            .ToList();

        return Ok(latest);
    }

    [HttpPost]
    [Authorize(Policy = "MarketMonitoring")]
    public async Task<IActionResult> SubmitPrice(SubmitMarketPriceRequest request)
    {
        var agentId = GetUserId();
        var market = await _catalog.FindMarketAsync(request.Market);
        if (market == null)
            return BadRequest("Select a registered market before submitting a price.");

        string cropName;
        try
        {
            cropName = await _catalog.EnsureCropAsync(request.Crop, agentId, User.IsInRole("Government") ? "Government" : "MarketAgent", User.IsInRole("Government") || User.IsInRole("Admin"));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }

        var price = new MarketPrice
        {
            Id = Guid.NewGuid(),
            RegisteredMarketId = market.Id,
            Market = market.Name,
            Region = market.Province,
            District = market.District,
            Sector = market.Sector,
            Cell = market.Cell,
            Crop = cropName,
            PricePerKg = request.PricePerKg,
            ObservedAt = request.ObservedAt ?? DateTime.UtcNow,
            AgentId = agentId
        };

        _db.MarketPrices.Add(price);
        await _db.SaveChangesAsync();

        return Ok(price);
    }

    [HttpGet("forecast/{crop}/{market}")]
    [Authorize(Policy = "ForecastViewer")]
    public async Task<IActionResult> GetPriceForecast(string crop, string market, [FromQuery] int days = 7)
    {
        // Get historical prices for the crop and market
        var historicalPrices = await _db.MarketPrices
            .Where(p => p.Crop == crop && p.Market == market)
            .OrderByDescending(p => p.ObservedAt)
            .Take(60) // Last 60 data points
            .Select(p => new Services.HistoricalPrice
            {
                Date = p.ObservedAt,
                Price = p.PricePerKg
            })
            .ToListAsync();

        var forecast = await _forecastingService.GetPriceForecastAsync(
            crop, 
            market, 
            days, 
            historicalPrices
        );

        if (forecast == null)
        {
            return StatusCode(503, "Forecasting service unavailable");
        }

        return Ok(forecast);
    }

    [HttpPost("detect-anomaly")]
    [Authorize(Policy = "MarketMonitoring")]
    public async Task<IActionResult> DetectAnomaly([FromBody] AnomalyDetectionRequest request)
    {
        var historicalPrices = await _db.MarketPrices
            .Where(p => p.Crop == request.Crop && p.Market == request.Market)
            .OrderByDescending(p => p.ObservedAt)
            .Take(30)
            .Select(p => new Services.HistoricalPrice
            {
                Date = p.ObservedAt,
                Price = p.PricePerKg
            })
            .ToListAsync();

        var result = await _forecastingService.DetectAnomalyAsync(
            request.Crop,
            request.Market,
            request.CurrentPrice,
            historicalPrices
        );

        if (result == null)
        {
            return StatusCode(503, "Forecasting service unavailable");
        }

        return Ok(result);
    }

    private Guid? GetUserId()
    {
        var claim = User.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier") ??
                   User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
        return Guid.TryParse(claim?.Value, out var guid) ? guid : null;
    }
}

public record AnomalyDetectionRequest(
    string Crop,
    string Market,
    decimal CurrentPrice);

