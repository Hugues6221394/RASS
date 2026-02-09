using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Rass.Api.Data;
using Rass.Api.Domain.Entities;
using Rass.Api.Dtos;

namespace Rass.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class LotsController : ControllerBase
{
    private readonly AppDbContext _db;

    public LotsController(AppDbContext db)
    {
        _db = db;
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

        var lot = new Lot
        {
            Id = Guid.NewGuid(),
            Crop = request.Crop,
            QuantityKg = request.QuantityKg,
            QualityGrade = string.IsNullOrWhiteSpace(request.QualityGrade) ? "A" : request.QualityGrade,
            ExpectedHarvestDate = request.ExpectedHarvestDate == default ? DateTime.UtcNow.AddDays(3) : request.ExpectedHarvestDate,
            Status = "Listed",
            Verified = User.IsInRole("CooperativeManager") || User.IsInRole("Admin")
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

        return CreatedAtAction(nameof(GetLots), new { id = lot.Id }, lot);
    }

    private Guid? GetUserId()
    {
        var sub = User.FindFirstValue(JwtRegisteredClaimNames.Sub) ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(sub, out var guid) ? guid : null;
    }
}

