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
public class FarmersController : ControllerBase
{
    private readonly AppDbContext _db;

    public FarmersController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    [Authorize(Roles = "Admin,CooperativeManager,Government")]
    public async Task<IActionResult> GetFarmers()
    {
        var farmers = await _db.Farmers
            .Include(f => f.User)
            .Include(f => f.Cooperative)
            .Select(f => new
            {
                f.Id,
                f.User.FullName,
                f.User.Email,
                f.Phone,
                f.District,
                f.Sector,
                f.Crops,
                f.FarmSizeHectares,
                f.IsActive,
                Cooperative = f.Cooperative != null ? f.Cooperative.Name : null
            }).ToListAsync();

        return Ok(farmers);
    }

    [HttpGet("profile")]
    [Authorize(Roles = "Farmer")]
    public async Task<IActionResult> GetFarmerProfile()
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var farmer = await _db.Farmers
            .Include(f => f.User)
            .Include(f => f.Cooperative)
            .FirstOrDefaultAsync(f => f.UserId == userId.Value);

        if (farmer == null) return NotFound();

        return Ok(new
        {
            farmer.Id,
            farmer.User.FullName,
            farmer.User.Email,
            farmer.Phone,
            farmer.NationalId,
            farmer.District,
            farmer.Sector,
            farmer.Crops,
            farmer.FarmSizeHectares,
            Cooperative = farmer.Cooperative != null ? new
            {
                farmer.Cooperative.Id,
                farmer.Cooperative.Name,
                farmer.Cooperative.Location
            } : null
        });
    }

    [HttpPost("register")]
    [Authorize(Roles = "Admin,CooperativeManager")]
    public async Task<IActionResult> RegisterFarmer(RegisterFarmerRequest request)
    {
        if (await _db.Users.AnyAsync(u => u.Email == request.Email))
        {
            return Conflict("User already exists.");
        }

        var farmerRole = await _db.Roles.FirstAsync(r => r.Name == "Farmer");

        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = request.Email,
            FullName = request.FullName,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("Pass@123")
        };

        var farmer = new Farmer
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            CooperativeId = request.CooperativeId,
            District = request.District,
            Sector = request.Sector,
            Phone = request.Phone,
            NationalId = request.NationalId,
            Crops = request.Crops,
            FarmSizeHectares = request.FarmSizeHectares
        };

        _db.Users.Add(user);
        _db.Farmers.Add(farmer);
        _db.UserRoles.Add(new UserRole { UserId = user.Id, RoleId = farmerRole.Id });

        await _db.SaveChangesAsync();

        // Send SMS confirmation (mock implementation)
        await SendSmsConfirmation(farmer.Phone, farmer.User.FullName);

        return CreatedAtAction(nameof(GetFarmers), new { id = farmer.Id }, new { farmer.Id, user.FullName, user.Email });
    }

    [HttpPost("harvest-declaration")]
    [Authorize(Roles = "Farmer")]
    public async Task<IActionResult> DeclareHarvest(CreateHarvestDeclarationRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var farmer = await _db.Farmers.FirstOrDefaultAsync(f => f.UserId == userId.Value);
        if (farmer == null) return NotFound("Farmer not found");

        var declaration = new HarvestDeclaration
        {
            Id = Guid.NewGuid(),
            FarmerId = farmer.Id,
            Crop = request.Crop,
            ExpectedQuantityKg = request.ExpectedQuantityKg,
            ExpectedHarvestDate = request.ExpectedHarvestDate.Kind == DateTimeKind.Utc 
                ? request.ExpectedHarvestDate 
                : request.ExpectedHarvestDate.ToUniversalTime(),
            QualityIndicators = request.QualityIndicators,
            Status = "Pending"
        };

        _db.HarvestDeclarations.Add(declaration);
        await _db.SaveChangesAsync();

        // Notify cooperative manager
        if (farmer.CooperativeId.HasValue)
        {
            await NotifyCooperativeManager(farmer.CooperativeId.Value, declaration);
        }

        return Created("", new { declaration.Id, declaration.Status });
    }

    [HttpGet("harvest-declarations")]
    [Authorize(Roles = "Farmer,CooperativeManager")]
    public async Task<IActionResult> GetHarvestDeclarations()
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var query = _db.HarvestDeclarations
            .Include(d => d.Farmer)
            .ThenInclude(f => f.User)
            .Include(d => d.Farmer.Cooperative)
            .AsQueryable();

        if (User.IsInRole("Farmer"))
        {
            var farmer = await _db.Farmers.FirstOrDefaultAsync(f => f.UserId == userId.Value);
            if (farmer == null) return NotFound();
            query = query.Where(d => d.FarmerId == farmer.Id);
        }
        else if (User.IsInRole("CooperativeManager"))
        {
            var cooperative = await _db.Cooperatives
                .FirstOrDefaultAsync(c => c.ManagerId == userId.Value);
            if (cooperative != null)
            {
                query = query.Where(d => d.Farmer.CooperativeId == cooperative.Id);
            }
        }

        var declarations = await query
            .OrderByDescending(d => d.CreatedAt)
            .Select(d => new
            {
                d.Id,
                d.Crop,
                d.ExpectedQuantityKg,
                d.ExpectedHarvestDate,
                d.QualityIndicators,
                d.Status,
                d.CreatedAt,
                Farmer = new
                {
                    d.Farmer.User.FullName,
                    d.Farmer.Phone
                },
                Cooperative = d.Farmer.Cooperative != null ? d.Farmer.Cooperative.Name : null
            })
            .ToListAsync();

        return Ok(declarations);
    }

    [HttpPost("harvest-declaration/{id}/review")]
    [Authorize(Roles = "CooperativeManager")]
    public async Task<IActionResult> ReviewHarvestDeclaration(Guid id, ReviewHarvestDeclarationRequest request)
    {
        var declaration = await _db.HarvestDeclarations
            .Include(d => d.Farmer)
            .ThenInclude(f => f.Cooperative)
            .FirstOrDefaultAsync(d => d.Id == id);

        if (declaration == null) return NotFound();

        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var cooperative = await _db.Cooperatives
            .FirstOrDefaultAsync(c => c.ManagerId == userId.Value);

        if (cooperative == null || declaration.Farmer.CooperativeId != cooperative.Id)
        {
            return Forbid("You can only review declarations from your cooperative");
        }

        declaration.Status = request.Status;
        declaration.ReviewedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        return Ok(new { declaration.Id, declaration.Status });
    }

    private Guid? GetUserId()
    {
        var claim = User.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier") ??
                   User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
        return Guid.TryParse(claim?.Value, out var guid) ? guid : null;
    }

    private async Task SendSmsConfirmation(string phone, string name)
    {
        // Mock SMS implementation - in real system would integrate with SMS service
        Console.WriteLine($"SMS sent to {phone}: Welcome {name}! Your RASS account has been created.");
    }

    private async Task NotifyCooperativeManager(Guid cooperativeId, HarvestDeclaration declaration)
    {
        // Mock notification - in real system would send email/SMS to cooperative manager
        Console.WriteLine($"Notification sent to cooperative {cooperativeId}: New harvest declaration from {declaration.Farmer.User.FullName}");
    }
}

