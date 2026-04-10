using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Rass.Api.Data;
using Rass.Api.Domain.Entities;
using Rass.Api.Dtos;

namespace Rass.Api.Controllers;

[ApiController]
[Route("api/transport-jobs")]
[Authorize]
public class TransportJobsController : ControllerBase
{
    private readonly AppDbContext _db;

    public TransportJobsController(AppDbContext db) => _db = db;

    // ── Cooperative Manager: Post a job ──

    [HttpPost]
    [Authorize(Roles = "CooperativeManager")]
    public async Task<IActionResult> CreateJob(CreateTransportJobRequest req)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var coop = await _db.Cooperatives.FirstOrDefaultAsync(c => c.ManagerId == userId.Value);
        if (coop == null) return NotFound("Cooperative not found");

        var job = new TransportJob
        {
            CooperativeId = coop.Id,
            PostedByUserId = userId.Value,
            Title = req.Title.Trim(),
            Description = req.Description,
            Crop = req.Crop.Trim(),
            QuantityKg = req.QuantityKg,
            QualityGrade = req.QualityGrade,
            PickupLocation = req.PickupLocation.Trim(),
            DeliveryLocation = req.DeliveryLocation.Trim(),
            DistanceKm = req.DistanceKm,
            PickupDate = req.PickupDate,
            DeliveryDeadline = req.DeliveryDeadline,
            MinPaymentRwf = req.MinPaymentRwf,
            MaxPaymentRwf = req.MaxPaymentRwf,
            PaymentTerms = req.PaymentTerms ?? "OnDelivery",
            RequiredVehicleType = req.RequiredVehicleType,
            RequiresColdChain = req.RequiresColdChain,
            SpecialInstructions = req.SpecialInstructions,
            Status = "Open",
        };

        _db.TransportJobs.Add(job);

        // Notify all active transporters
        var transporterUserIds = await _db.UserRoles
            .Include(ur => ur.Role)
            .Where(ur => ur.Role.Name == "Transporter")
            .Select(ur => ur.UserId)
            .ToListAsync();

        foreach (var tid in transporterUserIds)
        {
            _db.Notifications.Add(new Notification
            {
                UserId = tid,
                Title = "New transport job available",
                Message = $"{coop.Name} posted: {job.Title} — {job.Crop} {job.QuantityKg:N0}kg, {job.PickupLocation} → {job.DeliveryLocation}",
                Type = "TransportJob",
            });
        }

        await _db.SaveChangesAsync();
        return Created("", new { job.Id, message = "Transport job posted and transporters notified." });
    }

    // ── Cooperative Manager: My posted jobs ──

    [HttpGet("my-jobs")]
    [Authorize(Roles = "CooperativeManager")]
    public async Task<IActionResult> GetMyJobs()
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var coop = await _db.Cooperatives.FirstOrDefaultAsync(c => c.ManagerId == userId.Value);
        if (coop == null) return NotFound("Cooperative not found");

        var jobs = await _db.TransportJobs
            .Where(j => j.CooperativeId == coop.Id)
            .Include(j => j.Applications)
            .Include(j => j.AssignedTransporter)
            .OrderByDescending(j => j.CreatedAt)
            .Select(j => new
            {
                j.Id, j.Title, j.Crop, j.QuantityKg, j.PickupLocation, j.DeliveryLocation,
                j.PickupDate, j.DeliveryDeadline, j.MinPaymentRwf, j.MaxPaymentRwf,
                j.RequiredVehicleType, j.RequiresColdChain, j.Status, j.CreatedAt,
                j.DistanceKm, j.PaymentTerms, j.SpecialInstructions, j.Description,
                ApplicationCount = j.Applications.Count,
                AssignedTransporter = j.AssignedTransporter == null ? null : j.AssignedTransporter.FullName,
            })
            .ToListAsync();

        return Ok(jobs);
    }

    // ── Cooperative Manager: View applications for a job ──

    [HttpGet("{jobId}/applications")]
    [Authorize(Roles = "CooperativeManager,Admin")]
    public async Task<IActionResult> GetApplications(Guid jobId)
    {
        var job = await _db.TransportJobs.FindAsync(jobId);
        if (job == null) return NotFound();

        var apps = await _db.TransportJobApplications
            .Where(a => a.TransportJobId == jobId)
            .Include(a => a.TransporterUser)
            .OrderByDescending(a => a.CreatedAt)
            .Select(a => new
            {
                a.Id, a.ProposedPriceRwf, a.VehicleType, a.PlateNumber,
                a.VehicleCapacityKg, a.CoverLetter, a.EstimatedDeliveryHours,
                a.DriverPhone, a.DrivingLicenseUrl, a.InsuranceDocUrl,
                a.VehicleInspectionUrl, a.Status, a.ReviewNote, a.CreatedAt,
                TransporterName = a.TransporterUser.FullName,
                TransporterEmail = a.TransporterUser.Email,
                TransporterUserId = a.TransporterUserId,
            })
            .ToListAsync();

        return Ok(apps);
    }

    // ── Cooperative Manager: Process an application ──

    [HttpPost("applications/{appId}/process")]
    [Authorize(Roles = "CooperativeManager")]
    public async Task<IActionResult> ProcessApplication(Guid appId, ProcessTransportJobApplicationRequest req)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var app = await _db.TransportJobApplications
            .Include(a => a.TransportJob)
            .FirstOrDefaultAsync(a => a.Id == appId);
        if (app == null) return NotFound("Application not found");

        var coop = await _db.Cooperatives.FirstOrDefaultAsync(c => c.ManagerId == userId.Value);
        if (coop == null || app.TransportJob.CooperativeId != coop.Id)
            return Forbid();

        if (req.Accepted)
        {
            if (app.TransportJob.Status != "Open")
                return BadRequest("Job is no longer open for assignment.");

            app.Status = "Accepted";
            app.ReviewNote = req.ReviewNote;
            app.UpdatedAt = DateTime.UtcNow;

            // Assign the job
            app.TransportJob.AssignedTransporterId = app.TransporterUserId;
            app.TransportJob.Status = "Assigned";
            app.TransportJob.UpdatedAt = DateTime.UtcNow;

            // Create a transport request for tracking
            var transportReq = new TransportRequest
            {
                Origin = app.TransportJob.PickupLocation,
                Destination = app.TransportJob.DeliveryLocation,
                LoadKg = app.TransportJob.QuantityKg,
                Status = "Assigned",
                PickupStart = app.TransportJob.PickupDate ?? DateTime.UtcNow,
                PickupEnd = app.TransportJob.DeliveryDeadline ?? DateTime.UtcNow.AddDays(7),
                Price = app.ProposedPriceRwf,
                DriverPhone = app.DriverPhone,
                AssignedTruck = app.PlateNumber,
            };
            _db.TransportRequests.Add(transportReq);

            app.TransportJob.TransportRequestId = transportReq.Id;

            // Reject all other applications
            var others = await _db.TransportJobApplications
                .Where(a => a.TransportJobId == app.TransportJobId && a.Id != appId && a.Status == "Submitted")
                .ToListAsync();
            foreach (var o in others)
            {
                o.Status = "Rejected";
                o.ReviewNote = "Another transporter was selected.";
                o.UpdatedAt = DateTime.UtcNow;

                _db.Notifications.Add(new Notification
                {
                    UserId = o.TransporterUserId,
                    Title = "Job application update",
                    Message = $"Your application for \"{app.TransportJob.Title}\" was not selected.",
                    Type = "TransportJob",
                });
            }

            // Notify winner
            _db.Notifications.Add(new Notification
            {
                UserId = app.TransporterUserId,
                Title = "You won a transport job!",
                Message = $"Your application for \"{app.TransportJob.Title}\" has been accepted. Pickup: {app.TransportJob.PickupLocation}. Please prepare for delivery.",
                Type = "TransportJob",
            });
        }
        else
        {
            app.Status = "Rejected";
            app.ReviewNote = req.ReviewNote;
            app.UpdatedAt = DateTime.UtcNow;

            _db.Notifications.Add(new Notification
            {
                UserId = app.TransporterUserId,
                Title = "Job application update",
                Message = $"Your application for \"{app.TransportJob.Title}\" was not selected. {req.ReviewNote ?? ""}".Trim(),
                Type = "TransportJob",
            });
        }

        await _db.SaveChangesAsync();
        return Ok(new { message = req.Accepted ? "Transporter assigned and notified." : "Application rejected." });
    }

    // ── Transporter: Browse open jobs ──

    [HttpGet("available")]
    [Authorize(Roles = "Transporter")]
    public async Task<IActionResult> GetAvailableJobs()
    {
        var jobs = await _db.TransportJobs
            .Where(j => j.Status == "Open")
            .Include(j => j.Cooperative)
            .OrderByDescending(j => j.CreatedAt)
            .Select(j => new
            {
                j.Id, j.Title, j.Description, j.Crop, j.QuantityKg, j.QualityGrade,
                j.PickupLocation, j.DeliveryLocation, j.DistanceKm,
                j.PickupDate, j.DeliveryDeadline,
                j.MinPaymentRwf, j.MaxPaymentRwf, j.PaymentTerms,
                j.RequiredVehicleType, j.RequiresColdChain, j.SpecialInstructions,
                j.CreatedAt,
                CooperativeName = j.Cooperative.Name,
                CooperativeRegion = j.Cooperative.Region,
                ApplicationCount = j.Applications.Count,
            })
            .ToListAsync();

        return Ok(jobs);
    }

    // ── Transporter: Apply to a job ──

    [HttpPost("{jobId}/apply")]
    [Authorize(Roles = "Transporter")]
    public async Task<IActionResult> ApplyToJob(Guid jobId, ApplyToTransportJobRequest req)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var job = await _db.TransportJobs.FindAsync(jobId);
        if (job == null) return NotFound("Job not found");
        if (job.Status != "Open") return BadRequest("Job is no longer accepting applications.");

        var existing = await _db.TransportJobApplications
            .AnyAsync(a => a.TransportJobId == jobId && a.TransporterUserId == userId.Value);
        if (existing) return BadRequest("You have already applied to this job.");

        var app = new TransportJobApplication
        {
            TransportJobId = jobId,
            TransporterUserId = userId.Value,
            ProposedPriceRwf = req.ProposedPriceRwf,
            VehicleType = req.VehicleType,
            PlateNumber = req.PlateNumber,
            VehicleCapacityKg = req.VehicleCapacityKg,
            CoverLetter = req.CoverLetter,
            EstimatedDeliveryHours = req.EstimatedDeliveryHours,
            DriverPhone = req.DriverPhone,
        };

        // Save uploaded documents
        if (!string.IsNullOrEmpty(req.DrivingLicenseBase64))
            app.DrivingLicenseUrl = await SaveJobDocument(jobId, req.DrivingLicenseBase64, req.DrivingLicenseFileName ?? "driving-license");

        if (!string.IsNullOrEmpty(req.InsuranceDocBase64))
            app.InsuranceDocUrl = await SaveJobDocument(jobId, req.InsuranceDocBase64, req.InsuranceDocFileName ?? "insurance");

        _db.TransportJobApplications.Add(app);

        // Notify cooperative manager
        _db.Notifications.Add(new Notification
        {
            UserId = job.PostedByUserId,
            Title = "New job application",
            Message = $"A transporter applied to \"{job.Title}\" with proposed price {req.ProposedPriceRwf:N0} RWF.",
            Type = "TransportJob",
        });

        await _db.SaveChangesAsync();
        return Created("", new { app.Id, message = "Application submitted successfully." });
    }

    // ── Transporter: My applications ──

    [HttpGet("my-applications")]
    [Authorize(Roles = "Transporter")]
    public async Task<IActionResult> GetMyApplications()
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var apps = await _db.TransportJobApplications
            .Where(a => a.TransporterUserId == userId.Value)
            .Include(a => a.TransportJob).ThenInclude(j => j.Cooperative)
            .OrderByDescending(a => a.CreatedAt)
            .Select(a => new
            {
                a.Id, a.ProposedPriceRwf, a.VehicleType, a.PlateNumber,
                a.Status, a.ReviewNote, a.CreatedAt,
                Job = new
                {
                    a.TransportJob.Id, a.TransportJob.Title, a.TransportJob.Crop,
                    a.TransportJob.QuantityKg, a.TransportJob.PickupLocation,
                    a.TransportJob.DeliveryLocation, a.TransportJob.Status,
                    CooperativeName = a.TransportJob.Cooperative.Name,
                },
            })
            .ToListAsync();

        return Ok(apps);
    }

    // ── Price Moderation (Government) ──

    [HttpGet("/api/government/price-submissions")]
    [Authorize(Roles = "Government,Admin")]
    public async Task<IActionResult> GetPriceSubmissions(
        [FromQuery] string? status = null,
        [FromQuery] string? crop = null,
        [FromQuery] int days = 30)
    {
        var cutoff = DateTime.UtcNow.AddDays(-days);
        var query = _db.MarketPrices
            .Where(p => p.ObservedAt >= cutoff)
            .Include(p => p.Agent)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(p => p.VerificationStatus == status);
        if (!string.IsNullOrWhiteSpace(crop))
            query = query.Where(p => p.Crop == crop);

        var prices = await query
            .OrderByDescending(p => p.ObservedAt)
            .Take(500)
            .Select(p => new
            {
                p.Id, p.Market, p.Region, p.District, p.Sector, p.Cell, p.Crop,
                p.PricePerKg, p.ObservedAt,
                p.VerificationStatus, p.ModerationNote, p.ModeratedAt,
                AgentName = p.Agent != null ? p.Agent.FullName : "System",
                AgentEmail = p.Agent != null ? p.Agent.Email : null,
                AgentUserId = p.AgentId,
            })
            .ToListAsync();

        return Ok(prices);
    }

    [HttpPost("/api/government/price-submissions/{id}/moderate")]
    [Authorize(Roles = "Government,Admin")]
    public async Task<IActionResult> ModeratePrice(Guid id, ModerateMarketPriceRequest req)
    {
        var price = await _db.MarketPrices.FindAsync(id);
        if (price == null) return NotFound();

        var userId = GetUserId();
        price.VerificationStatus = req.Status; // Approved, Rejected, Flagged
        price.ModerationNote = req.Note;
        price.ModeratedByUserId = userId;
        price.ModeratedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return Ok(new { message = $"Price marked as {req.Status}." });
    }

    // ── Helpers ──

    private async Task<string> SaveJobDocument(Guid jobId, string base64Content, string fileName)
    {
        var uploadsDir = Path.Combine(Directory.GetCurrentDirectory(), "uploads", "transport-jobs", jobId.ToString());
        Directory.CreateDirectory(uploadsDir);

        var cleanBase64 = base64Content.Contains(',') ? base64Content[(base64Content.IndexOf(',') + 1)..] : base64Content;
        var bytes = Convert.FromBase64String(cleanBase64);

        var safeFileName = $"{Guid.NewGuid():N}_{Path.GetFileName(fileName)}";
        var filePath = Path.Combine(uploadsDir, safeFileName);
        await System.IO.File.WriteAllBytesAsync(filePath, bytes);

        return $"/uploads/transport-jobs/{jobId}/{safeFileName}";
    }

    private Guid? GetUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier) ??
                    User.FindFirst("sub");
        return Guid.TryParse(claim?.Value, out var guid) ? guid : null;
    }
}
