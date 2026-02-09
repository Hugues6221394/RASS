using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Rass.Api.Data;

namespace Rass.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ReferenceController : ControllerBase
{
    private readonly AppDbContext _db;

    public ReferenceController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet("crops")]
    [AllowAnonymous]
    public async Task<IActionResult> GetCrops()
    {
        var crops = await _db.Lots.Select(l => l.Crop)
            .Union(_db.MarketPrices.Select(m => m.Crop))
            .Distinct()
            .OrderBy(c => c)
            .ToListAsync();
        return Ok(crops);
    }

    [HttpGet("markets")]
    [AllowAnonymous]
    public async Task<IActionResult> GetMarkets()
    {
        var markets = await _db.MarketPrices.Select(m => m.Market)
            .Union(_db.StorageFacilities.Select(s => s.Location))
            .Distinct()
            .OrderBy(m => m)
            .ToListAsync();
        return Ok(markets);
    }

    [HttpGet("storage-facilities")]
    [AllowAnonymous]
    public async Task<IActionResult> GetStorageFacilities()
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
}

