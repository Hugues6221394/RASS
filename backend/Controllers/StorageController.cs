using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Rass.Api.Data;
using Rass.Api.Domain.Entities;
using Rass.Api.Dtos;

namespace Rass.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class StorageController : ControllerBase
{
    private readonly AppDbContext _db;

    public StorageController(AppDbContext db)
    {
        _db = db;
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
    [Authorize(Roles = "StorageOperator,Admin,CooperativeManager")]
    public async Task<IActionResult> GetBookings()
    {
        var bookings = await _db.StorageBookings
            .Include(b => b.StorageFacility)
            .Include(b => b.Contract)
            .Select(b => new
            {
                b.Id,
                b.QuantityKg,
                b.StartDate,
                b.EndDate,
                b.Status,
                Facility = b.StorageFacility.Name,
                Tracking = b.Contract != null ? b.Contract.TrackingId : null
            }).ToListAsync();

        return Ok(bookings);
    }

    [HttpPost("book")]
    [Authorize(Roles = "StorageOperator,Admin,CooperativeManager")]
    public async Task<IActionResult> CreateBooking(CreateStorageBookingRequest request)
    {
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

        return CreatedAtAction(nameof(GetBookings), new { id = booking.Id }, booking);
    }
}

