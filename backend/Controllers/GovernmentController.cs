using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Rass.Api.Data;

namespace Rass.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Government,Admin")]
public class GovernmentController : ControllerBase
{
    private readonly AppDbContext _db;

    public GovernmentController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet("dashboard")]
    public async Task<IActionResult> GetDashboard()
    {
        var dashboard = new
        {
            MarketOverview = new
            {
                TotalListings = await _db.MarketListings.CountAsync(l => l.Status == "Active"),
                TotalVolume = await _db.MarketListings.Where(l => l.Status == "Active").SumAsync(l => l.QuantityKg),
                AveragePrice = await _db.MarketPrices
                    .GroupBy(p => p.Crop)
                    .Select(g => new
                    {
                        Crop = g.Key,
                        AveragePrice = g.Average(p => p.PricePerKg),
                        LatestPrice = g.OrderByDescending(p => p.ObservedAt).First().PricePerKg
                    })
                    .ToListAsync()
            },
            SupplyChain = new
            {
                TotalFarmers = await _db.Farmers.CountAsync(),
                ActiveCooperatives = await _db.Cooperatives.CountAsync(c => c.IsActive && c.IsVerified),
                TotalContracts = await _db.Contracts.CountAsync(),
                CompletedDeliveries = await _db.TransportRequests.CountAsync(t => t.Status == "Completed")
            },
            PriceTrends = await _db.MarketPrices
                .GroupBy(p => new { p.Crop, p.Market })
                .Select(g => new
                {
                    Crop = g.Key.Crop,
                    Market = g.Key.Market,
                    CurrentPrice = g.OrderByDescending(p => p.ObservedAt).First().PricePerKg,
                    PreviousPrice = g.OrderByDescending(p => p.ObservedAt).Count() > 1
                        ? g.OrderByDescending(p => p.ObservedAt).Skip(1).First().PricePerKg
                        : (decimal?)null,
                    Change = g.OrderByDescending(p => p.ObservedAt).Count() > 1
                        ? g.OrderByDescending(p => p.ObservedAt).First().PricePerKg -
                          g.OrderByDescending(p => p.ObservedAt).Skip(1).First().PricePerKg
                        : 0m
                })
                .ToListAsync(),
            RegionalDistribution = await _db.Cooperatives
                .GroupBy(c => c.Region)
                .Select(g => new
                {
                    Region = g.Key,
                    CooperativeCount = g.Count(),
                    FarmerCount = g.SelectMany(c => c.Farmers).Count(),
                    TotalVolume = g.SelectMany(c => c.Lots).Sum(l => l.QuantityKg)
                })
                .ToListAsync()
        };

        return Ok(dashboard);
    }

    [HttpGet("price-analysis")]
    public async Task<IActionResult> GetPriceAnalysis([FromQuery] string? crop, [FromQuery] int days = 30)
    {
        var cutoff = DateTime.UtcNow.AddDays(-days);
        var query = _db.MarketPrices.Where(p => p.ObservedAt >= cutoff);

        if (!string.IsNullOrEmpty(crop))
        {
            query = query.Where(p => p.Crop == crop);
        }

        var analysis = await query
            .GroupBy(p => new { p.Crop, p.Market })
            .Select(g => new
            {
                Crop = g.Key.Crop,
                Market = g.Key.Market,
                MinPrice = g.Min(p => p.PricePerKg),
                MaxPrice = g.Max(p => p.PricePerKg),
                AvgPrice = g.Average(p => p.PricePerKg),
                CurrentPrice = g.OrderByDescending(p => p.ObservedAt).First().PricePerKg,
                PriceVolatility = g.Max(p => p.PricePerKg) - g.Min(p => p.PricePerKg),
                DataPoints = g.Count()
            })
            .OrderBy(a => a.Crop)
            .ThenBy(a => a.Market)
            .ToListAsync();

        return Ok(analysis);
    }

    [HttpGet("supply-demand")]
    public async Task<IActionResult> GetSupplyDemand()
    {
        var supply = await _db.MarketListings
            .Where(l => l.Status == "Active")
            .GroupBy(l => l.Crop)
            .Select(g => new
            {
                Crop = g.Key,
                TotalSupply = g.Sum(l => l.QuantityKg),
                AveragePrice = g.Average(l => l.MinimumPrice),
                Listings = g.Count()
            })
            .ToListAsync();

        var demand = await _db.BuyerOrders
            .Where(o => o.Status == "Open" || o.Status == "Accepted")
            .GroupBy(o => o.Crop)
            .Select(g => new
            {
                Crop = g.Key,
                TotalDemand = g.Sum(o => o.QuantityKg),
                AveragePriceOffer = g.Average(o => o.PriceOffer),
                Orders = g.Count()
            })
            .ToListAsync();

        var supplyDemand = supply
            .GroupJoin(demand,
                s => s.Crop,
                d => d.Crop,
                (s, d) => new
                {
                    Crop = s.Crop,
                    Supply = s.TotalSupply,
                    Demand = d.FirstOrDefault()?.TotalDemand ?? 0,
                    SupplyPrice = s.AveragePrice,
                    DemandPrice = d.FirstOrDefault()?.AveragePriceOffer ?? 0,
                    Balance = s.TotalSupply - (d.FirstOrDefault()?.TotalDemand ?? 0),
                    Status = s.TotalSupply > (d.FirstOrDefault()?.TotalDemand ?? 0) ? "Surplus" : "Deficit"
                })
            .ToList();

        return Ok(supplyDemand);
    }

    [HttpGet("export-report")]
    public async Task<IActionResult> ExportReport([FromQuery] string reportType, [FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate)
    {
        var start = startDate ?? DateTime.UtcNow.AddMonths(-1);
        var end = endDate ?? DateTime.UtcNow;

        var report = reportType.ToLower() switch
        {
            "transactions" => await GetTransactionReport(start, end),
            "prices" => await GetPriceReport(start, end),
            "supplychain" => await GetSupplyChainReport(start, end),
            _ => null
        };

        if (report == null)
        {
            return BadRequest("Invalid report type. Use: transactions, prices, or supplychain");
        }

        return Ok(report);
    }

    private async Task<object> GetTransactionReport(DateTime start, DateTime end)
    {
        return new
        {
            ReportType = "Transactions",
            Period = $"{start:yyyy-MM-dd} to {end:yyyy-MM-dd}",
            TotalContracts = await _db.Contracts.CountAsync(),
            TotalValue = await _db.PaymentLedgers
                .Where(p => p.CreatedAt >= start && p.CreatedAt <= end && p.Status == "Completed")
                .SumAsync(p => p.Amount),
            Transactions = await _db.PaymentLedgers
                .Where(p => p.CreatedAt >= start && p.CreatedAt <= end)
                .Include(p => p.Contract)
                .ThenInclude(c => c.BuyerOrder)
                .Select(p => new
                {
                    p.Id,
                    p.Reference,
                    p.Amount,
                    p.Status,
                    p.Type,
                    p.CreatedAt,
                    Crop = p.Contract != null ? p.Contract.BuyerOrder.Crop : "N/A"
                })
                .ToListAsync()
        };
    }

    private async Task<object> GetPriceReport(DateTime start, DateTime end)
    {
        return new
        {
            ReportType = "Prices",
            Period = $"{start:yyyy-MM-dd} to {end:yyyy-MM-dd}",
            PriceData = await _db.MarketPrices
                .Where(p => p.ObservedAt >= start && p.ObservedAt <= end)
                .GroupBy(p => new { p.Crop, p.Market })
                .Select(g => new
                {
                    Crop = g.Key.Crop,
                    Market = g.Key.Market,
                    MinPrice = g.Min(p => p.PricePerKg),
                    MaxPrice = g.Max(p => p.PricePerKg),
                    AvgPrice = g.Average(p => p.PricePerKg),
                    Observations = g.Count()
                })
                .ToListAsync()
        };
    }

    private async Task<object> GetSupplyChainReport(DateTime start, DateTime end)
    {
        return new
        {
            ReportType = "Supply Chain",
            Period = $"{start:yyyy-MM-dd} to {end:yyyy-MM-dd}",
            HarvestDeclarations = await _db.HarvestDeclarations
                .CountAsync(h => h.CreatedAt >= start && h.CreatedAt <= end),
            MarketListings = await _db.MarketListings
                .CountAsync(l => l.CreatedAt >= start && l.CreatedAt <= end),
            Orders = await _db.BuyerOrders
                .CountAsync(o => o.CreatedAt >= start && o.CreatedAt <= end),
            Deliveries = await _db.TransportRequests
                .CountAsync(t => t.CreatedAt >= start && t.CreatedAt <= end && t.Status == "Completed")
        };
    }
}

