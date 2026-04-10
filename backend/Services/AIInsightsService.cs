using Microsoft.EntityFrameworkCore;
using Rass.Api.Data;
using Rass.Api.Domain.Entities;

namespace Rass.Api.Services;

/// <summary>
/// AI-powered platform intelligence service for admin monitoring
/// Detects anomalies, monitors data quality, and provides recommendations
/// </summary>
public class AIInsightsService
{
    private readonly AppDbContext _db;
    private readonly ForecastingService _forecastingService;
    private readonly ILogger<AIInsightsService> _logger;

    public AIInsightsService(
        AppDbContext db,
        ForecastingService forecastingService,
        ILogger<AIInsightsService> logger)
    {
        _db = db;
        _forecastingService = forecastingService;
        _logger = logger;
    }

    #region Platform Anomaly Detection

    /// <summary>
    /// Scan for price anomalies across all markets
    /// </summary>
    public async Task<List<PlatformAlert>> DetectPriceAnomaliesAsync()
    {
        var alerts = new List<PlatformAlert>();
        
        try
        {
            // Get recent prices grouped by crop and market
            var recentPrices = await _db.MarketPrices
                .Where(p => p.ObservedAt >= DateTime.UtcNow.AddDays(-30))
                .GroupBy(p => new { p.Crop, p.Market })
                .Select(g => new
                {
                    g.Key.Crop,
                    g.Key.Market,
                    Prices = g.OrderByDescending(p => p.ObservedAt).Take(30).ToList(),
                    LatestPrice = g.OrderByDescending(p => p.ObservedAt).First()
                })
                .ToListAsync();

            foreach (var group in recentPrices)
            {
                if (group.Prices.Count < 5) continue;

                var prices = group.Prices.Select(p => (double)p.PricePerKg).ToList();
                var mean = prices.Average();
                var stdDev = Math.Sqrt(prices.Average(p => Math.Pow(p - mean, 2)));
                var latestPrice = (double)group.LatestPrice.PricePerKg;
                var zScore = stdDev > 0 ? (latestPrice - mean) / stdDev : 0;

                // Check for significant price spike (>2.5 std deviations)
                if (Math.Abs(zScore) > 2.5)
                {
                    var isSpike = zScore > 0;
                    var percentChange = ((latestPrice - mean) / mean) * 100;

                    // ENHANCEMENT: Query the Python forecasting service to verify
                    // if this anomaly is expected (e.g., seasonal) or a true anomaly
                    var history = group.Prices.Select(p => new HistoricalPrice 
                    { 
                        Date = p.ObservedAt, 
                        Price = p.PricePerKg 
                    }).ToList();

                    var aiForecast = await _forecastingService.GetEnhancedPriceForecastAsync(
                        group.Crop, 
                        group.Market, 
                        7, 
                        history);

                    double aiConfidenceScore = Math.Min(0.95, 0.7 + Math.Abs(zScore) * 0.1);
                    string severity = Math.Abs(zScore) > 3.5 ? "Critical" : Math.Abs(zScore) > 3 ? "High" : "Medium";
                    
                    if (aiForecast != null && aiForecast.Confidence > 0)
                    {
                        // Compare latest price with AI's expected price range
                        var todayForecast = aiForecast.Predictions.FirstOrDefault();
                        if (todayForecast != null)
                        {
                            if (latestPrice > todayForecast.UpperBound || latestPrice < todayForecast.LowerBound)
                            {
                                // AI confirms this is outside the expected statistical band (True Anomaly)
                                aiConfidenceScore = Math.Max(aiConfidenceScore, aiForecast.Confidence);
                                severity = "Critical"; // Escalate
                            }
                            else
                            {
                                // AI thinks this price is actually within expected variance (e.g. seasonal shift)
                                aiConfidenceScore *= 0.5; // Downgrade confidence
                                severity = "Low";
                            }
                        }
                    }

                    alerts.Add(new PlatformAlert
                    {
                        AlertType = isSpike ? "PriceSpike" : "PriceDrop",
                        Severity = severity,
                        Title = $"{(isSpike ? "Price Spike" : "Price Drop")} Detected: {group.Crop}",
                        Description = $"{group.Crop} in {group.Market} has experienced a {Math.Abs(percentChange):F1}% {(isSpike ? "increase" : "decrease")}. " +
                                    $"Current price: {latestPrice:N0} RWF/kg, Average: {mean:N0} RWF/kg. Z-score: {zScore:F2}",
                        Crop = group.Crop,
                        Region = group.Market,
                        ConfidenceScore = aiConfidenceScore,
                        AiRecommendation = isSpike
                            ? "Investigate potential market manipulation or supply shortage. Review recent transactions."
                            : "Check for quality issues or oversupply. May indicate market instability."
                    });
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error detecting price anomalies");
        }

        return alerts;
    }

    /// <summary>
    /// Detect suspicious user activities
    /// </summary>
    public async Task<List<PlatformAlert>> DetectSuspiciousActivitiesAsync()
    {
        var alerts = new List<PlatformAlert>();

        try
        {
            // 1. Detect users with unusually high transaction volumes
            var highVolumeUsers = await _db.BuyerOrders
                .Where(o => o.CreatedAt >= DateTime.UtcNow.AddDays(-7))
                .GroupBy(o => o.BuyerProfileId)
                .Select(g => new { BuyerProfileId = g.Key, OrderCount = g.Count(), TotalValue = g.Sum(o => (decimal)o.QuantityKg * o.PriceOffer) })
                .Where(x => x.OrderCount > 20 || x.TotalValue > 50_000_000) // 50M RWF threshold
                .ToListAsync();

            foreach (var user in highVolumeUsers)
            {
                var buyer = await _db.BuyerProfiles.Include(b => b.User).FirstOrDefaultAsync(b => b.Id == user.BuyerProfileId);
                alerts.Add(new PlatformAlert
                {
                    AlertType = "SuspiciousActivity",
                    Severity = "Medium",
                    Title = $"High Transaction Volume: {buyer?.User?.FullName ?? "Unknown"}",
                    Description = $"Buyer placed {user.OrderCount} orders worth {user.TotalValue:N0} RWF in the last 7 days.",
                    RelatedUserId = buyer?.UserId,
                    ConfidenceScore = 0.7,
                    AiRecommendation = "Review transaction history for potential fraud or bulk buying patterns."
                });
            }

            // 2. Detect inactive cooperatives with active listings
            var inactiveCoops = await _db.Cooperatives
                .Include(c => c.Manager)
                .Where(c => !_db.BuyerOrders
                    .Any(o => o.MarketListing != null && 
                              o.MarketListing.CooperativeId == c.Id && 
                              o.CreatedAt >= DateTime.UtcNow.AddDays(-30)))
                .Where(c => _db.MarketListings.Any(l => l.CooperativeId == c.Id && l.Status == "Active"))
                .ToListAsync();

            foreach (var coop in inactiveCoops)
            {
                alerts.Add(new PlatformAlert
                {
                    AlertType = "InactiveUser",
                    Severity = "Low",
                    Title = $"Inactive Cooperative: {coop.Name}",
                    Description = $"Cooperative {coop.Name} has active listings but no orders in 30 days.",
                    RelatedUserId = coop.ManagerId,
                    Region = coop.Region,
                    District = coop.District,
                    ConfidenceScore = 0.8,
                    AiRecommendation = "Contact cooperative to verify activity. Consider listing review."
                });
            }

            // 3. Detect potentially fake listings (unrealistic prices or quantities)
            var suspiciousListings = await _db.MarketListings
                .Include(l => l.Cooperative)
                .Where(l => l.Status == "Active")
                .Where(l => l.MinimumPrice < 10 || l.MinimumPrice > 50000 || l.QuantityKg > 500000)
                .ToListAsync();

            foreach (var listing in suspiciousListings)
            {
                alerts.Add(new PlatformAlert
                {
                    AlertType = "FraudRisk",
                    Severity = listing.MinimumPrice < 10 ? "High" : "Medium",
                    Title = $"Suspicious Listing: {listing.Crop}",
                    Description = $"Listing for {listing.Crop} has unusual parameters: " +
                                $"Price: {listing.MinimumPrice:N0} RWF/kg, Quantity: {listing.QuantityKg:N0} kg",
                    RelatedEntityId = listing.Id,
                    RelatedEntityType = "MarketListing",
                    Crop = listing.Crop,
                    ConfidenceScore = 0.75,
                    AiRecommendation = "Verify listing details with cooperative. Consider temporary suspension."
                });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error detecting suspicious activities");
        }

        return alerts;
    }

    /// <summary>
    /// Detect supply vs demand imbalances
    /// </summary>
    public async Task<List<PlatformAlert>> DetectSupplyDemandImbalancesAsync()
    {
        var alerts = new List<PlatformAlert>();

        try
        {
            // Get active listings supply
            var supply = await _db.MarketListings
                .Where(l => l.Status == "Active")
                .GroupBy(l => l.Crop)
                .Select(g => new { Crop = g.Key, TotalKg = g.Sum(l => l.QuantityKg) })
                .ToListAsync();

            // Get recent demand (orders in last 30 days)
            var demand = await _db.BuyerOrders
                .Where(o => o.CreatedAt >= DateTime.UtcNow.AddDays(-30))
                .Where(o => o.MarketListing != null)
                .GroupBy(o => o.MarketListing!.Crop)
                .Select(g => new { Crop = g.Key, TotalKg = g.Sum(o => o.QuantityKg) })
                .ToListAsync();

            foreach (var s in supply)
            {
                var d = demand.FirstOrDefault(x => x.Crop == s.Crop);
                var demandKg = d?.TotalKg ?? 0;

                // Check for severe imbalance
                if (demandKg > 0)
                {
                    var ratio = s.TotalKg / demandKg;

                    if (ratio < 0.3) // Supply shortage
                    {
                        alerts.Add(new PlatformAlert
                        {
                            AlertType = "SupplyShortage",
                            Severity = ratio < 0.1 ? "Critical" : "High",
                            Title = $"Supply Shortage: {s.Crop}",
                            Description = $"Available supply ({s.TotalKg:N0} kg) is only {ratio * 100:F0}% of recent demand ({demandKg:N0} kg/month).",
                            Crop = s.Crop,
                            ConfidenceScore = 0.85,
                            AiRecommendation = "Alert cooperatives to increase production or listings. Consider price guidance."
                        });
                    }
                    else if (ratio > 5) // Oversupply
                    {
                        alerts.Add(new PlatformAlert
                        {
                            AlertType = "DemandSurge",
                            Severity = "Medium",
                            Title = $"Oversupply Warning: {s.Crop}",
                            Description = $"Available supply ({s.TotalKg:N0} kg) is {ratio:F1}x the recent demand ({demandKg:N0} kg/month).",
                            Crop = s.Crop,
                            ConfidenceScore = 0.75,
                            AiRecommendation = "Consider promotional campaigns or price adjustments. Alert cooperatives about storage considerations."
                        });
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error detecting supply/demand imbalances");
        }

        return alerts;
    }

    #endregion

    #region Data Quality Analysis

    /// <summary>
    /// Scan for data quality issues across the platform
    /// </summary>
    public async Task<List<DataQualityIssue>> ScanDataQualityAsync()
    {
        var issues = new List<DataQualityIssue>();

        try
        {
            // 1. Check for unrealistic harvest quantities
            var unrealisticHarvests = await _db.HarvestDeclarations
                .Include(h => h.Farmer)
                .Where(h => h.ExpectedQuantityKg > 50000 || h.ExpectedQuantityKg < 1)
                .ToListAsync();

            foreach (var h in unrealisticHarvests)
            {
                issues.Add(new DataQualityIssue
                {
                    IssueType = "UnrealisticValue",
                    Severity = h.ExpectedQuantityKg > 100000 ? "High" : "Medium",
                    EntityType = "HarvestDeclaration",
                    EntityId = h.Id,
                    FieldName = "ExpectedQuantityKg",
                    CurrentValue = h.ExpectedQuantityKg.ToString("N0"),
                    ExpectedValue = "100 - 10,000 kg typical",
                    Description = $"Harvest declaration of {h.ExpectedQuantityKg:N0} kg from farmer {h.Farmer?.User?.FullName} seems unrealistic.",
                    Crop = h.Crop,
                    SuggestedCorrection = "Verify with farmer. May be typo (missing/extra zeros).",
                    AutoCorrectable = false
                });
            }

            // 2. Check for missing price data
            var cropsWithoutRecentPrices = await _db.MarketListings
                .Where(l => l.Status == "Active")
                .Select(l => l.Crop)
                .Distinct()
                .ToListAsync();

            var recentPriceCrops = await _db.MarketPrices
                .Where(p => p.ObservedAt >= DateTime.UtcNow.AddDays(-7))
                .Select(p => p.Crop)
                .Distinct()
                .ToListAsync();

            var missingPriceCrops = cropsWithoutRecentPrices.Except(recentPriceCrops, StringComparer.OrdinalIgnoreCase);

            foreach (var crop in missingPriceCrops)
            {
                issues.Add(new DataQualityIssue
                {
                    IssueType = "MissingData",
                    Severity = "High",
                    EntityType = "MarketPrice",
                    FieldName = "PricePerKg",
                    Description = $"No market price data for {crop} in the last 7 days. Active listings exist.",
                    Crop = crop,
                    SuggestedCorrection = "Collect price data from market agents.",
                    AutoCorrectable = false
                });
            }

            // 3. Check for duplicate entries
            var duplicateListings = await _db.MarketListings
                .Where(l => l.Status == "Active")
                .GroupBy(l => new { l.CooperativeId, l.Crop, l.MinimumPrice })
                .Where(g => g.Count() > 1)
                .Select(g => new { g.Key, Count = g.Count(), Listings = g.ToList() })
                .ToListAsync();

            foreach (var dup in duplicateListings)
            {
                issues.Add(new DataQualityIssue
                {
                    IssueType = "DuplicateEntry",
                    Severity = "Low",
                    EntityType = "MarketListing",
                    EntityId = dup.Listings.First().Id,
                    Description = $"Found {dup.Count} potentially duplicate listings for same crop at same price from same cooperative.",
                    Crop = dup.Key.Crop,
                    SuggestedCorrection = "Review and consolidate duplicate listings.",
                    AutoCorrectable = true
                });
            }

            // 4. Check for inconsistent data
            var inconsistentLots = await _db.Lots
                .Where(l => l.HarvestedAt != null && l.HarvestedAt > DateTime.UtcNow)
                .ToListAsync();

            foreach (var lot in inconsistentLots)
            {
                issues.Add(new DataQualityIssue
                {
                    IssueType = "InconsistentData",
                    Severity = "Medium",
                    EntityType = "Lot",
                    EntityId = lot.Id,
                    FieldName = "HarvestedAt",
                    CurrentValue = lot.HarvestedAt?.ToString("yyyy-MM-dd"),
                    ExpectedValue = "Date <= today",
                    Description = "Lot has harvest date in the future.",
                    Crop = lot.Crop,
                    SuggestedCorrection = "Correct the harvest date.",
                    AutoCorrectable = false
                });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error scanning data quality");
        }

        return issues;
    }

    #endregion

    #region Model Performance Monitoring

    /// <summary>
    /// Get model performance summary
    /// </summary>
    public async Task<object> GetModelPerformanceSummaryAsync()
    {
        var logs = await _db.ModelPerformanceLogs
            .Where(l => l.RecordedAt >= DateTime.UtcNow.AddDays(-30))
            .GroupBy(l => l.ModelName)
            .Select(g => new
            {
                Model = g.Key,
                AvgAccuracy = g.Average(l => l.AccuracyRate),
                AvgMae = g.Average(l => l.Mae ?? 0),
                LatestStatus = g.OrderByDescending(l => l.RecordedAt).First().Status,
                DriftDetected = g.Any(l => l.DriftDetected),
                RecordCount = g.Count()
            })
            .ToListAsync();

        return new
        {
            models = logs,
            overallHealth = logs.All(l => l.LatestStatus == "Active") ? "Healthy" : 
                           logs.Any(l => l.LatestStatus == "Degraded") ? "Degraded" : "NeedsAttention",
            lastUpdated = DateTime.UtcNow
        };
    }

    /// <summary>
    /// Log model performance metrics
    /// </summary>
    public async Task LogModelPerformanceAsync(ModelPerformanceLog log)
    {
        _db.ModelPerformanceLogs.Add(log);
        await _db.SaveChangesAsync();
    }

    #endregion

    #region Recommendations Engine

    /// <summary>
    /// Generate AI recommendations for admin
    /// </summary>
    public async Task<List<object>> GenerateAdminRecommendationsAsync()
    {
        var recommendations = new List<object>();

        try
        {
            // 1. Data collection recommendations
            var regionsWithLowData = await _db.MarketPrices
                .Where(p => p.ObservedAt >= DateTime.UtcNow.AddDays(-30))
                .GroupBy(p => p.Market)
                .Select(g => new { Region = g.Key, DataPoints = g.Count() })
                .Where(x => x.DataPoints < 10)
                .ToListAsync();

            foreach (var region in regionsWithLowData)
            {
                recommendations.Add(new
                {
                    type = "DataCollection",
                    priority = "High",
                    title = $"Increase data collection in {region.Region}",
                    description = $"Only {region.DataPoints} price data points collected in the last 30 days. AI models need more data for accurate predictions.",
                    action = "Deploy market agents or incentivize reporting"
                });
            }

            // 2. Model accuracy warnings
            var degradedModels = await _db.ModelPerformanceLogs
                .Where(l => l.RecordedAt >= DateTime.UtcNow.AddDays(-7))
                .Where(l => l.AccuracyRate < 70)
                .Select(l => new { l.ModelName, l.Crop, l.AccuracyRate })
                .Distinct()
                .ToListAsync();

            foreach (var model in degradedModels)
            {
                recommendations.Add(new
                {
                    type = "ModelAccuracy",
                    priority = model.AccuracyRate < 50 ? "Critical" : "Medium",
                    title = $"Model accuracy dropping for {model.Crop ?? "general"} ({model.ModelName})",
                    description = $"Current accuracy: {model.AccuracyRate:F1}%. Consider retraining or switching models.",
                    action = "Retrain model or review training data quality"
                });
            }

            // 3. User engagement recommendations
            var lowEngagementRoles = await _db.Users
                .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
                .Where(u => u.LastLogin != null && u.LastLogin < DateTime.UtcNow.AddDays(-14))
                .GroupBy(u => u.UserRoles.First().Role.Name)
                .Select(g => new { Role = g.Key, InactiveCount = g.Count() })
                .Where(x => x.InactiveCount > 10)
                .ToListAsync();

            foreach (var role in lowEngagementRoles)
            {
                recommendations.Add(new
                {
                    type = "UserEngagement",
                    priority = "Low",
                    title = $"{role.InactiveCount} inactive {role.Role}s",
                    description = $"These users haven't logged in for 2+ weeks. Consider re-engagement campaigns.",
                    action = "Send notifications or conduct user surveys"
                });
            }

            // 4. System health recommendations
            var pendingAlerts = await _db.PlatformAlerts.CountAsync(a => a.Status == "Open");
            if (pendingAlerts > 20)
            {
                recommendations.Add(new
                {
                    type = "SystemHealth",
                    priority = "High",
                    title = $"{pendingAlerts} unresolved platform alerts",
                    description = "Large backlog of alerts needs attention. Consider automated handling rules.",
                    action = "Review and resolve alerts, configure automation"
                });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating recommendations");
        }

        return recommendations;
    }

    #endregion

    #region National Statistics

    /// <summary>
    /// Get comprehensive national platform statistics
    /// </summary>
    public async Task<object> GetNationalStatisticsAsync()
    {
        var now = DateTime.UtcNow;
        var from90 = now.AddDays(-90);
        var userStats = await _db.Users
            .Include(u => u.UserRoles)
            .ThenInclude(ur => ur.Role)
            .GroupBy(u => u.UserRoles.First().Role.Name)
            .Select(g => new { Role = g.Key, Count = g.Count() })
            .ToListAsync();

        var transactionStats = await _db.BuyerOrders
            .Where(o => o.CreatedAt >= DateTime.UtcNow.AddDays(-30))
            .GroupBy(o => o.Status)
            .Select(g => new { Status = g.Key, Count = g.Count(), TotalValue = g.Sum(o => (decimal)o.QuantityKg * o.PriceOffer) })
            .ToListAsync();

        var volumeByRegion = await _db.MarketListings
            .Where(l => l.Status == "Active")
            .Include(l => l.Cooperative)
            .GroupBy(l => l.Cooperative.Region)
            .Select(g => new { Region = g.Key, TotalKg = g.Sum(l => l.QuantityKg), ListingCount = g.Count() })
            .ToListAsync();

        var topCrops = await _db.MarketListings
            .Where(l => l.Status == "Active")
            .GroupBy(l => l.Crop)
            .Select(g => new { Crop = g.Key, TotalKg = g.Sum(l => l.QuantityKg), AvgPrice = g.Average(l => l.MinimumPrice) })
            .OrderByDescending(x => x.TotalKg)
            .Take(10)
            .ToListAsync();

        var aggregatedPriceTrends = await _db.MarketPrices
            .Where(p => p.ObservedAt >= from90)
            .GroupBy(p => new { date = p.ObservedAt.Date, p.Crop })
            .Select(g => new
            {
                date = g.Key.date,
                crop = g.Key.Crop,
                avgPrice = Math.Round(g.Average(x => x.PricePerKg), 2)
            })
            .OrderBy(x => x.date)
            .ToListAsync();

        var supplyByCrop = await _db.MarketListings
            .Where(l => l.CreatedAt >= from90)
            .GroupBy(l => l.Crop)
            .Select(g => new { crop = g.Key, supplyKg = g.Sum(x => x.QuantityKg) })
            .ToListAsync();
        var demandByCrop = await _db.BuyerOrders
            .Where(o => o.CreatedAt >= from90)
            .GroupBy(o => o.Crop)
            .Select(g => new { crop = g.Key, demandKg = g.Sum(x => x.QuantityKg) })
            .ToListAsync();
        var demandMap = demandByCrop.ToDictionary(x => x.crop, x => x.demandKg, StringComparer.OrdinalIgnoreCase);
        var supplyDemandBalance = supplyByCrop
            .Select(s =>
            {
                var demand = demandMap.TryGetValue(s.crop, out var d) ? d : 0;
                return new
                {
                    crop = s.crop,
                    supplyKg = Math.Round(s.supplyKg, 2),
                    demandKg = Math.Round(demand, 2),
                    balanceKg = Math.Round(s.supplyKg - demand, 2)
                };
            })
            .OrderByDescending(x => Math.Abs(x.balanceKg))
            .Take(20)
            .ToList();

        var regionalComparisons = await _db.MarketListings
            .Where(l => l.CreatedAt >= from90)
            .Include(l => l.Cooperative)
            .GroupBy(l => l.Cooperative.Region)
            .Select(g => new
            {
                region = g.Key,
                listingCount = g.Count(),
                volumeKg = Math.Round(g.Sum(x => x.QuantityKg), 2),
                avgMinPrice = Math.Round(g.Average(x => x.MinimumPrice), 2)
            })
            .OrderByDescending(x => x.volumeKg)
            .ToListAsync();

        return new
        {
            users = new
            {
                total = userStats.Sum(u => u.Count),
                byRole = userStats
            },
            transactions = new
            {
                last30Days = transactionStats,
                totalVolume = transactionStats.Sum(t => t.TotalValue),
                totalCount = transactionStats.Sum(t => t.Count)
            },
            regionalPerformance = volumeByRegion,
            topCrops = topCrops,
            aggregatedPriceTrends,
            supplyDemandBalance,
            regionalComparisons,
            generatedAt = DateTime.UtcNow
        };
    }

    public async Task<ScanResult> ScanPlatformAsync()
    {
        var anomalies = 0;
        var recommendations = 0;
        var requiresAction = false;

        try
        {
            var priceAnomalies = await DetectPriceAnomaliesAsync();
            var suspiciousActivity = await DetectSuspiciousActivitiesAsync();
            var supplyImbalance = await DetectSupplyDemandImbalancesAsync();

            anomalies = priceAnomalies.Count + suspiciousActivity.Count + supplyImbalance.Count;
            requiresAction = anomalies > 0;

            var recs = await GenerateAdminRecommendationsAsync();
            recommendations = recs.Count;

            _logger.LogInformation($"Scan completed. Anomalies: {anomalies}, Recommendations: {recommendations}");
        }
        catch (Exception ex)
        {
             _logger.LogError(ex, "Error during platform scan.");
        }

        return new ScanResult
        {
            AnomaliesDetected = anomalies,
            RecommendationsGenerated = recommendations,
            RequiresAction = requiresAction
        };
    }
    #endregion
}

public class ScanResult
{
    public int AnomaliesDetected { get; set; }
    public int RecommendationsGenerated { get; set; }
    public bool RequiresAction { get; set; }
}
