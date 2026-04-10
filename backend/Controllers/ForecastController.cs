using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Rass.Api.Data;
using Rass.Api.Domain.Entities;
using Rass.Api.Dtos;
using Rass.Api.Services;
using System.Security.Claims;

namespace Rass.Api.Controllers;

[ApiController]
[Route("api/forecast")]
public class ForecastController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ForecastingService _forecastingService;

    public ForecastController(AppDbContext db, ForecastingService forecastingService)
    {
        _db = db;
        _forecastingService = forecastingService;
    }

    [HttpPost("public")]
    [AllowAnonymous]
    [EnableRateLimiting("public-forecast")]
    public async Task<IActionResult> GetPublicForecast([FromBody] ForecastPriceRequest request)
    {
        var days = Math.Clamp(request.Days, 1, 3);
        var result = await BuildForecastAsync(request.Crop, request.Market, days, "Buyer");
        return result;
    }

    [HttpPost("full")]
    [Authorize]
    [EnableRateLimiting("auth-forecast")]
    public async Task<IActionResult> GetFullForecast([FromBody] ForecastPriceRequest request)
    {
        var role = User.Claims.FirstOrDefault(c => c.Type == ClaimTypes.Role)?.Value ?? "General";
        var days = Math.Clamp(request.Days, 1, 30);
        var result = await BuildForecastAsync(request.Crop, request.Market, days, role);
        return result;
    }

    [HttpPost("farmer")]
    [Authorize(Roles = "Farmer")]
    [EnableRateLimiting("auth-forecast")]
    public Task<IActionResult> GetFarmerForecast([FromBody] ForecastPriceRequest request) =>
        BuildForecastAsync(request.Crop, request.Market, Math.Clamp(request.Days, 1, 30), "Farmer");

    [HttpPost("trader")]
    [Authorize(Roles = "Buyer")]
    [EnableRateLimiting("auth-forecast")]
    public Task<IActionResult> GetTraderForecast([FromBody] ForecastPriceRequest request) =>
        BuildForecastAsync(request.Crop, request.Market, Math.Clamp(request.Days, 1, 30), "Buyer");

    [HttpPost("transporter")]
    [Authorize(Roles = "Transporter")]
    [EnableRateLimiting("auth-forecast")]
    public Task<IActionResult> GetTransporterForecast([FromBody] ForecastPriceRequest request) =>
        BuildForecastAsync(request.Crop, request.Market, Math.Clamp(request.Days, 1, 30), "Transporter");

    [HttpPost("admin")]
    [Authorize(Roles = "Admin,Government")]
    [EnableRateLimiting("auth-forecast")]
    public Task<IActionResult> GetAdminForecast([FromBody] ForecastPriceRequest request) =>
        BuildForecastAsync(request.Crop, request.Market, Math.Clamp(request.Days, 1, 30), "Admin");

    [HttpPost("price/enhanced")]
    [Authorize(Policy = "ForecastViewer")]
    public async Task<IActionResult> GetEnhancedPriceForecast([FromBody] ForecastPriceRequest request)
    {
        var role = User.Claims.FirstOrDefault(c => c.Type == ClaimTypes.Role)?.Value
                   ?? Request.Headers["X-User-Role"].FirstOrDefault()
                   ?? "Buyer";
        return await BuildForecastAsync(request.Crop, request.Market, Math.Clamp(request.Days, 1, 14), role);
    }

    private async Task<IActionResult> BuildForecastAsync(string crop, string market, int days, string userRole)
    {
        if (string.IsNullOrWhiteSpace(crop) || string.IsNullOrWhiteSpace(market))
        {
            return BadRequest("Crop and market are required.");
        }

        var historicalPrices = await _db.MarketPrices
            .Where(p => p.Crop == crop && p.Market == market)
            .OrderByDescending(p => p.ObservedAt)
            .Take(90)
            .Select(p => new Services.HistoricalPrice
            {
                Date = p.ObservedAt,
                Price = p.PricePerKg
            })
            .ToListAsync();

        if (historicalPrices.Count < 7)
        {
            historicalPrices = await _db.MarketPrices
                .Where(p => p.Crop == crop)
                .OrderByDescending(p => p.ObservedAt)
                .Take(90)
                .Select(p => new Services.HistoricalPrice
                {
                    Date = p.ObservedAt,
                    Price = p.PricePerKg
                })
                .ToListAsync();
        }

        if (historicalPrices.Count < 7)
        {
            var listingPrices = await _db.MarketListings
                .Where(l => l.Crop == crop && l.MinimumPrice > 0)
                .OrderByDescending(l => l.CreatedAt)
                .Take(30)
                .Select(l => (decimal?)l.MinimumPrice)
                .ToListAsync();

            var seed = listingPrices.Any() ? listingPrices.Average() ?? 0 : 0;
            if (seed > 0)
            {
                historicalPrices = Enumerable.Range(0, 7).Select(i => new Services.HistoricalPrice
                {
                    Date = DateTime.UtcNow.Date.AddDays(-(6 - i)),
                    Price = seed
                }).ToList();
            }
        }

        if (historicalPrices.Count < 7)
        {
            return BadRequest($"Not enough real market data for {crop} in {market}. At least 7 observations are required.");
        }

        var externalFactors = new
        {
            season = GetCurrentSeason()
        };

        var normalizedRole = NormalizeForecastRole(userRole);
        var forecast = await _forecastingService.GetEnhancedPriceForecastAsync(
            crop,
            market,
            days,
            historicalPrices,
            externalFactors: externalFactors,
            userRole: normalizedRole
        );

        if (forecast == null)
        {
            return StatusCode(503, "Forecasting service unavailable");
        }

        var districtForecasts = await BuildDistrictForecastsAsync(crop, forecast, normalizedRole);
        forecast.DistrictForecasts = districtForecasts;
        forecast.Role = normalizedRole;
        forecast.RoleSpecificAdvice = BuildRoleAdvice(normalizedRole, crop, market, forecast.Trend, forecast.Volatility, forecast.RoleSpecificAdvice);
        if (!forecast.TopFactors.Any())
        {
            forecast.TopFactors = new List<string>
            {
                $"Season:{GetCurrentSeason()}",
                $"Coverage:{districtForecasts.Count(d => d.Confidence >= 0.70)} districts with strong confidence",
                $"RoleLens:{normalizedRole}",
            };
        }

        return Ok(forecast);
    }

    private async Task<List<DistrictForecastInsight>> BuildDistrictForecastsAsync(
        string crop,
        EnhancedPriceForecastResponse marketForecast,
        string role)
    {
        var now = DateTime.UtcNow;
        var lookbackStart = now.AddDays(-60);
        var districtRows = await _db.MarketPrices
            .Where(p => p.Crop == crop && p.ObservedAt >= lookbackStart && !string.IsNullOrWhiteSpace(p.District))
            .OrderBy(p => p.ObservedAt)
            .Select(p => new { p.District, p.Region, p.PricePerKg, p.ObservedAt })
            .ToListAsync();

        var marketStart = marketForecast.Predictions.FirstOrDefault()?.Median ?? 0d;
        var marketEnd = marketForecast.Predictions.LastOrDefault()?.Median ?? marketStart;
        var marketRatio = marketStart > 0 ? marketEnd / marketStart : 1d;

        var districtStats = districtRows
            .GroupBy(r => RwandaAdminData.FindDistrict(r.District) ?? r.District!)
            .ToDictionary(
                g => g.Key,
                g =>
                {
                    var ordered = g.OrderBy(x => x.ObservedAt).ToList();
                    var first = ordered.First().PricePerKg;
                    var last = ordered.Last().PricePerKg;
                    var avg = ordered.Average(x => x.PricePerKg);
                    var ratio = first > 0 ? (double)(last / first) : 1d;
                    var confidence = Math.Min(0.95, 0.45 + ordered.Count / 20d);
                    return new
                    {
                        Region = ordered.Last().Region,
                        Average = (double)avg,
                        MomentumRatio = Math.Clamp(ratio, 0.85d, 1.15d),
                        Confidence = confidence,
                        ObservationCount = ordered.Count,
                    };
                });

        var regionStats = districtRows
            .Where(r => !string.IsNullOrWhiteSpace(r.Region))
            .GroupBy(r => RwandaAdminData.NormalizeProvince(r.Region) ?? r.Region!)
            .ToDictionary(
                g => g.Key,
                g =>
                {
                    var ordered = g.OrderBy(x => x.ObservedAt).ToList();
                    var first = ordered.First().PricePerKg;
                    var last = ordered.Last().PricePerKg;
                    var avg = ordered.Average(x => x.PricePerKg);
                    var ratio = first > 0 ? (double)(last / first) : 1d;
                    return new
                    {
                        Average = (double)avg,
                        MomentumRatio = Math.Clamp(ratio, 0.90d, 1.10d),
                    };
                });

        var baseline = marketStart > 0
            ? marketStart
            : districtRows.Count > 0
                ? districtRows.Average(x => (double)x.PricePerKg)
                : 0d;
        if (baseline <= 0) baseline = 300d;

        var results = new List<DistrictForecastInsight>();
        foreach (var district in RwandaAdminData.GetAllDistricts())
        {
            var province = RwandaAdminData.GetProvinceForDistrict(district) ?? "Unknown";
            districtStats.TryGetValue(district, out var districtStat);
            regionStats.TryGetValue(province, out var regionStat);

            var current = districtStat?.Average ?? regionStat?.Average ?? baseline;
            var momentum = districtStat?.MomentumRatio ?? regionStat?.MomentumRatio ?? 1d;
            var forecasted = current * marketRatio * momentum;
            var trend = ClassifyTrend(current, forecasted);
            var confidence = districtStat?.Confidence ?? (regionStat != null ? 0.62 : 0.45);
            var reason = BuildDistrictReason(crop, district, province, trend, districtStat?.ObservationCount ?? 0, marketForecast.Trend);
            var roleAdvice = BuildDistrictRoleAdvice(role, crop, district, trend);

            results.Add(new DistrictForecastInsight
            {
                District = district,
                Region = province,
                CurrentPrice = Math.Round(current, 2),
                ForecastedPrice = Math.Round(forecasted, 2),
                Trend = trend,
                Confidence = Math.Round(confidence, 2),
                Reason = reason,
                RoleAdvice = roleAdvice,
            });
        }

        return results
            .OrderBy(r => r.Region)
            .ThenBy(r => r.District)
            .ToList();
    }

    private static string NormalizeForecastRole(string role)
    {
        if (string.IsNullOrWhiteSpace(role)) return "Buyer";
        var normalized = role.Trim();
        if (string.Equals(normalized, "Public", StringComparison.OrdinalIgnoreCase)) return "Buyer";
        if (string.Equals(normalized, "General", StringComparison.OrdinalIgnoreCase)) return "Buyer";
        if (string.Equals(normalized, "Trader", StringComparison.OrdinalIgnoreCase)) return "Buyer";
        if (string.Equals(normalized, "CooperativeManager", StringComparison.OrdinalIgnoreCase)) return "Seller";
        if (string.Equals(normalized, "Farmer", StringComparison.OrdinalIgnoreCase)) return "Seller";
        if (string.Equals(normalized, "MarketAgent", StringComparison.OrdinalIgnoreCase)) return "Seller";
        if (string.Equals(normalized, "Government", StringComparison.OrdinalIgnoreCase)) return "Government";
        if (string.Equals(normalized, "Admin", StringComparison.OrdinalIgnoreCase)) return "Government";
        if (string.Equals(normalized, "Buyer", StringComparison.OrdinalIgnoreCase)) return "Buyer";
        return normalized;
    }

    private static string BuildRoleAdvice(
        string role,
        string crop,
        string market,
        string trend,
        string volatility,
        string? currentAdvice)
    {
        var normalizedTrend = string.IsNullOrWhiteSpace(trend) ? "STABLE" : trend.ToUpperInvariant();
        var volatilityTone = string.Equals(volatility, "HIGH", StringComparison.OrdinalIgnoreCase)
            ? "Price swings are high; execute quickly and monitor daily."
            : "Price movement is manageable; review every 2-3 days.";

        if (role == "Seller")
        {
            if (normalizedTrend == "UP")
                return $"Seller action: Hold briefly and prepare to sell into strength for {crop}. {volatilityTone} Target markets like {market} first.";
            if (normalizedTrend == "DOWN")
                return $"Seller action: Sell now to reduce downside risk on {crop}. Prioritize quick-moving districts and avoid over-stocking.";
            return $"Seller action: Hold core stock and sell gradually while the market remains stable for {crop}.";
        }

        if (role == "Government")
        {
            if (normalizedTrend == "UP")
                return $"Government action: Activate price stabilization for {crop} (regional releases, temporary logistics support, and targeted moderation enforcement).";
            if (normalizedTrend == "DOWN")
                return $"Government action: Protect producers of {crop} through floor-price monitoring, storage support, and coordinated procurement.";
            return $"Government action: Maintain monitoring for {crop} and prepare district contingency actions if volatility increases.";
        }

        // Buyer + guest default
        if (normalizedTrend == "UP")
            return $"Buyer action: Buy and stock {crop} immediately before additional increases. Focus districts with strongest upward pressure.";
        if (normalizedTrend == "DOWN")
            return $"Buyer action: Stagger purchases of {crop}; negotiate lower prices in districts showing strongest declines.";
        return currentAdvice ?? $"Buyer action: Build moderate stock of {crop} and monitor district-level shifts for tactical buying.";
    }

    private static string ClassifyTrend(double currentPrice, double forecastedPrice)
    {
        if (currentPrice <= 0) return "STABLE";
        var changeRatio = (forecastedPrice - currentPrice) / currentPrice;
        if (changeRatio >= 0.02d) return "UP";
        if (changeRatio <= -0.02d) return "DOWN";
        return "STABLE";
    }

    private static string BuildDistrictReason(
        string crop,
        string district,
        string province,
        string trend,
        int observations,
        string nationalTrend)
    {
        var evidence = observations >= 6
            ? $"based on {observations} recent observations in {district}"
            : $"using regional signals for {province} due to limited direct observations in {district}";

        return trend switch
        {
            "UP" => $"{crop} is expected to rise in {district} {evidence}, aligned with national trend ({nationalTrend}).",
            "DOWN" => $"{crop} is expected to fall in {district} {evidence}, indicating easing supply pressure.",
            _ => $"{crop} is expected to remain stable in {district} {evidence}, with no sharp short-term shock detected.",
        };
    }

    private static string BuildDistrictRoleAdvice(string role, string crop, string district, string trend)
    {
        if (role == "Government")
        {
            return trend == "UP"
                ? $"Prioritize market supervision, strategic stock releases, and trader coordination for {crop} in {district}."
                : trend == "DOWN"
                    ? $"Protect producer margins in {district} with floor-price checks and storage incentives for {crop}."
                    : $"Maintain monitoring and weekly review meetings for {crop} in {district}.";
        }

        if (role == "Seller")
        {
            return trend == "UP"
                ? $"Seller: Hold briefly, then sell into peak demand in {district}."
                : trend == "DOWN"
                    ? $"Seller: Reduce exposure and sell faster in {district}."
                    : $"Seller: Keep balanced stock and sell progressively in {district}.";
        }

        return trend == "UP"
            ? $"Buyer: Buy and stock early in {district} before prices climb further."
            : trend == "DOWN"
                ? $"Buyer: Delay full purchase and negotiate better rates in {district}."
                : $"Buyer: Continue regular buying cadence in {district}.";
    }

    private static string GetCurrentSeason()
    {
        var month = DateTime.UtcNow.Month;
        if (month is >= 9 or <= 1)
        {
            return "harvesting";
        }

        if (month is >= 2 and <= 6)
        {
            return "planting";
        }

        return "lean";
    }
}
