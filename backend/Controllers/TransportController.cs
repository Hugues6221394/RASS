using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Rass.Api.Data;
using Rass.Api.Domain.Entities;
using Rass.Api.Dtos;

namespace Rass.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TransportController : ControllerBase
{
    private readonly AppDbContext _db;

    public TransportController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    [Authorize(Roles = "Transporter,Admin,CooperativeManager,Buyer")]
    public async Task<IActionResult> GetRequests()
    {
        var requests = await _db.TransportRequests
            .Include(t => t.Contract)
            .ThenInclude(c => c!.BuyerOrder)
            .Select(t => new
            {
                t.Id,
                t.Origin,
                t.Destination,
                t.LoadKg,
                t.PickupStart,
                t.PickupEnd,
                t.Price,
                t.Status,
                t.AssignedTruck,
                ContractTracking = t.Contract != null ? t.Contract.TrackingId : null
            }).ToListAsync();

        return Ok(requests);
    }

    [HttpPost]
    [Authorize(Roles = "CooperativeManager,Transporter,Admin")]
    public async Task<IActionResult> CreateTransport(CreateTransportRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Origin))
            return BadRequest("Pickup location is required.");
        if (string.IsNullOrWhiteSpace(request.Destination))
            return BadRequest("Drop location is required.");
        if (request.LoadKg <= 0)
            return BadRequest("Load kg must be greater than 0.");
        if (request.DistanceKm <= 0)
            return BadRequest("Distance is required and must be greater than 0.");
        if (request.EstimatedDeliveryHours <= 0)
            return BadRequest("Estimated delivery time is required and must be greater than 0.");

        Guid? assignedTransporterId = null;
        if (request.TransporterId.HasValue)
        {
            var transporter = await _db.TransporterProfiles.FirstOrDefaultAsync(t => t.Id == request.TransporterId.Value && t.IsActive);
            if (transporter == null) return BadRequest("Selected transporter is not available.");
            if (transporter.CapacityKg < request.LoadKg) return BadRequest("Selected transporter capacity is insufficient.");
            assignedTransporterId = transporter.Id;
        }

        var transport = new TransportRequest
        {
            Id = Guid.NewGuid(),
            ContractId = request.ContractId,
            Origin = request.Origin,
            Destination = request.Destination,
            LoadKg = request.LoadKg,
            PickupStart = request.PickupStart == default ? DateTime.UtcNow.AddHours(6) : request.PickupStart,
            PickupEnd = request.PickupEnd == default ? DateTime.UtcNow.AddHours(18) : request.PickupEnd,
            Price = request.Price,
            Status = assignedTransporterId.HasValue ? "Assigned" : "Pending",
            TransporterId = assignedTransporterId,
            AssignedAt = assignedTransporterId.HasValue ? DateTime.UtcNow : null,
            Notes = $"DistanceKm:{Math.Round(request.DistanceKm, 2)};EstimatedDeliveryHours:{Math.Round(request.EstimatedDeliveryHours, 2)}"
        };

        _db.TransportRequests.Add(transport);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetRequests), new { id = transport.Id }, transport);
    }
}

