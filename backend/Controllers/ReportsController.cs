using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Rass.Api.Data;
using System.Security.Claims;
using System.Text;

namespace Rass.Api.Controllers;

/// <summary>
/// Universal CSV/Excel export for all authenticated roles.
/// Each role gets access to report types relevant to their function.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ReportsController : ControllerBase
{
    private readonly AppDbContext _db;

    public ReportsController(AppDbContext db) => _db = db;

    /// <summary>
    /// Returns the list of report types available for the caller's role.
    /// </summary>
    [HttpGet("available")]
    public IActionResult GetAvailableReports()
    {
        var reports = new List<object>();

        if (HasRole("Admin") || HasRole("Government"))
        {
            reports.AddRange(new object[]
            {
                new { type = "comprehensive", label = "Comprehensive National Report" },
                new { type = "farmers", label = "Farmers Registry" },
                new { type = "cooperatives", label = "Cooperatives Performance" },
                new { type = "regulations", label = "Regulation Compliance" },
                new { type = "supply-demand", label = "Supply & Demand Balance" },
                new { type = "transporters", label = "Transporters Fleet" },
            });
        }

        if (HasRole("Admin") || HasRole("Government") || HasRole("CooperativeManager"))
        {
            reports.AddRange(new object[]
            {
                new { type = "listings", label = "Market Listings" },
                new { type = "harvests", label = "Harvest Declarations" },
                new { type = "inventory", label = "Inventory (Lots)" },
                new { type = "transport-jobs", label = "Transport Jobs" },
            });
        }

        if (HasRole("Admin") || HasRole("Government") || HasRole("Buyer") || HasRole("CooperativeManager"))
        {
            reports.AddRange(new object[]
            {
                new { type = "contracts", label = "Contracts" },
                new { type = "orders", label = "Buyer Orders" },
                new { type = "payments", label = "Payments & Transactions" },
            });
        }

        if (HasRole("Admin") || HasRole("Government") || HasRole("MarketAgent"))
        {
            reports.Add(new { type = "prices", label = "Price Trend Analysis" });
        }

        if (HasRole("Admin") || HasRole("Government") || HasRole("StorageOperator"))
        {
            reports.Add(new { type = "storage", label = "Storage & Capacity" });
        }

        if (HasRole("Farmer"))
        {
            reports.AddRange(new object[]
            {
                new { type = "my-harvests", label = "My Harvest Declarations" },
                new { type = "my-contributions", label = "My Lot Contributions" },
                new { type = "my-payments", label = "My Payments" },
            });
        }

        if (HasRole("Buyer"))
        {
            reports.AddRange(new object[]
            {
                new { type = "my-orders", label = "My Orders" },
                new { type = "my-contracts", label = "My Contracts" },
            });
        }

        if (HasRole("Transporter"))
        {
            reports.AddRange(new object[]
            {
                new { type = "my-jobs", label = "My Transport Jobs" },
                new { type = "my-deliveries", label = "My Completed Deliveries" },
            });
        }

        // Everyone can export prices
        if (!reports.Any(r => ((dynamic)r).type == "prices"))
            reports.Add(new { type = "prices", label = "Market Prices" });

        return Ok(reports);
    }

    /// <summary>
    /// Universal CSV export endpoint. Role-based access enforced per report type.
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
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var start = startDate ?? DateTime.UtcNow.AddMonths(-6);
        var end = endDate ?? DateTime.UtcNow;
        string csv;
        string fileName;

        switch (reportType.ToLower())
        {
            // ── Market prices (all roles) ──
            case "prices":
            case "price-trend":
            {
                var query = _db.MarketPrices.Where(p => p.ObservedAt >= start && p.ObservedAt <= end);
                if (!string.IsNullOrWhiteSpace(crop)) query = query.Where(p => p.Crop == crop);
                if (!string.IsNullOrWhiteSpace(region)) query = query.Where(p => p.Region == region);
                if (!string.IsNullOrWhiteSpace(district)) query = query.Where(p => p.District == district);
                var data = await query.OrderBy(p => p.ObservedAt).ToListAsync();
                csv = "Date,Crop,Market,Region,District,PricePerKg,VerificationStatus\n" +
                      string.Join("\n", data.Select(p => $"{p.ObservedAt:yyyy-MM-dd},{Esc(p.Crop)},{Esc(p.Market)},{Esc(p.Region)},{Esc(p.District)},{p.PricePerKg},{p.VerificationStatus}"));
                fileName = $"RASS_prices_{start:yyyyMMdd}_{end:yyyyMMdd}.csv";
                break;
            }

            // ── Listings (CooperativeManager, Admin, Government) ──
            case "listings":
            case "market-listings":
            {
                if (!HasAnyRole("CooperativeManager", "Admin", "Government")) return Forbid();
                var query = _db.MarketListings.Include(l => l.Cooperative).Where(l => l.CreatedAt >= start && l.CreatedAt <= end);
                if (HasRole("CooperativeManager"))
                {
                    var coopId = await GetCooperativeId(userId);
                    if (coopId != null) query = query.Where(l => l.CooperativeId == coopId);
                }
                if (!string.IsNullOrWhiteSpace(crop)) query = query.Where(l => l.Crop == crop);
                if (!string.IsNullOrWhiteSpace(status)) query = query.Where(l => l.Status == status);
                var data = await query.OrderByDescending(l => l.CreatedAt).ToListAsync();
                csv = "Crop,QuantityKg,MinimumPrice,QualityGrade,Status,Cooperative,Region,CreatedAt\n" +
                      string.Join("\n", data.Select(l => $"{Esc(l.Crop)},{l.QuantityKg},{l.MinimumPrice},{Esc(l.QualityGrade)},{l.Status},{Esc(l.Cooperative?.Name)},{Esc(l.Cooperative?.Region)},{l.CreatedAt:yyyy-MM-dd}"));
                fileName = $"RASS_listings_{start:yyyyMMdd}_{end:yyyyMMdd}.csv";
                break;
            }

            // ── Harvest declarations (CooperativeManager, Admin, Government) ──
            case "harvests":
            case "harvest-declarations":
            {
                if (!HasAnyRole("CooperativeManager", "Admin", "Government")) return Forbid();
                var query = _db.HarvestDeclarations.Include(h => h.Farmer).ThenInclude(f => f.User).Where(h => h.CreatedAt >= start && h.CreatedAt <= end);
                if (HasRole("CooperativeManager"))
                {
                    var coopId = await GetCooperativeId(userId);
                    if (coopId != null) query = query.Where(h => h.Farmer.CooperativeId == coopId);
                }
                if (!string.IsNullOrWhiteSpace(crop)) query = query.Where(h => h.Crop == crop);
                var data = await query.OrderByDescending(h => h.CreatedAt).ToListAsync();
                csv = "Farmer,Crop,ExpectedQuantityKg,ExpectedHarvestDate,QualityIndicators,Status,CreatedAt\n" +
                      string.Join("\n", data.Select(h => $"{Esc(h.Farmer?.User?.FullName)},{Esc(h.Crop)},{h.ExpectedQuantityKg},{h.ExpectedHarvestDate:yyyy-MM-dd},{Esc(h.QualityIndicators)},{h.Status},{h.CreatedAt:yyyy-MM-dd}"));
                fileName = $"RASS_harvests_{start:yyyyMMdd}_{end:yyyyMMdd}.csv";
                break;
            }

            // ── Inventory/lots (CooperativeManager, Admin, Government) ──
            case "inventory":
            case "lots":
            {
                if (!HasAnyRole("CooperativeManager", "StorageOperator", "Admin", "Government")) return Forbid();
                var query = _db.Lots.Include(l => l.Cooperative).AsQueryable();
                if (HasRole("CooperativeManager"))
                {
                    var coopId = await GetCooperativeId(userId);
                    if (coopId != null) query = query.Where(l => l.CooperativeId == coopId);
                }
                if (!string.IsNullOrWhiteSpace(crop)) query = query.Where(l => l.Crop == crop);
                if (!string.IsNullOrWhiteSpace(region)) query = query.Where(l => l.Cooperative.Region == region);
                var data = await query.OrderByDescending(l => l.CreatedAt).ToListAsync();
                csv = "Crop,QuantityKg,QualityGrade,Status,Verified,Cooperative,Region,ExpectedPricePerKg,CreatedAt\n" +
                      string.Join("\n", data.Select(l => $"{Esc(l.Crop)},{l.QuantityKg},{Esc(l.QualityGrade)},{l.Status},{l.Verified},{Esc(l.Cooperative?.Name)},{Esc(l.Cooperative?.Region)},{l.ExpectedPricePerKg},{l.CreatedAt:yyyy-MM-dd}"));
                fileName = $"RASS_inventory_{DateTime.UtcNow:yyyyMMdd}.csv";
                break;
            }

            // ── Contracts (Buyer, CooperativeManager, Admin, Government) ──
            case "contracts":
            {
                if (!HasAnyRole("Buyer", "CooperativeManager", "Admin", "Government")) return Forbid();
                var query = _db.Contracts
                    .Include(c => c.BuyerOrder).ThenInclude(o => o.BuyerProfile).ThenInclude(b => b.User)
                    .Include(c => c.BuyerOrder).ThenInclude(o => o.MarketListing).ThenInclude(l => l.Cooperative)
                    .Where(c => c.CreatedAt >= start && c.CreatedAt <= end);
                if (HasRole("Buyer") && !HasAnyRole("Admin", "Government"))
                    query = query.Where(c => c.BuyerOrder.BuyerProfile.UserId == Guid.Parse(userId!));
                if (HasRole("CooperativeManager") && !HasAnyRole("Admin", "Government"))
                {
                    var coopId = await GetCooperativeId(userId);
                    if (coopId != null) query = query.Where(c => c.BuyerOrder.MarketListing.CooperativeId == coopId);
                }
                var data = await query.OrderByDescending(c => c.CreatedAt).ToListAsync();
                csv = "TrackingId,Crop,TotalQuantityKg,AgreedPrice,TotalValue,Status,Buyer,Cooperative,CreatedAt\n" +
                      string.Join("\n", data.Select(c => $"{Esc(c.TrackingId)},{Esc(c.BuyerOrder?.Crop)},{c.TotalQuantityKg},{c.AgreedPrice},{c.TotalValue},{c.Status},{Esc(c.BuyerOrder?.BuyerProfile?.User?.FullName)},{Esc(c.BuyerOrder?.MarketListing?.Cooperative?.Name)},{c.CreatedAt:yyyy-MM-dd}"));
                fileName = $"RASS_contracts_{start:yyyyMMdd}_{end:yyyyMMdd}.csv";
                break;
            }

            // ── Orders (Buyer, CooperativeManager, Admin, Government) ──
            case "orders":
            case "my-orders":
            {
                if (!HasAnyRole("Buyer", "CooperativeManager", "Admin", "Government")) return Forbid();
                var query = _db.BuyerOrders.Include(o => o.BuyerProfile).ThenInclude(b => b.User)
                    .Include(o => o.MarketListing).ThenInclude(l => l.Cooperative)
                    .Where(o => o.CreatedAt >= start && o.CreatedAt <= end);
                if (HasRole("Buyer") && !HasAnyRole("Admin", "Government"))
                    query = query.Where(o => o.BuyerProfile.UserId == Guid.Parse(userId!));
                if (HasRole("CooperativeManager") && !HasAnyRole("Admin", "Government"))
                {
                    var coopId = await GetCooperativeId(userId);
                    if (coopId != null) query = query.Where(o => o.MarketListing != null && o.MarketListing.CooperativeId == coopId);
                }
                if (!string.IsNullOrWhiteSpace(crop)) query = query.Where(o => o.Crop == crop);
                if (!string.IsNullOrWhiteSpace(status)) query = query.Where(o => o.Status == status);
                var data = await query.OrderByDescending(o => o.CreatedAt).ToListAsync();
                csv = "Crop,QuantityKg,PriceOffer,TotalPrice,Status,DeliveryLocation,Buyer,Cooperative,CreatedAt\n" +
                      string.Join("\n", data.Select(o => $"{Esc(o.Crop)},{o.QuantityKg},{o.PriceOffer},{o.PriceOffer * (decimal)o.QuantityKg},{o.Status},{Esc(o.DeliveryLocation)},{Esc(o.BuyerProfile?.User?.FullName)},{Esc(o.MarketListing?.Cooperative?.Name)},{o.CreatedAt:yyyy-MM-dd}"));
                fileName = $"RASS_orders_{start:yyyyMMdd}_{end:yyyyMMdd}.csv";
                break;
            }

            // ── Payments (Buyer, CooperativeManager, Admin, Government) ──
            case "payments":
            case "transactions":
            case "my-payments":
            {
                if (!HasAnyRole("Buyer", "CooperativeManager", "Farmer", "Admin", "Government")) return Forbid();
                var query = _db.PaymentLedgers.Include(p => p.Contract).ThenInclude(c => c.BuyerOrder).ThenInclude(o => o.BuyerProfile)
                    .Where(p => p.CreatedAt >= start && p.CreatedAt <= end);
                if (HasRole("Buyer") && !HasAnyRole("Admin", "Government"))
                    query = query.Where(p => p.Contract != null && p.Contract.BuyerOrder != null && p.Contract.BuyerOrder.BuyerProfile.UserId == Guid.Parse(userId!));
                var data = await query.OrderByDescending(p => p.CreatedAt).ToListAsync();
                csv = "Reference,Amount,Status,Type,ContractTrackingId,CreatedAt\n" +
                      string.Join("\n", data.Select(p => $"{Esc(p.Reference)},{p.Amount},{p.Status},{p.Type},{Esc(p.Contract?.TrackingId)},{p.CreatedAt:yyyy-MM-dd}"));
                fileName = $"RASS_payments_{start:yyyyMMdd}_{end:yyyyMMdd}.csv";
                break;
            }

            // ── Transport jobs (CooperativeManager, Transporter, Admin, Government) ──
            case "transport-jobs":
            case "my-jobs":
            {
                if (!HasAnyRole("CooperativeManager", "Transporter", "Admin", "Government")) return Forbid();
                var query = _db.TransportJobs.Include(j => j.Cooperative).Include(j => j.AssignedTransporter)
                    .Where(j => j.CreatedAt >= start && j.CreatedAt <= end);
                if (HasRole("CooperativeManager") && !HasAnyRole("Admin", "Government"))
                {
                    var coopId = await GetCooperativeId(userId);
                    if (coopId != null) query = query.Where(j => j.CooperativeId == coopId);
                }
                if (HasRole("Transporter") && !HasAnyRole("Admin", "Government"))
                    query = query.Where(j => j.AssignedTransporterId == Guid.Parse(userId!));
                var data = await query.OrderByDescending(j => j.CreatedAt).ToListAsync();
                csv = "Title,Crop,QuantityKg,PickupLocation,DeliveryLocation,DistanceKm,Status,PaymentRange,Cooperative,AssignedTransporter,PickupDate,DeliveryDeadline,CreatedAt\n" +
                      string.Join("\n", data.Select(j => $"{Esc(j.Title)},{Esc(j.Crop)},{j.QuantityKg},{Esc(j.PickupLocation)},{Esc(j.DeliveryLocation)},{j.DistanceKm},{j.Status},{j.MinPaymentRwf}-{j.MaxPaymentRwf},{Esc(j.Cooperative?.Name)},{Esc(j.AssignedTransporter?.FullName)},{j.PickupDate:yyyy-MM-dd},{j.DeliveryDeadline:yyyy-MM-dd},{j.CreatedAt:yyyy-MM-dd}"));
                fileName = $"RASS_transport_jobs_{start:yyyyMMdd}_{end:yyyyMMdd}.csv";
                break;
            }

            // ── My deliveries (Transporter) ──
            case "my-deliveries":
            {
                if (!HasAnyRole("Transporter", "Admin", "Government")) return Forbid();
                var query = _db.TransportRequests.Include(t => t.Contract).Where(t => t.PickupStart >= start && t.PickupStart <= end);
                if (HasRole("Transporter") && !HasAnyRole("Admin", "Government"))
                    query = query.Where(t => t.TransporterId == Guid.Parse(userId!));
                if (!string.IsNullOrWhiteSpace(status)) query = query.Where(t => t.Status == status);
                var data = await query.OrderByDescending(t => t.PickupStart).ToListAsync();
                csv = "Origin,Destination,LoadKg,Status,PickupStart,PickupEnd,ContractTracking\n" +
                      string.Join("\n", data.Select(t => $"{Esc(t.Origin)},{Esc(t.Destination)},{t.LoadKg},{t.Status},{t.PickupStart:yyyy-MM-dd},{t.PickupEnd:yyyy-MM-dd},{Esc(t.Contract?.TrackingId)}"));
                fileName = $"RASS_deliveries_{start:yyyyMMdd}_{end:yyyyMMdd}.csv";
                break;
            }

            // ── My harvests (Farmer) ──
            case "my-harvests":
            {
                if (!HasAnyRole("Farmer", "Admin", "Government")) return Forbid();
                var farmer = await _db.Farmers.FirstOrDefaultAsync(f => f.UserId == Guid.Parse(userId!));
                var query = _db.HarvestDeclarations.Where(h => h.CreatedAt >= start && h.CreatedAt <= end);
                if (farmer != null && !HasAnyRole("Admin", "Government"))
                    query = query.Where(h => h.FarmerId == farmer.Id);
                if (!string.IsNullOrWhiteSpace(crop)) query = query.Where(h => h.Crop == crop);
                var data = await query.OrderByDescending(h => h.CreatedAt).ToListAsync();
                csv = "Crop,ExpectedQuantityKg,ExpectedHarvestDate,QualityIndicators,Status,ConditionGrade,CreatedAt\n" +
                      string.Join("\n", data.Select(h => $"{Esc(h.Crop)},{h.ExpectedQuantityKg},{h.ExpectedHarvestDate:yyyy-MM-dd},{Esc(h.QualityIndicators)},{h.Status},{Esc(h.ConditionGrade)},{h.CreatedAt:yyyy-MM-dd}"));
                fileName = $"RASS_my_harvests_{start:yyyyMMdd}_{end:yyyyMMdd}.csv";
                break;
            }

            // ── My contributions (Farmer) ──
            case "my-contributions":
            {
                if (!HasAnyRole("Farmer", "Admin", "Government")) return Forbid();
                var farmer = await _db.Farmers.FirstOrDefaultAsync(f => f.UserId == Guid.Parse(userId!));
                var query = _db.LotContributions.Include(lc => lc.Lot).ThenInclude(l => l.Cooperative).AsQueryable();
                if (farmer != null && !HasAnyRole("Admin", "Government"))
                    query = query.Where(lc => lc.FarmerId == farmer.Id);
                var data = await query.OrderByDescending(lc => lc.ContributedAt).ToListAsync();
                csv = "Crop,QuantityKg,LotQualityGrade,LotStatus,Cooperative,ContributedAt\n" +
                      string.Join("\n", data.Select(lc => $"{Esc(lc.Lot?.Crop)},{lc.QuantityKg},{Esc(lc.Lot?.QualityGrade)},{lc.Lot?.Status},{Esc(lc.Lot?.Cooperative?.Name)},{lc.ContributedAt:yyyy-MM-dd}"));
                fileName = $"RASS_my_contributions_{DateTime.UtcNow:yyyyMMdd}.csv";
                break;
            }

            // ── My contracts (Buyer) ──
            case "my-contracts":
            {
                if (!HasAnyRole("Buyer", "Admin", "Government")) return Forbid();
                var query = _db.Contracts
                    .Include(c => c.BuyerOrder).ThenInclude(o => o.BuyerProfile).ThenInclude(b => b.User)
                    .Include(c => c.BuyerOrder).ThenInclude(o => o.MarketListing).ThenInclude(l => l.Cooperative)
                    .Where(c => c.CreatedAt >= start && c.CreatedAt <= end);
                if (HasRole("Buyer") && !HasAnyRole("Admin", "Government"))
                    query = query.Where(c => c.BuyerOrder.BuyerProfile.UserId == Guid.Parse(userId!));
                var data = await query.OrderByDescending(c => c.CreatedAt).ToListAsync();
                csv = "TrackingId,Crop,QuantityKg,AgreedPrice,TotalValue,Status,Cooperative,CreatedAt\n" +
                      string.Join("\n", data.Select(c => $"{Esc(c.TrackingId)},{Esc(c.BuyerOrder?.Crop)},{c.TotalQuantityKg},{c.AgreedPrice},{c.TotalValue},{c.Status},{Esc(c.BuyerOrder?.MarketListing?.Cooperative?.Name)},{c.CreatedAt:yyyy-MM-dd}"));
                fileName = $"RASS_my_contracts_{start:yyyyMMdd}_{end:yyyyMMdd}.csv";
                break;
            }

            // ── Storage (StorageOperator, Admin, Government) ──
            case "storage":
            {
                if (!HasAnyRole("StorageOperator", "Admin", "Government")) return Forbid();
                var facilities = await _db.StorageFacilities.ToListAsync();
                var bookings = await _db.StorageBookings.Include(b => b.StorageFacility).Where(b => b.StartDate >= start && b.StartDate <= end).ToListAsync();
                var sb = new StringBuilder();
                sb.AppendLine("=== STORAGE FACILITIES ===");
                sb.AppendLine("Name,Location,CapacityKg,AvailableKg,Utilization%,Features");
                foreach (var f in facilities)
                {
                    var pct = f.CapacityKg > 0 ? Math.Round((double)(f.CapacityKg - f.AvailableKg) / f.CapacityKg * 100, 1) : 0;
                    sb.AppendLine($"{Esc(f.Name)},{Esc(f.Location)},{f.CapacityKg},{f.AvailableKg},{pct},{Esc(f.Features)}");
                }
                sb.AppendLine();
                sb.AppendLine("=== STORAGE BOOKINGS ===");
                sb.AppendLine("Facility,QuantityKg,Status,StartDate,EndDate");
                foreach (var b in bookings)
                    sb.AppendLine($"{Esc(b.StorageFacility?.Name)},{b.QuantityKg},{b.Status},{b.StartDate:yyyy-MM-dd},{b.EndDate:yyyy-MM-dd}");
                csv = sb.ToString();
                fileName = $"RASS_storage_{start:yyyyMMdd}_{end:yyyyMMdd}.csv";
                break;
            }

            default:
                return BadRequest(new { message = $"Unsupported report type '{reportType}'." });
        }

        var bom = new byte[] { 0xEF, 0xBB, 0xBF };
        var csvBytes = Encoding.UTF8.GetBytes(csv);
        var result = new byte[bom.Length + csvBytes.Length];
        bom.CopyTo(result, 0);
        csvBytes.CopyTo(result, bom.Length);

        return File(result, "text/csv; charset=utf-8", fileName);
    }

    private bool HasRole(string role) => User.IsInRole(role);
    private bool HasAnyRole(params string[] roles) => roles.Any(r => User.IsInRole(r));
    private static string Esc(string? v) => v == null ? "" : v.Contains(',') || v.Contains('"') || v.Contains('\n') ? $"\"{v.Replace("\"", "\"\"")}\"" : v;

    private async Task<Guid?> GetCooperativeId(string? userId)
    {
        if (userId == null) return null;
        var uid = Guid.Parse(userId);
        var coop = await _db.Cooperatives.FirstOrDefaultAsync(c => c.ManagerId == uid);
        return coop?.Id;
    }
}
