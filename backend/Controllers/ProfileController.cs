using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
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
[Authorize]
public class ProfileController : ControllerBase
{
    private readonly AppDbContext _db;

    public ProfileController(AppDbContext db)
    {
        _db = db;
    }

    private Guid? GetUserId()
    {
        var claim = User.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier") ??
                   User.FindFirst(ClaimTypes.NameIdentifier);
        return Guid.TryParse(claim?.Value, out var guid) ? guid : null;
    }

    [HttpGet]
    public async Task<IActionResult> GetProfile()
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var user = await _db.Users
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.Id == userId.Value);

        if (user == null) return NotFound();

        var roles = user.UserRoles.Select(ur => ur.Role.Name).ToList();
        var primaryRole = roles.FirstOrDefault() ?? "User";

        // Get role-specific profile data
        object? profileData = null;

        if (roles.Contains("Farmer"))
        {
            var farmer = await _db.Farmers
                .Include(f => f.Cooperative)
                .FirstOrDefaultAsync(f => f.UserId == userId.Value);
            
            if (farmer != null)
            {
                profileData = new
                {
                    farmer.Id,
                    farmer.Phone,
                    farmer.District,
                    farmer.Sector,
                    farmer.Crops,
                    farmer.NationalId,
                    farmer.FarmSizeHectares,
                    farmer.IsActive,
                    Cooperative = farmer.Cooperative != null ? new
                    {
                        farmer.Cooperative.Id,
                        farmer.Cooperative.Name,
                        farmer.Cooperative.Location
                    } : null
                };
            }
        }
        else if (roles.Contains("Buyer"))
        {
            var buyer = await _db.BuyerProfiles
                .FirstOrDefaultAsync(b => b.UserId == userId.Value);
            
            if (buyer != null)
            {
                profileData = new
                {
                    buyer.Id,
                    buyer.Organization,
                    buyer.BusinessType,
                    buyer.Location,
                    buyer.Phone,
                    buyer.TaxId,
                    buyer.IsVerified,
                    buyer.IsActive,
                    OrderCount = await _db.BuyerOrders.CountAsync(o => o.BuyerProfileId == buyer.Id),
                    ActiveOrders = await _db.BuyerOrders.CountAsync(o => o.BuyerProfileId == buyer.Id && (o.Status == "Open" || o.Status == "Accepted"))
                };
            }
        }
        else if (roles.Contains("Transporter"))
        {
            var transporter = await _db.TransporterProfiles
                .FirstOrDefaultAsync(t => t.UserId == userId.Value);
            
            if (transporter != null)
            {
                profileData = new
                {
                    transporter.Id,
                    transporter.CompanyName,
                    transporter.VehicleType,
                    transporter.LicensePlate,
                    transporter.CapacityKg,
                    transporter.Phone,
                    transporter.LicenseNumber,
                    OperatingRegions = transporter.OperatingRegions.Split(',', StringSplitOptions.RemoveEmptyEntries),
                    transporter.IsVerified,
                    transporter.IsActive
                };
            }
        }
        else if (roles.Contains("CooperativeManager"))
        {
            var cooperative = await _db.Cooperatives
                .FirstOrDefaultAsync(c => c.Farmers.Any(f => f.UserId == userId.Value));
            
            if (cooperative != null)
            {
                profileData = new
                {
                    cooperative.Id,
                    cooperative.Name,
                    cooperative.Region,
                    cooperative.District,
                    cooperative.Location,
                    cooperative.Phone,
                    cooperative.Email,
                    cooperative.IsVerified,
                    cooperative.IsActive
                };
            }
        }

        return Ok(new
        {
            user.Id,
            user.FullName,
            user.Email,
            user.IsActive,
            Roles = roles,
            Profile = profileData
        });
    }

    [HttpPut]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var user = await _db.Users
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.Id == userId.Value);

        if (user == null) return NotFound();

        var roles = user.UserRoles.Select(ur => ur.Role.Name).ToList();

        // Update role-specific profile
        if (roles.Contains("Farmer"))
        {
            var farmer = await _db.Farmers.FirstOrDefaultAsync(f => f.UserId == userId.Value);
            if (farmer != null)
            {
                if (!string.IsNullOrEmpty(request.Phone)) farmer.Phone = request.Phone;
                if (!string.IsNullOrEmpty(request.District)) farmer.District = request.District;
                if (!string.IsNullOrEmpty(request.Sector)) farmer.Sector = request.Sector;
                if (!string.IsNullOrEmpty(request.Crops)) farmer.Crops = request.Crops;
            }
        }
        else if (roles.Contains("Buyer"))
        {
            var buyer = await _db.BuyerProfiles.FirstOrDefaultAsync(b => b.UserId == userId.Value);
            if (buyer != null)
            {
                if (!string.IsNullOrEmpty(request.Organization)) buyer.Organization = request.Organization;
                if (!string.IsNullOrEmpty(request.BusinessType)) buyer.BusinessType = request.BusinessType;
                if (!string.IsNullOrEmpty(request.Location)) buyer.Location = request.Location;
                if (!string.IsNullOrEmpty(request.Phone)) buyer.Phone = request.Phone;
            }
        }
        else if (roles.Contains("Transporter"))
        {
            var transporter = await _db.TransporterProfiles.FirstOrDefaultAsync(t => t.UserId == userId.Value);
            if (transporter != null)
            {
                if (!string.IsNullOrEmpty(request.CompanyName)) transporter.CompanyName = request.CompanyName;
                if (!string.IsNullOrEmpty(request.VehicleType)) transporter.VehicleType = request.VehicleType;
                if (!string.IsNullOrEmpty(request.VehiclePlate)) transporter.LicensePlate = request.VehiclePlate;
                if (request.CapacityKg.HasValue) transporter.CapacityKg = request.CapacityKg.Value;
                if (!string.IsNullOrEmpty(request.Phone)) transporter.Phone = request.Phone;
                // Note: IsActive is used instead of IsAvailable
            }
        }

        await _db.SaveChangesAsync();
        return Ok(new { message = "Profile updated successfully" });
    }

    [HttpPut("password")]
    public async Task<IActionResult> UpdatePassword([FromBody] UpdatePasswordRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var user = await _db.Users.FindAsync(userId.Value);
        if (user == null) return NotFound();

        if (!BCrypt.Net.BCrypt.Verify(request.CurrentPassword, user.PasswordHash))
        {
            return BadRequest("Current password is incorrect.");
        }

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        await _db.SaveChangesAsync();

        return Ok(new { message = "Password updated successfully" });
    }

    [HttpPost("deactivate")]
    public async Task<IActionResult> DeactivateAccount()
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var user = await _db.Users.FindAsync(userId.Value);
        if (user == null) return NotFound();

        user.IsActive = false;
        await _db.SaveChangesAsync();

        return Ok(new { message = "Account deactivated successfully" });
    }

    [HttpPost("otp/enable")]
    public async Task<IActionResult> EnableOtp([FromBody] EnableOtpRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        // In a real implementation, this would store OTP preference
        // For now, just return success
        return Ok(new { message = $"OTP {(request.Enable ? "enabled" : "disabled")} successfully" });
    }
}

