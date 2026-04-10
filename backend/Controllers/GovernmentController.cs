using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Rass.Api.Data;
using Rass.Api.Dtos;
using Rass.Api.Services;
using System.Text.Json;

namespace Rass.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Government,Admin")]
public class GovernmentController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ForecastingService _forecastingService;

    public GovernmentController(AppDbContext db, ForecastingService forecastingService)
    {
        _db = db;
        _forecastingService = forecastingService;
    }

    [HttpGet("dashboard")]
    public async Task<IActionResult> GetDashboard()
    {
        // Fetch price data first, compute trends in memory to avoid unsupported SQL
        var allPrices = await _db.MarketPrices
            .OrderByDescending(p => p.ObservedAt)
            .ToListAsync();
        var nationalPriceTrends = allPrices
            .GroupBy(p => new DateTime(p.ObservedAt.Year, p.ObservedAt.Month, 1))
            .OrderBy(g => g.Key)
            .Select(g => new
            {
                month = g.Key.ToString("yyyy-MM"),
                value = Math.Round(g.Average(x => x.PricePerKg), 2)
            })
            .ToList();

        var priceTrends = allPrices
            .GroupBy(p => new { p.Crop, p.Market })
            .Select(g =>
            {
                var sorted = g.OrderByDescending(p => p.ObservedAt).ToList();
                var current = sorted.FirstOrDefault()?.PricePerKg ?? 0;
                var previous = sorted.Count > 1 ? sorted[1].PricePerKg : (decimal?)null;
                return new
                {
                    Crop = g.Key.Crop,
                    Market = g.Key.Market,
                    CurrentPrice = current,
                    PreviousPrice = previous,
                    Change = previous.HasValue ? current - previous.Value : 0m
                };
            })
            .ToList();

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
            NationalPriceTrends = nationalPriceTrends,
            TrendExplanation = BuildTrendExplanation(nationalPriceTrends.Select(x => x.value).ToList()),
            PriceTrends = priceTrends,
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

    [HttpGet("listing-moderation")]
    public async Task<IActionResult> GetListingModerationQueue(
        [FromQuery] string? status = null,
        [FromQuery] string? crop = null,
        [FromQuery] string? region = null,
        [FromQuery] int take = 200)
    {
        var query = _db.MarketListings
            .Include(l => l.Cooperative)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(l => l.Status == status);
        if (!string.IsNullOrWhiteSpace(crop))
            query = query.Where(l => l.Crop == crop);
        if (!string.IsNullOrWhiteSpace(region))
            query = query.Where(l => l.Cooperative.Region == region);

        var rows = await query
            .OrderByDescending(l => l.CreatedAt)
            .Take(Math.Clamp(take, 1, 500))
            .Select(l => new
            {
                l.Id,
                l.Crop,
                l.QuantityKg,
                l.MinimumPrice,
                l.QualityGrade,
                l.Status,
                l.AvailabilityWindowStart,
                l.AvailabilityWindowEnd,
                l.CreatedAt,
                Cooperative = new
                {
                    l.Cooperative.Id,
                    l.Cooperative.Name,
                    l.Cooperative.Region,
                    l.Cooperative.District,
                    l.Cooperative.Sector
                }
            })
            .ToListAsync();

        return Ok(new
        {
            total = rows.Count,
            rows
        });
    }

    [HttpGet("price-analysis")]
    public async Task<IActionResult> GetPriceAnalysis([FromQuery] string? crop, [FromQuery] string? region, [FromQuery] int days = 30)
    {
        var cutoff = DateTime.UtcNow.AddDays(-days);
        var query = _db.MarketPrices.Where(p => p.ObservedAt >= cutoff);

        if (!string.IsNullOrEmpty(crop))
            query = query.Where(p => p.Crop == crop);
        if (!string.IsNullOrEmpty(region))
            query = query.Where(p => p.Region == region);

        var analysis = await query
            .GroupBy(p => new { p.Crop, p.Market, p.Region })
            .Select(g => new
            {
                Crop = g.Key.Crop,
                Market = g.Key.Market,
                Region = g.Key.Region,
                MinPrice = g.Min(p => p.PricePerKg),
                MaxPrice = g.Max(p => p.PricePerKg),
                AvgPrice = g.Average(p => p.PricePerKg),
                CurrentPrice = g.OrderByDescending(p => p.ObservedAt).First().PricePerKg,
                PriceVolatility = g.Max(p => p.PricePerKg) - g.Min(p => p.PricePerKg),
                DataPoints = g.Count()
            })
            .OrderBy(a => a.Region)
            .ThenBy(a => a.Crop)
            .ThenBy(a => a.Market)
            .ToListAsync();

        return Ok(analysis);
    }

    [HttpGet("price-series")]
    public async Task<IActionResult> GetPriceSeries([FromQuery] int months = 6)
    {
        var cutoff = DateTime.UtcNow.AddMonths(-months);
        var prices = await _db.MarketPrices
            .Where(p => p.ObservedAt >= cutoff)
            .ToListAsync();

        var grouped = prices
            .GroupBy(p => new { p.Crop, Month = new DateTime(p.ObservedAt.Year, p.ObservedAt.Month, 1) })
            .Select(g => new
            {
                Crop = g.Key.Crop,
                Month = g.Key.Month,
                AvgPrice = g.Average(p => p.PricePerKg)
            })
            .ToList();

        var topCrops = grouped
            .GroupBy(g => g.Crop)
            .OrderByDescending(g => g.Count())
            .Select(g => g.Key)
            .Take(5)
            .ToList();

        var series = grouped
            .Where(g => topCrops.Contains(g.Crop))
            .OrderBy(g => g.Month)
            .Select(g => new
            {
                g.Crop,
                Month = g.Month.ToString("yyyy-MM"),
                g.AvgPrice
            })
            .ToList();

        return Ok(series);
    }

    [HttpGet("national-forecast")]
    public async Task<IActionResult> GetNationalForecast([FromQuery] int days = 7, [FromQuery] int limit = 5)
    {
        var recent = await _db.MarketPrices
            .OrderByDescending(p => p.ObservedAt)
            .Take(500)
            .ToListAsync();

        var latestByCrop = recent
            .GroupBy(p => p.Crop)
            .Select(g => g.OrderByDescending(p => p.ObservedAt).First())
            .Take(limit)
            .ToList();

        var results = new List<object>();

        foreach (var latest in latestByCrop)
        {
            var history = await _db.MarketPrices
                .Where(p => p.Crop == latest.Crop && p.Market == latest.Market)
                .OrderByDescending(p => p.ObservedAt)
                .Take(60)
                .Select(p => new HistoricalPrice
                {
                    Date = p.ObservedAt,
                    Price = p.PricePerKg
                })
                .ToListAsync();

            var forecast = await _forecastingService.GetEnhancedPriceForecastAsync(
                latest.Crop,
                latest.Market,
                days,
                history,
                externalFactors: new { season = GetCurrentSeason() }
            );

            var forecastMedian = forecast?.Predictions.Select(p => p.Median).DefaultIfEmpty((double)latest.PricePerKg).Average() ?? (double)latest.PricePerKg;
            var changePct = latest.PricePerKg > 0
                ? ((forecastMedian - (double)latest.PricePerKg) / (double)latest.PricePerKg) * 100
                : 0;

            results.Add(new
            {
                crop = latest.Crop,
                market = latest.Market,
                currentPrice = latest.PricePerKg,
                forecastPrice = Math.Round(forecastMedian, 2),
                change = Math.Round(changePct, 1)
            });
        }

        return Ok(results);
    }

    private static string GetCurrentSeason()
    {
        var month = DateTime.UtcNow.Month;
        if (month is >= 9 or <= 1) return "harvesting";
        if (month is >= 2 and <= 6) return "planting";
        return "lean";
    }

    [HttpGet("supply-demand")]
    public async Task<IActionResult> GetSupplyDemand()
    {
        var supplyDemand = await GetSupplyDemandRows();
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

    /// <summary>
    /// Parametric report generator — supports dynamic filtering by crop, region, date range.
    /// Report types: price-trend, crop-growth, supply-demand, regional-performance, price-regulation-compliance
    /// </summary>
    [HttpPost("generate-report")]
    public async Task<IActionResult> GenerateReport(GenerateReportRequest request)
    {
        var start = request.StartDate ?? DateTime.UtcNow.AddMonths(-6);
        var end = request.EndDate ?? DateTime.UtcNow;

        object report = request.ReportType.ToLower() switch
        {
            "price-trend" => await GeneratePriceTrendReport(request.Crop, request.Region, request.District, start, end, request.Aggregation ?? "monthly"),
            "crop-growth" => await GenerateCropGrowthReport(start, end, request.Region),
            "supply-demand" => await GenerateSupplyDemandReport(request.Crop, request.Region),
            "regional-performance" => await GenerateRegionalPerformanceReport(start, end, request.Crop),
            "regulation-compliance" => await GenerateRegulationComplianceReport(request.Crop, request.Region),
            "comprehensive" => await GenerateComprehensiveReport(start, end),
            "farmers" => await GenerateFarmersReport(request.Region, request.District),
            "cooperatives" => await GenerateCooperativesReport(request.Region),
            "listings" or "market-listings" => await GenerateListingsReport(request.Crop, request.Region, start, end),
            "harvests" or "harvest-declarations" => await GenerateHarvestsReport(request.Crop, request.Region, start, end),
            "inventory" or "lots" => await GenerateInventoryReport(request.Crop, request.Region),
            "transporters" => await GenerateTransportersReport(request.Region),
            "market-agents" or "marketagents" => await GenerateMarketAgentsReport(request.Region, request.District, start, end),
            "storage-keepers" or "storagekeepers" or "storage-operators" => await GenerateStorageKeepersReport(request.Region, request.District, start, end),
            "transport-jobs" => await GenerateTransportJobsReport(request.Region, start, end),
            "contracts" => await GenerateContractsReport(request.Crop, start, end),
            "orders" => await GenerateOrdersReport(request.Crop, start, end),
            "payments" or "transactions" => await GeneratePaymentsReport(start, end),
            _ => new { error = "Invalid report type. Supported: price-trend, crop-growth, supply-demand, regional-performance, regulation-compliance, comprehensive, farmers, cooperatives, listings, harvests, inventory, transporters, market-agents, storage-keepers, transport-jobs, contracts, orders, payments" }
        };

        return Ok(report);
    }

    /// <summary>
    /// Universal CSV/Excel export for all report types
    /// </summary>
    [HttpGet("export-csv")]
    public async Task<IActionResult> ExportCsv(
        [FromQuery] string reportType,
        [FromQuery] string? crop = null,
        [FromQuery] string? region = null,
        [FromQuery] string? district = null,
        [FromQuery] string? status = null,
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null)
    {
        var start = startDate ?? DateTime.UtcNow.AddMonths(-6);
        var end = endDate ?? DateTime.UtcNow;
        string csv;
        string fileName;

        switch (reportType.ToLower())
        {
            case "prices":
            case "price-trend":
            {
                var query = _db.MarketPrices.Where(p => p.ObservedAt >= start && p.ObservedAt <= end);
                if (!string.IsNullOrWhiteSpace(crop)) query = query.Where(p => p.Crop == crop);
                if (!string.IsNullOrWhiteSpace(region)) query = query.Where(p => p.Region == region);
                var data = await query.OrderBy(p => p.ObservedAt).ToListAsync();
                csv = "Date,Crop,Market,Region,District,PricePerKg,VerificationStatus\n" +
                      string.Join("\n", data.Select(p => $"{p.ObservedAt:yyyy-MM-dd},{Esc(p.Crop)},{Esc(p.Market)},{Esc(p.Region)},{Esc(p.District)},{p.PricePerKg},{p.VerificationStatus}"));
                fileName = $"RASS_prices_{start:yyyyMMdd}_{end:yyyyMMdd}.csv";
                break;
            }
            case "farmers":
            {
                var query = _db.Farmers.Include(f => f.User).Include(f => f.Cooperative).AsQueryable();
                if (!string.IsNullOrWhiteSpace(region)) query = query.Where(f => f.Cooperative != null && f.Cooperative.Region == region);
                var data = await query.OrderBy(f => f.User.FullName).ToListAsync();
                csv = "FullName,Email,Phone,NationalId,District,Sector,Crops,FarmSizeHa,IsActive,Cooperative,CooperativeRegion\n" +
                      string.Join("\n", data.Select(f => $"{Esc(f.User.FullName)},{Esc(f.User.Email)},{Esc(f.Phone)},{Esc(f.NationalId)},{Esc(f.District)},{Esc(f.Sector)},{Esc(f.Crops)},{f.FarmSizeHectares},{f.IsActive},{Esc(f.Cooperative?.Name)},{Esc(f.Cooperative?.Region)}"));
                fileName = $"RASS_farmers_{DateTime.UtcNow:yyyyMMdd}.csv";
                break;
            }
            case "cooperatives":
            {
                var query = _db.Cooperatives.Include(c => c.Farmers).Include(c => c.Lots).AsQueryable();
                if (!string.IsNullOrWhiteSpace(region)) query = query.Where(c => c.Region == region);
                var data = await query.OrderBy(c => c.Name).ToListAsync();
                csv = "Name,Region,District,Location,Phone,Email,IsVerified,IsActive,FarmerCount,TotalLots,TotalInventoryKg\n" +
                      string.Join("\n", data.Select(c => $"{Esc(c.Name)},{Esc(c.Region)},{Esc(c.District)},{Esc(c.Location)},{Esc(c.Phone)},{Esc(c.Email)},{c.IsVerified},{c.IsActive},{c.Farmers.Count},{c.Lots.Count},{c.Lots.Sum(l => l.QuantityKg):F0}"));
                fileName = $"RASS_cooperatives_{DateTime.UtcNow:yyyyMMdd}.csv";
                break;
            }
            case "listings":
            case "market-listings":
            {
                var query = _db.MarketListings.Include(l => l.Cooperative).Where(l => l.CreatedAt >= start && l.CreatedAt <= end);
                if (!string.IsNullOrWhiteSpace(crop)) query = query.Where(l => l.Crop == crop);
                if (!string.IsNullOrWhiteSpace(region)) query = query.Where(l => l.Cooperative.Region == region);
                if (!string.IsNullOrWhiteSpace(status)) query = query.Where(l => l.Status == status);
                var data = await query.OrderByDescending(l => l.CreatedAt).ToListAsync();
                csv = "Crop,QuantityKg,MinimumPrice,QualityGrade,Status,Cooperative,Region,District,AvailabilityStart,AvailabilityEnd,CreatedAt\n" +
                      string.Join("\n", data.Select(l => $"{Esc(l.Crop)},{l.QuantityKg},{l.MinimumPrice},{Esc(l.QualityGrade)},{l.Status},{Esc(l.Cooperative?.Name)},{Esc(l.Cooperative?.Region)},{Esc(l.Cooperative?.District)},{l.AvailabilityWindowStart:yyyy-MM-dd},{l.AvailabilityWindowEnd:yyyy-MM-dd},{l.CreatedAt:yyyy-MM-dd}"));
                fileName = $"RASS_listings_{start:yyyyMMdd}_{end:yyyyMMdd}.csv";
                break;
            }
            case "harvests":
            case "harvest-declarations":
            {
                var query = _db.HarvestDeclarations.Include(h => h.Farmer).ThenInclude(f => f.User).Where(h => h.CreatedAt >= start && h.CreatedAt <= end);
                if (!string.IsNullOrWhiteSpace(crop)) query = query.Where(h => h.Crop == crop);
                var data = await query.OrderByDescending(h => h.CreatedAt).ToListAsync();
                csv = "Farmer,Crop,ExpectedQuantityKg,ExpectedHarvestDate,QualityIndicators,Status,ConditionGrade,CreatedAt\n" +
                      string.Join("\n", data.Select(h => $"{Esc(h.Farmer?.User?.FullName)},{Esc(h.Crop)},{h.ExpectedQuantityKg},{h.ExpectedHarvestDate:yyyy-MM-dd},{Esc(h.QualityIndicators)},{h.Status},{Esc(h.ConditionGrade)},{h.CreatedAt:yyyy-MM-dd}"));
                fileName = $"RASS_harvests_{start:yyyyMMdd}_{end:yyyyMMdd}.csv";
                break;
            }
            case "inventory":
            case "lots":
            {
                var query = _db.Lots.Include(l => l.Cooperative).AsQueryable();
                if (!string.IsNullOrWhiteSpace(crop)) query = query.Where(l => l.Crop == crop);
                if (!string.IsNullOrWhiteSpace(region)) query = query.Where(l => l.Cooperative.Region == region);
                var data = await query.OrderByDescending(l => l.CreatedAt).ToListAsync();
                csv = "Crop,QuantityKg,QualityGrade,Status,Verified,Cooperative,Region,ExpectedPricePerKg,ExpectedHarvestDate,CreatedAt\n" +
                      string.Join("\n", data.Select(l => $"{Esc(l.Crop)},{l.QuantityKg},{Esc(l.QualityGrade)},{l.Status},{l.Verified},{Esc(l.Cooperative?.Name)},{Esc(l.Cooperative?.Region)},{l.ExpectedPricePerKg},{l.ExpectedHarvestDate:yyyy-MM-dd},{l.CreatedAt:yyyy-MM-dd}"));
                fileName = $"RASS_inventory_{DateTime.UtcNow:yyyyMMdd}.csv";
                break;
            }
            case "transporters":
            {
                var data = await _db.TransporterProfiles.Include(t => t.User).OrderBy(t => t.User.FullName).ToListAsync();
                csv = "FullName,Email,CompanyName,Phone,VehicleType,LicensePlate,CapacityKg,LicenseNumber,OperatingRegions,IsVerified,IsActive\n" +
                      string.Join("\n", data.Select(t => $"{Esc(t.User.FullName)},{Esc(t.User.Email)},{Esc(t.CompanyName)},{Esc(t.Phone)},{Esc(t.VehicleType)},{Esc(t.LicensePlate)},{t.CapacityKg},{Esc(t.LicenseNumber)},{Esc(t.OperatingRegions)},{t.IsVerified},{t.IsActive}"));
                fileName = $"RASS_transporters_{DateTime.UtcNow:yyyyMMdd}.csv";
                break;
            }
            case "market-agents":
            case "marketagents":
            {
                var roleId = await _db.Roles.Where(r => r.Name == "MarketAgent").Select(r => r.Id).FirstOrDefaultAsync();
                var marketAgentUsers = roleId == Guid.Empty
                    ? new List<Domain.Entities.User>()
                    : await _db.Users
                        .Where(u => u.UserRoles.Any(ur => ur.RoleId == roleId))
                        .OrderBy(u => u.FullName)
                        .ToListAsync();

                var priceRows = await _db.MarketPrices
                    .Where(p => p.ObservedAt >= start && p.ObservedAt <= end)
                    .ToListAsync();

                if (!string.IsNullOrWhiteSpace(region))
                    priceRows = priceRows.Where(p => p.Region == region).ToList();
                if (!string.IsNullOrWhiteSpace(district))
                    priceRows = priceRows.Where(p => p.District == district).ToList();

                var byAgent = priceRows
                    .Where(p => p.AgentId.HasValue)
                    .GroupBy(p => p.AgentId!.Value)
                    .ToDictionary(
                        g => g.Key,
                        g => new
                        {
                            Submissions = g.Count(),
                            DistinctMarkets = g.Select(x => x.Market).Where(x => !string.IsNullOrWhiteSpace(x)).Distinct(StringComparer.OrdinalIgnoreCase).Count(),
                            DistinctCrops = g.Select(x => x.Crop).Where(x => !string.IsNullOrWhiteSpace(x)).Distinct(StringComparer.OrdinalIgnoreCase).Count(),
                            LastSubmissionAt = g.Max(x => x.ObservedAt),
                            LastRegion = g.OrderByDescending(x => x.ObservedAt).First().Region,
                            LastDistrict = g.OrderByDescending(x => x.ObservedAt).First().District,
                        });

                csv = "FullName,Email,IsActive,PriceSubmissions,DistinctMarkets,DistinctCrops,LastSubmissionAt,LastRegion,LastDistrict\n" +
                      string.Join("\n", marketAgentUsers.Select(u =>
                      {
                          byAgent.TryGetValue(u.Id, out var stats);
                          return $"{Esc(u.FullName)},{Esc(u.Email)},{u.IsActive},{stats?.Submissions ?? 0},{stats?.DistinctMarkets ?? 0},{stats?.DistinctCrops ?? 0},{(stats != null ? stats.LastSubmissionAt.ToString("yyyy-MM-dd") : "")},{Esc(stats?.LastRegion)},{Esc(stats?.LastDistrict)}";
                      }));
                fileName = $"RASS_market_agents_{start:yyyyMMdd}_{end:yyyyMMdd}.csv";
                break;
            }
            case "storage-keepers":
            case "storagekeepers":
            case "storage-operators":
            {
                var facilities = await _db.StorageFacilities.OrderBy(f => f.Name).ToListAsync();
                var bookings = await _db.StorageBookings
                    .Include(b => b.StorageFacility)
                    .Where(b => b.StartDate <= end && b.EndDate >= start)
                    .ToListAsync();

                if (!string.IsNullOrWhiteSpace(region))
                    bookings = bookings.Where(b => (b.StorageFacility?.Location ?? string.Empty).Contains(region, StringComparison.OrdinalIgnoreCase)).ToList();
                if (!string.IsNullOrWhiteSpace(district))
                    bookings = bookings.Where(b => (b.StorageFacility?.Location ?? string.Empty).Contains(district, StringComparison.OrdinalIgnoreCase)).ToList();

                csv = "Facility,Location,CapacityKg,AvailableKg,UtilizationPct,BookingsInPeriod,ActiveBookings,ReservedKg,ConfirmedKg,CompletedKg\n" +
                      string.Join("\n", facilities.Select(f =>
                      {
                          var facilityBookings = bookings.Where(b => b.StorageFacilityId == f.Id).ToList();
                          var utilization = f.CapacityKg > 0 ? Math.Round(((f.CapacityKg - f.AvailableKg) / f.CapacityKg) * 100, 2) : 0;
                          var reservedKg = facilityBookings.Where(b => b.Status == "Reserved").Sum(b => b.QuantityKg);
                          var confirmedKg = facilityBookings.Where(b => b.Status == "Confirmed").Sum(b => b.QuantityKg);
                          var completedKg = facilityBookings.Where(b => b.Status == "Completed").Sum(b => b.QuantityKg);
                          var activeBookings = facilityBookings.Count(b => b.Status == "Reserved" || b.Status == "Confirmed");
                          return $"{Esc(f.Name)},{Esc(f.Location)},{f.CapacityKg},{f.AvailableKg},{utilization},{facilityBookings.Count},{activeBookings},{reservedKg},{confirmedKg},{completedKg}";
                      }));
                fileName = $"RASS_storage_keepers_{start:yyyyMMdd}_{end:yyyyMMdd}.csv";
                break;
            }
            case "transport-jobs":
            {
                var query = _db.TransportJobs.Include(j => j.Cooperative).Include(j => j.AssignedTransporter).Where(j => j.CreatedAt >= start && j.CreatedAt <= end);
                var data = await query.OrderByDescending(j => j.CreatedAt).ToListAsync();
                csv = "Title,Crop,QuantityKg,PickupLocation,DeliveryLocation,DistanceKm,Status,PaymentRange,Cooperative,AssignedTransporter,PickupDate,DeliveryDeadline,CreatedAt\n" +
                      string.Join("\n", data.Select(j => $"{Esc(j.Title)},{Esc(j.Crop)},{j.QuantityKg},{Esc(j.PickupLocation)},{Esc(j.DeliveryLocation)},{j.DistanceKm},{j.Status},{j.MinPaymentRwf}-{j.MaxPaymentRwf},{Esc(j.Cooperative?.Name)},{Esc(j.AssignedTransporter?.FullName)},{j.PickupDate:yyyy-MM-dd},{j.DeliveryDeadline:yyyy-MM-dd},{j.CreatedAt:yyyy-MM-dd}"));
                fileName = $"RASS_transport_jobs_{start:yyyyMMdd}_{end:yyyyMMdd}.csv";
                break;
            }
            case "contracts":
            {
                var query = _db.Contracts
                    .Include(c => c.BuyerOrder).ThenInclude(o => o.BuyerProfile).ThenInclude(b => b.User)
                    .Include(c => c.BuyerOrder).ThenInclude(o => o.MarketListing).ThenInclude(l => l.Cooperative)
                    .Where(c => c.CreatedAt >= start && c.CreatedAt <= end);
                var data = await query.OrderByDescending(c => c.CreatedAt).ToListAsync();
                csv = "TrackingId,Crop,TotalQuantityKg,AgreedPrice,TotalValue,Status,Buyer,Cooperative,CreatedAt\n" +
                      string.Join("\n", data.Select(c => $"{Esc(c.TrackingId)},{Esc(c.BuyerOrder?.Crop)},{c.TotalQuantityKg},{c.AgreedPrice},{c.TotalValue},{c.Status},{Esc(c.BuyerOrder?.BuyerProfile?.User?.FullName)},{Esc(c.BuyerOrder?.MarketListing?.Cooperative?.Name)},{c.CreatedAt:yyyy-MM-dd}"));
                fileName = $"RASS_contracts_{start:yyyyMMdd}_{end:yyyyMMdd}.csv";
                break;
            }
            case "orders":
            {
                var query = _db.BuyerOrders.Include(o => o.BuyerProfile).ThenInclude(b => b.User).Where(o => o.CreatedAt >= start && o.CreatedAt <= end);
                if (!string.IsNullOrWhiteSpace(crop)) query = query.Where(o => o.Crop == crop);
                if (!string.IsNullOrWhiteSpace(status)) query = query.Where(o => o.Status == status);
                var data = await query.OrderByDescending(o => o.CreatedAt).ToListAsync();
                csv = "Crop,QuantityKg,PriceOffer,TotalPrice,Status,DeliveryLocation,Buyer,DeliveryWindowStart,DeliveryWindowEnd,CreatedAt\n" +
                      string.Join("\n", data.Select(o => $"{Esc(o.Crop)},{o.QuantityKg},{o.PriceOffer},{o.PriceOffer * (decimal)o.QuantityKg},{o.Status},{Esc(o.DeliveryLocation)},{Esc(o.BuyerProfile?.User?.FullName)},{o.DeliveryWindowStart:yyyy-MM-dd},{o.DeliveryWindowEnd:yyyy-MM-dd},{o.CreatedAt:yyyy-MM-dd}"));
                fileName = $"RASS_orders_{start:yyyyMMdd}_{end:yyyyMMdd}.csv";
                break;
            }
            case "payments":
            case "transactions":
            {
                var query = _db.PaymentLedgers.Include(p => p.Contract).Where(p => p.CreatedAt >= start && p.CreatedAt <= end);
                var data = await query.OrderByDescending(p => p.CreatedAt).ToListAsync();
                csv = "Reference,Amount,Status,Type,ContractTrackingId,CreatedAt\n" +
                      string.Join("\n", data.Select(p => $"{Esc(p.Reference)},{p.Amount},{p.Status},{p.Type},{Esc(p.Contract?.TrackingId)},{p.CreatedAt:yyyy-MM-dd}"));
                fileName = $"RASS_payments_{start:yyyyMMdd}_{end:yyyyMMdd}.csv";
                break;
            }
            case "regulations":
            case "regulation-compliance":
            {
                var data = await _db.PriceRegulations.OrderByDescending(r => r.CreatedAt).ToListAsync();
                csv = "Crop,Region,District,Market,MinPricePerKg,MaxPricePerKg,Status,EffectiveFrom,EffectiveTo,Notes,CreatedAt\n" +
                      string.Join("\n", data.Select(r => $"{Esc(r.Crop)},{Esc(r.Region)},{Esc(r.District)},{Esc(r.Market)},{r.MinPricePerKg},{r.MaxPricePerKg},{r.Status},{r.EffectiveFrom:yyyy-MM-dd},{r.EffectiveTo:yyyy-MM-dd},{Esc(r.Notes)},{r.CreatedAt:yyyy-MM-dd}"));
                fileName = $"RASS_regulations_{DateTime.UtcNow:yyyyMMdd}.csv";
                break;
            }
            case "supply-demand":
            {
                var supplyDemand = await GetSupplyDemandRows();
                csv = "Crop,SupplyKg,DemandKg,Balance,Status,SupplyPrice,DemandPrice\n" +
                      string.Join("\n", supplyDemand.Select((dynamic r) => $"{r.Crop},{r.Supply},{r.Demand},{r.Balance},{r.Status},{r.SupplyPrice},{r.DemandPrice}"));
                fileName = $"RASS_supply_demand_{DateTime.UtcNow:yyyyMMdd}.csv";
                break;
            }
            case "comprehensive":
            {
                var sb = new System.Text.StringBuilder();
                sb.AppendLine($"RASS COMPREHENSIVE NATIONAL REPORT — Generated {DateTime.UtcNow:yyyy-MM-dd HH:mm} UTC");
                sb.AppendLine($"Period: {start:yyyy-MM-dd} to {end:yyyy-MM-dd}");
                sb.AppendLine();

                // Platform summary
                sb.AppendLine("=== PLATFORM SUMMARY ===");
                sb.AppendLine($"Total Farmers,{await _db.Farmers.CountAsync()}");
                sb.AppendLine($"Active Cooperatives,{await _db.Cooperatives.CountAsync(c => c.IsActive)}");
                sb.AppendLine($"Verified Cooperatives,{await _db.Cooperatives.CountAsync(c => c.IsVerified)}");
                sb.AppendLine($"Active Listings,{await _db.MarketListings.CountAsync(l => l.Status == "Active")}");
                sb.AppendLine($"Total Listing Volume (kg),{await _db.MarketListings.Where(l => l.Status == "Active").SumAsync(l => l.QuantityKg)}");
                sb.AppendLine($"Open Orders,{await _db.BuyerOrders.CountAsync(o => o.Status == "Open")}");
                sb.AppendLine($"Active Contracts,{await _db.Contracts.CountAsync(c => c.Status == "Active" || c.Status == "InDelivery")}");
                sb.AppendLine($"Registered Transporters,{await _db.TransporterProfiles.CountAsync()}");
                sb.AppendLine($"Completed Deliveries,{await _db.TransportRequests.CountAsync(t => t.Status == "Completed")}");
                sb.AppendLine($"Active Price Regulations,{await _db.PriceRegulations.CountAsync(r => r.Status == "Active")}");
                sb.AppendLine();

                // Prices section
                var pricesData = await _db.MarketPrices.Where(p => p.ObservedAt >= start && p.ObservedAt <= end).OrderBy(p => p.ObservedAt).ToListAsync();
                sb.AppendLine("=== MARKET PRICES ===");
                sb.AppendLine("Date,Crop,Market,Region,PricePerKg");
                foreach (var p in pricesData) sb.AppendLine($"{p.ObservedAt:yyyy-MM-dd},{Esc(p.Crop)},{Esc(p.Market)},{Esc(p.Region)},{p.PricePerKg}");
                sb.AppendLine();

                // Farmers section
                var farmers = await _db.Farmers.Include(f => f.User).Include(f => f.Cooperative).ToListAsync();
                sb.AppendLine("=== FARMERS ===");
                sb.AppendLine("Name,Email,District,Sector,Crops,FarmSizeHa,Cooperative,Active");
                foreach (var f in farmers) sb.AppendLine($"{Esc(f.User.FullName)},{Esc(f.User.Email)},{Esc(f.District)},{Esc(f.Sector)},{Esc(f.Crops)},{f.FarmSizeHectares},{Esc(f.Cooperative?.Name)},{f.IsActive}");
                sb.AppendLine();

                // Cooperatives section
                var coops = await _db.Cooperatives.Include(c => c.Farmers).Include(c => c.Lots).ToListAsync();
                sb.AppendLine("=== COOPERATIVES ===");
                sb.AppendLine("Name,Region,District,FarmerCount,InventoryKg,Verified,Active");
                foreach (var c in coops) sb.AppendLine($"{Esc(c.Name)},{Esc(c.Region)},{Esc(c.District)},{c.Farmers.Count},{c.Lots.Sum(l => l.QuantityKg):F0},{c.IsVerified},{c.IsActive}");

                csv = sb.ToString();
                fileName = $"RASS_comprehensive_{start:yyyyMMdd}_{end:yyyyMMdd}.csv";
                break;
            }
            default:
                return BadRequest($"Unsupported report type '{reportType}'. Supported: prices, farmers, cooperatives, listings, harvests, inventory, transporters, market-agents, storage-keepers, transport-jobs, contracts, orders, payments, regulations, supply-demand, comprehensive");
        }

        var bom = new byte[] { 0xEF, 0xBB, 0xBF }; // UTF-8 BOM for Excel
        var csvBytes = System.Text.Encoding.UTF8.GetBytes(csv);
        var result = new byte[bom.Length + csvBytes.Length];
        bom.CopyTo(result, 0);
        csvBytes.CopyTo(result, bom.Length);

        return File(result, "text/csv; charset=utf-8", fileName);
    }

    private static string Esc(string? v) => v == null ? "" : v.Contains(',') || v.Contains('"') || v.Contains('\n') ? $"\"{v.Replace("\"", "\"\"")}\"" : v;

    private async Task<object> GeneratePriceTrendReport(string? crop, string? region, string? district, DateTime start, DateTime end, string aggregation)
    {
        var query = _db.MarketPrices.Where(p => p.ObservedAt >= start && p.ObservedAt <= end);
        if (!string.IsNullOrWhiteSpace(crop)) query = query.Where(p => p.Crop == crop);
        if (!string.IsNullOrWhiteSpace(region)) query = query.Where(p => p.Region == region);

        var prices = await query.OrderBy(p => p.ObservedAt).ToListAsync();

        var grouped = aggregation switch
        {
            "daily" => prices.GroupBy(p => p.ObservedAt.Date.ToString("yyyy-MM-dd")),
            "weekly" => prices.GroupBy(p => $"{p.ObservedAt.Year}-W{System.Globalization.CultureInfo.InvariantCulture.Calendar.GetWeekOfYear(p.ObservedAt, System.Globalization.CalendarWeekRule.FirstDay, DayOfWeek.Monday):D2}"),
            _ => prices.GroupBy(p => p.ObservedAt.ToString("yyyy-MM")),
        };

        var trend = grouped.Select(g => new
        {
            Period = g.Key,
            AvgPrice = Math.Round((double)g.Average(p => p.PricePerKg), 2),
            MinPrice = (double)g.Min(p => p.PricePerKg),
            MaxPrice = (double)g.Max(p => p.PricePerKg),
            Observations = g.Count(),
            Markets = g.Select(p => p.Market).Distinct().Count(),
        }).ToList();

        var byCrop = prices.GroupBy(p => p.Crop).Select(g => new
        {
            Crop = g.Key,
            AvgPrice = Math.Round((double)g.Average(p => p.PricePerKg), 2),
            PriceChange = g.Count() > 1
                ? Math.Round((double)(g.OrderByDescending(p => p.ObservedAt).First().PricePerKg - g.OrderBy(p => p.ObservedAt).First().PricePerKg) / (double)g.OrderBy(p => p.ObservedAt).First().PricePerKg * 100, 1)
                : 0,
            Observations = g.Count(),
        }).OrderByDescending(c => Math.Abs(c.PriceChange)).ToList();

        return new
        {
            ReportType = "Price Trend Analysis",
            Period = $"{start:yyyy-MM-dd} to {end:yyyy-MM-dd}",
            Filters = new { crop, region, district, aggregation },
            TotalObservations = prices.Count,
            Trend = trend,
            ByCrop = byCrop,
        };
    }

    private async Task<object> GenerateCropGrowthReport(DateTime start, DateTime end, string? region)
    {
        var recentPrices = await _db.MarketPrices
            .Where(p => p.ObservedAt >= start && p.ObservedAt <= end)
            .ToListAsync();

        if (!string.IsNullOrWhiteSpace(region))
            recentPrices = recentPrices.Where(p => p.Region == region).ToList();

        var midpoint = start.AddDays((end - start).TotalDays / 2);

        var growth = recentPrices
            .GroupBy(p => p.Crop)
            .Select(g =>
            {
                var firstHalf = g.Where(p => p.ObservedAt < midpoint).ToList();
                var secondHalf = g.Where(p => p.ObservedAt >= midpoint).ToList();
                var avgFirst = firstHalf.Count > 0 ? (double)firstHalf.Average(p => p.PricePerKg) : 0;
                var avgSecond = secondHalf.Count > 0 ? (double)secondHalf.Average(p => p.PricePerKg) : 0;
                var growthPct = avgFirst > 0 ? Math.Round((avgSecond - avgFirst) / avgFirst * 100, 1) : 0;

                return new
                {
                    Crop = g.Key,
                    AvgPriceFirstHalf = Math.Round(avgFirst, 2),
                    AvgPriceSecondHalf = Math.Round(avgSecond, 2),
                    GrowthPercent = growthPct,
                    Direction = growthPct > 5 ? "Rising" : growthPct < -5 ? "Falling" : "Stable",
                    Observations = g.Count(),
                };
            })
            .OrderByDescending(c => c.GrowthPercent)
            .ToList();

        return new
        {
            ReportType = "Crop Price Growth Analysis",
            Period = $"{start:yyyy-MM-dd} to {end:yyyy-MM-dd}",
            Region = region ?? "National",
            TopGrowing = growth.Take(5).ToList(),
            TopFalling = growth.TakeLast(5).Reverse().ToList(),
            AllCrops = growth,
        };
    }

    private async Task<object> GenerateSupplyDemandReport(string? crop, string? region)
    {
        var supply = await _db.MarketListings
            .Where(l => l.Status == "Active")
            .Include(l => l.Cooperative)
            .ToListAsync();

        var demand = await _db.BuyerOrders
            .Where(o => o.Status == "Open" || o.Status == "Accepted")
            .ToListAsync();

        if (!string.IsNullOrWhiteSpace(crop))
        {
            supply = supply.Where(l => l.Crop == crop).ToList();
            demand = demand.Where(o => o.Crop == crop).ToList();
        }
        if (!string.IsNullOrWhiteSpace(region))
            supply = supply.Where(l => l.Cooperative?.Region == region).ToList();

        var byCrop = supply.Select(l => l.Crop).Union(demand.Select(o => o.Crop)).Distinct()
            .Select(c => new
            {
                Crop = c,
                SupplyKg = supply.Where(l => l.Crop == c).Sum(l => l.QuantityKg),
                DemandKg = demand.Where(o => o.Crop == c).Sum(o => o.QuantityKg),
                SupplyListings = supply.Count(l => l.Crop == c),
                DemandOrders = demand.Count(o => o.Crop == c),
                Balance = supply.Where(l => l.Crop == c).Sum(l => l.QuantityKg) - demand.Where(o => o.Crop == c).Sum(o => o.QuantityKg),
            })
            .OrderBy(c => c.Balance)
            .ToList();

        return new
        {
            ReportType = "Supply vs Demand Analysis",
            Filters = new { crop, region },
            TotalSupplyKg = supply.Sum(l => l.QuantityKg),
            TotalDemandKg = demand.Sum(o => o.QuantityKg),
            ByCrop = byCrop,
            CriticalShortages = byCrop.Where(c => c.Balance < 0).ToList(),
        };
    }

    private async Task<object> GenerateRegionalPerformanceReport(DateTime start, DateTime end, string? crop)
    {
        var prices = await _db.MarketPrices
            .Where(p => p.ObservedAt >= start && p.ObservedAt <= end)
            .ToListAsync();

        if (!string.IsNullOrWhiteSpace(crop))
            prices = prices.Where(p => p.Crop == crop).ToList();

        var byRegion = prices.GroupBy(p => p.Region).Select(g => new
        {
            Region = g.Key,
            AvgPrice = Math.Round((double)g.Average(p => p.PricePerKg), 2),
            MinPrice = (double)g.Min(p => p.PricePerKg),
            MaxPrice = (double)g.Max(p => p.PricePerKg),
            Volatility = Math.Round((double)(g.Max(p => p.PricePerKg) - g.Min(p => p.PricePerKg)) / (double)g.Average(p => p.PricePerKg) * 100, 1),
            Markets = g.Select(p => p.Market).Distinct().Count(),
            Crops = g.Select(p => p.Crop).Distinct().Count(),
            Observations = g.Count(),
        }).OrderBy(r => r.Region).ToList();

        return new
        {
            ReportType = "Regional Performance Comparison",
            Period = $"{start:yyyy-MM-dd} to {end:yyyy-MM-dd}",
            Crop = crop ?? "All Crops",
            Regions = byRegion,
            MostStable = byRegion.OrderBy(r => r.Volatility).FirstOrDefault()?.Region,
            MostVolatile = byRegion.OrderByDescending(r => r.Volatility).FirstOrDefault()?.Region,
        };
    }

    private async Task<object> GenerateRegulationComplianceReport(string? crop, string? region)
    {
        var now = DateTime.UtcNow;
        var regulations = await _db.PriceRegulations
            .Where(r => r.Status == "Active" && r.EffectiveFrom <= now && r.EffectiveTo >= now)
            .ToListAsync();

        if (!string.IsNullOrWhiteSpace(crop))
            regulations = regulations.Where(r => r.Crop == crop).ToList();
        if (!string.IsNullOrWhiteSpace(region))
            regulations = regulations.Where(r => r.Region == region).ToList();

        var compliance = new List<object>();
        foreach (var reg in regulations)
        {
            var recentPrices = await _db.MarketPrices
                .Where(p => p.Crop == reg.Crop && p.Region == reg.Region && p.ObservedAt >= now.AddDays(-30))
                .ToListAsync();

            var violations = recentPrices.Count(p => p.PricePerKg > reg.MaxPricePerKg);
            var belowMin = reg.MinPricePerKg.HasValue ? recentPrices.Count(p => p.PricePerKg < reg.MinPricePerKg.Value) : 0;

            compliance.Add(new
            {
                reg.Crop,
                reg.Region,
                RegulatedRange = $"{reg.MinPricePerKg?.ToString("N0") ?? "0"}–{reg.MaxPricePerKg:N0} RWF/kg",
                TotalObservations = recentPrices.Count,
                Violations = violations,
                BelowMinimum = belowMin,
                ComplianceRate = recentPrices.Count > 0 ? Math.Round((double)(recentPrices.Count - violations - belowMin) / recentPrices.Count * 100, 1) : 100,
                AvgMarketPrice = recentPrices.Count > 0 ? Math.Round((double)recentPrices.Average(p => p.PricePerKg), 2) : 0,
            });
        }

        return new
        {
            ReportType = "Price Regulation Compliance",
            ActiveRegulations = regulations.Count,
            Compliance = compliance,
        };
    }

    private async Task<object> GenerateComprehensiveReport(DateTime start, DateTime end)
    {
        var priceReport = await GeneratePriceTrendReport(null, null, null, start, end, "monthly");
        var growthReport = await GenerateCropGrowthReport(start, end, null);
        var supplyReport = await GenerateSupplyDemandReport(null, null);
        var regionalReport = await GenerateRegionalPerformanceReport(start, end, null);
        var complianceReport = await GenerateRegulationComplianceReport(null, null);

        return new
        {
            ReportType = "Comprehensive National Report",
            GeneratedAt = DateTime.UtcNow,
            Period = $"{start:yyyy-MM-dd} to {end:yyyy-MM-dd}",
            PriceTrends = priceReport,
            CropGrowth = growthReport,
            SupplyDemand = supplyReport,
            RegionalPerformance = regionalReport,
            RegulatoryCompliance = complianceReport,
            Summary = new
            {
                TotalFarmers = await _db.Farmers.CountAsync(),
                ActiveCooperatives = await _db.Cooperatives.CountAsync(c => c.IsActive),
                ActiveListings = await _db.MarketListings.CountAsync(l => l.Status == "Active"),
                OpenOrders = await _db.BuyerOrders.CountAsync(o => o.Status == "Open"),
                ActiveContracts = await _db.Contracts.CountAsync(c => c.Status == "Active" || c.Status == "InDelivery"),
            }
        };
    }

    // ═══════════════════════════════════════════════════════════
    // COMPREHENSIVE REPORT GENERATORS (new entity-level reports)
    // ═══════════════════════════════════════════════════════════

    private async Task<object> GenerateFarmersReport(string? region, string? district)
    {
        var query = _db.Farmers.Include(f => f.User).Include(f => f.Cooperative).AsQueryable();
        if (!string.IsNullOrWhiteSpace(region)) query = query.Where(f => f.Cooperative != null && f.Cooperative.Region == region);
        if (!string.IsNullOrWhiteSpace(district)) query = query.Where(f => f.District == district);

        var farmers = await query.ToListAsync();
        var activeFarmers = farmers.Count(f => f.IsActive);
        var totalFarmSize = farmers.Sum(f => f.FarmSizeHectares);
        var byDistrict = farmers.GroupBy(f => f.District).Select(g => new { District = g.Key, Count = g.Count() }).OrderByDescending(g => g.Count).ToList();
        var byCrop = farmers.SelectMany(f => (f.Crops ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            .GroupBy(c => c).Select(g => new { Crop = g.Key, FarmerCount = g.Count() }).OrderByDescending(g => g.FarmerCount).ToList();

        return new
        {
            ReportType = "Farmers Registry Report",
            GeneratedAt = DateTime.UtcNow,
            Filters = new { region, district },
            Summary = new { TotalFarmers = farmers.Count, ActiveFarmers = activeFarmers, InactiveFarmers = farmers.Count - activeFarmers, TotalFarmSizeHa = Math.Round(totalFarmSize, 1), AvgFarmSizeHa = farmers.Count > 0 ? Math.Round(totalFarmSize / farmers.Count, 2) : 0, DistrictsRepresented = byDistrict.Count },
            Data = farmers.Select(f => new { Name = f.User.FullName, f.User.Email, f.District, f.Sector, f.Crops, FarmSizeHa = f.FarmSizeHectares, f.IsActive, Cooperative = f.Cooperative?.Name ?? "None", Region = f.Cooperative?.Region ?? "N/A" }).ToList(),
            Insights = new[]
            {
                $"{activeFarmers} of {farmers.Count} farmers ({(farmers.Count > 0 ? Math.Round((double)activeFarmers / farmers.Count * 100, 1) : 0)}%) are active.",
                $"Top district: {byDistrict.FirstOrDefault()?.District ?? "N/A"} with {byDistrict.FirstOrDefault()?.Count ?? 0} farmers.",
                $"Top crop grown: {byCrop.FirstOrDefault()?.Crop ?? "N/A"} by {byCrop.FirstOrDefault()?.FarmerCount ?? 0} farmers.",
                $"Average farm size: {(farmers.Count > 0 ? Math.Round(totalFarmSize / farmers.Count, 2) : 0)} hectares."
            },
            ByDistrict = byDistrict,
            ByCrop = byCrop,
        };
    }

    private async Task<object> GenerateCooperativesReport(string? region)
    {
        var query = _db.Cooperatives.Include(c => c.Farmers).Include(c => c.Lots).Include(c => c.Manager).AsQueryable();
        if (!string.IsNullOrWhiteSpace(region)) query = query.Where(c => c.Region == region);

        var coops = await query.ToListAsync();
        var listings = await _db.MarketListings.Include(l => l.Cooperative).ToListAsync();
        var totalVolume = coops.Sum(c => c.Lots.Sum(l => l.QuantityKg));

        return new
        {
            ReportType = "Cooperatives Performance Report",
            GeneratedAt = DateTime.UtcNow,
            Filters = new { region },
            Summary = new { TotalCooperatives = coops.Count, VerifiedCooperatives = coops.Count(c => c.IsVerified), ActiveCooperatives = coops.Count(c => c.IsActive), TotalFarmers = coops.Sum(c => c.Farmers.Count), TotalInventoryKg = Math.Round(totalVolume, 0), TotalActiveListings = listings.Count(l => l.Status == "Active") },
            Data = coops.Select(c => new
            {
                c.Name, c.Region, c.District, c.Location,
                Manager = c.Manager?.FullName ?? "N/A",
                FarmerCount = c.Farmers.Count,
                TotalLots = c.Lots.Count,
                InventoryKg = Math.Round(c.Lots.Sum(l => l.QuantityKg), 0),
                ActiveListings = listings.Count(l => l.Cooperative?.Id == c.Id && l.Status == "Active"),
                ListingVolumeKg = Math.Round(listings.Where(l => l.Cooperative?.Id == c.Id && l.Status == "Active").Sum(l => l.QuantityKg), 0),
                c.IsVerified, c.IsActive,
            }).OrderByDescending(c => c.FarmerCount).ToList(),
            Insights = new[]
            {
                $"{coops.Count(c => c.IsVerified)} of {coops.Count} cooperatives are verified.",
                $"Total inventory: {totalVolume:N0} kg across {coops.Sum(c => c.Lots.Count)} lots.",
                $"Average farmers per cooperative: {(coops.Count > 0 ? Math.Round((double)coops.Sum(c => c.Farmers.Count) / coops.Count, 1) : 0)}.",
                $"Top cooperative: {coops.OrderByDescending(c => c.Farmers.Count).FirstOrDefault()?.Name ?? "N/A"} with {coops.Max(c => c.Farmers.Count)} farmers.",
            }
        };
    }

    private async Task<object> GenerateListingsReport(string? crop, string? region, DateTime start, DateTime end)
    {
        var query = _db.MarketListings.Include(l => l.Cooperative).Where(l => l.CreatedAt >= start && l.CreatedAt <= end);
        if (!string.IsNullOrWhiteSpace(crop)) query = query.Where(l => l.Crop == crop);
        if (!string.IsNullOrWhiteSpace(region)) query = query.Where(l => l.Cooperative.Region == region);

        var listings = await query.OrderByDescending(l => l.CreatedAt).ToListAsync();
        var byCrop = listings.GroupBy(l => l.Crop).Select(g => new { Crop = g.Key, Count = g.Count(), TotalKg = g.Sum(l => l.QuantityKg), AvgPrice = Math.Round((double)g.Average(l => l.MinimumPrice), 2) }).OrderByDescending(g => g.TotalKg).ToList();
        var byStatus = listings.GroupBy(l => l.Status).Select(g => new { Status = g.Key, Count = g.Count() }).ToList();

        // Get government-set prices for comparison
        var regs = await _db.PriceRegulations.Where(r => r.Status == "Active").ToListAsync();

        return new
        {
            ReportType = "Market Listings Report",
            GeneratedAt = DateTime.UtcNow,
            Period = $"{start:yyyy-MM-dd} to {end:yyyy-MM-dd}",
            Filters = new { crop, region },
            Summary = new { TotalListings = listings.Count, ActiveListings = listings.Count(l => l.Status == "Active"), TotalVolumeKg = Math.Round(listings.Sum(l => l.QuantityKg), 0), AverageMinPrice = listings.Count > 0 ? Math.Round((double)listings.Average(l => l.MinimumPrice), 2) : 0, CropsListed = byCrop.Count, CooperativesSelling = listings.Select(l => l.Cooperative?.Id).Distinct().Count() },
            Data = listings.Select(l =>
            {
                var reg = regs.FirstOrDefault(r => r.Crop == l.Crop && (r.Region == l.Cooperative?.Region || string.IsNullOrEmpty(r.Region)));
                return new
                {
                    l.Crop, QuantityKg = l.QuantityKg, SellerPrice = l.MinimumPrice,
                    GovMinPrice = reg?.MinPricePerKg, GovMaxPrice = reg?.MaxPricePerKg,
                    Compliance = reg != null ? (l.MinimumPrice >= (reg.MinPricePerKg ?? 0) && l.MinimumPrice <= reg.MaxPricePerKg ? "Compliant" : "Violation") : "Unregulated",
                    l.QualityGrade, l.Status, Cooperative = l.Cooperative?.Name, Region = l.Cooperative?.Region, l.CreatedAt,
                };
            }).ToList(),
            ByCrop = byCrop,
            ByStatus = byStatus,
            Insights = new[]
            {
                $"{listings.Count(l => l.Status == "Active")} active listings totaling {listings.Where(l => l.Status == "Active").Sum(l => l.QuantityKg):N0} kg.",
                $"Most listed crop: {byCrop.FirstOrDefault()?.Crop ?? "N/A"} ({byCrop.FirstOrDefault()?.TotalKg:N0} kg).",
                $"Average listing price: {(listings.Count > 0 ? listings.Average(l => l.MinimumPrice) : 0):N0} RWF/kg.",
            }
        };
    }

    private async Task<object> GenerateHarvestsReport(string? crop, string? region, DateTime start, DateTime end)
    {
        var query = _db.HarvestDeclarations
            .Include(h => h.Farmer).ThenInclude(f => f.User)
            .Include(h => h.Farmer).ThenInclude(f => f.Cooperative)
            .Where(h => h.CreatedAt >= start && h.CreatedAt <= end);
        if (!string.IsNullOrWhiteSpace(crop)) query = query.Where(h => h.Crop == crop);
        if (!string.IsNullOrWhiteSpace(region)) query = query.Where(h => h.Farmer.Cooperative != null && h.Farmer.Cooperative.Region == region);

        var harvests = await query.OrderByDescending(h => h.CreatedAt).ToListAsync();
        var byCrop = harvests.GroupBy(h => h.Crop).Select(g => new { Crop = g.Key, Count = g.Count(), TotalExpectedKg = g.Sum(h => h.ExpectedQuantityKg) }).OrderByDescending(g => g.TotalExpectedKg).ToList();
        var byStatus = harvests.GroupBy(h => h.Status).Select(g => new { Status = g.Key, Count = g.Count() }).ToList();
        var byCondition = harvests.Where(h => h.ConditionGrade != null).GroupBy(h => h.ConditionGrade!).Select(g => new { Condition = g.Key, Count = g.Count() }).ToList();

        return new
        {
            ReportType = "Harvest Declarations Report",
            GeneratedAt = DateTime.UtcNow,
            Period = $"{start:yyyy-MM-dd} to {end:yyyy-MM-dd}",
            Filters = new { crop, region },
            Summary = new { TotalDeclarations = harvests.Count, TotalExpectedKg = Math.Round(harvests.Sum(h => h.ExpectedQuantityKg), 0), UniqueFarmers = harvests.Select(h => h.FarmerId).Distinct().Count(), UniqueCrops = byCrop.Count, PendingDeclarations = harvests.Count(h => h.Status == "Pending"), ApprovedDeclarations = harvests.Count(h => h.Status == "Approved") },
            Data = harvests.Select(h => new { Farmer = h.Farmer?.User?.FullName, h.Crop, ExpectedKg = h.ExpectedQuantityKg, HarvestDate = h.ExpectedHarvestDate, h.QualityIndicators, h.Status, Condition = h.ConditionGrade ?? "N/A", Cooperative = h.Farmer?.Cooperative?.Name, Region = h.Farmer?.Cooperative?.Region, h.CreatedAt }).ToList(),
            ByCrop = byCrop, ByStatus = byStatus, ByCondition = byCondition,
            Insights = new[]
            {
                $"{harvests.Count} harvest declarations from {harvests.Select(h => h.FarmerId).Distinct().Count()} farmers.",
                $"Total expected volume: {harvests.Sum(h => h.ExpectedQuantityKg):N0} kg.",
                $"Top crop: {byCrop.FirstOrDefault()?.Crop ?? "N/A"} with {byCrop.FirstOrDefault()?.TotalExpectedKg:N0} kg expected.",
                $"{harvests.Count(h => h.Status == "Approved")} approved, {harvests.Count(h => h.Status == "Pending")} pending review.",
            }
        };
    }

    private async Task<object> GenerateInventoryReport(string? crop, string? region)
    {
        var query = _db.Lots.Include(l => l.Cooperative).AsQueryable();
        if (!string.IsNullOrWhiteSpace(crop)) query = query.Where(l => l.Crop == crop);
        if (!string.IsNullOrWhiteSpace(region)) query = query.Where(l => l.Cooperative.Region == region);

        var lots = await query.OrderByDescending(l => l.CreatedAt).ToListAsync();
        var byCrop = lots.GroupBy(l => l.Crop).Select(g => new { Crop = g.Key, TotalKg = Math.Round(g.Sum(l => l.QuantityKg), 0), Lots = g.Count(), VerifiedLots = g.Count(l => l.Verified), AvgPrice = g.Average(l => l.ExpectedPricePerKg ?? 0) }).OrderByDescending(g => g.TotalKg).ToList();
        var byRegion = lots.GroupBy(l => l.Cooperative?.Region ?? "Unknown").Select(g => new { Region = g.Key, TotalKg = Math.Round(g.Sum(l => l.QuantityKg), 0), Lots = g.Count() }).OrderByDescending(g => g.TotalKg).ToList();

        return new
        {
            ReportType = "Inventory (Lots) Report",
            GeneratedAt = DateTime.UtcNow,
            Filters = new { crop, region },
            Summary = new { TotalLots = lots.Count, TotalInventoryKg = Math.Round(lots.Sum(l => l.QuantityKg), 0), VerifiedLots = lots.Count(l => l.Verified), UnverifiedLots = lots.Count(l => !l.Verified), UniqueCrops = byCrop.Count, Cooperatives = lots.Select(l => l.Cooperative?.Id).Distinct().Count() },
            Data = lots.Select(l => new { l.Crop, QuantityKg = Math.Round(l.QuantityKg, 1), l.QualityGrade, l.Status, l.Verified, ExpectedPricePerKg = l.ExpectedPricePerKg, Cooperative = l.Cooperative?.Name, Region = l.Cooperative?.Region, HarvestDate = l.ExpectedHarvestDate, l.CreatedAt }).ToList(),
            ByCrop = byCrop, ByRegion = byRegion,
            Insights = new[]
            {
                $"Total inventory: {lots.Sum(l => l.QuantityKg):N0} kg across {lots.Count} lots.",
                $"{lots.Count(l => l.Verified)} lots verified ({(lots.Count > 0 ? Math.Round((double)lots.Count(l => l.Verified) / lots.Count * 100, 1) : 0)}%).",
                $"Top crop in stock: {byCrop.FirstOrDefault()?.Crop ?? "N/A"} ({byCrop.FirstOrDefault()?.TotalKg:N0} kg).",
            }
        };
    }

    private async Task<object> GenerateTransportersReport(string? region)
    {
        var transporters = await _db.TransporterProfiles.Include(t => t.User).ToListAsync();
        if (!string.IsNullOrWhiteSpace(region))
            transporters = transporters.Where(t => (t.OperatingRegions ?? "").Contains(region, StringComparison.OrdinalIgnoreCase)).ToList();

        var jobs = await _db.TransportJobs.Include(j => j.AssignedTransporter).ToListAsync();
        var requests = await _db.TransportRequests.ToListAsync();

        return new
        {
            ReportType = "Transporters Report",
            GeneratedAt = DateTime.UtcNow,
            Filters = new { region },
            Summary = new { TotalTransporters = transporters.Count, VerifiedTransporters = transporters.Count(t => t.IsVerified), ActiveTransporters = transporters.Count(t => t.IsActive), TotalCapacityKg = transporters.Sum(t => t.CapacityKg), OpenJobs = jobs.Count(j => j.Status == "Open"), AssignedJobs = jobs.Count(j => j.Status == "Assigned"), CompletedDeliveries = requests.Count(r => r.Status == "Completed") },
            Data = transporters.Select(t => new
            {
                Name = t.User.FullName, t.User.Email, t.CompanyName, t.Phone, t.VehicleType, t.LicensePlate,
                CapacityKg = t.CapacityKg, Regions = t.OperatingRegions ?? "",
                t.IsVerified, t.IsActive,
                AssignedJobs = jobs.Count(j => j.AssignedTransporterId == t.UserId),
                CompletedJobs = jobs.Count(j => j.AssignedTransporterId == t.UserId && j.Status == "Delivered"),
            }).OrderByDescending(t => t.AssignedJobs).ToList(),
            Insights = new[]
            {
                $"{transporters.Count(t => t.IsActive)} of {transporters.Count} transporters currently available.",
                $"Total fleet capacity: {transporters.Sum(t => t.CapacityKg):N0} kg.",
                $"{jobs.Count(j => j.Status == "Open")} transport jobs currently open for bidding.",
            }
        };
    }

    private async Task<object> GenerateMarketAgentsReport(string? region, string? district, DateTime start, DateTime end)
    {
        var roleId = await _db.Roles
            .Where(r => r.Name == "MarketAgent")
            .Select(r => r.Id)
            .FirstOrDefaultAsync();

        var marketAgentUsers = roleId == Guid.Empty
            ? new List<Domain.Entities.User>()
            : await _db.Users
                .Where(u => u.UserRoles.Any(ur => ur.RoleId == roleId))
                .OrderBy(u => u.FullName)
                .ToListAsync();

        var prices = await _db.MarketPrices
            .Where(p => p.ObservedAt >= start && p.ObservedAt <= end)
            .ToListAsync();

        if (!string.IsNullOrWhiteSpace(region))
            prices = prices.Where(p => p.Region == region).ToList();
        if (!string.IsNullOrWhiteSpace(district))
            prices = prices.Where(p => p.District == district).ToList();

        var byAgent = prices
            .Where(p => p.AgentId.HasValue)
            .GroupBy(p => p.AgentId!.Value)
            .ToDictionary(
                g => g.Key,
                g => new
                {
                    submissions = g.Count(),
                    markets = g.Select(x => x.Market).Where(x => !string.IsNullOrWhiteSpace(x)).Distinct(StringComparer.OrdinalIgnoreCase).Count(),
                    crops = g.Select(x => x.Crop).Where(x => !string.IsNullOrWhiteSpace(x)).Distinct(StringComparer.OrdinalIgnoreCase).Count(),
                    avgPrice = g.Average(x => x.PricePerKg),
                    lastSubmissionAt = g.Max(x => x.ObservedAt),
                    lastRegion = g.OrderByDescending(x => x.ObservedAt).First().Region,
                    lastDistrict = g.OrderByDescending(x => x.ObservedAt).First().District
                });

        var ranked = marketAgentUsers
            .Select(u =>
            {
                byAgent.TryGetValue(u.Id, out var stats);
                return new
                {
                    Name = u.FullName,
                    u.Email,
                    u.IsActive,
                    Submissions = stats?.submissions ?? 0,
                    DistinctMarkets = stats?.markets ?? 0,
                    DistinctCrops = stats?.crops ?? 0,
                    AverageObservedPrice = stats != null ? Math.Round(stats.avgPrice, 2) : 0m,
                    LastSubmissionAt = stats?.lastSubmissionAt,
                    LastRegion = stats?.lastRegion,
                    LastDistrict = stats?.lastDistrict
                };
            })
            .OrderByDescending(x => x.Submissions)
            .ToList();

        var totalSubmissions = ranked.Sum(x => x.Submissions);
        var activeAgents = ranked.Count(x => x.IsActive);

        return new
        {
            ReportType = "Market Agents Oversight Report",
            GeneratedAt = DateTime.UtcNow,
            Period = $"{start:yyyy-MM-dd} to {end:yyyy-MM-dd}",
            Filters = new { region, district },
            Summary = new
            {
                TotalMarketAgents = ranked.Count,
                ActiveMarketAgents = activeAgents,
                InactiveMarketAgents = ranked.Count - activeAgents,
                TotalPriceSubmissions = totalSubmissions,
                ParticipatingMarkets = prices.Select(p => p.Market).Where(m => !string.IsNullOrWhiteSpace(m)).Distinct(StringComparer.OrdinalIgnoreCase).Count(),
                ParticipatingDistricts = prices.Select(p => p.District).Where(d => !string.IsNullOrWhiteSpace(d)).Distinct(StringComparer.OrdinalIgnoreCase).Count()
            },
            Data = ranked,
            Insights = new[]
            {
                $"{activeAgents} of {ranked.Count} market agents are active.",
                $"Total market-price submissions in period: {totalSubmissions:N0}.",
                $"Top submitting agent: {ranked.FirstOrDefault()?.Name ?? "N/A"} ({ranked.FirstOrDefault()?.Submissions ?? 0} submissions)."
            }
        };
    }

    private async Task<object> GenerateStorageKeepersReport(string? region, string? district, DateTime start, DateTime end)
    {
        var facilities = await _db.StorageFacilities.ToListAsync();
        var bookings = await _db.StorageBookings
            .Include(b => b.StorageFacility)
            .Where(b => b.StartDate <= end && b.EndDate >= start)
            .ToListAsync();

        if (!string.IsNullOrWhiteSpace(region))
        {
            facilities = facilities.Where(f => (f.Location ?? string.Empty).Contains(region, StringComparison.OrdinalIgnoreCase)).ToList();
            bookings = bookings.Where(b => (b.StorageFacility?.Location ?? string.Empty).Contains(region, StringComparison.OrdinalIgnoreCase)).ToList();
        }
        if (!string.IsNullOrWhiteSpace(district))
        {
            facilities = facilities.Where(f => (f.Location ?? string.Empty).Contains(district, StringComparison.OrdinalIgnoreCase)).ToList();
            bookings = bookings.Where(b => (b.StorageFacility?.Location ?? string.Empty).Contains(district, StringComparison.OrdinalIgnoreCase)).ToList();
        }

        var facilityRows = facilities
            .Select(f =>
            {
                var facilityBookings = bookings.Where(b => b.StorageFacilityId == f.Id).ToList();
                var utilizationPct = f.CapacityKg > 0 ? Math.Round((f.CapacityKg - f.AvailableKg) / f.CapacityKg * 100, 2) : 0;
                var reservedKg = facilityBookings.Where(b => b.Status == "Reserved").Sum(b => b.QuantityKg);
                var confirmedKg = facilityBookings.Where(b => b.Status == "Confirmed").Sum(b => b.QuantityKg);
                var completedKg = facilityBookings.Where(b => b.Status == "Completed").Sum(b => b.QuantityKg);
                return new
                {
                    f.Name,
                    f.Location,
                    f.CapacityKg,
                    f.AvailableKg,
                    UtilizationPct = utilizationPct,
                    Bookings = facilityBookings.Count,
                    ActiveBookings = facilityBookings.Count(b => b.Status == "Reserved" || b.Status == "Confirmed"),
                    ReservedKg = Math.Round(reservedKg, 1),
                    ConfirmedKg = Math.Round(confirmedKg, 1),
                    CompletedKg = Math.Round(completedKg, 1),
                    Features = f.Features
                };
            })
            .OrderByDescending(x => x.UtilizationPct)
            .ToList();

        var totalCapacity = facilityRows.Sum(x => x.CapacityKg);
        var totalAvailable = facilityRows.Sum(x => x.AvailableKg);
        var totalUtilization = totalCapacity > 0 ? Math.Round((totalCapacity - totalAvailable) / totalCapacity * 100, 2) : 0;

        return new
        {
            ReportType = "Storage Keepers & Capacity Report",
            GeneratedAt = DateTime.UtcNow,
            Period = $"{start:yyyy-MM-dd} to {end:yyyy-MM-dd}",
            Filters = new { region, district },
            Summary = new
            {
                TotalFacilities = facilityRows.Count,
                TotalCapacityKg = Math.Round(totalCapacity, 1),
                TotalAvailableKg = Math.Round(totalAvailable, 1),
                NationalUtilizationPct = totalUtilization,
                TotalBookings = facilityRows.Sum(x => x.Bookings),
                ActiveBookings = facilityRows.Sum(x => x.ActiveBookings)
            },
            Data = facilityRows,
            Insights = new[]
            {
                $"Storage utilization is {totalUtilization:N1}% across {facilityRows.Count} facilities.",
                $"Active storage bookings: {facilityRows.Sum(x => x.ActiveBookings)}.",
                $"Most utilized facility: {facilityRows.FirstOrDefault()?.Name ?? "N/A"} ({facilityRows.FirstOrDefault()?.UtilizationPct ?? 0:N1}%)."
            }
        };
    }

    private async Task<object> GenerateTransportJobsReport(string? region, DateTime start, DateTime end)
    {
        var query = _db.TransportJobs.Include(j => j.Cooperative).Include(j => j.AssignedTransporter).Include(j => j.Applications)
            .Where(j => j.CreatedAt >= start && j.CreatedAt <= end);
        var jobs = await query.OrderByDescending(j => j.CreatedAt).ToListAsync();
        if (!string.IsNullOrWhiteSpace(region)) jobs = jobs.Where(j => j.Cooperative?.Region == region).ToList();

        var byStatus = jobs.GroupBy(j => j.Status).Select(g => new { Status = g.Key, Count = g.Count() }).ToList();

        return new
        {
            ReportType = "Transport Jobs Report",
            GeneratedAt = DateTime.UtcNow,
            Period = $"{start:yyyy-MM-dd} to {end:yyyy-MM-dd}",
            Filters = new { region },
            Summary = new { TotalJobs = jobs.Count, OpenJobs = jobs.Count(j => j.Status == "Open"), AssignedJobs = jobs.Count(j => j.Status == "Assigned"), CompletedJobs = jobs.Count(j => j.Status == "Delivered"), TotalApplications = jobs.Sum(j => j.Applications.Count), TotalCargoKg = Math.Round(jobs.Sum(j => j.QuantityKg), 0) },
            Data = jobs.Select(j => new { j.Title, j.Crop, QuantityKg = j.QuantityKg, j.PickupLocation, j.DeliveryLocation, DistanceKm = j.DistanceKm, j.Status, Budget = $"{j.MinPaymentRwf:N0}–{j.MaxPaymentRwf:N0}", Cooperative = j.Cooperative?.Name, AssignedTo = j.AssignedTransporter?.FullName, Applications = j.Applications.Count, j.CreatedAt }).ToList(),
            ByStatus = byStatus,
            Insights = new[]
            {
                $"{jobs.Count} transport jobs posted, {jobs.Sum(j => j.Applications.Count)} total applications received.",
                $"Average applications per job: {(jobs.Count > 0 ? Math.Round((double)jobs.Sum(j => j.Applications.Count) / jobs.Count, 1) : 0)}.",
                $"Total cargo moved: {jobs.Where(j => j.Status == "Delivered").Sum(j => j.QuantityKg):N0} kg.",
            }
        };
    }

    private async Task<object> GenerateContractsReport(string? crop, DateTime start, DateTime end)
    {
        var query = _db.Contracts
            .Include(c => c.BuyerOrder).ThenInclude(o => o.BuyerProfile).ThenInclude(b => b.User)
            .Include(c => c.BuyerOrder).ThenInclude(o => o.MarketListing).ThenInclude(l => l.Cooperative)
            .Where(c => c.CreatedAt >= start && c.CreatedAt <= end);
        if (!string.IsNullOrWhiteSpace(crop)) query = query.Where(c => c.BuyerOrder != null && c.BuyerOrder.Crop == crop);

        var contracts = await query.OrderByDescending(c => c.CreatedAt).ToListAsync();
        var byStatus = contracts.GroupBy(c => c.Status).Select(g => new { Status = g.Key, Count = g.Count(), TotalValue = g.Sum(c => c.TotalValue) }).ToList();

        return new
        {
            ReportType = "Contracts Report",
            GeneratedAt = DateTime.UtcNow,
            Period = $"{start:yyyy-MM-dd} to {end:yyyy-MM-dd}",
            Filters = new { crop },
            Summary = new { TotalContracts = contracts.Count, TotalValueRWF = contracts.Sum(c => c.TotalValue), TotalQuantityKg = contracts.Sum(c => c.TotalQuantityKg), ActiveContracts = contracts.Count(c => c.Status == "Active" || c.Status == "InDelivery"), CompletedContracts = contracts.Count(c => c.Status == "Completed"), DisputedContracts = contracts.Count(c => c.Status == "Disputed") },
            Data = contracts.Select(c => new { TrackingId = c.TrackingId, Crop = c.BuyerOrder?.Crop, QuantityKg = c.TotalQuantityKg, AgreedPrice = c.AgreedPrice, TotalValue = c.TotalValue, c.Status, Buyer = c.BuyerOrder?.BuyerProfile?.User?.FullName, Cooperative = c.BuyerOrder?.MarketListing?.Cooperative?.Name, c.CreatedAt }).ToList(),
            ByStatus = byStatus,
            Insights = new[]
            {
                $"{contracts.Count} contracts with total value {contracts.Sum(c => c.TotalValue):N0} RWF.",
                $"{contracts.Count(c => c.Status == "Completed")} contracts completed successfully.",
                $"{contracts.Count(c => c.Status == "Disputed")} contracts currently disputed.",
            }
        };
    }

    private async Task<object> GenerateOrdersReport(string? crop, DateTime start, DateTime end)
    {
        var query = _db.BuyerOrders.Include(o => o.BuyerProfile).ThenInclude(b => b.User).Where(o => o.CreatedAt >= start && o.CreatedAt <= end);
        if (!string.IsNullOrWhiteSpace(crop)) query = query.Where(o => o.Crop == crop);

        var orders = await query.OrderByDescending(o => o.CreatedAt).ToListAsync();
        var byCrop = orders.GroupBy(o => o.Crop).Select(g => new { Crop = g.Key, Count = g.Count(), TotalKg = g.Sum(o => o.QuantityKg), TotalValue = g.Sum(o => o.PriceOffer * (decimal)o.QuantityKg) }).OrderByDescending(g => g.TotalValue).ToList();
        var byStatus = orders.GroupBy(o => o.Status).Select(g => new { Status = g.Key, Count = g.Count() }).ToList();

        return new
        {
            ReportType = "Buyer Orders Report",
            GeneratedAt = DateTime.UtcNow,
            Period = $"{start:yyyy-MM-dd} to {end:yyyy-MM-dd}",
            Filters = new { crop },
            Summary = new { TotalOrders = orders.Count, TotalVolumeKg = Math.Round(orders.Sum(o => o.QuantityKg), 0), TotalValueRWF = orders.Sum(o => o.PriceOffer * (decimal)o.QuantityKg), OpenOrders = orders.Count(o => o.Status == "Open"), AcceptedOrders = orders.Count(o => o.Status == "Accepted"), CompletedOrders = orders.Count(o => o.Status == "Completed"), UniqueBuyers = orders.Select(o => o.BuyerProfileId).Distinct().Count() },
            Data = orders.Select(o => new { o.Crop, QuantityKg = o.QuantityKg, PriceOffer = o.PriceOffer, TotalPrice = o.PriceOffer * (decimal)o.QuantityKg, o.Status, o.DeliveryLocation, Buyer = o.BuyerProfile?.User?.FullName, DeliveryWindow = $"{o.DeliveryWindowStart:yyyy-MM-dd} to {o.DeliveryWindowEnd:yyyy-MM-dd}", o.CreatedAt }).ToList(),
            ByCrop = byCrop, ByStatus = byStatus,
            Insights = new[]
            {
                $"{orders.Count} orders from {orders.Select(o => o.BuyerProfileId).Distinct().Count()} unique buyers.",
                $"Total order value: {orders.Sum(o => o.PriceOffer * (decimal)o.QuantityKg):N0} RWF.",
                $"Most demanded crop: {byCrop.FirstOrDefault()?.Crop ?? "N/A"} ({byCrop.FirstOrDefault()?.TotalKg:N0} kg).",
            }
        };
    }

    private async Task<object> GeneratePaymentsReport(DateTime start, DateTime end)
    {
        var payments = await _db.PaymentLedgers
            .Include(p => p.Contract).ThenInclude(c => c.BuyerOrder)
            .Where(p => p.CreatedAt >= start && p.CreatedAt <= end)
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync();

        var byStatus = payments.GroupBy(p => p.Status).Select(g => new { Status = g.Key, Count = g.Count(), TotalAmount = g.Sum(p => p.Amount) }).ToList();
        var byType = payments.GroupBy(p => p.Type).Select(g => new { Type = g.Key, Count = g.Count(), TotalAmount = g.Sum(p => p.Amount) }).ToList();

        return new
        {
            ReportType = "Payments & Transactions Report",
            GeneratedAt = DateTime.UtcNow,
            Period = $"{start:yyyy-MM-dd} to {end:yyyy-MM-dd}",
            Summary = new { TotalTransactions = payments.Count, TotalAmountRWF = payments.Sum(p => p.Amount), CompletedPayments = payments.Count(p => p.Status == "Completed"), CompletedAmountRWF = payments.Where(p => p.Status == "Completed").Sum(p => p.Amount), PendingPayments = payments.Count(p => p.Status == "Pending"), FailedPayments = payments.Count(p => p.Status == "Failed") },
            Data = payments.Select(p => new { p.Reference, p.Amount, p.Status, p.Type, ContractTracking = p.Contract?.TrackingId, Crop = p.Contract?.BuyerOrder?.Crop, p.CreatedAt }).ToList(),
            ByStatus = byStatus, ByType = byType,
            Insights = new[]
            {
                $"{payments.Count} transactions totaling {payments.Sum(p => p.Amount):N0} RWF.",
                $"Completed: {payments.Where(p => p.Status == "Completed").Sum(p => p.Amount):N0} RWF ({payments.Count(p => p.Status == "Completed")} transactions).",
                $"Failed: {payments.Count(p => p.Status == "Failed")} transactions.",
            }
        };
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
                    Crop = p.Contract != null && p.Contract.BuyerOrder != null ? p.Contract.BuyerOrder.Crop : "N/A"
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

    private Guid? GetUserId()
    {
        var claim = User.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier") ??
                   User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
        return Guid.TryParse(claim?.Value, out var guid) ? guid : null;
    }

    /// <summary>
    /// Create an analytical report (saved as audit log for records)
    /// </summary>
    [HttpPost("reports")]
    public async Task<IActionResult> CreateReport(CreatePolicyReportRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var user = await _db.Users.FindAsync(userId.Value);

        _db.AuditLogs.Add(new Domain.Entities.AuditLog
        {
            Action = "PolicyReport",
            Actor = user?.Email ?? "Government",
            EntityType = "PolicyReport",
            EntityId = Guid.NewGuid().ToString(),
            Metadata = System.Text.Json.JsonSerializer.Serialize(new
            {
                request.Title,
                request.Content,
                request.Category,
                CreatedAt = DateTime.UtcNow,
                CreatedBy = userId.Value
            })
        });

        await _db.SaveChangesAsync();
        return Created("", new { message = "Report created successfully" });
    }

    /// <summary>
    /// Add policy annotation/commentary to data
    /// </summary>
    [HttpPost("annotations")]
    public async Task<IActionResult> AddAnnotation(AddPolicyAnnotationRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var user = await _db.Users.FindAsync(userId.Value);

        _db.AuditLogs.Add(new Domain.Entities.AuditLog
        {
            Action = "PolicyAnnotation",
            Actor = user?.Email ?? "Government",
            EntityType = request.ReferenceEntityType ?? "General",
            EntityId = request.ReferenceEntityId ?? Guid.NewGuid().ToString(),
            Metadata = System.Text.Json.JsonSerializer.Serialize(new
            {
                request.Content,
                AnnotatedAt = DateTime.UtcNow,
                AnnotatedBy = userId.Value
            })
        });

        await _db.SaveChangesAsync();
        return Created("", new { message = "Annotation added successfully" });
    }

    /// <summary>
    /// Get all policy reports and annotations
    /// </summary>
    [HttpGet("reports")]
    public async Task<IActionResult> GetReports([FromQuery] int days = 30)
    {
        var cutoff = DateTime.UtcNow.AddDays(-days);

        var reports = await _db.AuditLogs
            .Where(a => (a.Action == "PolicyReport" || a.Action == "PolicyAnnotation")
                       && a.Timestamp >= cutoff)
            .OrderByDescending(a => a.Timestamp)
            .Select(a => new
            {
                a.Id,
                a.Action,
                a.Actor,
                a.EntityType,
                a.EntityId,
                a.Metadata,
                a.Timestamp
            })
            .ToListAsync();

        return Ok(reports);
    }

    [HttpGet("annotations")]
    public async Task<IActionResult> GetAnnotations([FromQuery] int days = 180)
    {
        var cutoff = DateTime.UtcNow.AddDays(-days);
        var rows = await _db.AuditLogs
            .Where(a => a.Action == "PolicyAnnotation" && a.Timestamp >= cutoff)
            .OrderByDescending(a => a.Timestamp)
            .Select(a => new { a.Id, a.Actor, a.EntityType, a.EntityId, a.Metadata, a.Timestamp })
            .ToListAsync();
        var mapped = rows.Select(r => new
        {
            r.Id,
            r.Actor,
            r.EntityType,
            r.EntityId,
            Content = ExtractJsonString(r.Metadata, "Content") ?? r.Metadata ?? string.Empty,
            r.Timestamp
        });
        return Ok(mapped);
    }

    [HttpPut("annotations/{id}")]
    public async Task<IActionResult> UpdateAnnotation(Guid id, UpdatePolicyAnnotationRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();
        if (string.IsNullOrWhiteSpace(request.Content)) return BadRequest("Content is required.");
        var row = await _db.AuditLogs.FirstOrDefaultAsync(a => a.Id == id && a.Action == "PolicyAnnotation");
        if (row == null) return NotFound("Annotation not found.");
        row.Metadata = JsonSerializer.Serialize(new
        {
            Content = request.Content.Trim(),
            UpdatedAt = DateTime.UtcNow,
            UpdatedBy = userId.Value
        });
        row.Timestamp = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return Ok(new { message = "Annotation updated." });
    }

    [HttpDelete("annotations/{id}")]
    public async Task<IActionResult> DeleteAnnotation(Guid id)
    {
        var row = await _db.AuditLogs.FirstOrDefaultAsync(a => a.Id == id && a.Action == "PolicyAnnotation");
        if (row == null) return NotFound("Annotation not found.");
        _db.AuditLogs.Remove(row);
        await _db.SaveChangesAsync();
        return Ok(new { message = "Annotation deleted." });
    }

    [HttpGet("ongoing-contracts")]
    public async Task<IActionResult> GetOngoingContracts()
    {
        var statuses = new[] { "PendingApproval", "PendingSignature", "Active", "InDelivery", "Disputed" };
        var rows = await _db.Contracts
            .Where(c => statuses.Contains(c.Status))
            .Include(c => c.BuyerOrder).ThenInclude(o => o.BuyerProfile).ThenInclude(b => b.User)
            .Include(c => c.BuyerOrder).ThenInclude(o => o.MarketListing).ThenInclude(l => l.Cooperative)
            .OrderByDescending(c => c.CreatedAt)
            .Select(c => new
            {
                c.Id,
                c.TrackingId,
                c.Status,
                c.TotalQuantityKg,
                c.TotalValue,
                Crop = c.BuyerOrder != null ? c.BuyerOrder.Crop : "N/A",
                Buyer = c.BuyerOrder != null && c.BuyerOrder.BuyerProfile != null && c.BuyerOrder.BuyerProfile.User != null ? c.BuyerOrder.BuyerProfile.User.FullName : "N/A",
                Cooperative = c.BuyerOrder != null && c.BuyerOrder.MarketListing != null && c.BuyerOrder.MarketListing.Cooperative != null ? c.BuyerOrder.MarketListing.Cooperative.Name : "N/A",
                c.CreatedAt
            })
            .ToListAsync();
        return Ok(rows);
    }

    [HttpGet("national-intelligence-report")]
    public async Task<IActionResult> GetNationalIntelligenceReport()
    {
        var supplyDemand = await GetSupplyDemandRows();
        var indicators = supplyDemand.Select(x =>
        {
            var ratio = x.Demand > 0 ? x.Supply / x.Demand : (x.Supply > 0 ? 2.0 : 1.0);
            return new
            {
                x.Crop,
                Supply = x.Supply,
                Demand = x.Demand,
                Ratio = Math.Round(ratio, 2),
                Status = ratio > 1.2 ? "Surplus" : ratio < 0.8 ? "Deficit" : "Balanced",
                RiskLevel = ratio < 0.5 ? "High" : ratio < 0.8 ? "Medium" : "Low"
            };
        }).ToList();
        var prices = await _db.MarketPrices.OrderByDescending(p => p.ObservedAt).Take(365).ToListAsync();
        var monthly = prices
            .GroupBy(p => new DateTime(p.ObservedAt.Year, p.ObservedAt.Month, 1))
            .OrderBy(g => g.Key)
            .Select(g => g.Average(x => x.PricePerKg))
            .ToList();
        return Ok(new
        {
            GeneratedAt = DateTime.UtcNow,
            TrendExplanation = BuildTrendExplanation(monthly),
            SupplyDemand = supplyDemand,
            FoodSecurityIndicators = indicators,
            Recommendations = new[]
            {
                "Prioritize deficit crops in cooperative listing and logistics allocation.",
                "Accelerate reporting cadence for regions with repeated high food-security risk.",
                "Use ongoing-contract visibility to pre-empt supply bottlenecks."
            }
        });
    }

    /// <summary>
    /// Get food security indicators
    /// </summary>
    [HttpGet("food-security")]
    public async Task<IActionResult> GetFoodSecurityIndicators()
    {
        var supplyDemand = await GetSupplyDemandRows();
        var indicators = supplyDemand.Select(x =>
        {
            var ratio = x.Demand > 0 ? x.Supply / x.Demand : (x.Supply > 0 ? 2.0 : 1.0);
            return new
            {
                x.Crop,
                Supply = x.Supply,
                Demand = x.Demand,
                Ratio = Math.Round(ratio, 2),
                Status = ratio > 1.2 ? "Surplus" : ratio < 0.8 ? "Deficit" : "Balanced",
                RiskLevel = ratio < 0.5 ? "High" : ratio < 0.8 ? "Medium" : "Low"
            };
        }).ToList();
        return Ok(indicators);
    }

    [HttpGet("early-warnings")]
    public async Task<IActionResult> GetEarlyWarnings()
    {
        var warnings = new List<object>();
        var now = DateTime.UtcNow;

        // Price spike: crops where avg price last 7 days > avg price last 60 days by 25%+
        var recent7 = await _db.MarketPrices
            .Where(p => p.ObservedAt >= now.AddDays(-7))
            .GroupBy(p => p.Crop)
            .Select(g => new { Crop = g.Key, Avg = g.Average(p => p.PricePerKg) })
            .ToListAsync();

        var recent60 = await _db.MarketPrices
            .Where(p => p.ObservedAt >= now.AddDays(-60))
            .GroupBy(p => p.Crop)
            .Select(g => new { Crop = g.Key, Avg = g.Average(p => p.PricePerKg) })
            .ToListAsync();

        foreach (var r7 in recent7)
        {
            var r60 = recent60.FirstOrDefault(x => x.Crop == r7.Crop);
            if (r60 != null && r60.Avg > 0 && r7.Avg > r60.Avg * 1.25m)
            {
                warnings.Add(new
                {
                    id = Guid.NewGuid(),
                    type = "PriceSpike",
                    crop = r7.Crop,
                    region = "National",
                    severity = r7.Avg > r60.Avg * 1.5m ? "High" : "Medium",
                    message = $"{r7.Crop} price spiked {Math.Round((r7.Avg / r60.Avg - 1) * 100, 1)}% above 60-day average",
                    detectedAt = now,
                    status = "Active"
                });
            }
        }

        // Supply shortage: crops where total inventory is unusually low (< 1000 kg)
        var currentLots = await _db.Lots
            .GroupBy(l => l.Crop)
            .Select(g => new { Crop = g.Key, Total = g.Sum(l => l.QuantityKg) })
            .ToListAsync();

        foreach (var cur in currentLots.Where(c => c.Total < 1000 && c.Total > 0))
        {
            warnings.Add(new
            {
                id = Guid.NewGuid(),
                type = "SupplyShortage",
                crop = cur.Crop,
                region = "National",
                severity = cur.Total < 200 ? "High" : "Medium",
                message = $"{cur.Crop} total inventory is critically low at {Math.Round(cur.Total, 0)} kg",
                detectedAt = now,
                status = "Active"
            });
        }

        // Price regulation violations
        var activeRegs = await _db.PriceRegulations
            .Where(r => r.Status == "Active" && r.EffectiveFrom <= now && r.EffectiveTo >= now)
            .ToListAsync();
        foreach (var reg in activeRegs)
        {
            var recentViolations = await _db.MarketPrices
                .Where(p => p.Crop == reg.Crop && p.Region == reg.Region && p.ObservedAt >= now.AddDays(-7)
                    && (p.PricePerKg > reg.MaxPricePerKg || (reg.MinPricePerKg.HasValue && p.PricePerKg < reg.MinPricePerKg.Value)))
                .CountAsync();
            if (recentViolations > 0)
            {
                warnings.Add(new
                {
                    id = Guid.NewGuid(),
                    type = "RegulationViolation",
                    crop = reg.Crop,
                    region = reg.Region,
                    severity = recentViolations > 5 ? "High" : "Medium",
                    message = $"{reg.Crop} has {recentViolations} price observations violating regulation ({reg.MinPricePerKg?.ToString("N0") ?? "0"}–{reg.MaxPricePerKg:N0} RWF/kg) in {reg.Region}",
                    detectedAt = now,
                    status = "Active"
                });
            }
        }

        return Ok(warnings.Take(20));
    }

    [HttpGet("regional-scorecards")]
    public async Task<IActionResult> GetRegionalScorecards()
    {
        var cooperatives = await _db.Cooperatives
            .Include(c => c.Farmers)
            .Include(c => c.Lots)
            .ToListAsync();

        var provinces = new[] { "Kigali City", "Northern Province", "Southern Province", "Eastern Province", "Western Province" };

        var scorecards = provinces.Select(province => {
            var provCoops = cooperatives.Where(c =>
                c.Region.Contains(province, StringComparison.OrdinalIgnoreCase) ||
                c.District.Contains(province, StringComparison.OrdinalIgnoreCase)).ToList();

            var totalFarmers = provCoops.SelectMany(c => c.Farmers).Count();
            var totalCoops = provCoops.Count;
            var lots = provCoops.SelectMany(c => c.Lots).ToList();
            var totalVolume = lots.Sum(l => l.QuantityKg);
            var avgPrice = lots.Any() ? (lots.Average(l => l.ExpectedPricePerKg) ?? 0m) : 0m;
            var fsScore = Math.Min(100, 50 + totalFarmers / 10 + (int)(totalVolume / 1000));
            var growthPct = totalVolume > 0 ? Math.Round(Math.Min(100, totalVolume / 10000), 1) : 0;

            return new
            {
                district = province,
                totalFarmers,
                totalCooperatives = totalCoops,
                avgPrice = Math.Round(avgPrice, 2),
                totalVolumeKg = totalVolume,
                growthPct,
                foodSecurityScore = fsScore,
                rank = 0
            };
        })
        .OrderByDescending(s => s.foodSecurityScore)
        .Select((s, idx) => new
        {
            s.district,
            s.totalFarmers,
            s.totalCooperatives,
            s.avgPrice,
            s.totalVolumeKg,
            s.growthPct,
            s.foodSecurityScore,
            rank = idx + 1
        })
        .ToList();

        return Ok(scorecards);
    }

    private async Task<List<dynamic>> GetSupplyDemandRows()
    {
        var supply = await _db.MarketListings
            .Where(l => l.Status == "Active")
            .GroupBy(l => l.Crop)
            .Select(g => new
            {
                Crop = g.Key,
                TotalSupply = g.Sum(l => l.QuantityKg),
                AveragePrice = g.Average(l => l.MinimumPrice)
            })
            .ToListAsync();

        var demand = await _db.BuyerOrders
            .Where(o => o.Status == "Open" || o.Status == "Accepted")
            .GroupBy(o => o.Crop)
            .Select(g => new
            {
                Crop = g.Key,
                TotalDemand = g.Sum(o => o.QuantityKg),
                AveragePriceOffer = g.Average(o => o.PriceOffer)
            })
            .ToListAsync();

        var crops = supply.Select(s => s.Crop).Union(demand.Select(d => d.Crop)).Distinct().ToList();
        return crops.Select(crop =>
        {
            var s = supply.FirstOrDefault(x => x.Crop == crop);
            var d = demand.FirstOrDefault(x => x.Crop == crop);
            var supplyVal = s?.TotalSupply ?? 0;
            var demandVal = d?.TotalDemand ?? 0;
            return new
            {
                Crop = crop,
                Supply = supplyVal,
                Demand = demandVal,
                SupplyPrice = s?.AveragePrice ?? 0m,
                DemandPrice = d?.AveragePriceOffer ?? 0m,
                Balance = supplyVal - demandVal,
                Status = supplyVal > demandVal ? "Surplus" : supplyVal < demandVal ? "Deficit" : "Balanced"
            };
        }).Cast<dynamic>().ToList();
    }

    private static string BuildTrendExplanation(IReadOnlyList<decimal> trend)
    {
        if (trend.Count < 2) return "Insufficient trend history. Collect more market price observations.";
        var first = trend.First();
        var last = trend.Last();
        if (first <= 0) return "Baseline price is not valid for trend interpretation.";
        var deltaPct = Math.Round(((last - first) / first) * 100, 1);
        if (deltaPct > 8) return $"National prices are rising (+{deltaPct}%) mainly due to demand growth versus active supply.";
        if (deltaPct < -8) return $"National prices are falling ({deltaPct}%) due to stronger supply coverage and easing demand pressure.";
        return $"National prices are stable ({deltaPct}% change), indicating near-balanced supply and demand.";
    }

    private static string? ExtractJsonString(string? metadata, string key)
    {
        if (string.IsNullOrWhiteSpace(metadata)) return null;
        try
        {
            using var doc = JsonDocument.Parse(metadata);
            if (doc.RootElement.TryGetProperty(key, out var val) && val.ValueKind == JsonValueKind.String)
                return val.GetString();
        }
        catch { }
        return null;
    }
}

