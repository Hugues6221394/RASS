using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Rass.Api.Data;
using Rass.Api.Domain.Entities;
using Rass.Api.Dtos;
using Rass.Api.Hubs;
using Microsoft.AspNetCore.SignalR;
using System.Security.Claims;

namespace Rass.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class StorageController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IHubContext<NotificationHub> _hubContext;

    public StorageController(AppDbContext db, IHubContext<NotificationHub> hubContext)
    {
        _db = db;
        _hubContext = hubContext;
    }

    [HttpGet("facilities")]
    [AllowAnonymous]
    public async Task<IActionResult> GetFacilities()
    {
        var facilities = await _db.StorageFacilities
            .Select(f => new
            {
                f.Id,
                f.Name,
                f.Location,
                f.CapacityKg,
                f.AvailableKg,
                Features = f.Features.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries)
            }).ToListAsync();

        return Ok(facilities);
    }

    [HttpGet("bookings")]
    [Authorize(Roles = "StorageOperator,StorageManager,Admin,CooperativeManager")]
    public async Task<IActionResult> GetBookings()
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var query = _db.StorageBookings
            .Include(b => b.StorageFacility)
            .Include(b => b.Contract)
                .ThenInclude(c => c!.BuyerOrder)
                    .ThenInclude(o => o.MarketListing)
            .AsQueryable();

        if (User.IsInRole("CooperativeManager"))
        {
            var coop = await _db.Cooperatives.FirstOrDefaultAsync(c => c.ManagerId == userId.Value);
            if (coop == null) return Ok(Array.Empty<object>());
            query = query.Where(b => b.Contract != null && b.Contract.BuyerOrder != null &&
                                     b.Contract.BuyerOrder.MarketListing != null &&
                                     b.Contract.BuyerOrder.MarketListing.CooperativeId == coop.Id);
        }

        var bookings = await query
            .OrderByDescending(b => b.StartDate)
            .Select(b => new
            {
                b.Id,
                b.ContractId,
                b.QuantityKg,
                b.StartDate,
                b.EndDate,
                b.Status,
                Facility = b.StorageFacility.Name,
                Tracking = b.Contract != null ? b.Contract.TrackingId : null
            })
            .ToListAsync();

        return Ok(bookings);
    }

    [HttpPost("book")]
    [Authorize(Roles = "StorageOperator,StorageManager,Admin,CooperativeManager")]
    public async Task<IActionResult> CreateBooking(CreateStorageBookingRequest request)
    {
        var userId = GetUserId();
        var facility = await _db.StorageFacilities.FirstOrDefaultAsync(f => f.Id == request.StorageFacilityId);
        if (facility == null)
        {
            return NotFound("Facility not found.");
        }

        if (facility.AvailableKg < request.QuantityKg)
        {
            return BadRequest("Not enough available capacity.");
        }

        var booking = new StorageBooking
        {
            Id = Guid.NewGuid(),
            StorageFacilityId = request.StorageFacilityId,
            ContractId = request.ContractId,
            LotId = request.LotId,
            QuantityKg = request.QuantityKg,
            StartDate = request.StartDate == default ? DateTime.UtcNow : request.StartDate,
            EndDate = request.EndDate == default ? DateTime.UtcNow.AddDays(7) : request.EndDate,
            Status = "Reserved"
        };

        facility.AvailableKg -= request.QuantityKg;

        _db.StorageBookings.Add(booking);
        await _db.SaveChangesAsync();

        var storageOperators = await _db.UserRoles
            .Where(ur => ur.Role.Name == "StorageOperator")
            .Select(ur => ur.UserId)
            .Distinct()
            .ToListAsync();

        var now = DateTime.UtcNow;
        var newBookingNotes = storageOperators.Select(storageUserId => new Notification
        {
            Id = Guid.NewGuid(),
            UserId = storageUserId,
            Title = "New storage booking request",
            Message = $"{facility.Name}: {Math.Round(booking.QuantityKg, 1)}kg from {booking.StartDate:yyyy-MM-dd} to {booking.EndDate:yyyy-MM-dd}.",
            Type = "Info",
            ActionUrl = "/storage-dashboard",
            CreatedAt = now
        }).ToList();
        if (newBookingNotes.Count > 0)
        {
            _db.Notifications.AddRange(newBookingNotes);
            await _db.SaveChangesAsync();
            foreach (var n in newBookingNotes)
            {
                await _hubContext.Clients.Group($"user-{n.UserId}").SendAsync("ReceiveNotification", new
                {
                    n.Id,
                    n.Title,
                    n.Message,
                    n.Type,
                    n.CreatedAt
                });
            }
        }

        return CreatedAtAction(nameof(GetBookings), new { id = booking.Id }, booking);
    }

    [HttpGet("stats")]
    [Authorize(Roles = "StorageOperator,StorageManager,Admin")]
    public async Task<IActionResult> GetStats()
    {
        var totalCapacity = await _db.StorageFacilities.SumAsync(f => f.CapacityKg);
        var availableCapacity = await _db.StorageFacilities.SumAsync(f => f.AvailableKg);
        var utilization = totalCapacity > 0 ? (double)(totalCapacity - availableCapacity) / totalCapacity * 100 : 0;

        return Ok(new
        {
            TotalCapacity = totalCapacity,
            AvailableCapacity = availableCapacity,
            ReservedCapacity = totalCapacity - availableCapacity,
            Utilization = Math.Round(utilization, 1)
        });
    }

    [HttpPost("bookings/{id}/handle")]
    [Authorize(Roles = "StorageOperator,StorageManager,Admin")]
    public async Task<IActionResult> HandleBooking(Guid id, HandleStorageBookingRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var booking = await _db.StorageBookings
            .Include(b => b.StorageFacility)
            .Include(b => b.Lot)
            .FirstOrDefaultAsync(b => b.Id == id);

        if (booking == null) return NotFound("Booking not found");

        if (request.Approved)
        {
            booking.Status = "Approved";
            if (!booking.ContractId.HasValue)
            {
                var buyerProfile = await _db.BuyerProfiles.FirstOrDefaultAsync(b => b.UserId == userId.Value);
                if (buyerProfile == null)
                {
                    buyerProfile = new BuyerProfile
                    {
                        Id = Guid.NewGuid(),
                        UserId = userId.Value,
                        Organization = "Storage Operations",
                        BusinessType = "Storage",
                        Location = booking.StorageFacility?.Location ?? "Rwanda",
                        Phone = "N/A",
                        TaxId = "N/A",
                        IsVerified = true,
                        IsActive = true
                    };
                    _db.BuyerProfiles.Add(buyerProfile);
                }

                var order = new BuyerOrder
                {
                    Id = Guid.NewGuid(),
                    BuyerProfileId = buyerProfile.Id,
                    Crop = booking.Lot?.Crop ?? "Storage Service",
                    QuantityKg = booking.QuantityKg,
                    PriceOffer = booking.Lot?.ExpectedPricePerKg ?? 0,
                    DeliveryLocation = booking.StorageFacility?.Location ?? "Storage Facility",
                    DeliveryWindowStart = booking.StartDate,
                    DeliveryWindowEnd = booking.EndDate,
                    Status = "Accepted",
                    Notes = "Auto-generated from approved storage booking."
                };
                _db.BuyerOrders.Add(order);

                var contract = new Contract
                {
                    Id = Guid.NewGuid(),
                    BuyerOrderId = order.Id,
                    AgreedPrice = order.PriceOffer,
                    TotalQuantityKg = booking.QuantityKg,
                    TotalValue = order.PriceOffer * (decimal)booking.QuantityKg,
                    Status = "PendingApproval",
                    TrackingId = $"RASS-ST-{Random.Shared.Next(100000, 999999)}",
                    DeliveryTerms = "Storage handling terms apply.",
                    PaymentTerms = "To be agreed in contract review.",
                    PenaltyClause = "Standard storage liability applies.",
                    ContractSource = "AutoGenerated",
                    DocumentTitle = "Storage Service Contract",
                    DocumentContent = $"Storage booking agreement for {booking.QuantityKg:N0} kg at {booking.StorageFacility?.Name ?? "Facility"}."
                };
                if (booking.LotId.HasValue)
                {
                    contract.ContractLots.Add(new ContractLot { ContractId = contract.Id, LotId = booking.LotId.Value });
                }
                _db.Contracts.Add(contract);
                booking.ContractId = contract.Id;
            }
        }
        else
        {
            booking.Status = "Rejected";
            // Release capacity back if rejected
            if (booking.StorageFacility != null)
            {
                booking.StorageFacility.AvailableKg += booking.QuantityKg;
            }
        }

        await _db.SaveChangesAsync();

        if (booking.ContractId.HasValue)
        {
            var cooperativeId = booking.Lot?.CooperativeId;
            var targetUsers = await _db.Cooperatives
                .Where(c => cooperativeId.HasValue && c.Id == cooperativeId.Value)
                .Select(c => c.ManagerId)
                .Where(idVal => idVal != null)
                .Select(idVal => idVal!.Value)
                .ToListAsync();

            if (targetUsers.Count > 0)
            {
                var notes = targetUsers.Select(targetUserId => new Notification
                {
                    Id = Guid.NewGuid(),
                    UserId = targetUserId,
                    Title = request.Approved ? "Storage booking approved" : "Storage booking rejected",
                    Message = request.Approved
                        ? "Storage booking approved. Contract is ready in the contract center."
                        : $"Storage booking rejected. {request.Notes ?? string.Empty}".Trim(),
                    Type = request.Approved ? "Success" : "Warning",
                    ActionUrl = "/contracts",
                    CreatedAt = DateTime.UtcNow
                }).ToList();
                _db.Notifications.AddRange(notes);
                await _db.SaveChangesAsync();
                foreach (var n in notes)
                {
                    await _hubContext.Clients.Group($"user-{n.UserId}").SendAsync("ReceiveNotification", new
                    {
                        n.Id,
                        n.Title,
                        n.Message,
                        n.Type,
                        n.CreatedAt
                    });
                }
            }
        }
        return Ok(new { booking.Id, booking.Status });
    }

    /// <summary>
    /// Create a new storage facility (Storage Operator only)
    /// </summary>
    [HttpPost("facilities")]
    [Authorize(Roles = "StorageOperator,StorageManager,Admin")]
    public async Task<IActionResult> CreateFacility(CreateStorageFacilityRequest request)
    {
        var facility = new StorageFacility
        {
            Id = Guid.NewGuid(),
            Name = request.Name,
            Location = request.Location,
            CapacityKg = request.CapacityKg,
            AvailableKg = request.AvailableKg ?? request.CapacityKg,
            Features = request.Features ?? ""
        };

        _db.StorageFacilities.Add(facility);
        await _db.SaveChangesAsync();

        return Created("", new { facility.Id, message = "Facility created successfully" });
    }

    /// <summary>
    /// Update storage facility details
    /// </summary>
    [HttpPut("facilities/{id}")]
    [Authorize(Roles = "StorageOperator,StorageManager,Admin")]
    public async Task<IActionResult> UpdateFacility(Guid id, UpdateStorageFacilityRequest request)
    {
        var facility = await _db.StorageFacilities.FirstOrDefaultAsync(f => f.Id == id);
        if (facility == null) return NotFound("Facility not found");

        if (!string.IsNullOrEmpty(request.Name)) facility.Name = request.Name;
        if (!string.IsNullOrEmpty(request.Location)) facility.Location = request.Location;
        if (request.CapacityKg.HasValue) facility.CapacityKg = request.CapacityKg.Value;
        if (request.AvailableKg.HasValue) facility.AvailableKg = request.AvailableKg.Value;
        if (!string.IsNullOrEmpty(request.Features)) facility.Features = request.Features;

        await _db.SaveChangesAsync();
        return Ok(new { message = "Facility updated successfully" });
    }

    [HttpDelete("facilities/{id}")]
    [Authorize(Roles = "StorageOperator,StorageManager,Admin")]
    public async Task<IActionResult> DeleteFacility(Guid id)
    {
        var facility = await _db.StorageFacilities
            .Include(f => f.Bookings)
            .FirstOrDefaultAsync(f => f.Id == id);
        if (facility == null) return NotFound("Facility not found");
        if (facility.Bookings.Any(b => b.Status != "Released" && b.Status != "Completed"))
            return BadRequest("Cannot delete facility with active bookings.");

        _db.StorageFacilities.Remove(facility);
        await _db.SaveChangesAsync();
        return Ok(new { message = "Facility deleted successfully" });
    }

    /// <summary>
    /// Update booking schedule
    /// </summary>
    [HttpPut("bookings/{id}")]
    [Authorize(Roles = "StorageOperator,StorageManager,Admin")]
    public async Task<IActionResult> UpdateBooking(Guid id, UpdateStorageBookingRequest request)
    {
        var booking = await _db.StorageBookings.FirstOrDefaultAsync(b => b.Id == id);
        if (booking == null) return NotFound("Booking not found");

        if (!string.IsNullOrEmpty(request.Status)) booking.Status = request.Status;
        if (request.StartDate.HasValue) booking.StartDate = request.StartDate.Value;
        if (request.EndDate.HasValue) booking.EndDate = request.EndDate.Value;
        if (request.QuantityKg.HasValue) booking.QuantityKg = request.QuantityKg.Value;

        await _db.SaveChangesAsync();
        return Ok(new { message = "Booking updated successfully" });
    }

    /// <summary>
    /// Delete/Cancel a storage reservation
    /// </summary>
    [HttpDelete("bookings/{id}")]
    [Authorize(Roles = "StorageOperator,StorageManager,Admin,CooperativeManager")]
    public async Task<IActionResult> CancelBooking(Guid id)
    {
        var booking = await _db.StorageBookings
            .Include(b => b.StorageFacility)
            .FirstOrDefaultAsync(b => b.Id == id);

        if (booking == null) return NotFound("Booking not found");

        if (booking.Status == "Completed")
        {
            return BadRequest("Cannot cancel completed bookings");
        }

        // Release capacity back
        if (booking.StorageFacility != null)
        {
            booking.StorageFacility.AvailableKg += booking.QuantityKg;
        }

        _db.StorageBookings.Remove(booking);
        await _db.SaveChangesAsync();

        return Ok(new { message = "Booking cancelled successfully" });
    }

    /// <summary>
    /// Get stored inventory records
    /// </summary>
    [HttpGet("inventory")]
    [Authorize(Roles = "StorageOperator,StorageManager,Admin")]
    public async Task<IActionResult> GetInventory()
    {
        var inventory = await _db.StorageBookings
            .Include(b => b.StorageFacility)
            .Include(b => b.Lot)
            .Where(b => b.Status == "Approved" || b.Status == "Active")
            .Select(b => new
            {
                b.Id,
                Facility = b.StorageFacility != null ? b.StorageFacility.Name : null,
                Crop = b.Lot != null ? b.Lot.Crop : "Unknown",
                b.QuantityKg,
                b.StartDate,
                b.EndDate,
                b.Status,
                DaysRemaining = (b.EndDate - DateTime.UtcNow).Days
            })
            .ToListAsync();

        return Ok(inventory);
    }

    /// <summary>
    /// Release inventory for shipment
    /// </summary>
    [HttpPost("bookings/{id}/release")]
    [Authorize(Roles = "StorageOperator,StorageManager,Admin")]
    public async Task<IActionResult> ReleaseInventory(Guid id)
    {
        var booking = await _db.StorageBookings
            .Include(b => b.StorageFacility)
            .FirstOrDefaultAsync(b => b.Id == id);

        if (booking == null) return NotFound("Booking not found");

        booking.Status = "Released";

        // Restore capacity
        if (booking.StorageFacility != null)
        {
            booking.StorageFacility.AvailableKg += booking.QuantityKg;
        }

        await _db.SaveChangesAsync();
        return Ok(new { message = "Inventory released for shipment" });
    }

    /// <summary>
    /// Get storage capacity metrics by facility
    /// </summary>
    [HttpGet("capacity")]
    [Authorize(Roles = "StorageOperator,StorageManager,Admin,Government")]
    public async Task<IActionResult> GetCapacityMetrics()
    {
        var metrics = await _db.StorageFacilities
            .Select(f => new
            {
                f.Id,
                f.Name,
                f.Location,
                f.CapacityKg,
                f.AvailableKg,
                UsedKg = f.CapacityKg - f.AvailableKg,
                Utilization = f.CapacityKg > 0 ? Math.Round((f.CapacityKg - f.AvailableKg) / f.CapacityKg * 100, 1) : 0,
                Features = f.Features.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries)
            })
            .ToListAsync();

        return Ok(metrics);
    }

    private Guid? GetUserId()
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier) ??
                  User.FindFirstValue("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier");
        return Guid.TryParse(sub, out var guid) ? guid : null;
    }
}
