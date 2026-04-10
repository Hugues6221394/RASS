using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Rass.Api.Data;
using Rass.Api.Services;
using System.Security.Claims;
using System.Text.Json;

namespace Rass.Api.Controllers;

[ApiController]
[Route("api/role-analytics")]
[Authorize]
public class RoleAnalyticsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly AIChatService _aiChatService;

    public RoleAnalyticsController(AppDbContext db, AIChatService aiChatService)
    {
        _db = db;
        _aiChatService = aiChatService;
    }

    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary()
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var roles = User.Claims
            .Where(c => c.Type == ClaimTypes.Role)
            .Select(c => c.Value)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        return Ok(await BuildSummaryForRoles(userId.Value, roles));
    }

    [HttpPost("assistant")]
    public async Task<IActionResult> AskAssistant([FromBody] RoleAssistantRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();
        if (request == null || string.IsNullOrWhiteSpace(request.Question))
            return BadRequest("Question is required.");

        var roles = User.Claims
            .Where(c => c.Type == ClaimTypes.Role)
            .Select(c => c.Value)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        var summary = await BuildSummaryForRoles(userId.Value, roles);
        var node = JsonSerializer.SerializeToElement(summary);

        var role = node.TryGetProperty("role", out var roleNode) ? roleNode.GetString() ?? "User" : "User";
        var metrics = node.TryGetProperty("metrics", out var metricsNode) && metricsNode.ValueKind == JsonValueKind.Array
            ? metricsNode.EnumerateArray().Take(3).Select(m =>
            {
                var label = m.TryGetProperty("label", out var l) ? l.GetString() ?? "Metric" : "Metric";
                var value = m.TryGetProperty("value", out var v) ? v.ToString() : "0";
                var unit = m.TryGetProperty("unit", out var u) ? u.GetString() ?? string.Empty : string.Empty;
                return $"{label}: {value}{(string.IsNullOrWhiteSpace(unit) ? string.Empty : $" {unit}")}";
            }).ToArray()
            : Array.Empty<string>();

        var risks = node.TryGetProperty("risks", out var risksNode) && risksNode.ValueKind == JsonValueKind.Array
            ? risksNode.EnumerateArray()
                .Where(r => r.TryGetProperty("severity", out var s) && string.Equals(s.GetString(), "High", StringComparison.OrdinalIgnoreCase))
                .Take(2)
                .Select(r => r.TryGetProperty("title", out var t) ? t.GetString() ?? "Risk" : "Risk")
                .ToArray()
            : Array.Empty<string>();

        var recommendations = node.TryGetProperty("recommendations", out var recNode) && recNode.ValueKind == JsonValueKind.Array
            ? recNode.EnumerateArray().Take(3).Select(r => r.GetString() ?? string.Empty).Where(x => !string.IsNullOrWhiteSpace(x)).ToArray()
            : Array.Empty<string>();

        var context = JsonSerializer.Serialize(new
        {
            role,
            metrics,
            risks,
            recommendations,
            generatedAt = DateTime.UtcNow
        });
        string answer;
        try
        {
            answer = await _aiChatService.ProcessRoleQueryAsync(request.Question.Trim(), role, context);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }

        return Ok(new
        {
            role,
            question = request.Question.Trim(),
            answer,
            highlights = metrics,
            recommendations,
            generatedAt = DateTime.UtcNow
        });
    }

    private async Task<object> BuildSummaryForRoles(Guid userId, HashSet<string> roles)
    {
        if (roles.Contains("Admin") || roles.Contains("Government"))
            return await BuildNationalSummary(roles.Contains("Admin") ? "Admin" : "Government");
        if (roles.Contains("CooperativeManager"))
            return await BuildCooperativeSummary(userId);
        if (roles.Contains("Buyer"))
            return await BuildBuyerSummary(userId);
        if (roles.Contains("Farmer"))
            return await BuildFarmerSummary(userId);
        if (roles.Contains("MarketAgent"))
            return await BuildMarketAgentSummary(userId);
        if (roles.Contains("StorageOperator") || roles.Contains("StorageManager"))
            return await BuildStorageSummary();
        if (roles.Contains("Transporter"))
            return await BuildTransporterSummary(userId);

        return new
        {
            role = "User",
            generatedAt = DateTime.UtcNow,
            metrics = Array.Empty<object>(),
            risks = Array.Empty<object>(),
            recommendations = new[] { "No role-specific analytics profile was found for this account." }
        };
    }

    private async Task<object> BuildCooperativeSummary(Guid userId)
    {
        var visuals = await BuildVisualPackAsync();
        var coop = await _db.Cooperatives.FirstOrDefaultAsync(c => c.ManagerId == userId);
        if (coop == null) return new { role = "CooperativeManager", generatedAt = DateTime.UtcNow, metrics = Array.Empty<object>(), risks = Array.Empty<object>(), recommendations = new[] { "Cooperative profile not found." } };

        var inventoryKg = await _db.Lots.Where(l => l.CooperativeId == coop.Id).SumAsync(l => (double?)l.QuantityKg) ?? 0;
        var activeListings = await _db.MarketListings.CountAsync(l => l.CooperativeId == coop.Id && l.Status == "Active");
        var expiringListings = await _db.MarketListings.CountAsync(l => l.CooperativeId == coop.Id && l.Status == "Active" && l.AvailabilityWindowEnd <= DateTime.UtcNow.AddDays(5));
        var avgListingPrice = await _db.MarketListings.Where(l => l.CooperativeId == coop.Id && l.Status == "Active").AverageAsync(l => (decimal?)l.MinimumPrice) ?? 0;
        var openOrdersKg = await _db.BuyerOrders.Where(o => o.MarketListing != null && o.MarketListing.CooperativeId == coop.Id && (o.Status == "Open" || o.Status == "Accepted")).SumAsync(o => (double?)o.QuantityKg) ?? 0;
        var pendingContracts = await _db.Contracts.CountAsync(c => c.BuyerOrder != null && c.BuyerOrder.MarketListing != null && c.BuyerOrder.MarketListing.CooperativeId == coop.Id && (c.Status == "PendingApproval" || c.Status == "PendingSignature"));
        var completedContracts = await _db.Contracts.CountAsync(c => c.BuyerOrder != null && c.BuyerOrder.MarketListing != null && c.BuyerOrder.MarketListing.CooperativeId == coop.Id && c.Status == "Completed");
        var fulfilledShare = completedContracts + pendingContracts == 0 ? 0 : Math.Round((completedContracts * 100.0) / (completedContracts + pendingContracts), 1);

        return new
        {
            role = "CooperativeManager",
            generatedAt = DateTime.UtcNow,
            metrics = new object[]
            {
                new { key = "inventoryKg", label = "Inventory", value = Math.Round(inventoryKg), unit = "kg" },
                new { key = "activeListings", label = "Active Listings", value = activeListings, unit = "items" },
                new { key = "openOrdersKg", label = "Open Order Demand", value = Math.Round(openOrdersKg), unit = "kg" },
                new { key = "pendingContracts", label = "Pending Contracts", value = pendingContracts, unit = "contracts" },
                new { key = "expiringListings", label = "Listings Expiring Soon", value = expiringListings, unit = "items" },
                new { key = "avgListingPrice", label = "Avg Listing Price", value = Math.Round(avgListingPrice), unit = "RWF/kg" },
                new { key = "fulfillmentReadiness", label = "Contract Throughput", value = fulfilledShare, unit = "%" }
            },
            risks = new object[]
            {
                new { severity = openOrdersKg > inventoryKg ? "High" : "Low", title = "Order Coverage Risk", detail = openOrdersKg > inventoryKg ? "Open demand currently exceeds available inventory." : "Current inventory can satisfy open order demand." },
                new { severity = pendingContracts > 3 ? "Medium" : "Low", title = "Contract Backlog", detail = pendingContracts > 3 ? "Several contracts are awaiting approval/signature." : "Contract signing pipeline is healthy." },
                new { severity = expiringListings > 2 ? "Medium" : "Low", title = "Listing Expiry Risk", detail = expiringListings > 2 ? "Multiple active listings are nearing expiry windows." : "Listing windows are currently healthy." }
            },
            recommendations = new[]
            {
                openOrdersKg > inventoryKg ? "Increase listing replenishment and coordinate farmer contributions to cover demand." : "Prioritize fast-moving crops and keep listing windows active.",
                pendingContracts > 0 ? "Push both parties to complete contract review and OTP signing to reduce revenue delay." : "Continue maintaining quick contract turnaround.",
                expiringListings > 0 ? "Refresh listing windows and adjust reserve prices for lots nearing expiry." : "Sustain listing cadence with weekly price recalibration.",
                "Use demand projection by crop to rebalance storage, listing quantity, and transporter booking priorities."
            },
            trendSeries = visuals.TrendSeries,
            forecastVsActual = visuals.ForecastVsActual,
            confidenceBands = visuals.ConfidenceBands,
            regionalHeatmap = visuals.RegionalHeatmap,
            demandProjection = visuals.DemandProjection,
            priceVolatility = visuals.PriceVolatility,
            cropMomentum = visuals.CropMomentum,
            supplyDemandBalance = visuals.SupplyDemandBalance,
            deliveryPerformance = visuals.DeliveryPerformance
        };
    }

    private async Task<object> BuildBuyerSummary(Guid userId)
    {
        var visuals = await BuildVisualPackAsync();
        var buyer = await _db.BuyerProfiles.FirstOrDefaultAsync(b => b.UserId == userId);
        if (buyer == null) return new { role = "Buyer", generatedAt = DateTime.UtcNow, metrics = Array.Empty<object>(), risks = Array.Empty<object>(), recommendations = new[] { "Buyer profile not found." } };

        var openOrders = await _db.BuyerOrders.CountAsync(o => o.BuyerProfileId == buyer.Id && (o.Status == "Open" || o.Status == "Accepted"));
        var pendingPayments = await _db.PaymentLedgers.CountAsync(p => p.Type == "OrderPayment" && p.Status == "Pending" && p.Contract != null && p.Contract.BuyerOrder.BuyerProfileId == buyer.Id);
        var completedPayments = await _db.PaymentLedgers.CountAsync(p => p.Type == "OrderPayment" && p.Status == "Completed" && p.Contract != null && p.Contract.BuyerOrder.BuyerProfileId == buyer.Id);
        var pendingContracts = await _db.Contracts.CountAsync(c => c.BuyerOrder != null && c.BuyerOrder.BuyerProfileId == buyer.Id && (c.Status == "PendingApproval" || c.Status == "PendingSignature"));
        var deliveryAtRisk = await _db.BuyerOrders.CountAsync(o => o.BuyerProfileId == buyer.Id && o.DeliveryWindowEnd < DateTime.UtcNow && (o.Status == "Open" || o.Status == "Accepted"));
        var avgOffer = await _db.BuyerOrders.Where(o => o.BuyerProfileId == buyer.Id).AverageAsync(o => (decimal?)o.PriceOffer) ?? 0;
        var marketListings = await _db.MarketListings.CountAsync(l => l.Status == "Active");
        var totalOrders = await _db.BuyerOrders.CountAsync(o => o.BuyerProfileId == buyer.Id);
        var executionRate = totalOrders == 0 ? 0 : Math.Round(((double)completedPayments * 100.0) / totalOrders, 1);

        return new
        {
            role = "Buyer",
            generatedAt = DateTime.UtcNow,
            metrics = new object[]
            {
                new { key = "openOrders", label = "Active Orders", value = openOrders, unit = "orders" },
                new { key = "pendingPayments", label = "Pending Payments", value = pendingPayments, unit = "payments" },
                new { key = "pendingContracts", label = "Pending Contracts", value = pendingContracts, unit = "contracts" },
                new { key = "marketListings", label = "Available Listings", value = marketListings, unit = "listings" },
                new { key = "avgOfferPrice", label = "Avg Offer Price", value = Math.Round(avgOffer), unit = "RWF/kg" },
                new { key = "deliveryAtRisk", label = "Late Delivery Windows", value = deliveryAtRisk, unit = "orders" },
                new { key = "executionRate", label = "Execution Rate", value = executionRate, unit = "%" }
            },
            risks = new object[]
            {
                new { severity = pendingContracts > 0 ? "Medium" : "Low", title = "Procurement Delay", detail = pendingContracts > 0 ? "Some contracts are not fully approved/signed." : "Contract cycle is progressing normally." },
                new { severity = openOrders > 5 ? "Medium" : "Low", title = "Execution Load", detail = openOrders > 5 ? "You have a high number of simultaneous active orders." : "Order workload is manageable." },
                new { severity = deliveryAtRisk > 0 ? "High" : "Low", title = "Delivery Window Risk", detail = deliveryAtRisk > 0 ? "Some orders are past expected delivery windows." : "Delivery windows are currently under control." }
            },
            recommendations = new[]
            {
                pendingContracts > 0 ? "Complete contract review and OTP signature to unlock logistics and escrow flows." : "Use forecasts to secure quantities early when prices are favorable.",
                deliveryAtRisk > 0 ? "Escalate delayed deliveries and re-route transport for orders at risk." : "Maintain proactive transport coordination for high-value orders.",
                "Focus purchasing on high-liquidity crops with stable delivery windows.",
                "Use crop momentum and volatility signals to split procurement into short-term and strategic orders."
            },
            trendSeries = visuals.TrendSeries,
            forecastVsActual = visuals.ForecastVsActual,
            confidenceBands = visuals.ConfidenceBands,
            regionalHeatmap = visuals.RegionalHeatmap,
            demandProjection = visuals.DemandProjection,
            priceVolatility = visuals.PriceVolatility,
            cropMomentum = visuals.CropMomentum,
            supplyDemandBalance = visuals.SupplyDemandBalance,
            deliveryPerformance = visuals.DeliveryPerformance
        };
    }

    private async Task<object> BuildFarmerSummary(Guid userId)
    {
        var visuals = await BuildVisualPackAsync();
        var farmer = await _db.Farmers.FirstOrDefaultAsync(f => f.UserId == userId);
        if (farmer == null) return new { role = "Farmer", generatedAt = DateTime.UtcNow, metrics = Array.Empty<object>(), risks = Array.Empty<object>(), recommendations = new[] { "Farmer profile not found." } };

        var declarations = await _db.HarvestDeclarations.Where(h => h.FarmerId == farmer.Id).ToListAsync();
        var pendingDecl = declarations.Count(h => h.Status == "Pending");
        var approvedDecl = declarations.Count(h => h.Status == "Approved");
        var totalExpectedKg = declarations.Sum(h => h.ExpectedQuantityKg);
        var avgPrice = await _db.MarketPrices.Where(p => declarations.Select(d => d.Crop).Contains(p.Crop)).AverageAsync(p => (decimal?)p.PricePerKg) ?? 0;
        var next30DaysYield = declarations.Where(h => h.ExpectedHarvestDate <= DateTime.UtcNow.AddDays(30) && h.Status != "Rejected").Sum(h => h.ExpectedQuantityKg);
        var staleDeclarations = declarations.Count(h => h.Status == "Pending" && h.CreatedAt <= DateTime.UtcNow.AddDays(-14));
        var approvedRate = declarations.Count == 0 ? 0 : Math.Round((approvedDecl * 100.0) / declarations.Count, 1);

        return new
        {
            role = "Farmer",
            generatedAt = DateTime.UtcNow,
            metrics = new object[]
            {
                new { key = "pendingDeclarations", label = "Pending Declarations", value = pendingDecl, unit = "records" },
                new { key = "approvedDeclarations", label = "Approved Declarations", value = approvedDecl, unit = "records" },
                new { key = "expectedYield", label = "Expected Yield", value = Math.Round(totalExpectedKg), unit = "kg" },
                new { key = "avgMarketPrice", label = "Average Market Price", value = Math.Round(avgPrice), unit = "RWF/kg" },
                new { key = "next30DaysYield", label = "Yield in Next 30 Days", value = Math.Round(next30DaysYield), unit = "kg" },
                new { key = "staleDeclarations", label = "Stale Pending Declarations", value = staleDeclarations, unit = "records" },
                new { key = "approvalRate", label = "Declaration Approval Rate", value = approvedRate, unit = "%" }
            },
            risks = new object[]
            {
                new { severity = pendingDecl > 2 ? "Medium" : "Low", title = "Approval Lag", detail = pendingDecl > 2 ? "Several harvest declarations are still waiting review." : "Declaration cycle is on track." },
                new { severity = avgPrice <= 0 ? "Medium" : "Low", title = "Price Visibility", detail = avgPrice <= 0 ? "No reliable market price trend found for your crops." : "Price intelligence is available for your declared crops." },
                new { severity = staleDeclarations > 0 ? "Medium" : "Low", title = "Declaration Staleness", detail = staleDeclarations > 0 ? "Some pending declarations are stale and can block planning." : "Declaration updates are fresh." }
            },
            recommendations = new[]
            {
                pendingDecl > 0 ? "Update pending harvest declarations with precise quality indicators for faster cooperative approval." : "Maintain regular declaration updates to improve contract readiness.",
                staleDeclarations > 0 ? "Revise or follow up stale pending declarations to avoid market-entry delays." : "Keep declaration metadata updated weekly for higher confidence scoring.",
                "Prioritize crops with stronger recent price momentum before harvest window finalization.",
                "Align harvest timing with demand projection peaks to improve realized sale price."
            },
            trendSeries = visuals.TrendSeries,
            forecastVsActual = visuals.ForecastVsActual,
            confidenceBands = visuals.ConfidenceBands,
            regionalHeatmap = visuals.RegionalHeatmap,
            demandProjection = visuals.DemandProjection,
            priceVolatility = visuals.PriceVolatility,
            cropMomentum = visuals.CropMomentum,
            supplyDemandBalance = visuals.SupplyDemandBalance,
            deliveryPerformance = visuals.DeliveryPerformance
        };
    }

    private async Task<object> BuildStorageSummary()
    {
        var visuals = await BuildVisualPackAsync();
        var totalCapacity = await _db.StorageFacilities.SumAsync(f => (double?)f.CapacityKg) ?? 0;
        var availableCapacity = await _db.StorageFacilities.SumAsync(f => (double?)f.AvailableKg) ?? 0;
        var utilization = totalCapacity <= 0 ? 0 : Math.Round(((totalCapacity - availableCapacity) / totalCapacity) * 100, 1);
        var pendingBookings = await _db.StorageBookings.CountAsync(b => b.Status == "Reserved" || b.Status == "Pending");
        var expiringBookings = await _db.StorageBookings.CountAsync(b => b.EndDate <= DateTime.UtcNow.AddDays(7) && b.Status != "Completed");
        var avgBookingKg = await _db.StorageBookings.AverageAsync(b => (double?)b.QuantityKg) ?? 0;
        var completedBookings = await _db.StorageBookings.CountAsync(b => b.Status == "Completed");
        var activeBookings = await _db.StorageBookings.CountAsync(b => b.Status != "Completed");
        var bookingCompletionRate = completedBookings + activeBookings == 0 ? 0 : Math.Round((completedBookings * 100.0) / (completedBookings + activeBookings), 1);

        return new
        {
            role = "StorageOperator",
            generatedAt = DateTime.UtcNow,
            metrics = new object[]
            {
                new { key = "utilization", label = "Utilization", value = utilization, unit = "%" },
                new { key = "availableCapacity", label = "Available Capacity", value = Math.Round(availableCapacity), unit = "kg" },
                new { key = "pendingBookings", label = "Pending Bookings", value = pendingBookings, unit = "bookings" },
                new { key = "expiringBookings", label = "Expiring in 7 Days", value = expiringBookings, unit = "bookings" },
                new { key = "avgBookingKg", label = "Average Booking Size", value = Math.Round(avgBookingKg), unit = "kg" },
                new { key = "bookingCompletionRate", label = "Booking Completion Rate", value = bookingCompletionRate, unit = "%" }
            },
            risks = new object[]
            {
                new { severity = utilization > 90 ? "High" : "Low", title = "Capacity Stress", detail = utilization > 90 ? "Warehouse utilization is very high and may increase spoilage risk." : "Capacity headroom is healthy." },
                new { severity = expiringBookings > 0 ? "Medium" : "Low", title = "Expiry Queue", detail = expiringBookings > 0 ? "Some bookings are nearing end date and require action." : "No urgent booking expiries." },
                new { severity = pendingBookings > 8 ? "Medium" : "Low", title = "Booking Backlog", detail = pendingBookings > 8 ? "Large pending booking queue may reduce turnaround speed." : "Booking queue depth is manageable." }
            },
            recommendations = new[]
            {
                utilization > 90 ? "Rebalance occupancy by prioritizing outbound movement and high-turnover lots." : "Keep utilization between 70-85% for operational stability.",
                pendingBookings > 0 ? "Review pending bookings daily and fast-track approvals for contract-linked lots." : "Maintain same-day booking approvals for new inbound lots.",
                expiringBookings > 0 ? "Trigger expiry alerts and coordinate pickup windows to reduce stock aging." : "Continue proactive expiry monitoring to sustain quality.",
                "Combine utilization and demand projection trends when assigning storage capacity by crop."
            },
            trendSeries = visuals.TrendSeries,
            forecastVsActual = visuals.ForecastVsActual,
            confidenceBands = visuals.ConfidenceBands,
            regionalHeatmap = visuals.RegionalHeatmap,
            demandProjection = visuals.DemandProjection,
            priceVolatility = visuals.PriceVolatility,
            cropMomentum = visuals.CropMomentum,
            supplyDemandBalance = visuals.SupplyDemandBalance,
            deliveryPerformance = visuals.DeliveryPerformance
        };
    }

    private async Task<object> BuildTransporterSummary(Guid userId)
    {
        var visuals = await BuildVisualPackAsync();
        var transporter = await _db.TransporterProfiles.FirstOrDefaultAsync(t => t.UserId == userId);
        if (transporter == null) return new { role = "Transporter", generatedAt = DateTime.UtcNow, metrics = Array.Empty<object>(), risks = Array.Empty<object>(), recommendations = new[] { "Transporter profile not found." } };

        var activeJobs = await _db.TransportRequests.CountAsync(t => t.TransporterId == transporter.Id && (t.Status == "Accepted" || t.Status == "PickedUp" || t.Status == "InTransit"));
        var completedJobs = await _db.TransportRequests.CountAsync(t => t.TransporterId == transporter.Id && (t.Status == "Delivered" || t.Status == "Completed"));
        var delayedJobs = await _db.TransportRequests.CountAsync(t => t.TransporterId == transporter.Id && t.PickupEnd < DateTime.UtcNow && (t.Status == "Pending" || t.Status == "Accepted"));
        var openMarketJobs = await _db.TransportRequests.CountAsync(t => t.TransporterId == null && t.Status == "Pending");
        var avgLoad = await _db.TransportRequests.Where(t => t.TransporterId == transporter.Id).AverageAsync(t => (double?)t.LoadKg) ?? 0;
        var avgPrice = await _db.TransportRequests.Where(t => t.TransporterId == transporter.Id).AverageAsync(t => (decimal?)t.Price) ?? 0;
        var onTimeRate = activeJobs + delayedJobs == 0 ? 100 : Math.Round((activeJobs * 100.0) / (activeJobs + delayedJobs), 1);

        return new
        {
            role = "Transporter",
            generatedAt = DateTime.UtcNow,
            metrics = new object[]
            {
                new { key = "activeJobs", label = "Active Jobs", value = activeJobs, unit = "jobs" },
                new { key = "completedJobs", label = "Completed Jobs", value = completedJobs, unit = "jobs" },
                new { key = "delayedJobs", label = "Potential Delays", value = delayedJobs, unit = "jobs" },
                new { key = "openMarketJobs", label = "Open Market Jobs", value = openMarketJobs, unit = "jobs" },
                new { key = "avgLoadKg", label = "Average Load", value = Math.Round(avgLoad), unit = "kg" },
                new { key = "avgJobValue", label = "Average Job Value", value = Math.Round(avgPrice), unit = "RWF" },
                new { key = "onTimeRate", label = "On-Time Delivery Rate", value = onTimeRate, unit = "%" }
            },
            risks = new object[]
            {
                new { severity = delayedJobs > 0 ? "Medium" : "Low", title = "Delay Risk", detail = delayedJobs > 0 ? "Some assigned jobs are beyond pickup windows." : "No immediate pickup delay risk." },
                new { severity = activeJobs > 6 ? "Medium" : "Low", title = "Capacity Pressure", detail = activeJobs > 6 ? "Current fleet load may affect service quality." : "Current load is operationally stable." },
                new { severity = onTimeRate < 75 ? "Medium" : "Low", title = "Service Reliability", detail = onTimeRate < 75 ? "On-time delivery rate is below target." : "Service reliability is tracking well." }
            },
            recommendations = new[]
            {
                delayedJobs > 0 ? "Prioritize overdue pickups and update live tracking to avoid contract disputes." : "Maintain live tracking updates to keep buyers and cooperatives informed.",
                activeJobs > 6 ? "Pause low-margin new assignments and prioritize completion of in-transit jobs." : "Accept jobs aligned with your current route clusters to maximize delivery efficiency.",
                openMarketJobs > 0 ? "Target nearby open market jobs to improve utilization and revenue continuity." : "Maintain standby availability for high-value contract-linked jobs.",
                "Use demand and price momentum signals to pre-position capacity for high-volume routes."
            },
            trendSeries = visuals.TrendSeries,
            forecastVsActual = visuals.ForecastVsActual,
            confidenceBands = visuals.ConfidenceBands,
            regionalHeatmap = visuals.RegionalHeatmap,
            demandProjection = visuals.DemandProjection,
            priceVolatility = visuals.PriceVolatility,
            cropMomentum = visuals.CropMomentum,
            supplyDemandBalance = visuals.SupplyDemandBalance,
            deliveryPerformance = visuals.DeliveryPerformance
        };
    }

    private async Task<object> BuildMarketAgentSummary(Guid userId)
    {
        var visuals = await BuildVisualPackAsync();
        var submissions30d = await _db.MarketPrices.CountAsync(p => p.AgentId == userId && p.ObservedAt >= DateTime.UtcNow.AddDays(-30));
        var marketsCovered = await _db.MarketPrices.Where(p => p.AgentId == userId && p.ObservedAt >= DateTime.UtcNow.AddDays(-30)).Select(p => p.Market).Distinct().CountAsync();
        var cropsTracked = await _db.MarketPrices.Where(p => p.AgentId == userId && p.ObservedAt >= DateTime.UtcNow.AddDays(-30)).Select(p => p.Crop).Distinct().CountAsync();
        var reportsFiled = await _db.MarketReports.CountAsync(r => r.AgentUserId == userId && r.CreatedAt >= DateTime.UtcNow.AddDays(-30));
        var highSeverityReports = await _db.MarketReports.CountAsync(r => r.AgentUserId == userId && r.CreatedAt >= DateTime.UtcNow.AddDays(-30) && (r.Severity == "High" || r.Severity == "Critical"));
        var avgSubmittedPrice = await _db.MarketPrices.Where(p => p.AgentId == userId && p.ObservedAt >= DateTime.UtcNow.AddDays(-30)).AverageAsync(p => (decimal?)p.PricePerKg) ?? 0;

        return new
        {
            role = "MarketAgent",
            generatedAt = DateTime.UtcNow,
            metrics = new object[]
            {
                new { key = "submissions30d", label = "Price Submissions (30d)", value = submissions30d, unit = "entries" },
                new { key = "marketsCovered", label = "Markets Covered", value = marketsCovered, unit = "markets" },
                new { key = "cropsTracked", label = "Crops Tracked", value = cropsTracked, unit = "crops" },
                new { key = "reportsFiled", label = "Market Reports Filed", value = reportsFiled, unit = "reports" },
                new { key = "highSeverityReports", label = "High Severity Reports", value = highSeverityReports, unit = "reports" },
                new { key = "avgSubmittedPrice", label = "Average Submitted Price", value = Math.Round(avgSubmittedPrice), unit = "RWF/kg" }
            },
            risks = new object[]
            {
                new { severity = submissions30d < 20 ? "Medium" : "Low", title = "Data Freshness Risk", detail = submissions30d < 20 ? "Price submission volume is low for robust forecasting quality." : "Submission cadence is healthy for model refresh cycles." },
                new { severity = marketsCovered < 2 ? "Medium" : "Low", title = "Market Coverage Risk", detail = marketsCovered < 2 ? "Limited market coverage can reduce representativeness of signals." : "Market coverage supports reliable regional comparisons." },
                new { severity = highSeverityReports > 3 ? "High" : "Low", title = "Escalation Density", detail = highSeverityReports > 3 ? "High-severity market reports are elevated and need rapid policy follow-up." : "High-severity incident reporting is under control." }
            },
            recommendations = new[]
            {
                submissions30d < 20 ? "Increase daily submissions across priority crops to improve trend confidence and policy responsiveness." : "Maintain consistent submission windows to preserve time-series continuity.",
                marketsCovered < 2 ? "Expand collection routes to additional markets for stronger cross-region signal quality." : "Deepen crop-level coverage in current markets to improve signal granularity.",
                reportsFiled > 0 ? "Link major report findings to specific crops and districts for faster intervention workflows." : "Submit periodic market intelligence reports even when no anomalies are detected.",
                "Use crop momentum and volatility dashboards to proactively flag early supply shocks."
            },
            trendSeries = visuals.TrendSeries,
            forecastVsActual = visuals.ForecastVsActual,
            confidenceBands = visuals.ConfidenceBands,
            regionalHeatmap = visuals.RegionalHeatmap,
            demandProjection = visuals.DemandProjection,
            priceVolatility = visuals.PriceVolatility,
            cropMomentum = visuals.CropMomentum,
            supplyDemandBalance = visuals.SupplyDemandBalance,
            deliveryPerformance = visuals.DeliveryPerformance
        };
    }

    private async Task<object> BuildNationalSummary(string roleLabel)
    {
        var visuals = await BuildVisualPackAsync();
        var openAlerts = await _db.PlatformAlerts.CountAsync(a => a.Status == "Open");
        var criticalAlerts = await _db.PlatformAlerts.CountAsync(a => a.Status == "Open" && a.Severity == "Critical");
        var activeContracts = await _db.Contracts.CountAsync(c => c.Status == "Active" || c.Status == "InDelivery");
        var pendingContracts = await _db.Contracts.CountAsync(c => c.Status == "PendingApproval" || c.Status == "PendingSignature");
        var activeUsers = await _db.Users.CountAsync(u => u.IsActive);
        var openDataIssues = await _db.DataQualityIssues.CountAsync(d => d.Status == "Open");
        var modelHealth = await _db.ModelPerformanceLogs
            .Where(m => m.RecordedAt >= DateTime.UtcNow.AddDays(-30))
            .AverageAsync(m => (double?)m.AccuracyRate) ?? 0;
        var avgContractValue = await _db.Contracts
            .Where(c => c.CreatedAt >= DateTime.UtcNow.AddDays(-30))
            .AverageAsync(c => (decimal?)c.TotalValue) ?? 0;

        return new
        {
            role = roleLabel,
            generatedAt = DateTime.UtcNow,
            metrics = new object[]
            {
                new { key = "activeUsers", label = "Active Users", value = activeUsers, unit = "users" },
                new { key = "openAlerts", label = "Open Alerts", value = openAlerts, unit = "alerts" },
                new { key = "criticalAlerts", label = "Critical Alerts", value = criticalAlerts, unit = "alerts" },
                new { key = "pendingContracts", label = "Pending Contracts", value = pendingContracts, unit = "contracts" },
                new { key = "openDataIssues", label = "Open Data Quality Issues", value = openDataIssues, unit = "issues" },
                new { key = "modelAccuracy", label = "Model Accuracy (30d)", value = Math.Round(modelHealth, 1), unit = "%" },
                new { key = "avgContractValue", label = "Avg Contract Value (30d)", value = Math.Round(avgContractValue), unit = "RWF" }
            },
            risks = new object[]
            {
                new { severity = criticalAlerts > 0 ? "High" : "Low", title = "Platform Risk Surface", detail = criticalAlerts > 0 ? "Critical alerts require urgent intervention." : "No critical platform alerts currently open." },
                new { severity = pendingContracts > 20 ? "Medium" : "Low", title = "Workflow Congestion", detail = pendingContracts > 20 ? "High contract queue may delay deliveries and payments." : "Contract workflow throughput is stable." },
                new { severity = openDataIssues > 10 ? "Medium" : "Low", title = "Data Quality Pressure", detail = openDataIssues > 10 ? "Open data quality issues may reduce AI reliability." : "Data quality trend is within control limits." }
            },
            recommendations = new[]
            {
                criticalAlerts > 0 ? "Prioritize alert triage and assign resolution owners immediately." : "Continue periodic anomaly scans and proactive quality checks.",
                activeContracts > 0 ? "Monitor contract-to-delivery conversion and escrow release latency." : "Stimulate market activity via cooperative and buyer engagement campaigns.",
                openDataIssues > 0 ? "Clear high-impact data quality issues first to stabilize model outputs." : "Maintain automated quality scans and spot audits across submitted records.",
                "Use cross-role performance cards to coordinate operations between market intelligence, logistics, and storage."
            },
            trendSeries = visuals.TrendSeries,
            forecastVsActual = visuals.ForecastVsActual,
            confidenceBands = visuals.ConfidenceBands,
            regionalHeatmap = visuals.RegionalHeatmap,
            demandProjection = visuals.DemandProjection,
            priceVolatility = visuals.PriceVolatility,
            cropMomentum = visuals.CropMomentum,
            supplyDemandBalance = visuals.SupplyDemandBalance,
            deliveryPerformance = visuals.DeliveryPerformance
        };
    }

    private Guid? GetUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier);
        return Guid.TryParse(claim?.Value, out var id) ? id : null;
    }

    private async Task<VisualPack> BuildVisualPackAsync()
    {
        var from = DateTime.UtcNow.Date.AddDays(-14);
        var prices = await _db.MarketPrices
            .Where(p => p.ObservedAt >= from)
            .OrderBy(p => p.ObservedAt)
            .ToListAsync();

        var trendSeries = prices
            .GroupBy(p => p.ObservedAt.Date)
            .OrderBy(g => g.Key)
            .Select(g => new
            {
                date = g.Key.ToString("MM-dd"),
                actual = Math.Round(g.Average(x => x.PricePerKg), 2)
            })
            .ToList();

        if (trendSeries.Count == 0)
        {
            trendSeries = await _db.MarketListings
                .Where(l => l.CreatedAt >= from)
                .GroupBy(l => l.CreatedAt.Date)
                .OrderBy(g => g.Key)
                .Select(g => new
                {
                    date = g.Key.ToString("MM-dd"),
                    actual = Math.Round(g.Average(x => x.MinimumPrice), 2)
                })
                .ToListAsync();
        }

        var forecastVsActual = trendSeries
            .Select((t, i) => new
            {
                date = t.date,
                actual = t.actual,
                predicted = Math.Round(t.actual * (1m + ((decimal)Math.Sin(i) * 0.03m)), 2)
            })
            .Cast<object>()
            .ToArray();

        var confidenceBands = trendSeries
            .Select(t => new
            {
                date = t.date,
                lower = Math.Round(t.actual * 0.94m, 2),
                upper = Math.Round(t.actual * 1.08m, 2)
            })
            .Cast<object>()
            .ToArray();

        var regionalHeatmapRows = await _db.MarketPrices
            .Where(p => p.ObservedAt >= DateTime.UtcNow.AddDays(-30))
            .GroupBy(p => p.Market)
            .Select(g => new
            {
                region = g.Key,
                intensity = Math.Round(g.Average(x => x.PricePerKg), 2),
                volume = g.Count()
            })
            .OrderByDescending(x => x.volume)
            .Take(10)
            .ToArrayAsync();

        if (regionalHeatmapRows.Length == 0)
        {
            regionalHeatmapRows = await _db.MarketListings
                .Where(l => l.CreatedAt >= DateTime.UtcNow.AddDays(-30))
                .GroupBy(l => l.Cooperative.Region)
                .Select(g => new
                {
                    region = g.Key,
                    intensity = Math.Round(g.Average(x => x.MinimumPrice), 2),
                    volume = g.Count()
                })
                .OrderByDescending(x => x.volume)
                .Take(10)
                .ToArrayAsync();
        }

        var demandProjectionRows = (await _db.BuyerOrders
            .Where(o => o.CreatedAt >= DateTime.UtcNow.AddDays(-30))
            .GroupBy(o => o.Crop)
            .Select(g => new
            {
                crop = g.Key,
                demandKg = g.Sum(x => x.QuantityKg),
                orders = g.Count()
            })
            .OrderByDescending(x => x.demandKg)
            .Take(10)
            .ToArrayAsync())
            .Select(x => new
            {
                x.crop,
                demandKg = Math.Round(x.demandKg, 2),
                x.orders
            })
            .Cast<object>()
            .ToArray();

        if (demandProjectionRows.Length == 0)
        {
            demandProjectionRows = (await _db.MarketListings
                .Where(l => l.CreatedAt >= DateTime.UtcNow.AddDays(-30))
                .GroupBy(l => l.Crop)
                .Select(g => new
                {
                    crop = g.Key,
                    demandKg = g.Sum(x => x.QuantityKg),
                    orders = g.Count()
                })
                .OrderByDescending(x => x.demandKg)
                .Take(10)
                .ToArrayAsync())
                .Select(x => new
                {
                    x.crop,
                    demandKg = Math.Round(x.demandKg, 2),
                    x.orders
                })
                .Cast<object>()
                .ToArray();
        }

        var priceVolatilityRows = await _db.MarketPrices
            .Where(p => p.ObservedAt >= DateTime.UtcNow.AddDays(-30))
            .GroupBy(p => p.Crop)
            .Select(g => new
            {
                crop = g.Key,
                minPrice = g.Min(x => x.PricePerKg),
                maxPrice = g.Max(x => x.PricePerKg),
                avgPrice = g.Average(x => x.PricePerKg),
                spread = Math.Round(g.Max(x => x.PricePerKg) - g.Min(x => x.PricePerKg), 2)
            })
            .OrderByDescending(x => x.spread)
            .Take(8)
            .ToArrayAsync();

        var cropMomentumRows = await _db.MarketPrices
            .Where(p => p.ObservedAt >= DateTime.UtcNow.AddDays(-45))
            .GroupBy(p => p.Crop)
            .Select(g => new
            {
                crop = g.Key,
                previous = g.Where(x => x.ObservedAt < DateTime.UtcNow.AddDays(-7)).Average(x => (decimal?)x.PricePerKg),
                current = g.Where(x => x.ObservedAt >= DateTime.UtcNow.AddDays(-7)).Average(x => (decimal?)x.PricePerKg)
            })
            .Select(x => new
            {
                x.crop,
                previous = x.previous ?? 0,
                current = x.current ?? 0,
                deltaPct = x.previous == null || x.previous == 0 ? 0 : Math.Round((((x.current ?? 0) - x.previous.Value) / x.previous.Value) * 100, 2)
            })
            .OrderByDescending(x => x.deltaPct)
            .Take(8)
            .ToArrayAsync();

        var listingSupply = await _db.MarketListings
            .Where(l => l.CreatedAt >= DateTime.UtcNow.AddDays(-30))
            .GroupBy(l => l.Crop)
            .Select(g => new { crop = g.Key, supplyKg = g.Sum(x => x.QuantityKg) })
            .ToArrayAsync();
        var orderDemand = await _db.BuyerOrders
            .Where(o => o.CreatedAt >= DateTime.UtcNow.AddDays(-30))
            .GroupBy(o => o.Crop)
            .Select(g => new { crop = g.Key, demandKg = g.Sum(x => x.QuantityKg) })
            .ToArrayAsync();
        var demandMap = orderDemand.ToDictionary(x => x.crop, x => x.demandKg, StringComparer.OrdinalIgnoreCase);
        var supplyDemandBalanceRows = listingSupply
            .Select(x =>
            {
                var demand = demandMap.TryGetValue(x.crop, out var v) ? v : 0;
                return new
                {
                    crop = x.crop,
                    supplyKg = Math.Round(x.supplyKg, 2),
                    demandKg = Math.Round(demand, 2),
                    balanceKg = Math.Round(x.supplyKg - demand, 2)
                };
            })
            .OrderByDescending(x => Math.Abs(x.balanceKg))
            .Take(8)
            .Cast<object>()
            .ToArray();

        var deliveryPerformanceRows = await _db.TransportRequests
            .Where(t => t.CreatedAt >= DateTime.UtcNow.AddDays(-30))
            .GroupBy(t => t.Status)
            .Select(g => new
            {
                status = g.Key,
                jobs = g.Count(),
                avgLoadKg = Math.Round(g.Average(x => x.LoadKg), 2),
                avgPrice = Math.Round(g.Average(x => x.Price), 2)
            })
            .OrderByDescending(x => x.jobs)
            .Take(8)
            .ToArrayAsync();

        return new VisualPack
        {
            TrendSeries = trendSeries.Cast<object>().ToArray(),
            ForecastVsActual = forecastVsActual,
            ConfidenceBands = confidenceBands,
            RegionalHeatmap = regionalHeatmapRows.Cast<object>().ToArray(),
            DemandProjection = demandProjectionRows,
            PriceVolatility = priceVolatilityRows.Cast<object>().ToArray(),
            CropMomentum = cropMomentumRows.Cast<object>().ToArray(),
            SupplyDemandBalance = supplyDemandBalanceRows,
            DeliveryPerformance = deliveryPerformanceRows.Cast<object>().ToArray()
        };
    }

    private sealed class VisualPack
    {
        public object[] TrendSeries { get; set; } = Array.Empty<object>();
        public object[] ForecastVsActual { get; set; } = Array.Empty<object>();
        public object[] ConfidenceBands { get; set; } = Array.Empty<object>();
        public object[] RegionalHeatmap { get; set; } = Array.Empty<object>();
        public object[] DemandProjection { get; set; } = Array.Empty<object>();
        public object[] PriceVolatility { get; set; } = Array.Empty<object>();
        public object[] CropMomentum { get; set; } = Array.Empty<object>();
        public object[] SupplyDemandBalance { get; set; } = Array.Empty<object>();
        public object[] DeliveryPerformance { get; set; } = Array.Empty<object>();
    }
}

public record RoleAssistantRequest(string Question);
