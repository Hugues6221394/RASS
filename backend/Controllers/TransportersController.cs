using BCrypt.Net;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Rass.Api.Data;
using Rass.Api.Domain.Entities;
using Rass.Api.Dtos;

namespace Rass.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TransportersController : ControllerBase
{
    private readonly AppDbContext _db;

    public TransportersController(AppDbContext db)
    {
        _db = db;
    }

    [HttpPost("register")]
    public async Task<IActionResult> RegisterTransporter(CreateTransporterRequest request)
    {
        if (await _db.Users.AnyAsync(u => u.Email == request.Email))
        {
            return Conflict("User already exists.");
        }

        var transporterRole = await _db.Roles.FirstAsync(r => r.Name == "Transporter");

        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = request.Email,
            FullName = request.ContactPerson,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password)
        };

        var transporter = new TransporterProfile
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            CompanyName = request.CompanyName,
            LicenseNumber = request.LicenseNumber,
            Phone = request.Phone,
            CapacityKg = request.CapacityKg,
            VehicleType = request.VehicleType,
            LicensePlate = request.LicensePlate,
            OperatingRegions = string.Join(",", request.OperatingRegions),
            IsVerified = false,
            IsActive = true
        };

        _db.Users.Add(user);
        _db.TransporterProfiles.Add(transporter);
        _db.UserRoles.Add(new UserRole { UserId = user.Id, RoleId = transporterRole.Id });

        await _db.SaveChangesAsync();

        return Created("", new { transporter.Id, user.FullName, user.Email });
    }

    [HttpGet("profile")]
    [Authorize(Roles = "Transporter")]
    public async Task<IActionResult> GetTransporterProfile()
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var transporter = await _db.TransporterProfiles
            .Include(t => t.User)
            .Include(t => t.TransportRequests)
            .FirstOrDefaultAsync(t => t.UserId == userId.Value);

        if (transporter == null) return NotFound();

        return Ok(new
        {
            transporter.Id,
            transporter.User.FullName,
            transporter.User.Email,
            transporter.CompanyName,
            transporter.LicenseNumber,
            transporter.Phone,
            transporter.CapacityKg,
            transporter.VehicleType,
            transporter.LicensePlate,
            OperatingRegions = transporter.OperatingRegions.Split(','),
            transporter.IsVerified,
            transporter.IsActive,
            ActiveJobs = transporter.TransportRequests.Count(t => t.Status == "Assigned" || t.Status == "InTransit"),
            CompletedJobs = transporter.TransportRequests.Count(t => t.Status == "Completed")
        });
    }

    [HttpGet("available-jobs")]
    [Authorize(Roles = "Transporter")]
    public async Task<IActionResult> GetAvailableJobs()
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var transporter = await _db.TransporterProfiles
            .FirstOrDefaultAsync(t => t.UserId == userId.Value);

        if (transporter == null) return NotFound();

        var jobs = await _db.TransportRequests
            .Include(t => t.Contract)
            .ThenInclude(c => c.BuyerOrder)
            .Where(t => t.Status == "Pending" &&
                       t.TransporterId == null &&
                       t.LoadKg <= transporter.CapacityKg)
            .OrderBy(t => t.PickupStart)
            .Select(t => new
            {
                t.Id,
                t.Origin,
                t.Destination,
                t.LoadKg,
                t.PickupStart,
                t.PickupEnd,
                t.Price,
                Contract = t.Contract != null && t.Contract.BuyerOrder != null ? new
                {
                    t.Contract.Id,
                    t.Contract.TrackingId,
                    Crop = t.Contract.BuyerOrder.Crop,
                    Quantity = t.Contract.BuyerOrder.QuantityKg
                } : null
            })
            .ToListAsync();

        return Ok(jobs);
    }

    [HttpPost("job/{jobId}/accept")]
    [Authorize(Roles = "Transporter")]
    public async Task<IActionResult> AcceptJob(Guid jobId, AcceptJobRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var transporter = await _db.TransporterProfiles
            .FirstOrDefaultAsync(t => t.UserId == userId.Value);

        if (transporter == null) return NotFound("Transporter not found");

        var job = await _db.TransportRequests
            .FirstOrDefaultAsync(t => t.Id == jobId && t.Status == "Pending");

        if (job == null) return NotFound("Job not found or no longer available");

        if (job.LoadKg > transporter.CapacityKg)
        {
            return BadRequest("Job load exceeds your vehicle capacity");
        }

        // Check if transporter already has a conflicting job
        var conflictingJob = await _db.TransportRequests
            .AnyAsync(t => t.TransporterId == transporter.Id &&
                          t.Status != "Completed" &&
                          t.Status != "Cancelled" &&
                          ((t.PickupStart <= job.PickupEnd && t.PickupEnd >= job.PickupStart) ||
                           (t.DeliveredAt.HasValue && t.DeliveredAt.Value.AddHours(2) > job.PickupStart)));

        if (conflictingJob)
        {
            return BadRequest("You have a conflicting job schedule");
        }

        job.TransporterId = transporter.Id;
        job.Status = "Assigned";
        job.AssignedAt = DateTime.UtcNow;
        job.DriverPhone = request.DriverPhone ?? transporter.Phone;
        job.AssignedTruck = transporter.LicensePlate;

        await _db.SaveChangesAsync();

        return Ok(new { job.Id, job.Status, message = "Job accepted successfully" });
    }

    [HttpGet("my-jobs")]
    [Authorize(Roles = "Transporter")]
    public async Task<IActionResult> GetMyJobs()
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var transporter = await _db.TransporterProfiles
            .FirstOrDefaultAsync(t => t.UserId == userId.Value);

        if (transporter == null) return NotFound();

        var jobs = await _db.TransportRequests
            .Include(t => t.Contract)
            .ThenInclude(c => c.BuyerOrder)
            .Where(t => t.TransporterId == transporter.Id)
            .OrderByDescending(t => t.CreatedAt)
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
                t.AssignedAt,
                t.PickedUpAt,
                t.DeliveredAt,
                t.DriverPhone,
                t.AssignedTruck,
                t.Notes,
                Contract = t.Contract != null && t.Contract.BuyerOrder != null && t.Contract.BuyerOrder.BuyerProfile != null ? new
                {
                    t.Contract.Id,
                    t.Contract.TrackingId,
                    Crop = t.Contract.BuyerOrder.Crop,
                    Buyer = t.Contract.BuyerOrder.BuyerProfile.Organization
                } : null
            })
            .ToListAsync();

        return Ok(jobs);
    }

    [HttpPost("job/{jobId}/pickup")]
    [Authorize(Roles = "Transporter")]
    public async Task<IActionResult> ConfirmPickup(Guid jobId)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var transporter = await _db.TransporterProfiles
            .FirstOrDefaultAsync(t => t.UserId == userId.Value);

        if (transporter == null) return NotFound();

        var job = await _db.TransportRequests
            .FirstOrDefaultAsync(t => t.Id == jobId &&
                                    t.TransporterId == transporter.Id &&
                                    t.Status == "Assigned");

        if (job == null) return NotFound("Job not found or not assigned to you");

        job.Status = "PickedUp";
        job.PickedUpAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        return Ok(new { job.Id, job.Status, job.PickedUpAt });
    }

    [HttpPost("job/{jobId}/deliver")]
    [Authorize(Roles = "Transporter")]
    public async Task<IActionResult> ConfirmDelivery(Guid jobId, ConfirmDeliveryTransporterRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var transporter = await _db.TransporterProfiles
            .FirstOrDefaultAsync(t => t.UserId == userId.Value);

        if (transporter == null) return NotFound();

        var job = await _db.TransportRequests
            .Include(t => t.Contract)
            .ThenInclude(c => c.BuyerOrder)
            .FirstOrDefaultAsync(t => t.Id == jobId &&
                                    t.TransporterId == transporter.Id &&
                                    t.Status == "PickedUp");

        if (job == null) return NotFound("Job not found or not ready for delivery");

        job.Status = "Delivered";
        job.DeliveredAt = DateTime.UtcNow;
        job.Notes = request.Notes ?? "";
        job.ProofOfDeliveryUrl = request.ProofOfDeliveryUrl; // URL to uploaded proof

        // Update contract status
        if (job.Contract != null)
        {
            job.Contract.Status = "Delivered";
        }

        await _db.SaveChangesAsync();

        // Notify buyer
        if (job.Contract?.BuyerOrder != null)
        {
            await NotifyBuyer(job.Contract.BuyerOrder.BuyerProfile.User.Email,
                             job.Contract.TrackingId,
                             job.Contract.BuyerOrder.Crop);
        }

        return Ok(new { job.Id, job.Status, job.DeliveredAt, job.ProofOfDeliveryUrl });
    }

    [HttpGet("route/{jobId}")]
    [Authorize(Roles = "Transporter")]
    public async Task<IActionResult> GetRoute(Guid jobId)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var job = await _db.TransportRequests
            .FirstOrDefaultAsync(t => t.Id == jobId &&
                                    t.TransporterId.HasValue &&
                                    t.TransporterId.Value == _db.TransporterProfiles
                                        .FirstOrDefault(tp => tp.UserId == userId.Value)!.Id);

        if (job == null) return NotFound("Job not found");

        // Mock route generation - in production, use Google Maps API or similar
        var route = new
        {
            Origin = job.Origin,
            Destination = job.Destination,
            EstimatedDistance = CalculateDistance(job.Origin, job.Destination), // km
            EstimatedDuration = CalculateDuration(job.Origin, job.Destination), // minutes
            Waypoints = new[] { job.Origin, job.Destination },
            Instructions = new[]
            {
                $"Start from {job.Origin}",
                $"Proceed to {job.Destination}",
                $"Estimated travel time: {CalculateDuration(job.Origin, job.Destination)} minutes"
            }
        };

        return Ok(route);
    }

    private double CalculateDistance(string origin, string destination)
    {
        // Mock calculation - in production, use geocoding and distance API
        return 150.0; // km
    }

    private int CalculateDuration(string origin, string destination)
    {
        // Mock calculation - in production, use routing API
        return 180; // minutes
    }

    private Guid? GetUserId()
    {
        var claim = User.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier") ??
                   User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
        return Guid.TryParse(claim?.Value, out var guid) ? guid : null;
    }

    private async Task NotifyBuyer(string buyerEmail, string trackingId, string crop)
    {
        // Mock notification - in real system would send email/SMS
        Console.WriteLine($"Delivery notification sent to {buyerEmail}: {crop} delivery completed for tracking {trackingId}");
    }
}
