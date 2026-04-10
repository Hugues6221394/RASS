using BCrypt.Net;
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
public class FarmersController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IHubContext<NotificationHub> _hubContext;
    private readonly CatalogManagementService _catalog;

    public FarmersController(AppDbContext db, IHubContext<NotificationHub> hubContext, CatalogManagementService catalog)
    {
        _db = db;
        _hubContext = hubContext;
        _catalog = catalog;
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

    /// <summary>
    /// Farmer requests profile update (goes to cooperative for approval)
    /// </summary>
    [HttpPut("profile")]
    [Authorize(Roles = "Farmer")]
    public async Task<IActionResult> UpdateProfile(UpdateFarmerProfileRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var farmer = await _db.Farmers
            .Include(f => f.User)
            .FirstOrDefaultAsync(f => f.UserId == userId.Value);

        if (farmer == null) return NotFound();

        var requestedChanges = new
        {
            fullName = request.FullName,
            phone = request.Phone,
            district = request.District,
            sector = request.Sector,
            crops = request.Crops,
            farmSizeHectares = request.FarmSizeHectares
        };

        if (farmer.CooperativeId.HasValue)
        {
            var cooperativeManagerIds = await _db.Cooperatives
                .Where(c => c.Id == farmer.CooperativeId.Value && c.ManagerId != null)
                .Select(c => c.ManagerId!.Value)
                .ToListAsync();

            if (cooperativeManagerIds.Count > 0)
            {
                var now = DateTime.UtcNow;
                var notifications = cooperativeManagerIds.Select(managerId => new Notification
                {
                    Id = Guid.NewGuid(),
                    UserId = managerId,
                    Title = "Farmer Profile Update Request",
                    Message = $"{farmer.User.FullName} submitted a profile update request for review.",
                    Type = "profile.update.request",
                    IsRead = false,
                    ActionUrl = "/cooperative-dashboard",
                    CreatedAt = now
                });
                _db.Notifications.AddRange(notifications);
            }
        }

        _db.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            Action = "FarmerProfileUpdateRequested",
            Actor = farmer.User.Email,
            EntityType = "Farmer",
            EntityId = farmer.Id.ToString(),
            Metadata = System.Text.Json.JsonSerializer.Serialize(requestedChanges),
            Timestamp = DateTime.UtcNow
        });

        await _db.SaveChangesAsync();
        return Ok(new { message = "Profile update request submitted to cooperative manager for review." });
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
            PasswordHash = "", // Pending activation
            IsActive = false   // Pending activation
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

        // Persist in-app welcome notification
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

        string cropName;
        try
        {
            cropName = await _catalog.EnsureCropAsync(request.Crop, userId, "Farmer", false);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }

        var declaration = new HarvestDeclaration
        {
            Id = Guid.NewGuid(),
            FarmerId = farmer.Id,
            Crop = cropName,
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

        return Created("", new { declaration.Id, declaration.Status, message = "Harvest declaration submitted successfully." });
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

        // Support enhanced review with condition notes (backwards compatible)
        if (Request.ContentType?.Contains("json") == true)
        {
            try
            {
                using var reader = new StreamReader(Request.Body);
                var body = System.Text.Json.JsonDocument.Parse("{}"); // already deserialized
            }
            catch { /* ignore */ }
        }

        await _db.SaveChangesAsync();

        return Ok(new { declaration.Id, declaration.Status });
    }

    /// <summary>
    /// Enhanced harvest declaration review with mandatory condition assessment.
    /// Cooperative managers must document the crop condition during approval.
    /// </summary>
    [HttpPost("harvest-declaration/{id}/review-enhanced")]
    [Authorize(Roles = "CooperativeManager")]
    public async Task<IActionResult> ReviewHarvestDeclarationEnhanced(Guid id, ReviewHarvestDeclarationEnhancedRequest request)
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
            return Forbid("You can only review declarations from your cooperative");

        if (string.IsNullOrWhiteSpace(request.ConditionGrade))
            return BadRequest("Condition grade is required when reviewing a harvest declaration.");
        if (string.IsNullOrWhiteSpace(request.ConditionNote))
            return BadRequest("A condition note describing the crop state is required.");

        var validGrades = new[] { "Excellent", "Good", "MinorDefects", "ModerateDamage", "HighSpoilage" };
        if (!validGrades.Contains(request.ConditionGrade))
            return BadRequest($"Invalid condition grade. Must be one of: {string.Join(", ", validGrades)}");

        declaration.Status = request.Status;
        declaration.ConditionGrade = request.ConditionGrade;
        declaration.ConditionNote = request.ConditionNote;
        declaration.ReviewedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        return Ok(new { declaration.Id, declaration.Status, declaration.ConditionGrade, declaration.ConditionNote });
    }

    /// <summary>
    /// Update harvest declaration (only if status is Pending)
    /// </summary>
    [HttpPut("harvest-declaration/{id}")]
    [Authorize(Roles = "Farmer")]
    public async Task<IActionResult> UpdateHarvestDeclaration(Guid id, UpdateHarvestDeclarationRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var farmer = await _db.Farmers.FirstOrDefaultAsync(f => f.UserId == userId.Value);
        if (farmer == null) return NotFound("Farmer not found");

        var declaration = await _db.HarvestDeclarations
            .FirstOrDefaultAsync(d => d.Id == id && d.FarmerId == farmer.Id);

        if (declaration == null) return NotFound("Declaration not found");

        if (declaration.Status is "Approved" or "Completed")
        {
            return BadRequest("This declaration can no longer be updated.");
        }

        if (!string.IsNullOrEmpty(request.Crop))
        {
            try
            {
                declaration.Crop = await _catalog.EnsureCropAsync(request.Crop, userId, "Farmer", false);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }
        if (request.ExpectedQuantityKg.HasValue) declaration.ExpectedQuantityKg = request.ExpectedQuantityKg.Value;
        if (request.ExpectedHarvestDate.HasValue)
        {
            declaration.ExpectedHarvestDate = request.ExpectedHarvestDate.Value.Kind == DateTimeKind.Utc
                ? request.ExpectedHarvestDate.Value
                : request.ExpectedHarvestDate.Value.ToUniversalTime();
        }
        if (!string.IsNullOrEmpty(request.QualityIndicators)) declaration.QualityIndicators = request.QualityIndicators;

        await _db.SaveChangesAsync();

        return Ok(new { declaration.Id, message = "Declaration updated" });
    }

    /// <summary>
    /// Cancel/delete harvest declaration (only if status is Pending)
    /// </summary>
    [HttpDelete("harvest-declaration/{id}")]
    [Authorize(Roles = "Farmer")]
    public async Task<IActionResult> CancelHarvestDeclaration(Guid id)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var farmer = await _db.Farmers.FirstOrDefaultAsync(f => f.UserId == userId.Value);
        if (farmer == null) return NotFound("Farmer not found");

        var declaration = await _db.HarvestDeclarations
            .FirstOrDefaultAsync(d => d.Id == id && d.FarmerId == farmer.Id);

        if (declaration == null) return NotFound("Declaration not found");

        if (declaration.Status is "Approved" or "Completed")
        {
            return BadRequest("This declaration can no longer be cancelled.");
        }

        _db.HarvestDeclarations.Remove(declaration);
        await _db.SaveChangesAsync();

        return Ok(new { message = "Declaration deleted" });
    }

    [HttpGet("profile-update-requests")]
    [Authorize(Roles = "Farmer")]
    public async Task<IActionResult> GetMyProfileUpdateRequests([FromQuery] int take = 60)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();
        var farmer = await _db.Farmers.FirstOrDefaultAsync(f => f.UserId == userId.Value);
        if (farmer == null) return NotFound("Farmer not found");

        var rows = await _db.AuditLogs
            .Where(a => a.EntityType == "Farmer" && a.EntityId == farmer.Id.ToString() &&
                        (a.Action == "FarmerProfileUpdateRequested" || a.Action == "FarmerProfileUpdateApproved" || a.Action == "FarmerProfileUpdateRejected"))
            .OrderBy(a => a.Timestamp)
            .Take(Math.Clamp(take, 1, 200))
            .Select(a => new
            {
                a.Id,
                a.Action,
                a.Actor,
                a.Metadata,
                a.Timestamp
            })
            .ToListAsync();

        var pendingRequests = new List<(Guid Id, string Action, string Actor, string? Metadata, DateTime Timestamp)>();
        var timeline = new List<(Guid Id, string Action, string Actor, string? Metadata, DateTime Timestamp)>();
        foreach (var row in rows)
        {
            var item = (row.Id, row.Action, row.Actor, row.Metadata, row.Timestamp);
            if (row.Action == "FarmerProfileUpdateRequested")
            {
                pendingRequests.Add(item);
                continue;
            }

            if (pendingRequests.Count > 0)
            {
                pendingRequests.RemoveAt(pendingRequests.Count - 1);
            }
            timeline.Add(item);
        }

        timeline.AddRange(pendingRequests);

        var response = timeline
            .OrderByDescending(a => a.Timestamp)
            .Select(a => new
        {
            a.Id,
            Status = a.Action == "FarmerProfileUpdateApproved" ? "Approved" :
                     a.Action == "FarmerProfileUpdateRejected" ? "Rejected" : "Pending",
            a.Action,
            a.Timestamp,
            Details = string.IsNullOrWhiteSpace(a.Metadata) ? null : a.Metadata
        });

        return Ok(response);
    }

    [HttpDelete("profile-update-requests/{id}")]
    [Authorize(Roles = "Farmer")]
    public async Task<IActionResult> DeleteMyProfileUpdateRequestHistory(Guid id)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();
        var farmer = await _db.Farmers.FirstOrDefaultAsync(f => f.UserId == userId.Value);
        if (farmer == null) return NotFound("Farmer not found");

        var row = await _db.AuditLogs.FirstOrDefaultAsync(a =>
            a.Id == id &&
            a.EntityType == "Farmer" &&
            a.EntityId == farmer.Id.ToString() &&
            a.Action == "FarmerProfileUpdateApproved");
        if (row == null) return NotFound("History entry not found.");

        var previousRequest = await _db.AuditLogs
            .Where(a => a.EntityType == "Farmer" &&
                        a.EntityId == farmer.Id.ToString() &&
                        a.Action == "FarmerProfileUpdateRequested" &&
                        a.Timestamp <= row.Timestamp)
            .OrderByDescending(a => a.Timestamp)
            .FirstOrDefaultAsync();

        _db.AuditLogs.Remove(row);
        if (previousRequest != null) _db.AuditLogs.Remove(previousRequest);
        await _db.SaveChangesAsync();
        return Ok(new { message = "Profile update history deleted." });
    }

    /// <summary>
    /// Get farmer's payment history
    /// </summary>
    [HttpGet("payments")]
    [Authorize(Roles = "Farmer")]
    public async Task<IActionResult> GetPayments()
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var farmer = await _db.Farmers.FirstOrDefaultAsync(f => f.UserId == userId.Value);
        if (farmer == null) return NotFound("Farmer not found");

        var directPayments = await _db.FarmerBalances
            .Where(fb => fb.FarmerId == farmer.Id)
            .OrderByDescending(fb => fb.CreatedAt)
            .Select(fb => new
            {
                fb.Id,
                fb.Amount,
                fb.Status,
                Reference = fb.TransactionReference,
                fb.CreatedAt
            })
            .ToListAsync();

        var contractsWithContribution = await _db.ContractLots
            .Include(cl => cl.Contract).ThenInclude(c => c.PaymentLedgers)
            .Include(cl => cl.Lot).ThenInclude(l => l.Contributions)
            .Where(cl =>
                cl.Contract != null &&
                cl.Lot != null &&
                cl.Lot.Contributions.Any(c => c.FarmerId == farmer.Id))
            .Select(cl => new
            {
                cl.ContractId,
                ContractValue = cl.Contract.TotalValue,
                PaidLedger = cl.Contract.PaymentLedgers
                    .Where(p => p.Status == "Completed" && (p.Type == "EscrowRelease" || p.Type == "EscrowDeposit"))
                    .OrderByDescending(p => p.CreatedAt)
                    .Select(p => new { p.Reference, p.CreatedAt, p.Amount })
                    .FirstOrDefault(),
                FarmerContribution = cl.Lot.Contributions
                    .Where(c => c.FarmerId == farmer.Id)
                    .Select(c => c.QuantityKg)
                    .FirstOrDefault(),
                TotalContributed = cl.Lot.Contributions.Sum(c => c.QuantityKg)
            })
            .ToListAsync();

        var existingContractIds = directPayments
            .Select(p => p.Reference)
            .Where(r => !string.IsNullOrWhiteSpace(r))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var derived = contractsWithContribution
            .Where(x => x.PaidLedger != null && x.TotalContributed > 0)
            .GroupBy(x => x.ContractId)
            .Select(g =>
            {
                var first = g.First();
                var shareRatio = g.Sum(x => x.FarmerContribution) / g.Sum(x => x.TotalContributed);
                return new
                {
                    Id = Guid.NewGuid(),
                    Amount = first.ContractValue * (decimal)shareRatio,
                    Status = "Paid",
                    Reference = first.PaidLedger!.Reference,
                    CreatedAt = first.PaidLedger.CreatedAt
                };
            })
            .Where(x => !existingContractIds.Contains(x.Reference))
            .ToList();

        var payments = directPayments.Concat(derived).OrderByDescending(p => p.CreatedAt).ToList();
        return Ok(payments);
    }

    [HttpGet("crop-recommendations")]
    [Authorize(Roles = "Farmer")]
    public async Task<IActionResult> GetCropRecommendations()
    {
        var topDemand = await _db.BuyerOrders
            .Where(o => o.Status == "Open" || o.Status == "Accepted")
            .GroupBy(o => o.Crop)
            .Select(g => new { Crop = g.Key, DemandKg = g.Sum(o => o.QuantityKg) })
            .ToListAsync();

        var availableSupply = await _db.Lots
            .Where(l => l.Status == "Stored" || l.Status == "Listed")
            .GroupBy(l => l.Crop)
            .Select(g => new { Crop = g.Key, SupplyKg = g.Sum(l => l.QuantityKg) })
            .ToListAsync();

        var latestPrices = await _db.MarketPrices
            .GroupBy(p => p.Crop)
            .Select(g => new
            {
                Crop = g.Key,
                AvgPrice = g.OrderByDescending(x => x.ObservedAt).Take(10).Average(x => x.PricePerKg)
            })
            .ToListAsync();

        var supplyMap = availableSupply.ToDictionary(x => x.Crop, x => x.SupplyKg, StringComparer.OrdinalIgnoreCase);
        var priceMap = latestPrices.ToDictionary(x => x.Crop, x => x.AvgPrice, StringComparer.OrdinalIgnoreCase);

        var recommendations = topDemand
            .Select(d =>
            {
                var supply = supplyMap.TryGetValue(d.Crop, out var s) ? s : 0;
                var deficit = Math.Max(0, d.DemandKg - supply);
                var avgPrice = priceMap.TryGetValue(d.Crop, out var p) ? p : 0;
                return new
                {
                    crop = d.Crop,
                    demandKg = d.DemandKg,
                    supplyKg = supply,
                    deficitKg = deficit,
                    avgPricePerKg = avgPrice,
                    score = deficit * 0.7 + (double)avgPrice * 0.3
                };
            })
            .Where(x => x.deficitKg > 0)
            .OrderByDescending(x => x.score)
            .Take(6)
            .ToList();

        if (recommendations.Count == 0)
        {
            recommendations = latestPrices
                .OrderByDescending(x => x.AvgPrice)
                .Take(6)
                .Select(x => new
                {
                    crop = x.Crop,
                    demandKg = 0d,
                    supplyKg = 0d,
                    deficitKg = 0d,
                    avgPricePerKg = x.AvgPrice,
                    score = (double)x.AvgPrice
                })
                .ToList();
        }

        return Ok(new { recommendations, generatedAt = DateTime.UtcNow });
    }

    /// <summary>
    /// Submit feedback report
    /// </summary>
    [HttpPost("feedback")]
    [Authorize(Roles = "Farmer")]
    public async Task<IActionResult> SubmitFeedback(SubmitFeedbackRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var farmer = await _db.Farmers
            .Include(f => f.User)
            .FirstOrDefaultAsync(f => f.UserId == userId.Value);
        if (farmer == null) return NotFound("Farmer not found");

        // Log feedback as audit entry
        _db.AuditLogs.Add(new AuditLog
        {
            Action = "FeedbackSubmitted",
            Actor = farmer.User.Email,
            EntityType = "Feedback",
            EntityId = Guid.NewGuid().ToString(),
            Metadata = System.Text.Json.JsonSerializer.Serialize(new
            {
                request.Category,
                request.Subject,
                request.Message,
                FarmerId = farmer.Id,
                SubmittedAt = DateTime.UtcNow
            })
        });
        await _db.SaveChangesAsync();

        return Ok(new { message = "Feedback submitted successfully" });
    }

    /// <summary>
    /// Get cooperative announcements for farmer
    /// </summary>
    [HttpGet("announcements")]
    [Authorize(Roles = "Farmer")]
    public async Task<IActionResult> GetAnnouncements()
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var farmer = await _db.Farmers.FirstOrDefaultAsync(f => f.UserId == userId.Value);
        if (farmer == null) return NotFound("Farmer not found");

        var notifications = await _db.Notifications
            .Where(n => n.UserId == userId.Value ||
                       (farmer.CooperativeId.HasValue && n.ActionUrl != null &&
                        n.ActionUrl.Contains(farmer.CooperativeId.Value.ToString())))
            .OrderByDescending(n => n.CreatedAt)
            .Take(20)
            .Select(n => new
            {
                n.Id,
                n.Title,
                Body = n.Message,
                n.Type,
                n.IsRead,
                n.CreatedAt
            })
            .ToListAsync();

        return Ok(notifications);
    }

    private Guid? GetUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier) ??
                    User.FindFirst(JwtRegisteredClaimNames.Sub) ??
                    User.FindFirst("sub") ??
                    User.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier");
        return Guid.TryParse(claim?.Value, out var guid) ? guid : null;
    }

    private async Task SendSmsConfirmation(string phone, string name)
    {
        var farmer = await _db.Farmers
            .Include(f => f.User)
            .FirstOrDefaultAsync(f => f.Phone == phone);
        if (farmer?.User == null) return;

        _db.Notifications.Add(new Notification
        {
            Id = Guid.NewGuid(),
            UserId = farmer.User.Id,
            Title = "Welcome to RASS",
            Message = $"Welcome {name}! Your RASS account has been created.",
            Type = "account.welcome",
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync();
    }

    private async Task NotifyCooperativeManager(Guid cooperativeId, HarvestDeclaration declaration)
    {
        var farmerName = await _db.Farmers
            .Include(f => f.User)
            .Where(f => f.Id == declaration.FarmerId)
            .Select(f => f.User.FullName)
            .FirstOrDefaultAsync() ?? "Farmer";
        var cooperativeManagerIds = await _db.Cooperatives
            .Where(c => c.Id == cooperativeId)
            .Select(c => c.ManagerId)
            .Where(managerId => managerId != null)
            .Select(managerId => managerId!.Value)
            .ToListAsync();

        if (!cooperativeManagerIds.Any()) return;

        var message = $"New harvest declaration from {farmerName}";
        var createdAt = DateTime.UtcNow;
        var notifications = cooperativeManagerIds.Select(userId => new Notification
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Title = "New Harvest Declaration",
            Message = message,
            Type = "harvest.declaration",
            IsRead = false,
            ActionUrl = $"/cooperative-dashboard/declarations/{declaration.Id}",
            CreatedAt = createdAt
        });

        _db.Notifications.AddRange(notifications);
        await _db.SaveChangesAsync();

        foreach (var note in notifications)
        {
            await _hubContext.Clients.Group($"user-{note.UserId}")
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
}

