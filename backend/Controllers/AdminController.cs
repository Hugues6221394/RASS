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
[Authorize(Roles = "Admin")]
public class AdminController : ControllerBase
{
    private readonly AppDbContext _db;

    public AdminController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet("users")]
    public async Task<IActionResult> GetUsers()
    {
        var users = await _db.Users
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .Select(u => new
            {
                u.Id,
                u.FullName,
                u.Email,
                u.IsActive,
                Role = u.UserRoles.Select(r => r.Role.Name).FirstOrDefault() ?? "NoRole",
                Roles = u.UserRoles.Select(r => r.Role.Name).ToList()
            })
            .OrderByDescending(u => u.Id) // Order by ID as proxy for creation time
            .ToListAsync();

        return Ok(users);
    }

    [HttpPost("users")]
    public async Task<IActionResult> CreateUser([FromBody] CreateUserRequest request)
    {
        if (await _db.Users.AnyAsync(u => u.Email == request.Email))
        {
            return Conflict("User with this email already exists.");
        }

        var role = await _db.Roles.FirstOrDefaultAsync(r => r.Name == request.Role);
        if (role == null)
        {
            return BadRequest($"Role '{request.Role}' not found.");
        }

        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = request.Email,
            FullName = request.FullName,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password ?? "Pass@123"),
            IsActive = true
        };

        _db.Users.Add(user);
        _db.UserRoles.Add(new UserRole { UserId = user.Id, RoleId = role.Id });
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetUsers), new { id = user.Id }, new
        {
            user.Id,
            user.FullName,
            user.Email,
            user.IsActive,
            Role = request.Role
        });
    }

    [HttpDelete("users/{userId}")]
    public async Task<IActionResult> DeleteUser(Guid userId)
    {
        var user = await _db.Users.FindAsync(userId);
        if (user == null) return NotFound();

        // Remove user roles first
        var userRoles = await _db.UserRoles.Where(ur => ur.UserId == userId).ToListAsync();
        _db.UserRoles.RemoveRange(userRoles);

        _db.Users.Remove(user);
        await _db.SaveChangesAsync();

        return Ok(new { message = "User deleted successfully" });
    }

    [HttpGet("system-stats")]
    public async Task<IActionResult> GetSystemStats()
    {
        var stats = new
        {
            TotalUsers = await _db.Users.CountAsync(),
            ActiveUsers = await _db.Users.CountAsync(u => u.IsActive),
            TotalContracts = await _db.Contracts.CountAsync(),
            TotalTransactions = await _db.PaymentLedgers.CountAsync(),
            TotalRevenue = await _db.PaymentLedgers
                .Where(p => p.Status == "Completed")
                .SumAsync(p => (decimal?)p.Amount) ?? 0
        };

        return Ok(stats);
    }

    [HttpGet("roles")]
    public async Task<IActionResult> GetRoles()
    {
        var roles = await _db.Roles.Select(r => new { r.Id, r.Name }).ToListAsync();
        return Ok(roles);
    }

    [HttpPost("user/{userId}/suspend")]
    public async Task<IActionResult> SuspendUser(Guid userId, SuspendUserRequest request)
    {
        var user = await _db.Users.FindAsync(userId);
        if (user == null) return NotFound();

        user.IsActive = false;
        await _db.SaveChangesAsync();

        await _db.AuditLogs.AddAsync(new AuditLog
        {
            Id = Guid.NewGuid(),
            Action = "UserSuspended",
            Actor = "Admin",
            Metadata = $"User {user.Email} suspended. Reason: {request.Reason}"
        });

        await _db.SaveChangesAsync();

        return Ok(new { user.Id, user.IsActive });
    }

    [HttpPost("user/{userId}/activate")]
    public async Task<IActionResult> ActivateUser(Guid userId)
    {
        var user = await _db.Users.FindAsync(userId);
        if (user == null) return NotFound();

        user.IsActive = true;
        await _db.SaveChangesAsync();

        await _db.AuditLogs.AddAsync(new AuditLog
        {
            Id = Guid.NewGuid(),
            Action = "UserActivated",
            Actor = "Admin",
            Metadata = $"User {user.Email} activated"
        });

        await _db.SaveChangesAsync();

        return Ok(new { user.Id, user.IsActive });
    }

    [HttpGet("cooperatives/pending")]
    public async Task<IActionResult> GetPendingCooperatives()
    {
        var cooperatives = await _db.Cooperatives
            .Where(c => !c.IsVerified)
            .Select(c => new
            {
                c.Id,
                c.Name,
                c.Region,
                c.District,
                c.Location,
                c.Phone,
                c.Email,
                c.CreatedAt,
                FarmerCount = c.Farmers.Count
            })
            .ToListAsync();

        return Ok(cooperatives);
    }

    [HttpPost("cooperative/{cooperativeId}/verify")]
    public async Task<IActionResult> VerifyCooperative(Guid cooperativeId, VerifyEntityRequest request)
    {
        var cooperative = await _db.Cooperatives.FindAsync(cooperativeId);
        if (cooperative == null) return NotFound();

        cooperative.IsVerified = request.Approved;
        cooperative.IsActive = request.Approved;
        await _db.SaveChangesAsync();

        await _db.AuditLogs.AddAsync(new AuditLog
        {
            Id = Guid.NewGuid(),
            Action = request.Approved ? "CooperativeVerified" : "CooperativeRejected",
            Actor = "Admin",
            Metadata = $"Cooperative {cooperative.Name} {(request.Approved ? "verified" : "rejected")}. Notes: {request.Notes}"
        });

        await _db.SaveChangesAsync();

        return Ok(new { cooperative.Id, cooperative.IsVerified });
    }

    [HttpGet("buyers/pending")]
    public async Task<IActionResult> GetPendingBuyers()
    {
        var buyers = await _db.BuyerProfiles
            .Include(b => b.User)
            .Where(b => !b.IsVerified)
            .Select(b => new
            {
                b.Id,
                b.User.FullName,
                b.User.Email,
                b.Organization,
                b.BusinessType,
                b.Location,
                b.Phone,
                b.CreatedAt,
                OrderCount = b.Orders.Count
            })
            .ToListAsync();

        return Ok(buyers);
    }

    [HttpPost("buyer/{buyerId}/verify")]
    public async Task<IActionResult> VerifyBuyer(Guid buyerId, VerifyEntityRequest request)
    {
        var buyer = await _db.BuyerProfiles
            .Include(b => b.User)
            .FirstOrDefaultAsync(b => b.Id == buyerId);

        if (buyer == null) return NotFound();

        buyer.IsVerified = request.Approved;
        buyer.IsActive = request.Approved;
        await _db.SaveChangesAsync();

        await _db.AuditLogs.AddAsync(new AuditLog
        {
            Id = Guid.NewGuid(),
            Action = request.Approved ? "BuyerVerified" : "BuyerRejected",
            Actor = "Admin",
            Metadata = $"Buyer {buyer.User.Email} ({buyer.Organization}) {(request.Approved ? "verified" : "rejected")}. Notes: {request.Notes}"
        });

        await _db.SaveChangesAsync();

        return Ok(new { buyer.Id, buyer.IsVerified });
    }

    [HttpGet("transporters/pending")]
    public async Task<IActionResult> GetPendingTransporters()
    {
        var transporters = await _db.TransporterProfiles
            .Include(t => t.User)
            .Where(t => !t.IsVerified)
            .Select(t => new
            {
                t.Id,
                t.User.FullName,
                t.User.Email,
                t.CompanyName,
                t.LicenseNumber,
                t.VehicleType,
                t.CapacityKg,
                t.CreatedAt,
                JobCount = t.TransportRequests.Count
            })
            .ToListAsync();

        return Ok(transporters);
    }

    [HttpPost("transporter/{transporterId}/verify")]
    public async Task<IActionResult> VerifyTransporter(Guid transporterId, VerifyEntityRequest request)
    {
        var transporter = await _db.TransporterProfiles
            .Include(t => t.User)
            .FirstOrDefaultAsync(t => t.Id == transporterId);

        if (transporter == null) return NotFound();

        transporter.IsVerified = request.Approved;
        transporter.IsActive = request.Approved;
        await _db.SaveChangesAsync();

        await _db.AuditLogs.AddAsync(new AuditLog
        {
            Id = Guid.NewGuid(),
            Action = request.Approved ? "TransporterVerified" : "TransporterRejected",
            Actor = "Admin",
            Metadata = $"Transporter {transporter.User.Email} ({transporter.CompanyName}) {(request.Approved ? "verified" : "rejected")}. Notes: {request.Notes}"
        });

        await _db.SaveChangesAsync();

        return Ok(new { transporter.Id, transporter.IsVerified });
    }

    [HttpGet("dashboard")]
    public async Task<IActionResult> GetDashboard()
    {
        var dashboard = new
        {
            Users = new
            {
                Total = await _db.Users.CountAsync(),
                Active = await _db.Users.CountAsync(u => u.IsActive),
                ByRole = await _db.UserRoles
                    .Include(ur => ur.Role)
                    .GroupBy(ur => ur.Role.Name)
                    .Select(g => new { Role = g.Key, Count = g.Count() })
                    .ToListAsync()
            },
            Cooperatives = new
            {
                Total = await _db.Cooperatives.CountAsync(),
                Verified = await _db.Cooperatives.CountAsync(c => c.IsVerified),
                Farmers = await _db.Farmers.CountAsync()
            },
            Buyers = new
            {
                Total = await _db.BuyerProfiles.CountAsync(),
                Verified = await _db.BuyerProfiles.CountAsync(b => b.IsVerified),
                Orders = await _db.BuyerOrders.CountAsync()
            },
            Transporters = new
            {
                Total = await _db.TransporterProfiles.CountAsync(),
                Verified = await _db.TransporterProfiles.CountAsync(t => t.IsVerified),
                Jobs = await _db.TransportRequests.CountAsync()
            },
            Market = new
            {
                ActiveListings = await _db.MarketListings.CountAsync(l => l.Status == "Active"),
                TotalVolume = await _db.Lots.SumAsync(l => l.QuantityKg),
                Contracts = await _db.Contracts.CountAsync(),
                Revenue = await _db.PaymentLedgers
                    .Where(p => p.Status == "Completed")
                    .SumAsync(p => p.Amount)
            }
        };

        return Ok(dashboard);
    }

    [HttpGet("market-prices")]
    public async Task<IActionResult> GetMarketPrices(GetMarketPricesRequest request)
    {
        var query = _db.MarketPrices.AsQueryable();

        if (!string.IsNullOrEmpty(request.Crop))
        {
            query = query.Where(p => p.Crop.Contains(request.Crop));
        }

        if (!string.IsNullOrEmpty(request.Market))
        {
            query = query.Where(p => p.Market.Contains(request.Market));
        }

        if (request.Days.HasValue)
        {
            var cutoff = DateTime.UtcNow.AddDays(-request.Days.Value);
            query = query.Where(p => p.ObservedAt >= cutoff);
        }

        var prices = await query
            .OrderByDescending(p => p.ObservedAt)
            .Select(p => new
            {
                p.Id,
                p.Market,
                p.Crop,
                p.ObservedAt,
                p.PricePerKg,
                Agent = p.AgentId.HasValue ? "MarketAgent" : "System"
            })
            .ToListAsync();

        return Ok(prices);
    }

    [HttpGet("audit-logs")]
    public async Task<IActionResult> GetAuditLogs(GetAuditLogsRequest request)
    {
        var query = _db.AuditLogs.AsQueryable();

        if (!string.IsNullOrEmpty(request.Action))
        {
            query = query.Where(l => l.Action.Contains(request.Action));
        }

        if (!string.IsNullOrEmpty(request.Actor))
        {
            query = query.Where(l => l.Actor.Contains(request.Actor));
        }

        if (request.Days.HasValue)
        {
            var cutoff = DateTime.UtcNow.AddDays(-request.Days.Value);
            query = query.Where(l => l.Timestamp >= cutoff);
        }

        var logs = await query
            .OrderByDescending(l => l.Timestamp)
            .Take(1000)
            .Select(l => new
            {
                l.Id,
                l.Action,
                l.Actor,
                l.Metadata,
                l.Timestamp
            })
            .ToListAsync();

        return Ok(logs);
    }

    [HttpPost("system-config")]
    public async Task<IActionResult> UpdateSystemConfig(UpdateSystemConfigRequest request)
    {
        // In a real system, this would update configuration settings
        // For now, just log the change

        await _db.AuditLogs.AddAsync(new AuditLog
        {
            Id = Guid.NewGuid(),
            Action = "SystemConfigUpdated",
            Actor = "Admin",
            Metadata = $"System configuration updated: {request.ConfigKey} = {request.ConfigValue}"
        });

        await _db.SaveChangesAsync();

        return Ok(new { message = "Configuration updated successfully" });
    }

    // ========== FARMER CRUD OPERATIONS ==========
    [HttpGet("farmers")]
    public async Task<IActionResult> GetAllFarmers()
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
                f.NationalId,
                f.District,
                f.Sector,
                f.Crops,
                f.FarmSizeHectares,
                f.IsActive,
                f.CreatedAt,
                Cooperative = f.Cooperative != null ? new { f.Cooperative.Id, f.Cooperative.Name } : null
            })
            .OrderByDescending(f => f.CreatedAt)
            .ToListAsync();

        return Ok(farmers);
    }

    [HttpPut("farmers/{farmerId}")]
    public async Task<IActionResult> UpdateFarmer(Guid farmerId, RegisterFarmerRequest request)
    {
        var farmer = await _db.Farmers
            .Include(f => f.User)
            .FirstOrDefaultAsync(f => f.Id == farmerId);

        if (farmer == null) return NotFound();

        farmer.User.FullName = request.FullName;
        farmer.User.Email = request.Email;
        farmer.Phone = request.Phone;
        farmer.District = request.District;
        farmer.Sector = request.Sector;
        farmer.NationalId = request.NationalId;
        farmer.Crops = request.Crops;
        farmer.FarmSizeHectares = request.FarmSizeHectares;
        farmer.CooperativeId = request.CooperativeId;

        await _db.SaveChangesAsync();
        return Ok(new { message = "Farmer updated successfully", farmer.Id });
    }

    [HttpDelete("farmers/{farmerId}")]
    public async Task<IActionResult> DeleteFarmer(Guid farmerId)
    {
        var farmer = await _db.Farmers
            .Include(f => f.User)
            .FirstOrDefaultAsync(f => f.Id == farmerId);

        if (farmer == null) return NotFound();

        // Soft delete
        farmer.IsActive = false;
        farmer.User.IsActive = false;
        await _db.SaveChangesAsync();

        return Ok(new { message = "Farmer deactivated successfully" });
    }

    // ========== COOPERATIVE CRUD OPERATIONS ==========
    [HttpGet("cooperatives")]
    public async Task<IActionResult> GetAllCooperatives()
    {
        var cooperatives = await _db.Cooperatives
            .Include(c => c.Manager)
            .Select(c => new
            {
                c.Id,
                c.Name,
                c.Region,
                c.District,
                c.Location,
                c.Phone,
                c.Email,
                c.IsVerified,
                c.IsActive,
                c.CreatedAt,
                Manager = c.Manager != null ? new { c.Manager.Id, c.Manager.FullName, c.Manager.Email } : null,
                FarmerCount = c.Farmers.Count,
                LotCount = c.Lots.Count
            })
            .OrderByDescending(c => c.CreatedAt)
            .ToListAsync();

        return Ok(cooperatives);
    }

    [HttpPut("cooperatives/{cooperativeId}")]
    public async Task<IActionResult> UpdateCooperative(Guid cooperativeId, CreateCooperativeRequest request)
    {
        var cooperative = await _db.Cooperatives.FindAsync(cooperativeId);
        if (cooperative == null) return NotFound();

        cooperative.Name = request.Name;
        cooperative.Region = request.Region;
        cooperative.District = request.District;
        cooperative.Location = request.Location;
        cooperative.Phone = request.Phone;
        cooperative.Email = request.Email;

        await _db.SaveChangesAsync();
        return Ok(new { message = "Cooperative updated successfully", cooperative.Id });
    }

    [HttpPost("cooperatives/{cooperativeId}/assign-manager")]
    public async Task<IActionResult> AssignManager(Guid cooperativeId, AssignManagerRequest request)
    {
        var cooperative = await _db.Cooperatives.FindAsync(cooperativeId);
        if (cooperative == null) return NotFound();

        var manager = await _db.Users
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.Id == request.ManagerId);

        if (manager == null) return NotFound("Manager user not found");

        // Ensure user has CooperativeManager role
        var managerRole = await _db.Roles.FirstOrDefaultAsync(r => r.Name == "CooperativeManager");
        if (managerRole == null) return BadRequest("CooperativeManager role not found");

        var hasRole = manager.UserRoles.Any(ur => ur.RoleId == managerRole.Id);
        if (!hasRole)
        {
            _db.UserRoles.Add(new UserRole { UserId = manager.Id, RoleId = managerRole.Id });
        }

        cooperative.ManagerId = request.ManagerId;
        await _db.SaveChangesAsync();

        return Ok(new { message = "Manager assigned successfully", cooperative.Id, Manager = new { manager.Id, manager.FullName } });
    }

    [HttpDelete("cooperatives/{cooperativeId}")]
    public async Task<IActionResult> DeleteCooperative(Guid cooperativeId)
    {
        var cooperative = await _db.Cooperatives.FindAsync(cooperativeId);
        if (cooperative == null) return NotFound();

        cooperative.IsActive = false;
        await _db.SaveChangesAsync();

        return Ok(new { message = "Cooperative deactivated successfully" });
    }

    // ========== BUYER CRUD OPERATIONS ==========
    [HttpGet("buyers")]
    public async Task<IActionResult> GetAllBuyers()
    {
        var buyers = await _db.BuyerProfiles
            .Include(b => b.User)
            .Select(b => new
            {
                b.Id,
                b.User.FullName,
                b.User.Email,
                b.Organization,
                b.BusinessType,
                b.Location,
                b.Phone,
                b.TaxId,
                b.IsVerified,
                b.IsActive,
                b.CreatedAt,
                OrderCount = b.Orders.Count
            })
            .OrderByDescending(b => b.CreatedAt)
            .ToListAsync();

        return Ok(buyers);
    }

    [HttpPut("buyers/{buyerId}")]
    public async Task<IActionResult> UpdateBuyer(Guid buyerId, CreateBuyerRequest request)
    {
        var buyer = await _db.BuyerProfiles
            .Include(b => b.User)
            .FirstOrDefaultAsync(b => b.Id == buyerId);

        if (buyer == null) return NotFound();

        buyer.User.FullName = request.FullName;
        buyer.User.Email = request.Email;
        buyer.Organization = request.Organization;
        buyer.BusinessType = request.BusinessType;
        buyer.Location = request.Location;
        buyer.Phone = request.Phone;
        buyer.TaxId = request.TaxId;

        await _db.SaveChangesAsync();
        return Ok(new { message = "Buyer updated successfully", buyer.Id });
    }

    [HttpDelete("buyers/{buyerId}")]
    public async Task<IActionResult> DeleteBuyer(Guid buyerId)
    {
        var buyer = await _db.BuyerProfiles
            .Include(b => b.User)
            .FirstOrDefaultAsync(b => b.Id == buyerId);

        if (buyer == null) return NotFound();

        buyer.IsActive = false;
        buyer.User.IsActive = false;
        await _db.SaveChangesAsync();

        return Ok(new { message = "Buyer deactivated successfully" });
    }

    // ========== TRANSPORTER CRUD OPERATIONS ==========
    [HttpGet("transporters")]
    public async Task<IActionResult> GetAllTransporters()
    {
        var transporters = await _db.TransporterProfiles
            .Include(t => t.User)
            .Select(t => new
            {
                t.Id,
                t.User.FullName,
                t.User.Email,
                t.CompanyName,
                t.LicenseNumber,
                t.Phone,
                t.VehicleType,
                t.LicensePlate,
                t.CapacityKg,
                t.OperatingRegions,
                t.IsVerified,
                t.IsActive,
                t.CreatedAt,
                JobCount = t.TransportRequests.Count
            })
            .OrderByDescending(t => t.CreatedAt)
            .ToListAsync();

        return Ok(transporters);
    }

    [HttpPut("transporters/{transporterId}")]
    public async Task<IActionResult> UpdateTransporter(Guid transporterId, CreateTransporterRequest request)
    {
        var transporter = await _db.TransporterProfiles
            .Include(t => t.User)
            .FirstOrDefaultAsync(t => t.Id == transporterId);

        if (transporter == null) return NotFound();

        transporter.User.FullName = request.ContactPerson;
        transporter.User.Email = request.Email;
        transporter.CompanyName = request.CompanyName;
        transporter.LicenseNumber = request.LicenseNumber;
        transporter.Phone = request.Phone;
        transporter.CapacityKg = request.CapacityKg;
        transporter.VehicleType = request.VehicleType;
        transporter.LicensePlate = request.LicensePlate;
        transporter.OperatingRegions = string.Join(",", request.OperatingRegions);

        await _db.SaveChangesAsync();
        return Ok(new { message = "Transporter updated successfully", transporter.Id });
    }

    [HttpDelete("transporters/{transporterId}")]
    public async Task<IActionResult> DeleteTransporter(Guid transporterId)
    {
        var transporter = await _db.TransporterProfiles
            .Include(t => t.User)
            .FirstOrDefaultAsync(t => t.Id == transporterId);

        if (transporter == null) return NotFound();

        transporter.IsActive = false;
        transporter.User.IsActive = false;
        await _db.SaveChangesAsync();

        return Ok(new { message = "Transporter deactivated successfully" });
    }
}

