using System.IdentityModel.Tokens.Jwt;
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
[Route("api/[controller]")]
public class LotsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IHubContext<NotificationHub> _hubContext;
    private readonly CatalogManagementService _catalog;

    public LotsController(AppDbContext db, IHubContext<NotificationHub> hubContext, CatalogManagementService catalog)
    {
        _db = db;
        _hubContext = hubContext;
        _catalog = catalog;
    }

    [HttpGet]
    [Authorize]
    public async Task<IActionResult> GetLots()
    {
        var lots = await _db.Lots
            .Include(l => l.Farmer).ThenInclude(f => f!.User)
            .Include(l => l.Cooperative)
            .Select(l => new
            {
                l.Id,
                l.FarmerId,
                l.Crop,
                l.QuantityKg,
                l.QualityGrade,
                l.Status,
                l.ExpectedHarvestDate,
                l.Verified,
                Cooperative = l.Cooperative != null ? l.Cooperative.Name : null,
                Farmer = l.Farmer != null && l.Farmer.User != null ? l.Farmer.User.FullName : null
            })
            .ToListAsync();

        return Ok(lots);
    }

    [HttpPost]
    [Authorize(Roles = "Farmer,CooperativeManager,Admin")]
    public async Task<IActionResult> CreateLot(CreateLotRequest request)
    {
        var userId = GetUserId();
        string cropName;
        try
        {
            cropName = await _catalog.EnsureCropAsync(request.Crop, userId, User.IsInRole("CooperativeManager") ? "CooperativeManager" : User.IsInRole("Admin") ? "Admin" : "Farmer", User.IsInRole("Government") || User.IsInRole("Admin"));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }

        var lot = new Lot
        {
            Id = Guid.NewGuid(),
            Crop = cropName,
            QuantityKg = request.QuantityKg,
            QualityGrade = string.IsNullOrWhiteSpace(request.QualityGrade) ? "A" : request.QualityGrade,
            ExpectedHarvestDate = request.ExpectedHarvestDate == default ? DateTime.UtcNow.AddDays(3) : request.ExpectedHarvestDate,
            Status = User.IsInRole("Farmer") ? "Submitted" : "Listed",
            Verified = User.IsInRole("CooperativeManager") || User.IsInRole("Admin"),
            MoisturePercent = request.MoisturePercent,
            StorageFacilityId = request.StorageFacilityId,
            ExpectedPricePerKg = request.ExpectedPricePerKg,
            Season = request.Season,
            ProductionMethod = request.ProductionMethod,
            LandAreaHectares = request.LandAreaHectares,
            HarvestedAt = request.HarvestDate,
            QualityNotes = request.QualityNotes
        };

        if (User.IsInRole("Farmer"))
        {
            var farmer = await _db.Farmers.FirstOrDefaultAsync(f => f.UserId == userId);
            if (farmer != null)
            {
                lot.FarmerId = farmer.Id;
                lot.CooperativeId = farmer.CooperativeId ?? request.CooperativeId;
            }
        }
        else
        {
            lot.CooperativeId = request.CooperativeId;
        }

        _db.Lots.Add(lot);
        await _db.SaveChangesAsync();

        if (User.IsInRole("Farmer") && lot.CooperativeId.HasValue)
        {
            var managerId = await _db.Cooperatives
                .Where(c => c.Id == lot.CooperativeId.Value && c.ManagerId != null)
                .Select(c => c.ManagerId!.Value)
                .FirstOrDefaultAsync();

            if (managerId != Guid.Empty)
            {
                var note = new Notification
                {
                    Id = Guid.NewGuid(),
                    UserId = managerId,
                    Title = "New inventory submission",
                    Message = $"{lot.Crop} inventory submission requires review.",
                    Type = "Info",
                    IsRead = false,
                    CreatedAt = DateTime.UtcNow,
                    ActionUrl = "/cooperative-dashboard"
                };
                _db.Notifications.Add(note);
                await _db.SaveChangesAsync();
                await _hubContext.Clients.Group($"user-{managerId}")
                    .SendAsync("ReceiveNotification", new
                    {
                        note.Id,
                        note.Title,
                        note.Message,
                        note.Type,
                        note.CreatedAt,
                        note.ActionUrl
                    });
            }
        }

        return CreatedAtAction(nameof(GetLots), new { id = lot.Id }, new { lot.Id, lot.Status, message = "Inventory submission created successfully." });
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Farmer,CooperativeManager,Admin")]
    public async Task<IActionResult> UpdateLot(Guid id, UpdateLotRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var lot = await _db.Lots
            .Include(l => l.Farmer)
            .Include(l => l.Cooperative)
            .FirstOrDefaultAsync(l => l.Id == id);
        if (lot == null) return NotFound("Lot not found");

        if (User.IsInRole("Farmer"))
        {
            var farmer = await _db.Farmers.FirstOrDefaultAsync(f => f.UserId == userId.Value);
            if (farmer == null || lot.FarmerId != farmer.Id) return Forbid();
            if (lot.Status is "Sold" or "Reserved") return BadRequest("Sold or reserved lots cannot be updated");
        }
        else if (User.IsInRole("CooperativeManager"))
        {
            var coop = await _db.Cooperatives.FirstOrDefaultAsync(c => c.ManagerId == userId.Value);
            if (coop == null || lot.CooperativeId != coop.Id) return Forbid();
            if (lot.Status != "Listed") return BadRequest("Only listed lots can be updated");
        }

        if (!string.IsNullOrWhiteSpace(request.Crop))
        {
            try
            {
                lot.Crop = await _catalog.EnsureCropAsync(request.Crop, userId, User.IsInRole("CooperativeManager") ? "CooperativeManager" : User.IsInRole("Admin") ? "Admin" : "Farmer", User.IsInRole("Government") || User.IsInRole("Admin"));
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }
        if (request.QuantityKg.HasValue && request.QuantityKg.Value > 0) lot.QuantityKg = request.QuantityKg.Value;
        if (!string.IsNullOrWhiteSpace(request.QualityGrade)) lot.QualityGrade = request.QualityGrade.Trim();
        if (request.ExpectedHarvestDate.HasValue) lot.ExpectedHarvestDate = request.ExpectedHarvestDate.Value;
        if (request.MoisturePercent.HasValue) lot.MoisturePercent = request.MoisturePercent.Value;
        if (request.ExpectedPricePerKg.HasValue) lot.ExpectedPricePerKg = request.ExpectedPricePerKg.Value;
        if (!string.IsNullOrWhiteSpace(request.Season)) lot.Season = request.Season.Trim();
        if (request.QualityNotes != null) lot.QualityNotes = request.QualityNotes.Trim();
        if (User.IsInRole("Farmer")) lot.Status = "Submitted";
        lot.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return Ok(new { lot.Id, message = "Lot updated" });
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Farmer,CooperativeManager,Admin")]
    public async Task<IActionResult> DeleteLot(Guid id)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var lot = await _db.Lots.FirstOrDefaultAsync(l => l.Id == id);
        if (lot == null) return NotFound("Lot not found");

        if (User.IsInRole("Farmer"))
        {
            var farmer = await _db.Farmers.FirstOrDefaultAsync(f => f.UserId == userId.Value);
            if (farmer == null || lot.FarmerId != farmer.Id) return Forbid();
            if (lot.Status is "Sold" or "Reserved") return BadRequest("Sold or reserved lots cannot be deleted");
        }
        else if (User.IsInRole("CooperativeManager"))
        {
            var coop = await _db.Cooperatives.FirstOrDefaultAsync(c => c.ManagerId == userId.Value);
            if (coop == null || lot.CooperativeId != coop.Id) return Forbid();
            if (lot.Status != "Listed") return BadRequest("Only listed lots can be deleted");
        }

        _db.Lots.Remove(lot);
        await _db.SaveChangesAsync();
        return Ok(new { message = "Lot deleted" });
    }

    private Guid? GetUserId()
    {
        var sub = User.FindFirstValue(JwtRegisteredClaimNames.Sub) ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(sub, out var guid) ? guid : null;
    }
}
