using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Rass.Api.Data;

namespace Rass.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TrackingController : ControllerBase
{
    private readonly AppDbContext _db;

    public TrackingController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet("{trackingId}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetTracking(string trackingId)
    {
        var contract = await _db.Contracts
            .Include(c => c.TransportRequests)
            .Include(c => c.StorageBookings).ThenInclude(b => b.StorageFacility)
            .Include(c => c.BuyerOrder)
            .FirstOrDefaultAsync(c => c.TrackingId == trackingId);

        if (contract == null)
        {
            return NotFound();
        }

        var response = new
        {
            contract.TrackingId,
            contract.Status,
            Order = new { contract.BuyerOrder.Crop, contract.BuyerOrder.DeliveryLocation, contract.BuyerOrder.DeliveryWindowStart, contract.BuyerOrder.DeliveryWindowEnd },
            Transports = contract.TransportRequests.Select(t => new { t.Status, t.Origin, t.Destination, t.AssignedTruck, t.PickupStart, t.PickupEnd }),
            Storage = contract.StorageBookings.Select(s => new { s.Status, Facility = s.StorageFacility.Name, s.StartDate, s.EndDate }),
        };

        return Ok(response);
    }
}

