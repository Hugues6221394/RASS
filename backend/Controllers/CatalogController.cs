using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Rass.Api.Data;
using Rass.Api.Domain.Entities;
using Rass.Api.Dtos;
using Rass.Api.Hubs;
using Rass.Api.Services;

namespace Rass.Api.Controllers;

[ApiController]
[Route("api/catalog")]
public class CatalogController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly CatalogManagementService _catalog;
    private readonly IHubContext<NotificationHub> _hubContext;

    public CatalogController(AppDbContext db, CatalogManagementService catalog, IHubContext<NotificationHub> hubContext)
    {
        _db = db;
        _catalog = catalog;
        _hubContext = hubContext;
    }

    [HttpGet("crops")]
    [AllowAnonymous]
    public async Task<IActionResult> GetCrops([FromQuery] bool includePending = false)
    {
        var canSeePending = includePending && (User.IsInRole("Government") || User.IsInRole("Admin"));

        var query = _db.CropCatalogs.AsQueryable();
        if (!canSeePending)
        {
            query = query.Where(c => c.Status == "Active" && (!c.RequiresGovernmentReview || c.IsGovernmentRegistered));
        }

        var crops = await query
            .OrderBy(c => c.Name)
            .Select(c => new
            {
                c.Id,
                c.Name,
                c.Status,
                c.IsGovernmentRegistered,
                c.RequiresGovernmentReview,
                c.SourceRole,
                c.CreatedAt,
                c.UpdatedAt
            })
            .ToListAsync();

        return Ok(crops);
    }

    [HttpPost("crops")]
    [Authorize(Roles = "Government,Admin")]
    public async Task<IActionResult> CreateCrop(CreateCropCatalogRequest request)
    {
        var actorId = GetUserId();
        var cropName = await _catalog.EnsureCropAsync(request.Name, actorId, User.IsInRole("Government") ? "Government" : "Admin", true);
        var crop = await _db.CropCatalogs.FirstAsync(c => c.NormalizedName == CatalogManagementService.NormalizeCropName(cropName));
        return Ok(new { crop.Id, crop.Name, message = "Crop catalog updated successfully." });
    }

    [HttpPost("crops/{id:guid}/approve")]
    [Authorize(Roles = "Government,Admin")]
    public async Task<IActionResult> ApproveCrop(Guid id)
    {
        var crop = await _db.CropCatalogs.FirstOrDefaultAsync(c => c.Id == id);
        if (crop == null) return NotFound("Crop not found.");

        crop.IsGovernmentRegistered = true;
        crop.RequiresGovernmentReview = false;
        crop.Status = "Active";
        crop.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(new { crop.Id, crop.Name, message = "Crop approved for national catalog." });
    }

    [HttpPost("crops/{id:guid}/reject")]
    [Authorize(Roles = "Government,Admin")]
    public async Task<IActionResult> RejectCrop(Guid id, [FromBody] RejectCropRequest? request = null)
    {
        var actorId = GetUserId();
        if (!actorId.HasValue) return Unauthorized();

        var crop = await _db.CropCatalogs.Include(c => c.CreatedByUser).FirstOrDefaultAsync(c => c.Id == id);
        if (crop == null) return NotFound("Crop not found.");

        var reason = string.IsNullOrWhiteSpace(request?.Reason) ? "No reason provided." : request!.Reason!.Trim();
        crop.Status = "Rejected";
        crop.RequiresGovernmentReview = false;
        crop.UpdatedAt = DateTime.UtcNow;

        var actor = await _db.Users
            .Where(u => u.Id == actorId.Value)
            .Select(u => u.FullName)
            .FirstOrDefaultAsync() ?? "Government";

        _db.AuditLogs.Add(new AuditLog
        {
            Action = "CropCatalogRejected",
            Actor = actor,
            ActorRole = User.IsInRole("Admin") ? "Admin" : "Government",
            ActionType = "Reject",
            EntityType = "CropCatalog",
            EntityId = crop.Id.ToString(),
            Metadata = reason,
            AfterState = System.Text.Json.JsonSerializer.Serialize(new
            {
                crop.Id,
                crop.Name,
                crop.Status,
                reason,
                rejectedBy = actor,
                rejectedAt = DateTime.UtcNow
            }),
            Timestamp = DateTime.UtcNow
        });

        if (crop.CreatedByUserId.HasValue)
        {
            var note = new Notification
            {
                Id = Guid.NewGuid(),
                UserId = crop.CreatedByUserId.Value,
                Title = $"Crop rejected: {crop.Name}",
                Message = $"Your submitted crop '{crop.Name}' was rejected. Reason: {reason}",
                Type = "Warning",
                ActionUrl = $"/messages?userId={actorId.Value}",
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            };
            _db.Notifications.Add(note);
            await _hubContext.Clients.Group($"user-{crop.CreatedByUserId.Value}").SendAsync("ReceiveNotification", new
            {
                note.Id,
                note.Title,
                note.Message,
                note.Type,
                note.IsRead,
                note.CreatedAt,
                note.ActionUrl
            });
        }

        await _db.SaveChangesAsync();

        return Ok(new { crop.Id, crop.Name, message = $"Crop '{crop.Name}' rejected.", reason });
    }

    [HttpDelete("crops/{id:guid}")]
    [Authorize(Roles = "Government,Admin")]
    public async Task<IActionResult> DeleteCrop(Guid id)
    {
        var crop = await _db.CropCatalogs.FirstOrDefaultAsync(c => c.Id == id);
        if (crop == null) return NotFound("Crop not found.");
        if (crop.Status != "Rejected")
            return BadRequest("Only rejected crops can be deleted. Reject the crop first.");

        _db.CropCatalogs.Remove(crop);
        await _db.SaveChangesAsync();

        return Ok(new { message = $"Crop '{crop.Name}' permanently deleted from catalog." });
    }

    [HttpGet("crops/{id:guid}")]
    [Authorize(Roles = "Government,Admin")]
    public async Task<IActionResult> GetCropDetail(Guid id)
    {
        var crop = await _db.CropCatalogs.Include(c => c.CreatedByUser).FirstOrDefaultAsync(c => c.Id == id);
        if (crop == null) return NotFound("Crop not found.");

        var latestRejection = await _db.AuditLogs
            .Where(a => a.EntityType == "CropCatalog" && a.EntityId == crop.Id.ToString() && a.Action == "CropCatalogRejected")
            .OrderByDescending(a => a.Timestamp)
            .Select(a => new { a.Metadata, a.Timestamp, a.Actor })
            .FirstOrDefaultAsync();

        return Ok(new
        {
            crop.Id,
            crop.Name,
            crop.Status,
            crop.IsGovernmentRegistered,
            crop.RequiresGovernmentReview,
            crop.SourceRole,
            crop.CreatedAt,
            crop.UpdatedAt,
            RejectionReason = latestRejection != null ? latestRejection.Metadata : null,
            RejectedAt = latestRejection != null ? latestRejection.Timestamp : (DateTime?)null,
            RejectedBy = latestRejection != null ? latestRejection.Actor : null,
            SubmitterUserId = crop.CreatedByUserId,
            CreatedBy = crop.CreatedByUser != null ? new { crop.CreatedByUser.Id, crop.CreatedByUser.FullName, crop.CreatedByUser.Email } : null,
        });
    }

    [HttpGet("markets")]
    [AllowAnonymous]
    public async Task<IActionResult> GetMarkets(
        [FromQuery] string? province = null,
        [FromQuery] string? district = null,
        [FromQuery] string? sector = null)
    {
        var query = _db.RegisteredMarkets.Where(m => m.IsActive).AsQueryable();

        if (!string.IsNullOrWhiteSpace(province))
        {
            var normalizedProvince = RwandaAdminData.NormalizeProvince(province);
            if (normalizedProvince != null)
                query = query.Where(m => m.Province == normalizedProvince);
        }

        if (!string.IsNullOrWhiteSpace(district))
        {
            var normalizedDistrict = RwandaAdminData.FindDistrict(district);
            if (normalizedDistrict != null)
                query = query.Where(m => m.District == normalizedDistrict);
        }

        if (!string.IsNullOrWhiteSpace(sector))
        {
            var normalizedSector = RwandaAdminData.FindSector(district, sector);
            if (normalizedSector != null)
                query = query.Where(m => m.Sector == normalizedSector);
        }

        var markets = await query
            .OrderBy(m => m.Name)
            .Select(m => new
            {
                m.Id,
                m.Name,
                m.Province,
                m.District,
                m.Sector,
                m.Cell,
                m.Location,
                m.CreatedAt
            })
            .ToListAsync();

        return Ok(markets);
    }

    [HttpPost("markets")]
    [Authorize(Roles = "Government,Admin")]
    public async Task<IActionResult> CreateMarket(CreateRegisteredMarketRequest request)
    {
        var market = await _catalog.CreateMarketAsync(
            request.Name,
            request.Province,
            request.District,
            request.Sector,
            request.Cell,
            request.Location,
            GetUserId());

        return Ok(new { market.Id, market.Name, message = "Market registered successfully." });
    }

    private Guid? GetUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier) ?? User.FindFirst("sub");
        return Guid.TryParse(claim?.Value, out var id) ? id : null;
    }
}
