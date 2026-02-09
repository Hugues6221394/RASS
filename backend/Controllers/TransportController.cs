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
    [Authorize(Roles = "Transporter,Admin")]
    public async Task<IActionResult> CreateTransport(CreateTransportRequest request)
    {
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
            Status = "Pending"
        };

        _db.TransportRequests.Add(transport);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetRequests), new { id = transport.Id }, transport);
    }
}

