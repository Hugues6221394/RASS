using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Rass.Api.Data;
using Rass.Api.Domain.Entities;
using Rass.Api.Dtos;

namespace Rass.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CooperativeController : ControllerBase
{
    private readonly AppDbContext _db;

    public CooperativeController(AppDbContext db)
    {
        _db = db;
    }

    [HttpPost("register")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> RegisterCooperative(CreateCooperativeRequest request)
    {
        if (await _db.Cooperatives.AnyAsync(c => c.Name == request.Name))
        {
            return Conflict("Cooperative with this name already exists.");
        }

        var cooperative = new Cooperative
        {
            Id = Guid.NewGuid(),
            Name = request.Name,
            Region = request.Region,
            District = request.District,
            Location = request.Location,
            Phone = request.Phone,
            Email = request.Email,
            IsVerified = false,
            IsActive = true
        };

        _db.Cooperatives.Add(cooperative);
        await _db.SaveChangesAsync();

        return Created("", new { cooperative.Id, cooperative.Name });
    }

    [HttpGet]
    [Authorize]
    public async Task<IActionResult> GetCooperatives()
    {
        var cooperatives = await _db.Cooperatives
            .Select(c => new
            {
                c.Id,
                c.Name,
                c.Region,
                c.District,
                c.Location,
                c.Phone,
                c.Email,
                c.IsVerified,
                c.IsActive,
                FarmerCount = c.Farmers.Count,
                LotCount = c.Lots.Count
            })
            .ToListAsync();

        return Ok(cooperatives);
    }

    [HttpGet("my-cooperative")]
    [Authorize(Roles = "CooperativeManager")]
    public async Task<IActionResult> GetMyCooperative()
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var cooperative = await _db.Cooperatives
            .Include(c => c.Farmers).ThenInclude(f => f.User)
            .Include(c => c.Lots)
            .Include(c => c.MarketListings)
            .FirstOrDefaultAsync(c => c.ManagerId == userId.Value);

        if (cooperative == null) return NotFound("Cooperative not found");

        return Ok(new
        {
            cooperative.Id,
            cooperative.Name,
            cooperative.Region,
            cooperative.District,
            cooperative.Location,
            cooperative.Phone,
            cooperative.Email,
            cooperative.IsVerified,
            cooperative.IsActive,
            Farmers = cooperative.Farmers.Select(f => new
            {
                f.Id,
                f.User.FullName,
                f.User.Email,
                f.Phone,
                f.Crops,
                f.FarmSizeHectares
            }),
            Inventory = cooperative.Lots
                .Where(l => l.Status == "Listed")
                .GroupBy(l => l.Crop)
                .Select(g => new
                {
                    Crop = g.Key,
                    TotalQuantity = g.Sum(l => l.QuantityKg),
                    AverageQuality = g.Average(l => l.QualityGrade == "A" ? 3 : l.QualityGrade == "B" ? 2 : 1)
                }),
            ActiveListings = cooperative.MarketListings
                .Where(l => l.Status == "Active")
                .Select(l => new
                {
                    l.Id,
                    l.Crop,
                    l.QuantityKg,
                    l.MinimumPrice,
                    l.AvailabilityWindowStart,
                    l.AvailabilityWindowEnd
                })
        });
    }

    [HttpGet("farmers")]
    [Authorize(Roles = "CooperativeManager")]
    public async Task<IActionResult> GetMyFarmers()
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var cooperative = await _db.Cooperatives
            .Include(c => c.Farmers).ThenInclude(f => f.User)
            .FirstOrDefaultAsync(c => c.ManagerId == userId.Value);

        if (cooperative == null) return NotFound("Cooperative not found");

        var farmers = cooperative.Farmers
            .Select(f => new
            {
                f.Id,
                f.User.FullName,
                f.User.Email,
                f.Phone,
                f.NationalId,
                f.District,
                f.Sector,
                f.Crops,
                f.FarmSizeHectares,
                f.IsActive,
                f.CreatedAt
            })
            .OrderByDescending(f => f.CreatedAt)
            .ToList();

        return Ok(farmers);
    }

    [HttpPost("inventory")]
    [Authorize(Roles = "CooperativeManager")]
    public async Task<IActionResult> AddToInventory(CreateLotRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var cooperative = await _db.Cooperatives
            .FirstOrDefaultAsync(c => c.ManagerId == userId.Value);

        if (cooperative == null) return NotFound("Cooperative not found");

        var expectedHarvestDate = request.ExpectedHarvestDate == default 
            ? DateTime.UtcNow.AddDays(3) 
            : (request.ExpectedHarvestDate.Kind == DateTimeKind.Utc 
                ? request.ExpectedHarvestDate 
                : request.ExpectedHarvestDate.ToUniversalTime());

        var lot = new Lot
        {
            Id = Guid.NewGuid(),
            CooperativeId = cooperative.Id,
            Crop = request.Crop,
            QuantityKg = request.QuantityKg,
            QualityGrade = string.IsNullOrWhiteSpace(request.QualityGrade) ? "A" : request.QualityGrade,
            ExpectedHarvestDate = expectedHarvestDate,
            Status = "Listed",
            Verified = true,
            HarvestedAt = DateTime.UtcNow
        };

        _db.Lots.Add(lot);
        await _db.SaveChangesAsync();

        return Created("", new { lot.Id, lot.Crop, lot.QuantityKg });
    }

    [HttpPost("market-listing")]
    [Authorize(Roles = "CooperativeManager")]
    public async Task<IActionResult> CreateMarketListing(CreateMarketListingRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var cooperative = await _db.Cooperatives
            .FirstOrDefaultAsync(c => c.ManagerId == userId.Value);

        if (cooperative == null) return NotFound("Cooperative not found");

        // Ensure DateTime values are UTC
        var availabilityStart = request.AvailabilityWindowStart.Kind == DateTimeKind.Utc 
            ? request.AvailabilityWindowStart 
            : request.AvailabilityWindowStart.ToUniversalTime();
        var availabilityEnd = request.AvailabilityWindowEnd.Kind == DateTimeKind.Utc 
            ? request.AvailabilityWindowEnd 
            : request.AvailabilityWindowEnd.ToUniversalTime();

        // Check if cooperative has enough inventory
        var availableInventory = await _db.Lots
            .Where(l => l.CooperativeId == cooperative.Id && l.Crop == request.Crop && l.Status == "Listed")
            .SumAsync(l => l.QuantityKg);

        if (availableInventory < request.QuantityKg)
        {
            return BadRequest("Insufficient inventory for this crop");
        }

        var listing = new MarketListing
        {
            Id = Guid.NewGuid(),
            CooperativeId = cooperative.Id,
            Crop = request.Crop,
            QuantityKg = request.QuantityKg,
            MinimumPrice = request.MinimumPrice,
            AvailabilityWindowStart = availabilityStart,
            AvailabilityWindowEnd = availabilityEnd,
            Description = request.Description,
            QualityGrade = request.QualityGrade,
            Status = "Active"
        };

        _db.MarketListings.Add(listing);
        await _db.SaveChangesAsync();

        return Created("", new { listing.Id, listing.Crop, listing.QuantityKg });
    }

    [HttpGet("market-listings")]
    [Authorize]
    public async Task<IActionResult> GetMarketListings()
    {
        var listings = await _db.MarketListings
            .Include(l => l.Cooperative)
            .Where(l => l.Status == "Active")
            .OrderByDescending(l => l.CreatedAt)
            .Select(l => new
            {
                l.Id,
                l.Crop,
                l.QuantityKg,
                l.MinimumPrice,
                l.AvailabilityWindowStart,
                l.AvailabilityWindowEnd,
                l.Description,
                l.QualityGrade,
                Cooperative = new
                {
                    l.Cooperative.Id,
                    l.Cooperative.Name,
                    l.Cooperative.Region,
                    l.Cooperative.Location
                }
            })
            .ToListAsync();

        return Ok(listings);
    }

    [HttpGet("orders")]
    [Authorize(Roles = "CooperativeManager")]
    public async Task<IActionResult> GetOrders()
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var cooperative = await _db.Cooperatives
            .FirstOrDefaultAsync(c => c.ManagerId == userId.Value);

        if (cooperative == null) return NotFound("Cooperative not found");

        var orders = await _db.BuyerOrders
            .Include(o => o.BuyerProfile).ThenInclude(b => b.User)
            .Include(o => o.MarketListing)
            .Where(o => o.MarketListing != null && o.MarketListing.CooperativeId == cooperative.Id)
            .OrderByDescending(o => o.CreatedAt)
            .Select(o => new
            {
                o.Id,
                o.Crop,
                o.QuantityKg,
                o.PriceOffer,
                o.DeliveryLocation,
                o.DeliveryWindowStart,
                o.DeliveryWindowEnd,
                o.Status,
                o.CreatedAt,
                Buyer = new
                {
                    o.BuyerProfile.User.FullName,
                    o.BuyerProfile.Organization,
                    o.BuyerProfile.Phone
                },
                MarketListing = o.MarketListing != null ? new
                {
                    o.MarketListing.Id,
                    o.MarketListing.MinimumPrice
                } : null
            })
            .ToListAsync();

        return Ok(orders);
    }

    [HttpPost("order/{orderId}/respond")]
    [Authorize(Roles = "CooperativeManager")]
    public async Task<IActionResult> RespondToOrder(Guid orderId, RespondToOrderRequest request)
    {
        var order = await _db.BuyerOrders
            .Include(o => o.MarketListing)
            .FirstOrDefaultAsync(o => o.Id == orderId);

        if (order == null) return NotFound("Order not found");

        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var cooperative = await _db.Cooperatives
            .FirstOrDefaultAsync(c => c.ManagerId == userId.Value);

        if (cooperative == null || order.MarketListing?.CooperativeId != cooperative.Id)
        {
            return Forbid("You can only respond to orders for your cooperative");
        }

        if (order.Status != "Open")
        {
            return BadRequest("Order has already been responded to");
        }

        order.Status = request.Accepted ? "Accepted" : "Rejected";
        await _db.SaveChangesAsync();

        if (request.Accepted)
        {
            // Create contract automatically
            var contract = new Contract
            {
                Id = Guid.NewGuid(),
                BuyerOrderId = order.Id,
                AgreedPrice = order.PriceOffer,
                Status = "Active",
                TrackingId = $"RASS-{Random.Shared.Next(100000, 999999)}"
            };

            // Assign available lots to the contract
            var availableLots = await _db.Lots
                .Where(l => l.CooperativeId == cooperative.Id &&
                           l.Crop == order.Crop &&
                           l.Status == "Listed")
                .OrderBy(l => l.ExpectedHarvestDate)
                .Take(5) // Take up to 5 lots
                .ToListAsync();

            double assignedQuantity = 0;
            foreach (var lot in availableLots)
            {
                if (assignedQuantity >= order.QuantityKg) break;

                double assignAmount = Math.Min(lot.QuantityKg, order.QuantityKg - assignedQuantity);
                contract.ContractLots.Add(new ContractLot
                {
                    ContractId = contract.Id,
                    LotId = lot.Id
                });

                assignedQuantity += assignAmount;
            }

            _db.Contracts.Add(contract);
            await _db.SaveChangesAsync();

            // Create transport request
            var transportRequest = new TransportRequest
            {
                Id = Guid.NewGuid(),
                ContractId = contract.Id,
                Origin = cooperative.Location,
                Destination = order.DeliveryLocation,
                LoadKg = order.QuantityKg,
                PickupStart = order.DeliveryWindowStart.AddDays(-1),
                PickupEnd = order.DeliveryWindowStart,
                Price = CalculateTransportPrice(cooperative.Location, order.DeliveryLocation, order.QuantityKg),
                Status = "Pending"
            };

            _db.TransportRequests.Add(transportRequest);
            await _db.SaveChangesAsync();

            // Notify available transporters
            await NotifyTransporters(transportRequest);
        }

        return Ok(new { order.Id, order.Status });
    }

    [HttpPost("order/{orderId}/assign-storage")]
    [Authorize(Roles = "CooperativeManager")]
    public async Task<IActionResult> AssignStorageLocation(Guid orderId, AssignStorageRequest request)
    {
        var order = await _db.BuyerOrders
            .Include(o => o.Contracts)
            .FirstOrDefaultAsync(o => o.Id == orderId);

        if (order == null) return NotFound("Order not found");

        var contract = order.Contracts.FirstOrDefault();
        if (contract == null) return BadRequest("No contract found for this order");

        var storageFacility = await _db.StorageFacilities.FindAsync(request.StorageFacilityId);
        if (storageFacility == null) return NotFound("Storage facility not found");

        if (storageFacility.AvailableKg < order.QuantityKg)
        {
            return BadRequest("Insufficient storage capacity");
        }

        var storageBooking = new StorageBooking
        {
            Id = Guid.NewGuid(),
            StorageFacilityId = storageFacility.Id,
            ContractId = contract.Id,
            QuantityKg = order.QuantityKg,
            StartDate = request.StartDate,
            EndDate = request.EndDate,
            Status = "Reserved"
        };

        storageFacility.AvailableKg -= order.QuantityKg;

        _db.StorageBookings.Add(storageBooking);
        await _db.SaveChangesAsync();

        return Ok(new { storageBooking.Id, storageFacility.Name, storageBooking.Status });
    }

    [HttpGet("available-transporters")]
    [Authorize(Roles = "CooperativeManager")]
    public async Task<IActionResult> GetAvailableTransporters([FromQuery] string? region, [FromQuery] double? minCapacity)
    {
        var query = _db.TransporterProfiles
            .Where(t => t.IsActive && t.IsVerified)
            .AsQueryable();

        if (!string.IsNullOrEmpty(region))
        {
            query = query.Where(t => t.OperatingRegions.Contains(region));
        }

        if (minCapacity.HasValue)
        {
            query = query.Where(t => t.CapacityKg >= minCapacity.Value);
        }

        var transporters = await query
            .Include(t => t.User)
            .Select(t => new
            {
                t.Id,
                t.CompanyName,
                t.LicenseNumber,
                t.Phone,
                t.CapacityKg,
                t.VehicleType,
                t.LicensePlate,
                OperatingRegions = t.OperatingRegions.Split(','),
                ActiveJobs = t.TransportRequests.Count(tr => tr.Status != "Completed" && tr.Status != "Cancelled"),
                CompletedJobs = t.TransportRequests.Count(tr => tr.Status == "Completed"),
                Rating = 4.5 // Mock rating - in production, calculate from reviews
            })
            .ToListAsync();

        return Ok(transporters);
    }

    [HttpPost("transport/{transportId}/assign-transporter")]
    [Authorize(Roles = "CooperativeManager")]
    public async Task<IActionResult> AssignTransporter(Guid transportId, AssignTransporterRequest request)
    {
        var transport = await _db.TransportRequests
            .FirstOrDefaultAsync(t => t.Id == transportId);

        if (transport == null) return NotFound("Transport request not found");

        var transporter = await _db.TransporterProfiles
            .FirstOrDefaultAsync(t => t.Id == request.TransporterId && t.IsActive && t.IsVerified);

        if (transporter == null) return NotFound("Transporter not found");

        if (transporter.CapacityKg < transport.LoadKg)
        {
            return BadRequest("Transporter capacity insufficient for this load");
        }

        transport.TransporterId = transporter.Id;
        transport.Status = "Assigned";
        transport.AssignedAt = DateTime.UtcNow;
        transport.AssignedTruck = transporter.LicensePlate;
        transport.DriverPhone = request.DriverPhone ?? transporter.Phone;

        await _db.SaveChangesAsync();

        // Notify transporter
        await NotifyTransporter(transporter.User.Email, transport);

        return Ok(new { transport.Id, transport.Status, Transporter = transporter.CompanyName });
    }

    private Guid? GetUserId()
    {
        var claim = User.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier") ??
                   User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
        return Guid.TryParse(claim?.Value, out var guid) ? guid : null;
    }

    private decimal CalculateTransportPrice(string origin, string destination, double loadKg)
    {
        // Mock calculation - in production, use distance API and pricing model
        var basePrice = 10000m; // Base price per trip
        var perKgPrice = 50m; // Price per kg
        return basePrice + (decimal)loadKg * perKgPrice;
    }

    private async Task NotifyTransporters(TransportRequest transport)
    {
        // Mock notification - in production, send push notifications or SMS to available transporters
        Console.WriteLine($"Transport job notification sent: {transport.Origin} → {transport.Destination}");
    }

    private async Task NotifyTransporter(string email, TransportRequest transport)
    {
        // Mock notification - in production, send email/SMS to transporter
        Console.WriteLine($"Transport assignment notification sent to {email}: Job {transport.Id}");
    }
}
