using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Rass.Api.Data;
using Rass.Api.Domain.Entities;
using Rass.Api.Dtos;
using Rass.Api.Hubs;
using Rass.Api.Services;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text.Json;

namespace Rass.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CooperativeController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IHubContext<NotificationHub> _hubContext;
    private readonly CatalogManagementService _catalog;

    public CooperativeController(AppDbContext db, IHubContext<NotificationHub> hubContext, CatalogManagementService catalog)
    {
        _db = db;
        _hubContext = hubContext;
        _catalog = catalog;
    }

    [HttpPost("register")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> RegisterCooperative(CreateCooperativeRequest request)
    {
        if (await _db.Cooperatives.AnyAsync(c => c.Name == request.Name))
        {
            return Conflict("Cooperative with this name already exists.");
        }

        var normalizedHierarchy = RwandaAdminData.NormalizeHierarchy(request.Region, request.District, request.Sector);
        if (normalizedHierarchy == null)
        {
            return BadRequest("Select a valid Province, District, and Sector combination for Rwanda.");
        }

        var cooperative = new Cooperative
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            Region = normalizedHierarchy.Value.Province,
            District = normalizedHierarchy.Value.District,
            Sector = normalizedHierarchy.Value.Sector,
            Cell = string.IsNullOrWhiteSpace(request.Cell) ? null : request.Cell.Trim(),
            Location = request.Location.Trim(),
            Phone = request.Phone.Trim(),
            Email = request.Email.Trim(),
            IsVerified = false,
            IsActive = true
        };

        _db.Cooperatives.Add(cooperative);
        await _db.SaveChangesAsync();

        return Created("", new { cooperative.Id, cooperative.Name });
    }

    [HttpGet]
    [Authorize]
    public async Task<IActionResult> GetCooperatives()
    {
        var cooperatives = await _db.Cooperatives
            .Select(c => new
            {
                c.Id,
                c.Name,
                c.Region,
                c.District,
                c.Sector,
                c.Cell,
                c.Location,
                c.Phone,
                c.Email,
                c.IsVerified,
                c.IsActive,
                FarmerCount = c.Farmers.Count,
                LotCount = c.Lots.Count
            })
            .ToListAsync();

        return Ok(cooperatives);
    }

    /// <summary>
    /// Public endpoint to browse cooperatives with filtering by region, district, sector, crop
    /// </summary>
    [HttpGet("browse")]
    [AllowAnonymous]
    public async Task<IActionResult> BrowseCooperatives(
        [FromQuery] string? region = null,
        [FromQuery] string? district = null,
        [FromQuery] string? sector = null,
        [FromQuery] string? crop = null)
    {
        var query = _db.Cooperatives
            .Where(c => c.IsActive && c.IsVerified)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(region))
            query = query.Where(c => c.Region == region);
        if (!string.IsNullOrWhiteSpace(district))
            query = query.Where(c => c.District == district);
        if (!string.IsNullOrWhiteSpace(sector))
            query = query.Where(c => c.Sector == sector);

        var coops = await query
            .Select(c => new
            {
                c.Id,
                c.Name,
                c.Region,
                c.District,
                c.Sector,
                c.Cell,
                c.Location,
                c.Phone,
                c.Email,
                FarmerCount = c.Farmers.Count,
                ActiveListings = c.MarketListings.Count(l => l.Status == "Active"),
                Crops = c.MarketListings.Where(l => l.Status == "Active").Select(l => l.Crop).Distinct().ToList(),
            })
            .OrderBy(c => c.Region)
            .ThenBy(c => c.District)
            .ToListAsync();

        // Filter by crop availability if specified
        if (!string.IsNullOrWhiteSpace(crop))
        {
            var filtered = coops.Where(c => c.Crops.Any(cr => cr.Equals(crop, StringComparison.OrdinalIgnoreCase))).ToList();
            return Ok(filtered);
        }

        return Ok(coops);
    }

    [HttpGet("my-cooperative")]
    [Authorize(Roles = "CooperativeManager")]
    public async Task<IActionResult> GetMyCooperative()
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var cooperative = await _db.Cooperatives
            .Include(c => c.Farmers).ThenInclude(f => f.User)
            .Include(c => c.Lots)
            .Include(c => c.MarketListings)
            .FirstOrDefaultAsync(c => c.ManagerId == userId.Value);

        if (cooperative == null) return NotFound("Cooperative not found");

        return Ok(new
        {
            cooperative.Id,
            cooperative.Name,
            cooperative.Region,
            cooperative.District,
            cooperative.Sector,
            cooperative.Cell,
            cooperative.Location,
            cooperative.Phone,
            cooperative.Email,
            cooperative.IsVerified,
            cooperative.IsActive,
            Farmers = cooperative.Farmers.Select(f => new
            {
                f.Id,
                f.User.FullName,
                f.User.Email,
                f.Phone,
                f.Crops,
                f.FarmSizeHectares
            }),
            Inventory = cooperative.Lots
                .Where(l => l.Status == "Listed")
                .GroupBy(l => l.Crop)
                .Select(g => new
                {
                    Crop = g.Key,
                    TotalQuantity = g.Sum(l => l.QuantityKg),
                    AverageQuality = g.Average(l => l.QualityGrade == "A" ? 3 : l.QualityGrade == "B" ? 2 : 1)
                }),
            ActiveListings = cooperative.MarketListings
                .Where(l => l.Status == "Active")
                .Select(l => new
                {
                    l.Id,
                    l.Crop,
                    l.QuantityKg,
                    l.MinimumPrice,
                    l.AvailabilityWindowStart,
                    l.AvailabilityWindowEnd
                })
        });
    }

    [HttpPut("my-cooperative/profile")]
    [Authorize(Roles = "CooperativeManager")]
    public async Task<IActionResult> UpdateMyCooperativeProfile(UpdateCooperativeProfileRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();
        var cooperative = await _db.Cooperatives.FirstOrDefaultAsync(c => c.ManagerId == userId.Value);
        if (cooperative == null) return NotFound("Cooperative not found");

        var before = new { cooperative.Name, cooperative.Phone, cooperative.Email, cooperative.Region, cooperative.District, cooperative.Sector, cooperative.Cell, cooperative.Location };

        if (!string.IsNullOrWhiteSpace(request.Name)) cooperative.Name = request.Name.Trim();
        if (!string.IsNullOrWhiteSpace(request.Phone)) cooperative.Phone = request.Phone.Trim();
        if (!string.IsNullOrWhiteSpace(request.Email)) cooperative.Email = request.Email.Trim();
        var nextRegion = !string.IsNullOrWhiteSpace(request.Region) ? request.Region.Trim() : cooperative.Region;
        var nextDistrict = !string.IsNullOrWhiteSpace(request.District) ? request.District.Trim() : cooperative.District;
        var nextSector = !string.IsNullOrWhiteSpace(request.Sector) ? request.Sector.Trim() : cooperative.Sector;
        var normalizedHierarchy = RwandaAdminData.NormalizeHierarchy(nextRegion, nextDistrict, nextSector);
        if (normalizedHierarchy == null)
            return BadRequest("Select a valid Province, District, and Sector combination for Rwanda.");

        cooperative.Region = normalizedHierarchy.Value.Province;
        cooperative.District = normalizedHierarchy.Value.District;
        cooperative.Sector = normalizedHierarchy.Value.Sector;
        cooperative.Cell = request.Cell != null ? string.IsNullOrWhiteSpace(request.Cell) ? null : request.Cell.Trim() : cooperative.Cell;
        if (!string.IsNullOrWhiteSpace(request.Location)) cooperative.Location = request.Location.Trim();

        _db.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            Action = "UPDATE",
            Actor = userId.Value.ToString(),
            EntityType = "COOPERATIVE",
            EntityId = cooperative.Id.ToString(),
            Metadata = JsonSerializer.Serialize(new
            {
                actor_id = userId.Value.ToString(),
                actor_role = "CooperativeManager",
                action_type = "UPDATE",
                entity_type = "COOPERATIVE",
                entity_id = cooperative.Id.ToString(),
                before_state = before,
                after_state = new { cooperative.Name, cooperative.Phone, cooperative.Email, cooperative.Region, cooperative.District, cooperative.Sector, cooperative.Cell, cooperative.Location },
                ip_address = HttpContext.Connection.RemoteIpAddress != null ? HttpContext.Connection.RemoteIpAddress.ToString() : null,
                device_info = Request.Headers.UserAgent.ToString()
            }),
            Timestamp = DateTime.UtcNow
        });

        await _db.SaveChangesAsync();
        return Ok(new { message = "Cooperative profile updated successfully." });
    }

    [HttpGet("farmers")]
    [Authorize(Roles = "CooperativeManager")]
    public async Task<IActionResult> GetMyFarmers()
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var cooperative = await _db.Cooperatives
            .Include(c => c.Farmers).ThenInclude(f => f.User)
            .FirstOrDefaultAsync(c => c.ManagerId == userId.Value);

        if (cooperative == null) return NotFound("Cooperative not found");

        var farmers = cooperative.Farmers
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
                f.CreatedAt
            })
            .OrderByDescending(f => f.CreatedAt)
            .ToList();

        return Ok(farmers);
    }

    [HttpPost("inventory")]
    [Authorize(Roles = "CooperativeManager")]
    public async Task<IActionResult> AddInventory(CreateLotRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var cooperative = await _db.Cooperatives.FirstOrDefaultAsync(c => c.ManagerId == userId.Value);
        if (cooperative == null) return NotFound("Cooperative not found for this manager");

        string cropName;
        try
        {
            cropName = await _catalog.EnsureCropAsync(request.Crop, userId, "CooperativeManager", false);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
        if (request.QuantityKg <= 0)
            return BadRequest("Quantity (kg) must be greater than 0.");
        if (string.IsNullOrWhiteSpace(request.QualityGrade))
            return BadRequest("Quality grade is required.");
        if (request.ExpectedHarvestDate == default)
            return BadRequest("Harvest date is required.");
        if (!request.StorageFacilityId.HasValue)
            return BadRequest("Storage location is required.");
        if (!request.ExpectedPricePerKg.HasValue || request.ExpectedPricePerKg.Value <= 0)
            return BadRequest("Price expectation is required and must be greater than 0.");
        if (request.FarmerContributions == null || !request.FarmerContributions.Any())
            return BadRequest("Farmer contributors are required.");

        // Validate contributions if provided
        if (request.FarmerContributions != null && request.FarmerContributions.Any())
        {
            var totalContributed = request.FarmerContributions.Sum(c => c.QuantityKg);
            if (Math.Abs(totalContributed - request.QuantityKg) > 0.01)
            {
                return BadRequest($"Sum of farmer contributions ({totalContributed}kg) does not match total inventory quantity ({request.QuantityKg}kg)");
            }

            // Verify all farmers belong to this cooperative
            var farmerIds = request.FarmerContributions.Select(c => c.FarmerId).ToList();
            var validFarmerCount = await _db.Farmers.CountAsync(f => farmerIds.Contains(f.Id) && f.CooperativeId == cooperative.Id);
            
            if (validFarmerCount != farmerIds.Distinct().Count())
            {
                return BadRequest("One or more selected farmers do not belong to your cooperative");
            }
        }

        var lot = new Lot
        {
            Id = Guid.NewGuid(),
            CooperativeId = cooperative.Id,
            Crop = cropName,
            QuantityKg = request.QuantityKg,
            QualityGrade = request.QualityGrade ?? "A",
            ExpectedHarvestDate = request.ExpectedHarvestDate == default ? DateTime.UtcNow.AddDays(7) : request.ExpectedHarvestDate,
            Status = "Stored",
            Verified = true,
            // Enhanced AI data fields
            MoisturePercent = request.MoisturePercent,
            StorageFacilityId = request.StorageFacilityId,
            ExpectedPricePerKg = request.ExpectedPricePerKg,
            Season = request.Season,
            ProductionMethod = request.ProductionMethod,
            LandAreaHectares = request.LandAreaHectares,
            HarvestedAt = request.HarvestDate,
            QualityNotes = request.QualityNotes
        };

        _db.Lots.Add(lot);

        // Add contributions
        if (request.FarmerContributions != null && request.FarmerContributions.Any())
        {
            foreach (var contrib in request.FarmerContributions)
            {
                _db.LotContributions.Add(new LotContribution
                {
                    Id = Guid.NewGuid(),
                    LotId = lot.Id,
                    FarmerId = contrib.FarmerId,
                    QuantityKg = contrib.QuantityKg,
                    ContributedAt = DateTime.UtcNow
                });
            }
        }

        // Create audit log
        _db.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            Action = "INVENTORY_ADDED",
            Actor = userId.Value.ToString(),
            Metadata = $"{{\"lotId\":\"{lot.Id}\",\"crop\":\"{request.Crop}\",\"quantity\":{request.QuantityKg}}}",
            Timestamp = DateTime.UtcNow
        });

        await _db.SaveChangesAsync();

        return Created("", new { lot.Id, lot.Crop, lot.QuantityKg });
    }

    [HttpGet("inventory")]
    [Authorize(Roles = "CooperativeManager")]
    public async Task<IActionResult> GetInventory()
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var cooperative = await _db.Cooperatives.FirstOrDefaultAsync(c => c.ManagerId == userId.Value);
        if (cooperative == null) return NotFound("Cooperative not found");

        var inventory = await _db.Lots
            .Include(l => l.Contributions).ThenInclude(lc => lc.Farmer).ThenInclude(f => f.User)
            .Where(l => l.CooperativeId == cooperative.Id)
            .OrderByDescending(l => l.ExpectedHarvestDate)
            .Select(l => new
            {
                l.Id,
                l.Crop,
                l.QuantityKg,
                l.QualityGrade,
                l.Status,
                l.ExpectedHarvestDate,
                l.Verified,
                LotContributions = l.Contributions.Select(lc => new
                {
                    lc.Id,
                    lc.FarmerId,
                    lc.QuantityKg,
                    lc.ContributedAt,
                    Farmer = new { FullName = lc.Farmer.User.FullName }
                })
            })
            .ToListAsync();

        return Ok(inventory);
    }

    [HttpGet("inventory-submissions")]
    [Authorize(Roles = "CooperativeManager")]
    public async Task<IActionResult> GetInventorySubmissions()
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var cooperative = await _db.Cooperatives.FirstOrDefaultAsync(c => c.ManagerId == userId.Value);
        if (cooperative == null) return NotFound("Cooperative not found");

        var rows = await _db.Lots
            .Include(l => l.Farmer).ThenInclude(f => f!.User)
            .Where(l => l.CooperativeId == cooperative.Id && (l.Status == "Submitted" || l.Status == "Rejected"))
            .OrderByDescending(l => l.CreatedAt)
            .Select(l => new
            {
                l.Id,
                l.Crop,
                l.QuantityKg,
                l.QualityGrade,
                l.ExpectedHarvestDate,
                l.MoisturePercent,
                l.ExpectedPricePerKg,
                l.Season,
                l.QualityNotes,
                l.Status,
                Farmer = l.Farmer != null && l.Farmer.User != null ? new { l.Farmer.Id, l.Farmer.User.FullName, l.Farmer.Phone } : null
            })
            .ToListAsync();

        return Ok(rows);
    }

    [HttpPost("inventory-submissions/{id}/review")]
    [Authorize(Roles = "CooperativeManager")]
    public async Task<IActionResult> ReviewInventorySubmission(Guid id, VerifyEntityRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var cooperative = await _db.Cooperatives.FirstOrDefaultAsync(c => c.ManagerId == userId.Value);
        if (cooperative == null) return NotFound("Cooperative not found");

        var lot = await _db.Lots
            .Include(l => l.Farmer)
            .FirstOrDefaultAsync(l => l.Id == id && l.CooperativeId == cooperative.Id);
        if (lot == null) return NotFound("Submission not found");
        if (lot.Status != "Submitted" && lot.Status != "Rejected") return BadRequest("Only submitted or rejected inventories can be reviewed");

        lot.Status = request.Approved ? "Listed" : "Rejected";
        lot.Verified = request.Approved;
        lot.UpdatedAt = DateTime.UtcNow;

        if (lot.FarmerId.HasValue)
        {
            _db.Notifications.Add(new Notification
            {
                Id = Guid.NewGuid(),
                UserId = lot.Farmer.UserId,
                Title = request.Approved ? "Inventory submission approved" : "Inventory submission rejected",
                Message = request.Approved
                    ? $"Your {lot.Crop} inventory submission was approved and is now available for listing."
                    : $"Your {lot.Crop} inventory submission was rejected. Please edit and resubmit. {request.Notes ?? string.Empty}".Trim(),
                Type = request.Approved ? "Success" : "Warning",
                ActionUrl = "/farmer-dashboard"
            });
            await _hubContext.Clients.Group($"user-{lot.Farmer.UserId}")
                .SendAsync("ReceiveNotification", new
                {
                    Title = request.Approved ? "Inventory submission approved" : "Inventory submission rejected",
                    Message = request.Approved
                        ? $"Your {lot.Crop} inventory submission was approved and is now available for listing."
                        : $"Your {lot.Crop} inventory submission was rejected. Please edit and resubmit. {request.Notes ?? string.Empty}".Trim(),
                    Type = request.Approved ? "Success" : "Warning",
                    CreatedAt = DateTime.UtcNow
                });
        }

        _db.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            Action = request.Approved ? "INVENTORY_SUBMISSION_APPROVED" : "INVENTORY_SUBMISSION_REJECTED",
            Actor = userId.Value.ToString(),
            EntityType = "Lot",
            EntityId = lot.Id.ToString(),
            Metadata = JsonSerializer.Serialize(new { request.Notes, lot.Crop, lot.QuantityKg }),
            Timestamp = DateTime.UtcNow
        });

        await _db.SaveChangesAsync();
        return Ok(new { lot.Id, lot.Status });
    }

    [HttpGet("profile-update-requests")]
    [Authorize(Roles = "CooperativeManager")]
    public async Task<IActionResult> GetProfileUpdateRequests()
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var cooperative = await _db.Cooperatives.FirstOrDefaultAsync(c => c.ManagerId == userId.Value);
        if (cooperative == null) return NotFound("Cooperative not found");

        var rows = await _db.AuditLogs
            .Where(a => a.Action == "FarmerProfileUpdateRequested" && a.Metadata != null)
            .OrderByDescending(a => a.Timestamp)
            .Take(200)
            .ToListAsync();

        var farmerMap = await _db.Farmers.Include(f => f.User)
            .Where(f => f.CooperativeId == cooperative.Id)
            .ToDictionaryAsync(f => f.User.Email, f => f);

        var response = rows.Select(a =>
        {
            farmerMap.TryGetValue(a.Actor, out var farmer);
            return new
            {
                a.Id,
                a.Actor,
                a.Timestamp,
                a.Metadata,
                FarmerId = farmer?.Id,
                FarmerName = farmer?.User.FullName,
                FarmerPhone = farmer?.Phone
            };
        }).Where(x => x.FarmerId != null).ToList();

        return Ok(response);
    }

    [HttpPost("profile-update-requests/{auditId}/process")]
    [Authorize(Roles = "CooperativeManager")]
    public async Task<IActionResult> ProcessProfileUpdateRequest(Guid auditId, VerifyEntityRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var cooperative = await _db.Cooperatives.FirstOrDefaultAsync(c => c.ManagerId == userId.Value);
        if (cooperative == null) return NotFound("Cooperative not found");

        var audit = await _db.AuditLogs.FirstOrDefaultAsync(a => a.Id == auditId && a.Action == "FarmerProfileUpdateRequested");
        if (audit == null || string.IsNullOrWhiteSpace(audit.Metadata)) return NotFound("Request not found");

        var farmer = await _db.Farmers.Include(f => f.User).FirstOrDefaultAsync(f => f.User.Email == audit.Actor && f.CooperativeId == cooperative.Id);
        if (farmer == null) return NotFound("Farmer not found");

        if (request.Approved)
        {
            try
            {
                using var doc = JsonDocument.Parse(audit.Metadata);
                var root = doc.RootElement;
                if (root.TryGetProperty("fullName", out var fullName) && fullName.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(fullName.GetString()))
                    farmer.User.FullName = fullName.GetString()!;
                if (root.TryGetProperty("phone", out var phone) && phone.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(phone.GetString()))
                    farmer.Phone = phone.GetString()!;
                if (root.TryGetProperty("district", out var district) && district.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(district.GetString()))
                    farmer.District = district.GetString()!;
                if (root.TryGetProperty("sector", out var sector) && sector.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(sector.GetString()))
                    farmer.Sector = sector.GetString()!;
                if (root.TryGetProperty("crops", out var crops) && crops.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(crops.GetString()))
                    farmer.Crops = crops.GetString()!;
                if (root.TryGetProperty("farmSizeHectares", out var farmSize) && farmSize.ValueKind == JsonValueKind.Number && farmSize.TryGetDouble(out var size))
                    farmer.FarmSizeHectares = size;
            }
            catch { }
        }

        _db.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            Action = request.Approved ? "FarmerProfileUpdateApproved" : "FarmerProfileUpdateRejected",
            Actor = userId.Value.ToString(),
            EntityType = "Farmer",
            EntityId = farmer.Id.ToString(),
            Metadata = request.Notes,
            Timestamp = DateTime.UtcNow
        });

        _db.Notifications.Add(new Notification
        {
            Id = Guid.NewGuid(),
            UserId = farmer.UserId,
            Title = request.Approved ? "Profile update approved" : "Profile update rejected",
            Message = request.Approved
                ? "Your profile update request has been approved and applied."
                : $"Your profile update request was rejected. {request.Notes ?? string.Empty}".Trim(),
            Type = request.Approved ? "Success" : "Warning",
            ActionUrl = "/farmer-dashboard"
        });

        await _db.SaveChangesAsync();
        await _hubContext.Clients.Group($"user-{farmer.UserId}")
            .SendAsync("ReceiveNotification", new
            {
                Title = request.Approved ? "Profile update approved" : "Profile update rejected",
                Message = request.Approved
                    ? "Your profile update request has been approved and applied."
                    : $"Your profile update request was rejected. {request.Notes ?? string.Empty}".Trim(),
                Type = request.Approved ? "Success" : "Warning",
                CreatedAt = DateTime.UtcNow
            });

        return Ok(new { processed = true, approved = request.Approved });
    }

    [HttpGet("harvest-declarations")]
    [Authorize(Roles = "CooperativeManager")]
    public async Task<IActionResult> GetHarvestDeclarationsForCooperative()
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();
        var cooperative = await _db.Cooperatives.FirstOrDefaultAsync(c => c.ManagerId == userId.Value);
        if (cooperative == null) return NotFound("Cooperative not found");

        var rows = await _db.HarvestDeclarations
            .Include(h => h.Farmer).ThenInclude(f => f.User)
            .Where(h => h.Farmer.CooperativeId == cooperative.Id)
            .OrderByDescending(h => h.CreatedAt)
            .Select(h => new
            {
                h.Id,
                h.Crop,
                h.ExpectedQuantityKg,
                h.ExpectedHarvestDate,
                h.QualityIndicators,
                h.Status,
                h.CreatedAt,
                Farmer = new { h.Farmer.Id, h.Farmer.User.FullName, h.Farmer.Phone }
            }).ToListAsync();

        return Ok(rows);
    }

    [HttpPut("inventory/{id}")]
    [Authorize(Roles = "CooperativeManager")]
    public async Task<IActionResult> UpdateInventory(Guid id, CreateLotRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var cooperative = await _db.Cooperatives
            .FirstOrDefaultAsync(c => c.ManagerId == userId.Value);

        if (cooperative == null) return NotFound("Cooperative not found");

        string cropName;
        try
        {
            cropName = await _catalog.EnsureCropAsync(request.Crop, userId, "CooperativeManager", false);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }

        var lot = await _db.Lots
            .Include(l => l.Contributions)
            .FirstOrDefaultAsync(l => l.Id == id && l.CooperativeId == cooperative.Id);

        if (lot == null) return NotFound("Inventory lot not found");

        // Update fields
        lot.Crop = cropName;
        lot.QuantityKg = request.QuantityKg;
        lot.QualityGrade = request.QualityGrade ?? "A";
        // If harvest date is provided, update it, otherwise keep existing
        if (request.ExpectedHarvestDate != default)
        {
            lot.ExpectedHarvestDate = request.ExpectedHarvestDate;
        }

        // Handle contributions
        // For simplicity, remove existing and add new
        _db.LotContributions.RemoveRange(lot.Contributions);

        if (request.FarmerContributions != null && request.FarmerContributions.Any())
        {
            foreach (var contrib in request.FarmerContributions)
            {
                _db.LotContributions.Add(new LotContribution
                {
                    Id = Guid.NewGuid(),
                    LotId = lot.Id,
                    FarmerId = contrib.FarmerId,
                    QuantityKg = contrib.QuantityKg,
                    ContributedAt = DateTime.UtcNow
                });
            }
        }

        // Audit log
        _db.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            Action = "INVENTORY_UPDATED",
            Actor = userId.Value.ToString(),
            Metadata = $"{{\"lotId\":\"{lot.Id}\",\"crop\":\"{request.Crop}\",\"quantity\":{request.QuantityKg}}}",
            Timestamp = DateTime.UtcNow
        });

        await _db.SaveChangesAsync();

        return Ok(new { lot.Id, lot.Crop, lot.QuantityKg });
    }

    [HttpDelete("inventory/{id}")]
    [Authorize(Roles = "CooperativeManager")]
    public async Task<IActionResult> DeleteInventory(Guid id)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var cooperative = await _db.Cooperatives
            .FirstOrDefaultAsync(c => c.ManagerId == userId.Value);

        if (cooperative == null) return NotFound("Cooperative not found");

        var lot = await _db.Lots
            .FirstOrDefaultAsync(l => l.Id == id && l.CooperativeId == cooperative.Id);

        if (lot == null) return NotFound("Inventory lot not found");

        _db.Lots.Remove(lot);

        // Audit log
        _db.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            Action = "INVENTORY_DELETED",
            Actor = userId.Value.ToString(),
            Metadata = $"{{\"lotId\":\"{lot.Id}\",\"crop\":\"{lot.Crop}\"}}",
            Timestamp = DateTime.UtcNow
        });

        await _db.SaveChangesAsync();

        return NoContent();
    }

    [HttpPost("market-listing")]
    [Authorize(Roles = "CooperativeManager")]
    public async Task<IActionResult> CreateMarketListing(CreateMarketListingRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var cooperative = await _db.Cooperatives
            .FirstOrDefaultAsync(c => c.ManagerId == userId.Value);

        if (cooperative == null) return NotFound("Cooperative not found");

        string cropName;
        try
        {
            cropName = await _catalog.EnsureCropAsync(request.Crop, userId, "CooperativeManager", false);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }

        if (!request.LotId.HasValue)
            return BadRequest("Linked inventory lot is required.");
        if (request.QuantityKg <= 0)
            return BadRequest("Available quantity must be greater than 0.");
        if (request.MinimumPrice <= 0)
            return BadRequest("Minimum price must be greater than 0.");
        if (!request.MarketPriceReference.HasValue || request.MarketPriceReference.Value <= 0)
            return BadRequest("Market price reference is required.");
        if (string.IsNullOrWhiteSpace(request.Location))
            return BadRequest("Location is required.");
        if (request.AvailabilityWindowEnd <= request.AvailabilityWindowStart)
            return BadRequest("Expiry date must be after availability start.");

        Lot? selectedLot = await _db.Lots.FirstOrDefaultAsync(l => l.Id == request.LotId.Value && l.CooperativeId == cooperative.Id);
        if (selectedLot == null) return BadRequest("Selected inventory lot was not found.");
        if (selectedLot.Status == "Contracted" || selectedLot.Status == "Sold") return BadRequest("Selected lot is not available for listing.");
        if (request.QuantityKg > selectedLot.QuantityKg) return BadRequest("Listing quantity exceeds selected lot quantity.");

        // Ensure DateTime values are UTC
        var availabilityStart = request.AvailabilityWindowStart.Kind == DateTimeKind.Utc 
            ? request.AvailabilityWindowStart 
            : request.AvailabilityWindowStart.ToUniversalTime();
        var availabilityEnd = request.AvailabilityWindowEnd.Kind == DateTimeKind.Utc 
            ? request.AvailabilityWindowEnd 
            : request.AvailabilityWindowEnd.ToUniversalTime();

        // Check if cooperative has enough inventory
        var availableInventory = await _db.Lots
            .Where(l => l.CooperativeId == cooperative.Id && l.Crop == cropName && (l.Status == "Stored" || l.Status == "Listed"))
            .SumAsync(l => l.QuantityKg);

        if (availableInventory < request.QuantityKg)
        {
            return BadRequest("Insufficient inventory for this crop");
        }

        // === GOVERNMENT PRICE REGULATION ENFORCEMENT ===
        var now = DateTime.UtcNow;
        var coopRegion = cooperative.Region;

        // Find applicable regulation: market → district → region
        var regulations = await _db.PriceRegulations
            .Where(r => r.Crop == cropName && r.Status == "Active" &&
                         r.EffectiveFrom <= now && r.EffectiveTo >= now)
            .ToListAsync();

        PriceRegulation? applicableRegulation = null;
        if (!string.IsNullOrWhiteSpace(cooperative.District))
            applicableRegulation = regulations.FirstOrDefault(r => r.District == cooperative.District);
        if (applicableRegulation == null)
            applicableRegulation = regulations.FirstOrDefault(r =>
                r.Region == coopRegion && string.IsNullOrEmpty(r.Market) && string.IsNullOrEmpty(r.District));

        if (applicableRegulation != null)
        {
            if (request.MinimumPrice > applicableRegulation.MaxPricePerKg)
            {
                return BadRequest(
                    $"Listing rejected: The entered price ({request.MinimumPrice:N0} RWF/kg) exceeds the government-regulated maximum price of {applicableRegulation.MaxPricePerKg:N0} RWF/kg for {cropName} in {coopRegion}. " +
                    $"Regulated range: {(applicableRegulation.MinPricePerKg?.ToString("N0") ?? "0")}–{applicableRegulation.MaxPricePerKg:N0} RWF/kg. " +
                    $"Please adjust your price to comply with RURA price moderation policy.");
            }

            if (applicableRegulation.MinPricePerKg.HasValue && request.MinimumPrice < applicableRegulation.MinPricePerKg.Value)
            {
                return BadRequest(
                    $"Warning: The entered price ({request.MinimumPrice:N0} RWF/kg) is below the government-regulated minimum of {applicableRegulation.MinPricePerKg:N0} RWF/kg for {cropName} in {coopRegion}.");
            }
        }

        var structuredDescription = $"MarketRef:{request.MarketPriceReference.Value};Location:{request.Location};{request.Description ?? string.Empty}".Trim();
        var listing = new MarketListing
        {
            Id = Guid.NewGuid(),
            CooperativeId = cooperative.Id,
            Crop = selectedLot?.Crop ?? cropName,
            QuantityKg = request.QuantityKg,
            MinimumPrice = request.MinimumPrice,
            AvailabilityWindowStart = availabilityStart,
            AvailabilityWindowEnd = availabilityEnd,
            Description = structuredDescription,
            QualityGrade = string.IsNullOrWhiteSpace(request.QualityGrade) ? (selectedLot?.QualityGrade ?? "A") : request.QualityGrade,
            Status = "Active"
        };

        // Mark source lots as listed so they can be traced and consumed by contracts.
        if (selectedLot != null)
        {
            selectedLot.Status = "Listed";
        }
        else
        {
            var lotsToList = await _db.Lots
                .Where(l => l.CooperativeId == cooperative.Id &&
                            l.Crop == cropName &&
                            (l.Status == "Stored" || l.Status == "Listed"))
                .OrderBy(l => l.ExpectedHarvestDate)
                .ToListAsync();

            double needed = request.QuantityKg;
            foreach (var lot in lotsToList)
            {
                if (needed <= 0) break;
                lot.Status = "Listed";
                needed -= lot.QuantityKg;
            }
        }

        _db.MarketListings.Add(listing);
        await _db.SaveChangesAsync();

        return Created("", new { listing.Id, listing.Crop, listing.QuantityKg });
    }

    [HttpGet("market-listings")]
    [Authorize]
    public async Task<IActionResult> GetMarketListings()
    {
        var listings = await _db.MarketListings
            .Include(l => l.Cooperative)
            .Where(l => l.Status == "Active")
            .OrderByDescending(l => l.CreatedAt)
            .Select(l => new
            {
                l.Id,
                l.Crop,
                l.QuantityKg,
                l.MinimumPrice,
                l.AvailabilityWindowStart,
                l.AvailabilityWindowEnd,
                l.Description,
                l.QualityGrade,
                l.Status,
                l.CreatedAt,
                Cooperative = new
                {
                    l.Cooperative.Id,
                    l.Cooperative.Name,
                    l.Cooperative.Region,
                    l.Cooperative.Location
                }
            })
            .ToListAsync();

        return Ok(listings);
    }

    [HttpGet("orders")]
    [Authorize(Roles = "CooperativeManager")]
    public async Task<IActionResult> GetOrders()
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var cooperative = await _db.Cooperatives
            .FirstOrDefaultAsync(c => c.ManagerId == userId.Value);

        if (cooperative == null) return NotFound("Cooperative not found");

        var orders = await _db.BuyerOrders
            .Include(o => o.BuyerProfile).ThenInclude(b => b.User)
            .Include(o => o.MarketListing)
            .Where(o => o.MarketListing != null && o.MarketListing.CooperativeId == cooperative.Id)
            .OrderByDescending(o => o.CreatedAt)
            .Select(o => new
            {
                o.Id,
                o.Crop,
                o.QuantityKg,
                o.PriceOffer,
                o.DeliveryLocation,
                o.DeliveryWindowStart,
                o.DeliveryWindowEnd,
                o.Status,
                o.CreatedAt,
                Buyer = o.BuyerProfile != null && o.BuyerProfile.User != null ? new
                {
                    o.BuyerProfile.User.FullName,
                    o.BuyerProfile.Organization,
                    o.BuyerProfile.Phone
                } : null,
                MarketListing = o.MarketListing != null ? new
                {
                    o.MarketListing.Id,
                    o.MarketListing.MinimumPrice
                } : null
            })
            .ToListAsync();

        return Ok(orders);
    }

    [HttpPost("order/{orderId}/respond")]
    [Authorize(Roles = "CooperativeManager")]
    public async Task<IActionResult> RespondToOrder(Guid orderId, RespondToOrderRequest request)
    {
        var order = await _db.BuyerOrders
            .Include(o => o.MarketListing)
            .FirstOrDefaultAsync(o => o.Id == orderId);

        if (order == null) return NotFound("Order not found");

        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var cooperative = await _db.Cooperatives
            .FirstOrDefaultAsync(c => c.ManagerId == userId.Value);

        if (cooperative == null || order.MarketListing?.CooperativeId != cooperative.Id)
        {
            return Forbid("You can only respond to orders for your cooperative");
        }

        if (order.Status != "Open")
        {
            return BadRequest("Order has already been responded to");
        }

        if (request.Accepted && order.MarketListing != null)
        {
            if (order.MarketListing.Status != "Active")
            {
                return BadRequest("Market listing is no longer active.");
            }

            if (order.MarketListing.QuantityKg < order.QuantityKg)
            {
                return BadRequest("Insufficient listing quantity to accept this order.");
            }
        }

        await using var tx = await _db.Database.BeginTransactionAsync();

        order.Status = request.Accepted ? "Accepted" : "Rejected";

        TransportRequest? transportToNotify = null;

        if (request.Accepted)
        {
            if (order.MarketListing != null)
            {
                order.MarketListing.QuantityKg -= order.QuantityKg;
                if (order.MarketListing.QuantityKg <= 0)
                {
                    order.MarketListing.QuantityKg = 0;
                    order.MarketListing.Status = "Sold";
                }
            }

            // Create contract automatically
            var contract = new Contract
            {
                Id = Guid.NewGuid(),
                BuyerOrderId = order.Id,
                AgreedPrice = order.PriceOffer,
                Status = "Active",
                TrackingId = $"RASS-{Random.Shared.Next(100000, 999999)}"
            };

            // Assign available lots to the contract
            var availableLots = await _db.Lots
                .Where(l => l.CooperativeId == cooperative.Id &&
                           l.Crop == order.Crop &&
                           l.Status == "Listed")
                .OrderBy(l => l.ExpectedHarvestDate)
                .Take(5) // Take up to 5 lots
                .ToListAsync();

            double assignedQuantity = 0;
            foreach (var lot in availableLots)
            {
                if (assignedQuantity >= order.QuantityKg) break;

                double assignAmount = Math.Min(lot.QuantityKg, order.QuantityKg - assignedQuantity);
                contract.ContractLots.Add(new ContractLot
                {
                    ContractId = contract.Id,
                    LotId = lot.Id
                });

                assignedQuantity += assignAmount;
                // Mark lot as contracted to prevent double-listing
                lot.Status = "Contracted";
            }

            _db.Contracts.Add(contract);

            // Create transport request
            var transportRequest = new TransportRequest
            {
                Id = Guid.NewGuid(),
                ContractId = contract.Id,
                Origin = cooperative.Location,
                Destination = order.DeliveryLocation,
                LoadKg = order.QuantityKg,
                PickupStart = order.DeliveryWindowStart.AddDays(-1),
                PickupEnd = order.DeliveryWindowStart,
                Price = CalculateTransportPrice(cooperative.Location, order.DeliveryLocation, order.QuantityKg),
                Status = "Pending"
            };

            _db.TransportRequests.Add(transportRequest);
            transportToNotify = transportRequest;
        }

        await _db.SaveChangesAsync();
        await tx.CommitAsync();

        if (transportToNotify != null)
        {
            // Notify available transporters after transaction commits
            await NotifyTransporters(transportToNotify);
        }

        if (order.BuyerProfileId != Guid.Empty)
        {
            var buyerUserId = await _db.BuyerProfiles
                .Where(b => b.Id == order.BuyerProfileId)
                .Select(b => b.UserId)
                .FirstOrDefaultAsync();

            if (buyerUserId != Guid.Empty)
            {
                var note = new Notification
                {
                    Id = Guid.NewGuid(),
                    UserId = buyerUserId,
                    Title = request.Accepted ? "Order accepted" : "Order rejected",
                    Message = request.Accepted
                        ? $"Your order for {order.Crop} has been accepted by {cooperative.Name}."
                        : $"Your order for {order.Crop} was rejected by {cooperative.Name}.",
                    Type = request.Accepted ? "Success" : "Warning",
                    ActionUrl = "/buyer-dashboard"
                };
                _db.Notifications.Add(note);
                await _db.SaveChangesAsync();
                await _hubContext.Clients.Group($"user-{buyerUserId}")
                    .SendAsync("ReceiveNotification", new
                    {
                        note.Id,
                        note.Title,
                        note.Message,
                        note.Type,
                        note.CreatedAt
                    });
            }
        }

        return Ok(new { order.Id, order.Status });
    }

    [HttpPost("order/{orderId}/assign-storage")]
    [Authorize(Roles = "CooperativeManager")]
    public async Task<IActionResult> AssignStorageLocation(Guid orderId, AssignStorageRequest request)
    {
        var order = await _db.BuyerOrders
            .Include(o => o.Contracts)
            .FirstOrDefaultAsync(o => o.Id == orderId);

        if (order == null) return NotFound("Order not found");

        var contract = order.Contracts.FirstOrDefault();
        if (contract == null) return BadRequest("No contract found for this order");

        var storageFacility = await _db.StorageFacilities.FindAsync(request.StorageFacilityId);
        if (storageFacility == null) return NotFound("Storage facility not found");

        if (storageFacility.AvailableKg < order.QuantityKg)
        {
            return BadRequest("Insufficient storage capacity");
        }

        var storageBooking = new StorageBooking
        {
            Id = Guid.NewGuid(),
            StorageFacilityId = storageFacility.Id,
            ContractId = contract.Id,
            QuantityKg = order.QuantityKg,
            StartDate = request.StartDate,
            EndDate = request.EndDate,
            Status = "Reserved"
        };

        storageFacility.AvailableKg -= order.QuantityKg;

        _db.StorageBookings.Add(storageBooking);
        await _db.SaveChangesAsync();

        return Ok(new { storageBooking.Id, storageFacility.Name, storageBooking.Status });
    }

    [HttpGet("available-transporters")]
    [Authorize(Roles = "CooperativeManager")]
    public async Task<IActionResult> GetAvailableTransporters([FromQuery] string? region, [FromQuery] double? minCapacity)
    {
        var query = _db.TransporterProfiles
            .Where(t => t.IsActive && t.IsVerified)
            .AsQueryable();

        if (!string.IsNullOrEmpty(region))
        {
            query = query.Where(t => t.OperatingRegions.Contains(region));
        }

        if (minCapacity.HasValue)
        {
            query = query.Where(t => t.CapacityKg >= minCapacity.Value);
        }

        var transporters = await query
            .Include(t => t.User)
            .Select(t => new
            {
                t.Id,
                t.CompanyName,
                t.LicenseNumber,
                t.Phone,
                t.CapacityKg,
                t.VehicleType,
                t.LicensePlate,
                OperatingRegions = t.OperatingRegions.Split(','),
                ActiveJobs = t.TransportRequests.Count(tr => tr.Status != "Completed" && tr.Status != "Cancelled"),
                CompletedJobs = t.TransportRequests.Count(tr => tr.Status == "Completed"),
                Rating = 4.5 // Mock rating - in production, calculate from reviews
            })
            .ToListAsync();

        return Ok(transporters);
    }

    [HttpPost("transport/{transportId}/assign-transporter")]
    [Authorize(Roles = "CooperativeManager")]
    public async Task<IActionResult> AssignTransporter(Guid transportId, AssignTransporterRequest request)
    {
        var transport = await _db.TransportRequests
            .FirstOrDefaultAsync(t => t.Id == transportId);

        if (transport == null) return NotFound("Transport request not found");

        var transporter = await _db.TransporterProfiles
            .Include(t => t.User)
            .FirstOrDefaultAsync(t => t.Id == request.TransporterId && t.IsActive && t.IsVerified);

        if (transporter == null) return NotFound("Transporter not found");

        if (transporter.CapacityKg < transport.LoadKg)
        {
            return BadRequest("Transporter capacity insufficient for this load");
        }

        transport.TransporterId = transporter.Id;
        transport.Status = "Assigned";
        transport.AssignedAt = DateTime.UtcNow;
        transport.AssignedTruck = transporter.LicensePlate;
        transport.DriverPhone = request.DriverPhone ?? transporter.Phone;

        await _db.SaveChangesAsync();

        // Notify transporter
        await NotifyTransporter(transporter.User.Email, transport);

        return Ok(new { transport.Id, transport.Status, Transporter = transporter.CompanyName });
    }

    private Guid? GetUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier) ??
                    User.FindFirst(JwtRegisteredClaimNames.Sub) ??
                    User.FindFirst("sub") ??
                    User.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier");
        return Guid.TryParse(claim?.Value, out var guid) ? guid : null;
    }

    private decimal CalculateTransportPrice(string origin, string destination, double loadKg)
    {
        var basePrice = 10000m;
        var perKgPrice = 50m;
        return basePrice + (decimal)loadKg * perKgPrice;
    }

    private async Task NotifyTransporters(TransportRequest transport)
    {
        var transporterUsers = await _db.TransporterProfiles
            .Where(t => t.IsActive && t.IsVerified && t.CapacityKg >= transport.LoadKg)
            .Select(t => t.UserId)
            .ToListAsync();

        if (!transporterUsers.Any()) return;

        var now = DateTime.UtcNow;
        var notifications = transporterUsers.Select(userId => new Notification
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Title = "New transport job available",
            Message = $"Pickup: {transport.Origin} → Dropoff: {transport.Destination}",
            Type = "transport.available",
            IsRead = false,
            ActionUrl = $"/transporter-dashboard?jobId={transport.Id}",
            CreatedAt = now
        });

        _db.Notifications.AddRange(notifications);
        await _db.SaveChangesAsync();
    }

    private async Task NotifyTransporter(string email, TransportRequest transport)
    {
        var transporterUser = await _db.Users.FirstOrDefaultAsync(u => u.Email == email);
        if (transporterUser == null) return;

        _db.Notifications.Add(new Notification
        {
            Id = Guid.NewGuid(),
            UserId = transporterUser.Id,
            Title = "Transport assignment confirmed",
            Message = $"You have been assigned job {transport.Id} ({transport.Origin} → {transport.Destination})",
            Type = "transport.assigned",
            IsRead = false,
            ActionUrl = $"/transporter-dashboard?jobId={transport.Id}",
            CreatedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync();
    }

    // ============ FARMER CRUD ============
    
    [HttpPost("farmers")]
    [Authorize(Roles = "CooperativeManager")]
    public async Task<IActionResult> AddFarmer(AddFarmerRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var cooperative = await _db.Cooperatives
            .FirstOrDefaultAsync(c => c.ManagerId == userId.Value);

        if (cooperative == null) return NotFound("Cooperative not found");

        // Check if email already exists
        if (await _db.Users.AnyAsync(u => u.Email == request.Email))
        {
            return Conflict("A user with this email already exists");
        }

        // Check if phone number already exists
        if (await _db.Farmers.AnyAsync(f => f.Phone == request.Phone))
        {
            return Conflict("A farmer with this phone number already exists");
        }

        var normalizedFarmerHierarchy = RwandaAdminData.NormalizeHierarchy(null, request.District, request.Sector);
        if (!normalizedFarmerHierarchy.HasValue)
        {
            return BadRequest("Select a valid District and Sector combination for Rwanda.");
        }

        // Create user account for farmer
        var user = new User
        {
            Id = Guid.NewGuid(),
            FullName = request.FullName,
            Email = request.Email,
            PasswordHash = "", // Pending activation
            IsActive = false   // Pending activation
        };

        // Assign Farmer role
        var farmerRole = await _db.Roles.FirstOrDefaultAsync(r => r.Name == "Farmer");
        if (farmerRole != null)
        {
            user.UserRoles.Add(new UserRole { UserId = user.Id, RoleId = farmerRole.Id });
        }

        var farmer = new Farmer
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            CooperativeId = cooperative.Id,
            Phone = request.Phone,
            NationalId = request.NationalId,
            District = normalizedFarmerHierarchy.Value.District,
            Sector = normalizedFarmerHierarchy.Value.Sector,
            Crops = request.Crops ?? "",
            FarmSizeHectares = request.FarmSizeHectares,
            IsActive = false // Pending activation
        };

        _db.Users.Add(user);
        _db.Farmers.Add(farmer);

        // Create audit log
        _db.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            Action = "FARMER_REGISTERED",
            Actor = userId.Value.ToString(),
            Metadata = $"{{\"farmerId\":\"{farmer.Id}\",\"farmerName\":\"{request.FullName}\",\"cooperative\":\"{cooperative.Name}\"}}",
            Timestamp = DateTime.UtcNow
        });

        await _db.SaveChangesAsync();

        _db.Notifications.Add(new Notification
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            Title = "Cooperative registration complete",
            Message = $"You have been registered as a farmer under cooperative {cooperative.Name}.",
            Type = "farmer.registered",
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync();

        return Created("", new { farmer.Id, request.FullName, request.Phone, cooperative = cooperative.Name });
    }

    [HttpPost("farmers/{farmerId}/reset-password")]
    [Authorize(Roles = "CooperativeManager")]
    public async Task<IActionResult> ResetFarmerPassword(Guid farmerId)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var cooperative = await _db.Cooperatives.FirstOrDefaultAsync(c => c.ManagerId == userId.Value);
        if (cooperative == null) return NotFound("Cooperative not found");

        var farmer = await _db.Farmers
            .Include(f => f.User)
            .FirstOrDefaultAsync(f => f.Id == farmerId && f.CooperativeId == cooperative.Id);

        if (farmer == null) return NotFound("Farmer not found in your cooperative");

        // Generate OTP
        var otp = new Random().Next(100000, 999999).ToString();
        farmer.User.ResetOtp = BCrypt.Net.BCrypt.HashPassword(otp);
        farmer.User.ResetOtpExpiry = DateTime.UtcNow.AddMinutes(10);
        
        // Deactivate until verified (optional, but good for security during reset)
        farmer.User.IsActive = false;
        farmer.IsActive = false;

        _db.Notifications.Add(new Notification
        {
            Id = Guid.NewGuid(),
            UserId = farmer.UserId,
            Title = "Password reset verification",
            Message = $"Your cooperative generated a password reset OTP: {otp}",
            Type = "auth.password_reset_otp",
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync();

        return Ok(new { message = "Password reset OTP generated and sent to the farmer notification center." });
    }

    [HttpPut("farmers/{farmerId}")]
    [Authorize(Roles = "CooperativeManager")]
    public async Task<IActionResult> UpdateFarmer(Guid farmerId, UpdateFarmerRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var cooperative = await _db.Cooperatives
            .FirstOrDefaultAsync(c => c.ManagerId == userId.Value);

        if (cooperative == null) return NotFound("Cooperative not found");

        var farmer = await _db.Farmers
            .Include(f => f.User)
            .FirstOrDefaultAsync(f => f.Id == farmerId && f.CooperativeId == cooperative.Id);

        if (farmer == null) return NotFound("Farmer not found in your cooperative");

        // Update farmer fields
        if (!string.IsNullOrEmpty(request.FullName)) farmer.User.FullName = request.FullName;
        if (!string.IsNullOrEmpty(request.Phone)) farmer.Phone = request.Phone;

        var nextDistrict = !string.IsNullOrWhiteSpace(request.District) ? request.District : farmer.District;
        var nextSector = !string.IsNullOrWhiteSpace(request.Sector) ? request.Sector : farmer.Sector;
        var normalizedFarmerHierarchy = RwandaAdminData.NormalizeHierarchy(null, nextDistrict, nextSector);
        if (!normalizedFarmerHierarchy.HasValue)
        {
            return BadRequest("Select a valid District and Sector combination for Rwanda.");
        }

        farmer.District = normalizedFarmerHierarchy.Value.District;
        farmer.Sector = normalizedFarmerHierarchy.Value.Sector;
        if (!string.IsNullOrEmpty(request.Crops)) farmer.Crops = request.Crops;
        if (request.FarmSizeHectares.HasValue) farmer.FarmSizeHectares = request.FarmSizeHectares.Value;
        if (request.IsActive.HasValue) farmer.IsActive = request.IsActive.Value;

        await _db.SaveChangesAsync();

        return Ok(new { farmer.Id, farmer.User.FullName, farmer.Phone, farmer.IsActive });
    }

    [HttpDelete("farmers/{farmerId}")]
    [Authorize(Roles = "CooperativeManager")]
    public async Task<IActionResult> DeleteFarmer(Guid farmerId)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var cooperative = await _db.Cooperatives
            .FirstOrDefaultAsync(c => c.ManagerId == userId.Value);

        if (cooperative == null) return NotFound("Cooperative not found");

        var farmer = await _db.Farmers
            .Include(f => f.User)
            .FirstOrDefaultAsync(f => f.Id == farmerId && f.CooperativeId == cooperative.Id);

        if (farmer == null) return NotFound("Farmer not found in your cooperative");

        // Soft delete - deactivate instead of removing
        farmer.IsActive = false;
        farmer.User.IsActive = false;

        _db.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            Action = "FARMER_DEACTIVATED",
            Actor = userId.Value.ToString(),
            Metadata = $"{{\"farmerId\":\"{farmer.Id}\",\"farmerName\":\"{farmer.User.FullName}\"}}",
            Timestamp = DateTime.UtcNow
        });

        await _db.SaveChangesAsync();

        return Ok(new { Message = "Farmer deactivated successfully" });
    }

    // ============ MARKET LISTING CRUD ============
    
    [HttpGet("my-listings")]
    [Authorize(Roles = "CooperativeManager")]
    public async Task<IActionResult> GetMyListings([FromQuery] bool includeCancelled = false)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var cooperative = await _db.Cooperatives
            .FirstOrDefaultAsync(c => c.ManagerId == userId.Value);

        if (cooperative == null) return NotFound("Cooperative not found");

        var rows = await _db.MarketListings
            .Include(l => l.Images)
            .Where(l => l.CooperativeId == cooperative.Id && (includeCancelled || l.Status != "Cancelled"))
            .OrderByDescending(l => l.CreatedAt)
            .Select(l => new
            {
                l.Id,
                l.Crop,
                l.QuantityKg,
                l.MinimumPrice,
                l.AvailabilityWindowStart,
                l.AvailabilityWindowEnd,
                l.Description,
                l.QualityGrade,
                l.Status,
                l.CreatedAt,
                Images = l.Images.OrderBy(i => i.DisplayOrder).Select(i => new { i.Id, i.ImageUrl, i.DisplayOrder })
            })
            .ToListAsync();

        var listings = rows.Select(l =>
        {
            var metadata = ParseStructuredListingMetadata(l.Description);
            return new
            {
                l.Id,
                l.Crop,
                l.QuantityKg,
                l.MinimumPrice,
                l.AvailabilityWindowStart,
                l.AvailabilityWindowEnd,
                Description = metadata.Description,
                Location = metadata.Location,
                MarketPriceReference = metadata.MarketPriceReference,
                l.QualityGrade,
                l.Status,
                l.CreatedAt,
                l.Images
            };
        }).ToList();

        return Ok(listings);
    }

    [HttpPost("market-listing/{listingId}/status")]
    [Authorize(Roles = "CooperativeManager,Government,Admin")]
    public async Task<IActionResult> SetMarketListingStatus(Guid listingId, SetListingStatusRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Status))
            return BadRequest("Status is required.");

        var allowedStatuses = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "Active",
            "Inactive",
            "Disabled",
            "Cancelled"
        };

        var nextStatus = request.Status.Trim();
        if (!allowedStatuses.Contains(nextStatus))
            return BadRequest("Unsupported status. Allowed: Active, Inactive, Disabled, Cancelled.");

        var actorId = GetUserId();
        if (!actorId.HasValue) return Unauthorized();

        var isPrivileged = User.IsInRole("Government") || User.IsInRole("Admin");
        var listing = await _db.MarketListings
            .Include(l => l.Cooperative)
            .FirstOrDefaultAsync(l => l.Id == listingId);
        if (listing == null) return NotFound("Listing not found.");

        if (!isPrivileged)
        {
            var cooperative = await _db.Cooperatives
                .FirstOrDefaultAsync(c => c.ManagerId == actorId.Value);
            if (cooperative == null) return NotFound("Cooperative not found");
            if (listing.CooperativeId != cooperative.Id)
                return Forbid();
        }

        if (!isPrivileged && string.Equals(nextStatus, "Disabled", StringComparison.OrdinalIgnoreCase))
            return Forbid();

        if (!isPrivileged && string.Equals(nextStatus, "Cancelled", StringComparison.OrdinalIgnoreCase))
        {
            var hasActiveOrders = await _db.BuyerOrders
                .AnyAsync(o => o.MarketListingId == listingId && o.Status == "Open");
            if (hasActiveOrders)
                return BadRequest("Cannot cancel listing with active orders. Cancel or complete orders first.");
        }

        var previousStatus = listing.Status;
        listing.Status = nextStatus;
        await _db.SaveChangesAsync();

        var role = User.IsInRole("Admin")
            ? "Admin"
            : User.IsInRole("Government")
                ? "Government"
                : "CooperativeManager";

        _db.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            Action = "MARKET_LISTING_STATUS_UPDATED",
            Actor = actorId.Value.ToString(),
            EntityType = "MarketListing",
            EntityId = listing.Id.ToString(),
            Metadata = JsonSerializer.Serialize(new
            {
                listingId = listing.Id,
                listing.Crop,
                previousStatus,
                newStatus = nextStatus,
                reason = request.Reason,
                actorRole = role
            }),
            Timestamp = DateTime.UtcNow
        });
        await _db.SaveChangesAsync();

        if (listing.Cooperative?.ManagerId != null && listing.Cooperative.ManagerId != actorId.Value)
        {
            var statusLower = nextStatus.ToLowerInvariant();
            var managerNotification = new Notification
            {
                Id = Guid.NewGuid(),
                UserId = listing.Cooperative.ManagerId.Value,
                Title = $"Listing {nextStatus}",
                Message = $"{listing.Crop} listing was set to {statusLower} by {role}.{(string.IsNullOrWhiteSpace(request.Reason) ? string.Empty : $" Reason: {request.Reason}")}",
                Type = string.Equals(nextStatus, "Disabled", StringComparison.OrdinalIgnoreCase) ? "Warning" : "Info",
                ActionUrl = "/cooperative-dashboard?tab=listings"
            };
            _db.Notifications.Add(managerNotification);
            await _db.SaveChangesAsync();
            await _hubContext.Clients.Group($"user-{listing.Cooperative.ManagerId.Value}")
                .SendAsync("ReceiveNotification", new
                {
                    managerNotification.Title,
                    managerNotification.Message,
                    managerNotification.Type,
                    CreatedAt = DateTime.UtcNow
                });
        }

        return Ok(new { listing.Id, listing.Crop, listing.Status });
    }

    [HttpGet("price-moderations")]
    [Authorize(Roles = "CooperativeManager")]
    public async Task<IActionResult> GetPriceModerations()
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var cooperative = await _db.Cooperatives
            .FirstOrDefaultAsync(c => c.ManagerId == userId.Value);
        if (cooperative == null) return NotFound("Cooperative not found");

        var listingRows = await _db.MarketListings
            .Where(l => l.CooperativeId == cooperative.Id && l.Status == "Active")
            .OrderByDescending(l => l.CreatedAt)
            .Select(l => new
            {
                l.Id,
                l.Crop,
                l.MinimumPrice,
                l.QuantityKg,
                l.QualityGrade,
                l.AvailabilityWindowEnd,
                l.CreatedAt
            })
            .ToListAsync();

        var now = DateTime.UtcNow;
        var crops = listingRows.Select(l => l.Crop).Distinct().ToList();
        var coopRegion = NormalizeProvinceLoose(cooperative.Region);
        var coopDistrict = NormalizeDistrictLoose(cooperative.District);
        var regulations = await _db.PriceRegulations
            .Where(r =>
                r.Status == "Active" &&
                r.EffectiveFrom <= now &&
                r.EffectiveTo >= now &&
                crops.Contains(r.Crop))
            .ToListAsync();

        var payload = listingRows.Select(l =>
        {
            var applicable = FindApplicableRegulation(regulations, l.Crop, coopRegion, coopDistrict);

            var min = applicable?.MinPricePerKg;
            var max = applicable?.MaxPricePerKg;
            var isAbove = max.HasValue && l.MinimumPrice > max.Value;
            var isBelow = min.HasValue && l.MinimumPrice < min.Value;
            var isCompliant = applicable == null || (!isAbove && !isBelow);
            var recommended = applicable == null
                ? l.MinimumPrice
                : isAbove
                    ? max!.Value
                    : isBelow && min.HasValue
                        ? min.Value
                        : l.MinimumPrice;

            return new
            {
                listingId = l.Id,
                crop = l.Crop,
                cooperativeRegion = coopRegion,
                cooperativeDistrict = coopDistrict,
                minimumPrice = l.MinimumPrice,
                quantityKg = l.QuantityKg,
                qualityGrade = l.QualityGrade,
                hasRegulation = applicable != null,
                regulation = applicable == null
                    ? null
                    : new
                    {
                        applicable.Id,
                        applicable.Region,
                        applicable.District,
                        applicable.MinPricePerKg,
                        applicable.MaxPricePerKg,
                        applicable.EffectiveFrom,
                        applicable.EffectiveTo
                    },
                isCompliant,
                isAboveMaximum = isAbove,
                isBelowMinimum = isBelow,
                recommendedPrice = recommended,
                createdAt = l.CreatedAt,
                availabilityWindowEnd = l.AvailabilityWindowEnd
            };
        }).ToList();

        return Ok(payload);
    }

    [HttpPut("market-listing/{listingId}")]
    [Authorize(Roles = "CooperativeManager")]
    public async Task<IActionResult> UpdateMarketListing(Guid listingId, UpdateMarketListingRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var cooperative = await _db.Cooperatives
            .FirstOrDefaultAsync(c => c.ManagerId == userId.Value);

        if (cooperative == null) return NotFound("Cooperative not found");

        var listing = await _db.MarketListings
            .FirstOrDefaultAsync(l => l.Id == listingId && l.CooperativeId == cooperative.Id);

        if (listing == null) return NotFound("Listing not found in your cooperative");

        var nextCrop = listing.Crop;
        if (!string.IsNullOrWhiteSpace(request.Crop))
        {
            try
            {
                nextCrop = await _catalog.EnsureCropAsync(request.Crop, userId, "CooperativeManager", false);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }
        var nextMinimumPrice = request.MinimumPrice ?? listing.MinimumPrice;

        var now = DateTime.UtcNow;
        var coopRegion = NormalizeProvinceLoose(cooperative.Region);
        var coopDistrict = NormalizeDistrictLoose(cooperative.District);
        var regulations = await _db.PriceRegulations
            .Where(r => r.Crop == nextCrop && r.Status == "Active" &&
                         r.EffectiveFrom <= now && r.EffectiveTo >= now)
            .ToListAsync();

        var applicableRegulation = FindApplicableRegulation(regulations, nextCrop, coopRegion, coopDistrict);

        if (applicableRegulation != null)
        {
            if (nextMinimumPrice > applicableRegulation.MaxPricePerKg)
            {
                return BadRequest(
                    $"Listing rejected: The entered price ({nextMinimumPrice:N0} RWF/kg) exceeds the government-regulated maximum price of {applicableRegulation.MaxPricePerKg:N0} RWF/kg for {nextCrop} in {coopRegion}. " +
                    $"Regulated range: {(applicableRegulation.MinPricePerKg?.ToString("N0") ?? "0")}–{applicableRegulation.MaxPricePerKg:N0} RWF/kg. " +
                    $"Please adjust your price to comply with RURA price moderation policy.");
            }

            if (applicableRegulation.MinPricePerKg.HasValue && nextMinimumPrice < applicableRegulation.MinPricePerKg.Value)
            {
                return BadRequest(
                    $"Warning: The entered price ({nextMinimumPrice:N0} RWF/kg) is below the government-regulated minimum of {applicableRegulation.MinPricePerKg:N0} RWF/kg for {nextCrop} in {coopRegion}.");
            }
        }

        // Update fields
        if (!string.IsNullOrEmpty(request.Crop)) listing.Crop = nextCrop;
        if (request.QuantityKg.HasValue) listing.QuantityKg = request.QuantityKg.Value;
        if (request.MinimumPrice.HasValue) listing.MinimumPrice = request.MinimumPrice.Value;
        if (request.AvailabilityWindowStart.HasValue) 
            listing.AvailabilityWindowStart = request.AvailabilityWindowStart.Value.ToUniversalTime();
        if (request.AvailabilityWindowEnd.HasValue) 
            listing.AvailabilityWindowEnd = request.AvailabilityWindowEnd.Value.ToUniversalTime();
        if (!string.IsNullOrEmpty(request.QualityGrade)) listing.QualityGrade = request.QualityGrade;
        if (!string.IsNullOrEmpty(request.Status)) listing.Status = request.Status;

        var existingMetadata = ParseStructuredListingMetadata(listing.Description);
        var nextMarketPriceReference = request.MarketPriceReference ?? existingMetadata.MarketPriceReference;
        var nextLocation = !string.IsNullOrWhiteSpace(request.Location) ? request.Location.Trim() : existingMetadata.Location;
        var nextDescription = !string.IsNullOrWhiteSpace(request.Description) ? request.Description.Trim() : existingMetadata.Description;

        if (request.MarketPriceReference.HasValue || !string.IsNullOrWhiteSpace(request.Location) || request.Description != null)
        {
            listing.Description = BuildStructuredListingDescription(nextMarketPriceReference, nextLocation, nextDescription);
        }

        await _db.SaveChangesAsync();

        return Ok(new { listing.Id, listing.Crop, listing.Status });
    }

    [HttpDelete("market-listing/{listingId}")]
    [Authorize(Roles = "CooperativeManager")]
    public async Task<IActionResult> DeleteMarketListing(Guid listingId)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var cooperative = await _db.Cooperatives
            .FirstOrDefaultAsync(c => c.ManagerId == userId.Value);

        if (cooperative == null) return NotFound("Cooperative not found");

        var listing = await _db.MarketListings
            .Include(l => l.Images)
            .FirstOrDefaultAsync(l => l.Id == listingId && l.CooperativeId == cooperative.Id);

        if (listing == null) return NotFound("Listing not found in your cooperative");

        // Check if there are active orders
        var hasActiveOrders = await _db.BuyerOrders
            .AnyAsync(o => o.MarketListingId == listingId && o.Status == "Open");

        if (hasActiveOrders)
        {
            return BadRequest("Cannot delete listing with active orders. Cancel or complete orders first.");
        }

        // Mark as cancelled instead of hard delete
        listing.Status = "Cancelled";
        await _db.SaveChangesAsync();

        return Ok(new { Message = "Listing cancelled successfully" });
    }

    // ============ IMAGE MANAGEMENT ============
    
    [HttpPost("market-listing/{listingId}/images")]
    [Authorize(Roles = "CooperativeManager")]
    public async Task<IActionResult> AddListingImages(Guid listingId, [FromBody] List<AddListingImageRequest> images)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var cooperative = await _db.Cooperatives
            .FirstOrDefaultAsync(c => c.ManagerId == userId.Value);

        if (cooperative == null) return NotFound("Cooperative not found");

        var listing = await _db.MarketListings
            .Include(l => l.Images)
            .FirstOrDefaultAsync(l => l.Id == listingId && l.CooperativeId == cooperative.Id);

        if (listing == null) return NotFound("Listing not found in your cooperative");

        var addedImages = new List<object>();
        var failedImages = new List<object>();
        var uploadsDir = Path.Combine(Directory.GetCurrentDirectory(), "uploads", "listings");
        Directory.CreateDirectory(uploadsDir);

        foreach (var imageRequest in images)
        {
            try
            {
                // Decode base64 and save file
                var imageBytes = Convert.FromBase64String(imageRequest.ImageBase64);
                var fileName = $"{Guid.NewGuid()}.jpg";
                var filePath = Path.Combine(uploadsDir, fileName);
                await System.IO.File.WriteAllBytesAsync(filePath, imageBytes);

                var listingImage = new ListingImage
                {
                    Id = Guid.NewGuid(),
                    MarketListingId = listingId,
                    ImageUrl = $"/uploads/listings/{fileName}",
                    DisplayOrder = imageRequest.DisplayOrder
                };

                _db.ListingImages.Add(listingImage);
                addedImages.Add(new { listingImage.Id, listingImage.ImageUrl, listingImage.DisplayOrder });
            }
            catch (Exception ex)
            {
                failedImages.Add(new { imageRequest.DisplayOrder, error = ex.Message });
            }
        }

        await _db.SaveChangesAsync();

        return Ok(new { AddedImages = addedImages, FailedImages = failedImages });
    }

    [HttpDelete("market-listing/{listingId}/images/{imageId}")]
    [Authorize(Roles = "CooperativeManager")]
    public async Task<IActionResult> DeleteListingImage(Guid listingId, Guid imageId)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var cooperative = await _db.Cooperatives
            .FirstOrDefaultAsync(c => c.ManagerId == userId.Value);

        if (cooperative == null) return NotFound("Cooperative not found");

        var listing = await _db.MarketListings
            .FirstOrDefaultAsync(l => l.Id == listingId && l.CooperativeId == cooperative.Id);

        if (listing == null) return NotFound("Listing not found in your cooperative");

        var image = await _db.ListingImages
            .FirstOrDefaultAsync(i => i.Id == imageId && i.MarketListingId == listingId);

        if (image == null) return NotFound("Image not found");

        // Delete file from disk
        var filePath = Path.Combine(Directory.GetCurrentDirectory(), image.ImageUrl.TrimStart('/'));
        if (System.IO.File.Exists(filePath))
        {
            System.IO.File.Delete(filePath);
        }

        _db.ListingImages.Remove(image);
        await _db.SaveChangesAsync();

        return Ok(new { Message = "Image deleted successfully" });
    }

    private static string BuildStructuredListingDescription(decimal? marketPriceReference, string? location, string? description)
    {
        var parts = new List<string>();
        if (marketPriceReference.HasValue)
        {
            parts.Add($"MarketRef:{marketPriceReference.Value}");
        }

        if (!string.IsNullOrWhiteSpace(location))
        {
            parts.Add($"Location:{location.Trim()}");
        }

        if (!string.IsNullOrWhiteSpace(description))
        {
            parts.Add(description.Trim());
        }

        return string.Join(";", parts);
    }

    private static (decimal? MarketPriceReference, string? Location, string Description) ParseStructuredListingMetadata(string? rawDescription)
    {
        var value = rawDescription ?? string.Empty;
        decimal? marketPriceReference = null;
        string? location = null;
        var description = value;

        if (value.StartsWith("MarketRef:", StringComparison.OrdinalIgnoreCase))
        {
            var firstSeparator = value.IndexOf(';');
            if (firstSeparator > "MarketRef:".Length)
            {
                var marketRefValue = value.Substring("MarketRef:".Length, firstSeparator - "MarketRef:".Length);
                if (decimal.TryParse(marketRefValue, out var parsedMarketRef))
                {
                    marketPriceReference = parsedMarketRef;
                }

                description = value[(firstSeparator + 1)..];
            }
        }

        if (description.StartsWith("Location:", StringComparison.OrdinalIgnoreCase))
        {
            var secondSeparator = description.IndexOf(';');
            if (secondSeparator > "Location:".Length)
            {
                location = description.Substring("Location:".Length, secondSeparator - "Location:".Length).Trim();
                description = description[(secondSeparator + 1)..];
            }
            else
            {
                location = description["Location:".Length..].Trim();
                description = string.Empty;
            }
        }

        return (marketPriceReference, location, description.Trim());
    }

    private static string NormalizeProvinceLoose(string? region)
    {
        var normalized = RwandaAdminData.NormalizeProvince(region);
        return string.IsNullOrWhiteSpace(normalized) ? (region ?? string.Empty).Trim() : normalized;
    }

    private static string? NormalizeDistrictLoose(string? district)
    {
        if (string.IsNullOrWhiteSpace(district)) return null;
        return RwandaAdminData.FindDistrict(district) ?? district.Trim();
    }

    private static bool SameLoose(string? left, string? right)
    {
        return string.Equals((left ?? string.Empty).Trim(), (right ?? string.Empty).Trim(), StringComparison.OrdinalIgnoreCase);
    }

    private static PriceRegulation? FindApplicableRegulation(
        IEnumerable<PriceRegulation> regulations,
        string crop,
        string cooperativeRegion,
        string? cooperativeDistrict)
    {
        var cropScoped = regulations
            .Where(r => SameLoose(r.Crop, crop))
            .ToList();
        if (cropScoped.Count == 0) return null;

        if (!string.IsNullOrWhiteSpace(cooperativeDistrict))
        {
            var districtSpecific = cropScoped.FirstOrDefault(r =>
                !string.IsNullOrWhiteSpace(r.District) &&
                SameLoose(NormalizeDistrictLoose(r.District), cooperativeDistrict));
            if (districtSpecific != null) return districtSpecific;
        }

        return cropScoped.FirstOrDefault(r =>
            string.IsNullOrWhiteSpace(r.Market) &&
            string.IsNullOrWhiteSpace(r.District) &&
            SameLoose(NormalizeProvinceLoose(r.Region), cooperativeRegion));
    }
}

