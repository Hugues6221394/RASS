using BCrypt.Net;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Rass.Api.Data;
using Rass.Api.Domain.Entities;
using Rass.Api.Dtos;
using System.Text.Json.Nodes;

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

    private void AddAuditLog(
        string action,
        string entityType,
        string? entityId,
        string actionType,
        object? beforeState = null,
        object? afterState = null)
    {
        var actorId = User.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")?.Value
            ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
            ?? "Admin";
        var actorRole = User.Claims
            .Where(c => c.Type == System.Security.Claims.ClaimTypes.Role)
            .Select(c => c.Value)
            .FirstOrDefault() ?? "Admin";
        var actorName = User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value
            ?? User.FindFirst("name")?.Value
            ?? actorId;
        var metadata = new JsonObject
        {
            ["actor_id"] = actorId,
            ["actor_name"] = actorName,
            ["actor_role"] = actorRole,
            ["action_type"] = actionType,
            ["entity_type"] = entityType,
            ["entity_id"] = entityId,
            ["before_state"] = beforeState is null ? null : JsonSerializer.SerializeToNode(beforeState),
            ["after_state"] = afterState is null ? null : JsonSerializer.SerializeToNode(afterState),
            ["ip_address"] = HttpContext.Connection.RemoteIpAddress?.ToString(),
            ["device_info"] = Request.Headers.UserAgent.ToString()
        };
        var ipAddr = HttpContext.Connection.RemoteIpAddress?.ToString();
        var deviceStr = Request.Headers.UserAgent.ToString();
        _db.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            Action = action,
            Actor = actorId,
            ActorRole = actorRole,
            ActionType = actionType,
            EntityType = entityType,
            EntityId = entityId,
            IpAddress = ipAddr,
            DeviceInfo = deviceStr?.Length > 500 ? deviceStr[..500] : deviceStr,
            BeforeState = beforeState is null ? null : JsonSerializer.Serialize(beforeState),
            AfterState = afterState is null ? null : JsonSerializer.Serialize(afterState),
            Metadata = metadata.ToJsonString(),
            Timestamp = DateTime.UtcNow
        });
    }

    private static string HumanizeToken(string token)
    {
        if (string.IsNullOrWhiteSpace(token)) return string.Empty;
        var chars = new List<char>(token.Length + 6);
        for (var i = 0; i < token.Length; i++)
        {
            var c = token[i];
            if (i > 0 && char.IsUpper(c) && char.IsLower(token[i - 1])) chars.Add(' ');
            chars.Add(c == '-' || c == '_' ? ' ' : char.ToLowerInvariant(c));
        }
        return string.Join(' ', new string(chars.ToArray()).Split(' ', StringSplitOptions.RemoveEmptyEntries));
    }

    private static string BuildFriendlyApiAction(string? method, string? path, int? statusCode)
    {
        var normalizedMethod = string.IsNullOrWhiteSpace(method) ? "GET" : method!.ToUpperInvariant();
        var segments = (path ?? string.Empty)
            .Trim('/')
            .Split('/', StringSplitOptions.RemoveEmptyEntries)
            .Where(s => !s.Equals("api", StringComparison.OrdinalIgnoreCase))
            .Where(s => !Guid.TryParse(s, out _))
            .Select(HumanizeToken)
            .Where(s => !string.IsNullOrWhiteSpace(s))
            .ToList();
        var target = segments.Count > 0 ? string.Join(' ', segments) : "system endpoint";
        var baseVerb = normalizedMethod switch
        {
            "GET" => "Viewed",
            "POST" => "Created",
            "PUT" => "Updated",
            "PATCH" => "Updated",
            "DELETE" => "Deleted",
            _ => "Accessed"
        };
        if (statusCode.HasValue && statusCode.Value >= 400)
        {
            var failureVerb = normalizedMethod switch
            {
                "GET" => "Failed to view",
                "POST" => "Failed to create",
                "PUT" => "Failed to update",
                "PATCH" => "Failed to update",
                "DELETE" => "Failed to delete",
                _ => "Failed to access"
            };
            return $"{failureVerb} {target} ({statusCode.Value})";
        }
        return $"{baseVerb} {target}";
    }

    private static string GetFriendlyAction(AuditLog log)
    {
        if (!string.IsNullOrWhiteSpace(log.Action) && !log.Action.StartsWith("API_", StringComparison.OrdinalIgnoreCase))
            return log.Action;

        string? method = null;
        var path = log.EntityId;
        int? statusCode = null;
        if (!string.IsNullOrWhiteSpace(log.Metadata))
        {
            try
            {
                using var doc = JsonDocument.Parse(log.Metadata);
                if (doc.RootElement.TryGetProperty("method", out var m) && m.ValueKind == JsonValueKind.String) method = m.GetString();
                if (doc.RootElement.TryGetProperty("path", out var p) && p.ValueKind == JsonValueKind.String) path = p.GetString();
                if (doc.RootElement.TryGetProperty("statusCode", out var s) && s.TryGetInt32(out var parsed)) statusCode = parsed;
            }
            catch
            {
                // best-effort formatting
            }
        }
        if (string.IsNullOrWhiteSpace(method) && !string.IsNullOrWhiteSpace(log.Action) && log.Action.StartsWith("API_", StringComparison.OrdinalIgnoreCase))
        {
            var parts = log.Action.Split('_', StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length >= 2) method = parts[1];
            if (parts.Length >= 3 && int.TryParse(parts[2], out var parsedStatus)) statusCode = parsedStatus;
        }
        return BuildFriendlyApiAction(method, path, statusCode);
    }

    private static string? ReadMetadataString(AuditLog log, string key)
    {
        if (string.IsNullOrWhiteSpace(log.Metadata)) return null;
        try
        {
            using var doc = JsonDocument.Parse(log.Metadata);
            if (doc.RootElement.TryGetProperty(key, out var node) && node.ValueKind == JsonValueKind.String)
            {
                return node.GetString();
            }
        }
        catch
        {
            // ignore metadata parsing errors for display fallback
        }
        return null;
    }

    private static string ResolveActorName(AuditLog log, IReadOnlyDictionary<Guid, string> userNames)
    {
        var metadataActorName = ReadMetadataString(log, "actor_name");
        if (!string.IsNullOrWhiteSpace(metadataActorName)) return metadataActorName!;
        if (Guid.TryParse(log.Actor, out var actorId) && userNames.TryGetValue(actorId, out var fullName))
            return fullName;
        return string.IsNullOrWhiteSpace(log.Actor) ? "System" : log.Actor;
    }

    private static string ResolveActorRole(AuditLog log, IReadOnlyDictionary<Guid, string> userRoles)
    {
        var metadataActorRole = ReadMetadataString(log, "actor_role");
        if (!string.IsNullOrWhiteSpace(metadataActorRole)) return metadataActorRole!;
        if (Guid.TryParse(log.Actor, out var actorId) && userRoles.TryGetValue(actorId, out var roleName))
            return roleName;
        return "System";
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
                Roles = u.UserRoles.Select(r => r.Role.Name).ToList(),
                Phone = _db.Farmers.Where(f => f.UserId == u.Id).Select(f => f.Phone).FirstOrDefault()
                    ?? _db.BuyerProfiles.Where(b => b.UserId == u.Id).Select(b => b.Phone).FirstOrDefault()
                    ?? _db.TransporterProfiles.Where(t => t.UserId == u.Id).Select(t => t.Phone).FirstOrDefault()
                    ?? _db.Cooperatives.Where(c => c.ManagerId == u.Id).Select(c => c.Phone).FirstOrDefault()
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
        AddAuditLog(
            "UserCreated",
            "USER",
            user.Id.ToString(),
            "CREATE",
            null,
            new { user.FullName, user.Email, role = role.Name, user.IsActive });
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
        var beforeState = new { user.FullName, user.Email, user.IsActive };

        // Remove user roles first
        var userRoles = await _db.UserRoles.Where(ur => ur.UserId == userId).ToListAsync();
        _db.UserRoles.RemoveRange(userRoles);

        _db.Users.Remove(user);
        AddAuditLog("UserDeleted", "USER", userId.ToString(), "DELETE", beforeState, null);
        await _db.SaveChangesAsync();

        return Ok(new { message = "User deleted successfully" });
    }

    [HttpPut("users/{userId}")]
    public async Task<IActionResult> UpdateUser(Guid userId, [FromBody] UpdateUserRequest request)
    {
        var user = await _db.Users
            .Include(u => u.UserRoles)
            .FirstOrDefaultAsync(u => u.Id == userId);
        if (user == null) return NotFound("User not found");
        var currentRole = await _db.UserRoles
            .Include(ur => ur.Role)
            .Where(ur => ur.UserId == user.Id)
            .Select(ur => ur.Role.Name)
            .FirstOrDefaultAsync();
        var beforeState = new
        {
            user.FullName,
            user.Email,
            Role = currentRole,
            user.IsActive,
            Phone = await _db.Farmers.Where(f => f.UserId == userId).Select(f => f.Phone).FirstOrDefaultAsync()
                ?? await _db.BuyerProfiles.Where(b => b.UserId == userId).Select(b => b.Phone).FirstOrDefaultAsync()
                ?? await _db.TransporterProfiles.Where(t => t.UserId == userId).Select(t => t.Phone).FirstOrDefaultAsync()
                ?? await _db.Cooperatives.Where(c => c.ManagerId == userId).Select(c => c.Phone).FirstOrDefaultAsync()
        };

        if (!string.IsNullOrWhiteSpace(request.Email))
        {
            var normalized = request.Email.Trim();
            var exists = await _db.Users.AnyAsync(u => u.Email == normalized && u.Id != userId);
            if (exists) return Conflict("Another user already uses that email.");
            user.Email = normalized;
        }

        if (!string.IsNullOrWhiteSpace(request.FullName))
        {
            user.FullName = request.FullName.Trim();
        }

        if (!string.IsNullOrWhiteSpace(request.Role))
        {
            var role = await _db.Roles.FirstOrDefaultAsync(r => r.Name == request.Role);
            if (role == null) return BadRequest($"Role '{request.Role}' not found.");
            _db.UserRoles.RemoveRange(user.UserRoles);
            _db.UserRoles.Add(new UserRole { UserId = user.Id, RoleId = role.Id });
        }

        if (request.IsActive.HasValue) user.IsActive = request.IsActive.Value;
        string? normalizedPhone = null;
        if (!string.IsNullOrWhiteSpace(request.Phone))
        {
            normalizedPhone = request.Phone.Trim();
            var farmer = await _db.Farmers.FirstOrDefaultAsync(f => f.UserId == userId);
            if (farmer != null) farmer.Phone = normalizedPhone;
            var buyer = await _db.BuyerProfiles.FirstOrDefaultAsync(b => b.UserId == userId);
            if (buyer != null) buyer.Phone = normalizedPhone;
            var transporter = await _db.TransporterProfiles.FirstOrDefaultAsync(t => t.UserId == userId);
            if (transporter != null) transporter.Phone = normalizedPhone;
            var cooperative = await _db.Cooperatives.FirstOrDefaultAsync(c => c.ManagerId == userId);
            if (cooperative != null) cooperative.Phone = normalizedPhone;
        }

        var finalRole = await _db.UserRoles
            .Include(ur => ur.Role)
            .Where(ur => ur.UserId == user.Id)
            .Select(ur => ur.Role.Name)
            .FirstOrDefaultAsync();
        AddAuditLog(
            "UserUpdated",
            "USER",
            userId.ToString(),
            "UPDATE",
            beforeState,
            new
            {
                user.FullName,
                user.Email,
                Role = finalRole,
                user.IsActive,
                Phone = normalizedPhone ?? beforeState.Phone
            });

        await _db.SaveChangesAsync();
        return Ok(new { user.Id, user.FullName, user.Email });
    }

    [HttpPost("users/{userId}/force-logout")]
    public async Task<IActionResult> ForceLogout(Guid userId)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (user == null) return NotFound("User not found");

        var beforeState = new { user.ResetOtp, user.ResetOtpExpiry };
        user.ResetOtp = $"FORCE-LOGOUT-{Guid.NewGuid():N}";
        user.ResetOtpExpiry = DateTime.UtcNow.AddMinutes(1);
        _db.Notifications.Add(new Notification
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Title = "Session ended by administrator",
            Message = "Please login again. Your session was ended by system administration.",
            Type = "Warning",
            ActionUrl = "/login"
        });
        AddAuditLog(
            "UserForceLogout",
            "USER",
            userId.ToString(),
            "UPDATE",
            beforeState,
            new { user.ResetOtp, user.ResetOtpExpiry });
        await _db.SaveChangesAsync();
        return Ok(new { message = "Force logout token issued." });
    }

    [HttpGet("transport-requests")]
    public async Task<IActionResult> GetTransportRequests()
    {
        var rows = await _db.TransportRequests
            .Include(t => t.Transporter).ThenInclude(tp => tp!.User)
            .Include(t => t.Contract).ThenInclude(c => c!.BuyerOrder)
            .OrderByDescending(t => t.CreatedAt)
            .Select(t => new
            {
                t.Id,
                t.Origin,
                t.Destination,
                t.LoadKg,
                t.Status,
                t.PickupStart,
                t.PickupEnd,
                t.CreatedAt,
                t.TransporterId,
                TransporterName = t.Transporter != null ? (t.Transporter.CompanyName != "" ? t.Transporter.CompanyName : t.Transporter.User.FullName) : null,
                ContractTrackingId = t.Contract != null ? t.Contract.TrackingId : null
            })
            .ToListAsync();
        return Ok(rows);
    }

    [HttpPost("transport-requests/{requestId}/assign")]
    public async Task<IActionResult> AssignTransportRequest(Guid requestId, [FromBody] AssignTransporterRequest request)
    {
        var row = await _db.TransportRequests.FirstOrDefaultAsync(t => t.Id == requestId);
        if (row == null) return NotFound("Transport request not found.");
        var transporter = await _db.TransporterProfiles.FirstOrDefaultAsync(t => t.Id == request.TransporterId && t.IsActive);
        if (transporter == null) return NotFound("Transporter not found.");
        row.TransporterId = transporter.Id;
        row.Status = "Assigned";
        row.AssignedAt = DateTime.UtcNow;
        row.DriverPhone = request.DriverPhone;
        _db.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            Action = "UPDATE",
            Actor = "Admin",
            EntityType = "LOGISTICS",
            EntityId = row.Id.ToString(),
            Metadata = JsonSerializer.Serialize(new { action_type = "ASSIGN", transporterId = transporter.Id, request.DriverPhone })
        });
        await _db.SaveChangesAsync();
        return Ok(new { message = "Transport request assigned." });
    }

    [HttpGet("system-stats")]
    public async Task<IActionResult> GetSystemStats()
    {
        var totalRevenue = await _db.PaymentLedgers
            .Where(p => p.Status == "Completed")
            .SumAsync(p => (decimal?)p.Amount) ?? 0;

        var totalOrders = await _db.BuyerOrders.CountAsync();
        var completedOrders = await _db.BuyerOrders.CountAsync(o => o.Status == "Completed");
        var pendingOrders = await _db.BuyerOrders.CountAsync(o => o.Status == "Pending");

        var stats = new
        {
            // User metrics
            TotalUsers = await _db.Users.CountAsync(),
            ActiveUsers = await _db.Users.CountAsync(u => u.IsActive),
            TotalFarmers = await _db.Farmers.CountAsync(),
            TotalBuyers = await _db.BuyerProfiles.CountAsync(),
            TotalCooperatives = await _db.Cooperatives.CountAsync(),
            VerifiedCooperatives = await _db.Cooperatives.CountAsync(c => c.IsVerified),
            TotalTransporters = await _db.TransporterProfiles.CountAsync(),

            // Transaction metrics
            TotalTransactions = await _db.PaymentLedgers.CountAsync(),
            CompletedTransactions = await _db.PaymentLedgers.CountAsync(p => p.Status == "Completed"),
            FailedTransactions = await _db.PaymentLedgers.CountAsync(p => p.Status == "Failed"),
            TotalRevenue = totalRevenue,
            AverageTransactionValue = totalRevenue > 0 ? totalRevenue / (decimal)(await _db.PaymentLedgers.CountAsync(p => p.Status == "Completed") + 0.1) : 0,

            // Order metrics
            TotalOrders = totalOrders,
            CompletedOrders = completedOrders,
            PendingOrders = pendingOrders,
            CancelledOrders = await _db.BuyerOrders.CountAsync(o => o.Status == "Cancelled"),
            AverageOrderValue = totalOrders > 0 ? (await _db.BuyerOrders.SumAsync(o => (decimal?)o.PriceOffer) ?? 0m) / totalOrders : 0m,

            // Market metrics
            ActiveListings = await _db.MarketListings.CountAsync(m => m.Status == "Active"),
            TotalListings = await _db.MarketListings.CountAsync(),
            UniqueCrops = await _db.MarketListings.Select(m => m.Crop).Distinct().CountAsync(),
            AverageListingPrice = await _db.MarketListings.Where(m => m.MinimumPrice > 0).AverageAsync(m => m.MinimumPrice),

            // Contract metrics
            TotalContracts = await _db.Contracts.CountAsync(),
            ActiveContracts = await _db.Contracts.CountAsync(c => c.Status == "Active"),
            CompletedContracts = await _db.Contracts.CountAsync(c => c.Status == "Completed"),

            // Logistics metrics
            TotalTransportRequests = await _db.TransportRequests.CountAsync(),
            CompletedTransports = await _db.TransportRequests.CountAsync(t => t.Status == "Completed"),
            PendingTransports = await _db.TransportRequests.CountAsync(t => t.Status == "Pending"),

            // Storage metrics
            TotalStorageFacilities = await _db.StorageFacilities.CountAsync(),
            TotalStorageCapacity = await _db.StorageFacilities.SumAsync(s => (double?)s.CapacityKg) ?? 0,
            UsedStorage = await _db.StorageFacilities.SumAsync(s => (double?)s.AvailableKg) ?? 0,

            // Harvest metrics
            TotalHarvestDeclarations = await _db.HarvestDeclarations.CountAsync(),
            TotalHarvestQuantity = await _db.HarvestDeclarations.SumAsync(h => (double?)h.ExpectedQuantityKg) ?? 0,
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
    [HttpPost("users/{userId}/suspend")]
    public async Task<IActionResult> SuspendUser(Guid userId, SuspendUserRequest request)
    {
        var user = await _db.Users.FindAsync(userId);
        if (user == null) return NotFound();
 
        var beforeActive = user.IsActive;
        user.IsActive = false;
        AddAuditLog(
            "UserSuspended",
            "USER",
            user.Id.ToString(),
            "UPDATE",
            new { user.Email, isActive = beforeActive, reason = (string?)null },
            new { user.Email, isActive = user.IsActive, reason = request.Reason });
        await _db.SaveChangesAsync();

        return Ok(new { user.Id, user.IsActive });
    }

    [HttpPost("user/{userId}/activate")]
    [HttpPost("users/{userId}/activate")]
    public async Task<IActionResult> ActivateUser(Guid userId)
    {
        var user = await _db.Users.FindAsync(userId);
        if (user == null) return NotFound();
 
        var beforeActive = user.IsActive;
        user.IsActive = true;
        AddAuditLog(
            "UserActivated",
            "USER",
            user.Id.ToString(),
            "UPDATE",
            new { user.Email, isActive = beforeActive },
            new { user.Email, isActive = user.IsActive });
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
    public async Task<IActionResult> GetAuditLogs([FromQuery] GetAuditLogsRequest request)
    {
        var query = _db.AuditLogs.AsQueryable();

        if (!string.IsNullOrEmpty(request.Action))
        {
            query = query.Where(l => l.Action.Contains(request.Action));
        }

        if (!string.IsNullOrEmpty(request.Actor))
        {
            query = query.Where(l => l.Actor.Contains(request.Actor) || (l.Metadata != null && l.Metadata.Contains(request.Actor)));
        }

        if (!string.IsNullOrEmpty(request.EntityType))
        {
            query = query.Where(l => l.EntityType != null && l.EntityType.Contains(request.EntityType));
        }

        if (!string.IsNullOrEmpty(request.Search))
        {
            query = query.Where(l =>
                l.Action.Contains(request.Search) ||
                l.Actor.Contains(request.Search) ||
                (l.EntityType != null && l.EntityType.Contains(request.Search)) ||
                (l.EntityId != null && l.EntityId.Contains(request.Search)) ||
                (l.Metadata != null && l.Metadata.Contains(request.Search)));
        }

        if (request.Days.HasValue && request.Days.Value > 0)
        {
            var cutoff = DateTime.UtcNow.AddDays(-request.Days.Value);
            query = query.Where(l => l.Timestamp >= cutoff);
        }

        if (request.StartDate.HasValue) query = query.Where(l => l.Timestamp >= request.StartDate.Value);
        if (request.EndDate.HasValue) query = query.Where(l => l.Timestamp <= request.EndDate.Value);

        var rows = await query
            .OrderBy(l => l.EntityType == "ApiRequest" ? 1 : 0)
            .ThenByDescending(l => l.Timestamp)
            .Take(1000)
            .ToListAsync();
        var actorIds = rows
            .Select(r => Guid.TryParse(r.Actor, out var id) ? id : (Guid?)null)
            .Where(id => id.HasValue)
            .Select(id => id!.Value)
            .Distinct()
            .ToList();
        var userNames = await _db.Users
            .Where(u => actorIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.FullName);
        var userRoles = await _db.UserRoles
            .Include(ur => ur.Role)
            .Where(ur => actorIds.Contains(ur.UserId))
            .GroupBy(ur => ur.UserId)
            .Select(g => new { UserId = g.Key, RoleName = g.Select(x => x.Role.Name).FirstOrDefault() ?? "User" })
            .ToDictionaryAsync(x => x.UserId, x => x.RoleName);
        var logs = rows.Select(l => new
        {
            l.Id,
            Action = GetFriendlyAction(l),
            Actor = ResolveActorName(l, userNames),
            ActorId = l.Actor,
            ActorRole = l.ActorRole ?? ResolveActorRole(l, userRoles),
            ActionType = l.ActionType,
            l.EntityType,
            l.EntityId,
            IpAddress = l.IpAddress,
            DeviceInfo = l.DeviceInfo,
            BeforeState = l.BeforeState,
            AfterState = l.AfterState,
            StatusCode = l.StatusCode,
            DurationMs = l.DurationMs,
            l.Metadata,
            l.Timestamp
        }).ToList();

        return Ok(logs);
    }

    [HttpGet("audit-logs/export")]
    public async Task<IActionResult> ExportAuditLogs([FromQuery] string? action, [FromQuery] string? actor, [FromQuery] string? entityType, [FromQuery] string? search, [FromQuery] int days = 30, [FromQuery] DateTime? startDate = null, [FromQuery] DateTime? endDate = null)
    {
        var request = new GetAuditLogsRequest(action, actor, entityType, search, days, startDate, endDate);
        var query = _db.AuditLogs.AsQueryable();
        if (!string.IsNullOrWhiteSpace(request.Action)) query = query.Where(l => l.Action.Contains(request.Action));
        if (!string.IsNullOrWhiteSpace(request.Actor)) query = query.Where(l => l.Actor.Contains(request.Actor) || (l.Metadata != null && l.Metadata.Contains(request.Actor)));
        if (!string.IsNullOrWhiteSpace(request.EntityType)) query = query.Where(l => l.EntityType != null && l.EntityType.Contains(request.EntityType));
        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            query = query.Where(l =>
                l.Action.Contains(request.Search) ||
                l.Actor.Contains(request.Search) ||
                (l.EntityType != null && l.EntityType.Contains(request.Search)) ||
                (l.EntityId != null && l.EntityId.Contains(request.Search)) ||
                (l.Metadata != null && l.Metadata.Contains(request.Search)));
        }
        if (days > 0)
        {
            var cutoff = DateTime.UtcNow.AddDays(-days);
            query = query.Where(l => l.Timestamp >= cutoff);
        }
        if (request.StartDate.HasValue) query = query.Where(l => l.Timestamp >= request.StartDate.Value);
        if (request.EndDate.HasValue) query = query.Where(l => l.Timestamp <= request.EndDate.Value);
        var rows = await query.OrderByDescending(l => l.Timestamp).Take(5000).ToListAsync();
        var actorIds = rows
            .Select(r => Guid.TryParse(r.Actor, out var id) ? id : (Guid?)null)
            .Where(id => id.HasValue)
            .Select(id => id!.Value)
            .Distinct()
            .ToList();
        var userNames = await _db.Users
            .Where(u => actorIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.FullName);
        var userRoles = await _db.UserRoles
            .Include(ur => ur.Role)
            .Where(ur => actorIds.Contains(ur.UserId))
            .GroupBy(ur => ur.UserId)
            .Select(g => new { UserId = g.Key, RoleName = g.Select(x => x.Role.Name).FirstOrDefault() ?? "User" })
            .ToDictionaryAsync(x => x.UserId, x => x.RoleName);
        var csv = new StringBuilder();
        csv.AppendLine("Id,Timestamp,Actor,ActorRole,ActionType,Action,EntityType,EntityId,IpAddress,StatusCode,DurationMs");
        foreach (var r in rows)
        {
            var actionLabel = GetFriendlyAction(r);
            var actorName = ResolveActorName(r, userNames);
            var actorRole = r.ActorRole ?? ResolveActorRole(r, userRoles);
            csv.AppendLine($"\"{r.Id}\",\"{r.Timestamp:O}\",\"{actorName}\",\"{actorRole}\",\"{r.ActionType}\",\"{actionLabel}\",\"{r.EntityType}\",\"{r.EntityId}\",\"{r.IpAddress}\",\"{r.StatusCode}\",\"{r.DurationMs}\"");
        }
        return File(Encoding.UTF8.GetBytes(csv.ToString()), "text/csv", $"audit-logs-{DateTime.UtcNow:yyyyMMddHHmmss}.csv");
    }

    [HttpPost("audit-logs/backfill")]
    public async Task<IActionResult> BackfillHistoricalAuditLogs()
    {
        const string source = "historical-backfill-v1";
        var now = DateTime.UtcNow;
        var existing = await _db.AuditLogs
            .Where(l => l.Metadata != null && l.Metadata.Contains(source))
            .Select(l => new { l.Action, l.EntityType, l.EntityId })
            .ToListAsync();
        var existingKeys = new HashSet<string>(existing.Select(e => $"{e.Action}|{e.EntityType}|{e.EntityId}"));

        var userRoleMap = await _db.UserRoles
            .Include(ur => ur.Role)
            .GroupBy(ur => ur.UserId)
            .Select(g => new { UserId = g.Key, Role = g.Select(x => x.Role.Name).FirstOrDefault() ?? "User" })
            .ToDictionaryAsync(x => x.UserId, x => x.Role);

        string ResolveRole(Guid? userId, string fallback = "System")
            => userId.HasValue && userRoleMap.TryGetValue(userId.Value, out var role) ? role : fallback;

        var pendingLogs = new List<AuditLog>();
        void AddBackfillLog(string action, string entityType, string? entityId, string actorId, string actorRole, DateTime timestamp, string actionType, object afterState)
        {
            var key = $"{action}|{entityType}|{entityId}";
            if (existingKeys.Contains(key)) return;
            var metadata = new JsonObject
            {
                ["source"] = source,
                ["reconstructed"] = true,
                ["actor_id"] = actorId,
                ["actor_role"] = actorRole,
                ["action_type"] = actionType,
                ["entity_type"] = entityType,
                ["entity_id"] = entityId,
                ["before_state"] = null,
                ["after_state"] = JsonSerializer.SerializeToNode(afterState),
                ["ip_address"] = null,
                ["device_info"] = "historical-backfill",
                ["backfilled_at"] = now
            };
            pendingLogs.Add(new AuditLog
            {
                Id = Guid.NewGuid(),
                Action = action,
                Actor = actorId,
                EntityType = entityType,
                EntityId = entityId,
                Metadata = metadata.ToJsonString(),
                Timestamp = timestamp == default ? now : timestamp
            });
            existingKeys.Add(key);
        }

        var users = await _db.Users.Select(u => new { u.Id, u.CreatedAt, u.LastLogin, u.Email }).ToListAsync();
        foreach (var u in users)
        {
            AddBackfillLog("CREATE", "USER", u.Id.ToString(), u.Id.ToString(), ResolveRole(u.Id), u.CreatedAt, "CREATE", new { u.Email });
            if (u.LastLogin.HasValue)
                AddBackfillLog("LOGIN", "USER", u.Id.ToString(), u.Id.ToString(), ResolveRole(u.Id), u.LastLogin.Value, "LOGIN", new { lastLogin = u.LastLogin.Value });
        }

        var farmers = await _db.Farmers.Select(f => new { f.Id, f.UserId, f.CreatedAt, f.District, f.Sector }).ToListAsync();
        foreach (var f in farmers)
            AddBackfillLog("CREATE", "FARMER", f.Id.ToString(), f.UserId.ToString(), ResolveRole(f.UserId, "Farmer"), f.CreatedAt, "CREATE", new { f.District, f.Sector });

        var cooperatives = await _db.Cooperatives.Select(c => new { c.Id, c.ManagerId, c.CreatedAt, c.Name }).ToListAsync();
        foreach (var c in cooperatives)
            AddBackfillLog("CREATE", "COOPERATIVE", c.Id.ToString(), (c.ManagerId ?? Guid.Empty).ToString(), ResolveRole(c.ManagerId, "CooperativeManager"), c.CreatedAt, "CREATE", new { c.Name });

        var buyers = await _db.BuyerProfiles.Select(b => new { b.Id, b.UserId, b.CreatedAt, b.Organization }).ToListAsync();
        foreach (var b in buyers)
            AddBackfillLog("CREATE", "BUYER_PROFILE", b.Id.ToString(), b.UserId.ToString(), ResolveRole(b.UserId, "Buyer"), b.CreatedAt, "CREATE", new { b.Organization });

        var transporters = await _db.TransporterProfiles.Select(t => new { t.Id, t.UserId, t.CreatedAt, t.CompanyName }).ToListAsync();
        foreach (var t in transporters)
            AddBackfillLog("CREATE", "TRANSPORTER_PROFILE", t.Id.ToString(), t.UserId.ToString(), ResolveRole(t.UserId, "Transporter"), t.CreatedAt, "CREATE", new { t.CompanyName });

        var lots = await _db.Lots.Include(l => l.Farmer).Include(l => l.Cooperative)
            .Select(l => new { l.Id, l.CreatedAt, l.UpdatedAt, l.Crop, l.QuantityKg, FarmerUserId = l.Farmer != null ? l.Farmer.UserId : (Guid?)null, ManagerId = l.Cooperative != null ? l.Cooperative.ManagerId : (Guid?)null })
            .ToListAsync();
        foreach (var l in lots)
        {
            var actor = l.FarmerUserId ?? l.ManagerId ?? Guid.Empty;
            AddBackfillLog("CREATE", "LOT", l.Id.ToString(), actor.ToString(), ResolveRole(actor == Guid.Empty ? null : actor, "System"), l.CreatedAt, "CREATE", new { l.Crop, l.QuantityKg });
            if (l.UpdatedAt.HasValue)
                AddBackfillLog("UPDATE", "LOT", l.Id.ToString(), actor.ToString(), ResolveRole(actor == Guid.Empty ? null : actor, "System"), l.UpdatedAt.Value, "UPDATE", new { l.Crop, l.QuantityKg });
        }

        var listings = await _db.MarketListings.Include(m => m.Cooperative)
            .Select(m => new { m.Id, m.CreatedAt, m.Crop, m.QuantityKg, ManagerId = m.Cooperative.ManagerId })
            .ToListAsync();
        foreach (var m in listings)
            AddBackfillLog("CREATE", "MARKET_LISTING", m.Id.ToString(), (m.ManagerId ?? Guid.Empty).ToString(), ResolveRole(m.ManagerId, "CooperativeManager"), m.CreatedAt, "CREATE", new { m.Crop, m.QuantityKg });

        var orders = await _db.BuyerOrders.Include(o => o.BuyerProfile)
            .Select(o => new { o.Id, o.CreatedAt, o.Crop, o.QuantityKg, o.BuyerProfile.UserId })
            .ToListAsync();
        foreach (var o in orders)
            AddBackfillLog("CREATE", "BUYER_ORDER", o.Id.ToString(), o.UserId.ToString(), ResolveRole(o.UserId, "Buyer"), o.CreatedAt, "CREATE", new { o.Crop, o.QuantityKg });

        var contracts = await _db.Contracts.Include(c => c.BuyerOrder).ThenInclude(o => o.BuyerProfile)
            .Select(c => new { c.Id, c.CreatedAt, c.Status, BuyerUserId = c.BuyerOrder.BuyerProfile.UserId })
            .ToListAsync();
        foreach (var c in contracts)
            AddBackfillLog("CREATE", "CONTRACT", c.Id.ToString(), c.BuyerUserId.ToString(), ResolveRole(c.BuyerUserId, "Buyer"), c.CreatedAt, "CREATE", new { c.Status });

        var requests = await _db.TransportRequests.Include(t => t.Transporter).ThenInclude(tp => tp!.User)
            .Select(t => new { t.Id, t.CreatedAt, t.Status, TransporterUserId = t.Transporter != null ? t.Transporter.UserId : (Guid?)null })
            .ToListAsync();
        foreach (var tr in requests)
            AddBackfillLog("CREATE", "TRANSPORT_REQUEST", tr.Id.ToString(), (tr.TransporterUserId ?? Guid.Empty).ToString(), ResolveRole(tr.TransporterUserId, "System"), tr.CreatedAt, "CREATE", new { tr.Status });

        var bookings = await _db.StorageBookings.Select(s => new { s.Id, s.StartDate, s.Status }).ToListAsync();
        foreach (var s in bookings)
            AddBackfillLog("CREATE", "STORAGE_BOOKING", s.Id.ToString(), "System", "System", s.StartDate, "CREATE", new { s.Status });

        var apps = await _db.RoleApplications.Select(a => new { a.Id, a.ApplicantUserId, a.CreatedAt, a.UpdatedAt, a.Status, a.TargetRole }).ToListAsync();
        foreach (var a in apps)
        {
            AddBackfillLog("CREATE", "APPLICATION", a.Id.ToString(), a.ApplicantUserId.ToString(), ResolveRole(a.ApplicantUserId, "Applicant"), a.CreatedAt, "CREATE", new { a.TargetRole, status = "Pending" });
            if (a.Status == "Approved" || a.Status == "Rejected")
                AddBackfillLog(a.Status == "Approved" ? "APPROVE" : "REJECT", "APPLICATION", a.Id.ToString(), "Admin", "Admin", a.UpdatedAt, a.Status == "Approved" ? "APPROVE" : "REJECT", new { a.TargetRole, a.Status });
        }

        var harvests = await _db.HarvestDeclarations.Include(h => h.Farmer)
            .Select(h => new { h.Id, h.CreatedAt, h.Crop, h.ExpectedQuantityKg, FarmerUserId = h.Farmer.UserId })
            .ToListAsync();
        foreach (var h in harvests)
            AddBackfillLog("CREATE", "HARVEST_DECLARATION", h.Id.ToString(), h.FarmerUserId.ToString(), ResolveRole(h.FarmerUserId, "Farmer"), h.CreatedAt, "CREATE", new { h.Crop, h.ExpectedQuantityKg });

        var ledgers = await _db.PaymentLedgers.Select(p => new { p.Id, p.CreatedAt, p.Amount, p.Status }).ToListAsync();
        foreach (var p in ledgers)
            AddBackfillLog("CREATE", "PAYMENT", p.Id.ToString(), "System", "System", p.CreatedAt, "CREATE", new { p.Amount, p.Status });

        if (pendingLogs.Count > 0)
        {
            await _db.AuditLogs.AddRangeAsync(pendingLogs);
            await _db.SaveChangesAsync();
        }

        return Ok(new { message = "Historical logs backfill completed.", created = pendingLogs.Count, source });
    }

    [HttpPost("system-config")]
    public async Task<IActionResult> UpdateSystemConfig(UpdateSystemConfigRequest request)
    {
        var previous = await _db.SystemConfigurations.FirstOrDefaultAsync(c => c.Key == request.ConfigKey);
        await UpsertSystemConfiguration(request.ConfigKey, request.ConfigValue, "General");
        AddAuditLog("SystemConfigUpdated", "CONFIG", request.ConfigKey, "UPDATE", new { key = request.ConfigKey, value = previous?.Value }, new { key = request.ConfigKey, value = request.ConfigValue });

        await _db.SaveChangesAsync();

        return Ok(new { message = "Configuration updated successfully", request.ConfigKey, request.ConfigValue });
    }

    [HttpGet("system-config")]
    public async Task<IActionResult> GetSystemConfig()
    {
        var configs = await _db.AuditLogs
            .Where(a => a.Action == "SystemConfigUpdated")
            .OrderByDescending(a => a.Timestamp)
            .ToListAsync();

        var latest = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var entry in configs)
        {
            if (string.IsNullOrWhiteSpace(entry.Metadata)) continue;
            try
            {
                using var doc = JsonDocument.Parse(entry.Metadata);
                var key = doc.RootElement.GetProperty("key").GetString();
                var value = doc.RootElement.GetProperty("value").GetString();
                if (!string.IsNullOrWhiteSpace(key) && value != null && !latest.ContainsKey(key))
                {
                    latest[key] = value;
                }
            }
            catch
            {
                continue;
            }
        }

        return Ok(latest);
    }

    [HttpGet("maintenance/status")]
    public async Task<IActionResult> GetMaintenanceStatus()
    {
        var enabled = await GetSystemConfigBool("system.maintenance.enabled", false);
        var start = await GetSystemConfigValue("system.maintenance.start");
        var end = await GetSystemConfigValue("system.maintenance.end");
        var description = await GetSystemConfigValue("system.maintenance.description");

        return Ok(new
        {
            enabled,
            start,
            end,
            description
        });
    }

    [HttpPost("maintenance/toggle")]
    public async Task<IActionResult> ToggleMaintenance([FromBody] MaintenanceToggleRequest request)
    {
        await UpsertSystemConfiguration("system.maintenance.enabled", request.Enabled ? "true" : "false", "Security");
        if (!string.IsNullOrWhiteSpace(request.Reason))
            await UpsertSystemConfiguration("system.maintenance.description", request.Reason!, "Security");

        await _db.AuditLogs.AddAsync(new AuditLog
        {
            Id = Guid.NewGuid(),
            Action = request.Enabled ? "MaintenanceEnabled" : "MaintenanceDisabled",
            Actor = "Admin",
            EntityType = "System",
            EntityId = "Maintenance",
            Metadata = request.Reason
        });

        if (request.Enabled)
        {
            var nonAdminUserIds = await _db.UserRoles
                .Include(ur => ur.Role)
                .Where(ur => ur.Role.Name != "Admin")
                .Select(ur => ur.UserId)
                .Distinct()
                .ToListAsync();

            var notifications = nonAdminUserIds.Select(uid => new Notification
            {
                Id = Guid.NewGuid(),
                UserId = uid,
                Title = "System Maintenance Active",
                Message = string.IsNullOrWhiteSpace(request.Reason)
                    ? "The platform is temporarily in maintenance mode. Only administrators can access the system right now."
                    : $"The platform is in maintenance mode: {request.Reason}",
                Type = "Warning"
            });
            _db.Notifications.AddRange(notifications);
        }
        else
        {
            var nonAdminUserIds = await _db.UserRoles
                .Include(ur => ur.Role)
                .Where(ur => ur.Role.Name != "Admin")
                .Select(ur => ur.UserId)
                .Distinct()
                .ToListAsync();

            var notifications = nonAdminUserIds.Select(uid => new Notification
            {
                Id = Guid.NewGuid(),
                UserId = uid,
                Title = "System Maintenance Completed",
                Message = "Maintenance mode has been disabled. You can now access the platform normally.",
                Type = "Success"
            });
            _db.Notifications.AddRange(notifications);
        }

        await _db.SaveChangesAsync();
        return Ok(new { enabled = request.Enabled, message = request.Enabled ? "Maintenance enabled" : "Maintenance disabled" });
    }

    [HttpPost("maintenance/schedule")]
    public async Task<IActionResult> ScheduleMaintenance([FromBody] ScheduleMaintenanceRequest request)
    {
        if (request.ScheduledStart >= request.ScheduledEnd) return BadRequest("Maintenance end time must be after start time.");
        if (string.IsNullOrWhiteSpace(request.Description)) return BadRequest("Description is required.");

        await UpsertSystemConfiguration("system.maintenance.start", request.ScheduledStart.ToUniversalTime().ToString("O"), "Security");
        await UpsertSystemConfiguration("system.maintenance.end", request.ScheduledEnd.ToUniversalTime().ToString("O"), "Security");
        await UpsertSystemConfiguration("system.maintenance.description", request.Description.Trim(), "Security");

        var nonAdminUserIds = await _db.UserRoles
            .Include(ur => ur.Role)
            .Where(ur => ur.Role.Name != "Admin")
            .Select(ur => ur.UserId)
            .Distinct()
            .ToListAsync();

        var msg = $"{request.Description.Trim()}. Scheduled: {request.ScheduledStart:u} to {request.ScheduledEnd:u} UTC.";
        var notifications = nonAdminUserIds.Select(uid => new Notification
        {
            Id = Guid.NewGuid(),
            UserId = uid,
            Title = "Scheduled Maintenance",
            Message = msg,
            Type = "Warning"
        });

        _db.Notifications.AddRange(notifications);
        await _db.AuditLogs.AddAsync(new AuditLog
        {
            Id = Guid.NewGuid(),
            Action = "MaintenanceScheduled",
            Actor = "Admin",
            EntityType = "System",
            EntityId = "Maintenance",
            Metadata = JsonSerializer.Serialize(new { request.ScheduledStart, request.ScheduledEnd, request.Description })
        });

        await _db.SaveChangesAsync();
        return Ok(new { message = "Maintenance scheduled and users notified." });
    }

    private async Task UpsertSystemConfiguration(string key, string value, string category)
    {
        var cfg = await _db.SystemConfigurations.FirstOrDefaultAsync(c => c.Key == key);
        if (cfg == null)
        {
            cfg = new SystemConfiguration
            {
                Id = Guid.NewGuid(),
                Key = key,
                Value = value,
                ValueType = "String",
                Category = category,
                IsEditable = true,
                Description = key
            };
            _db.SystemConfigurations.Add(cfg);
        }
        else
        {
            cfg.Value = value;
            cfg.Category = category;
            cfg.LastModifiedAt = DateTime.UtcNow;
        }
    }

    private async Task<string?> GetSystemConfigValue(string key)
    {
        var value = await _db.SystemConfigurations
            .Where(c => c.Key == key)
            .Select(c => c.Value)
            .FirstOrDefaultAsync();
        return value;
    }

    private async Task<bool> GetSystemConfigBool(string key, bool fallback = false)
    {
        var raw = await GetSystemConfigValue(key);
        return bool.TryParse(raw, out var parsed) ? parsed : fallback;
    }

    [HttpPost("users/{userId}/reset-password")]
    public async Task<IActionResult> ResetUserPassword(Guid userId, [FromBody] AdminResetPasswordRequest? request)
    {
        var user = await _db.Users.FindAsync(userId);
        if (user == null) return NotFound("User not found");

        var newPassword = string.IsNullOrWhiteSpace(request?.NewPassword)
            ? $"Rass@{Random.Shared.Next(100000, 999999)}"
            : request!.NewPassword!;

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(newPassword);
        user.ResetOtp = null;
        user.ResetOtpExpiry = null;
        user.IsActive = true;

        AddAuditLog(
            "UserPasswordReset",
            "USER",
            user.Id.ToString(),
            "UPDATE",
            null,
            new { user.Email, resetByAdmin = true, activated = true });

        await _db.SaveChangesAsync();

        return Ok(new { message = "Password reset successfully", temporaryPassword = newPassword });
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
                f.UserId,
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

    [HttpPost("farmers/{farmerId}/reset-password")]
    public async Task<IActionResult> ResetFarmerPassword(Guid farmerId)
    {
        var farmer = await _db.Farmers.Include(f => f.User).FirstOrDefaultAsync(f => f.Id == farmerId);
        if (farmer == null) return NotFound("Farmer not found");

        // Generate OTP
        var otp = new Random().Next(100000, 999999).ToString();
        farmer.User.ResetOtp = BCrypt.Net.BCrypt.HashPassword(otp);
        farmer.User.ResetOtpExpiry = DateTime.UtcNow.AddMinutes(10);
        
        // Set to inactive until they reset
        farmer.User.IsActive = false;
        farmer.IsActive = false;

        _db.Notifications.Add(new Notification
        {
            Id = Guid.NewGuid(),
            UserId = farmer.UserId,
            Title = "Password reset verification",
            Message = $"Admin issued password reset OTP: {otp}",
            Type = "auth.password_reset_otp",
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync();

        return Ok(new { message = "Password reset OTP generated and sent to the farmer notification center." });
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
                ManagerUserId = c.ManagerId,
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
                b.UserId,
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
                t.UserId,
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

    // ========== FORECASTING CONFIGURATION ==========
    [HttpGet("forecasting-config")]
    public async Task<IActionResult> GetForecastingConfig()
    {
        var config = await _db.AuditLogs
            .Where(a => a.Action == "ForecastingConfig")
            .OrderByDescending(a => a.Timestamp)
            .FirstOrDefaultAsync();

        if (config == null)
        {
            return Ok(new
            {
                ModelType = "ensemble",
                ConfidenceLevel = 0.8,
                ForecastHorizonDays = 7,
                Parameters = "{}"
            });
        }

        return Ok(System.Text.Json.JsonSerializer.Deserialize<object>(config.Metadata ?? "{}"));
    }

    [HttpPost("forecasting-config")]
    public async Task<IActionResult> UpdateForecastingConfig(UpdateForecastingConfigRequest request)
    {
        var configData = new
        {
            ModelType = request.ModelType ?? "ensemble",
            ConfidenceLevel = request.ConfidenceLevel ?? 0.8,
            ForecastHorizonDays = request.ForecastHorizonDays ?? 7,
            Parameters = request.Parameters ?? "{}",
            UpdatedAt = DateTime.UtcNow
        };

        await _db.AuditLogs.AddAsync(new AuditLog
        {
            Id = Guid.NewGuid(),
            Action = "ForecastingConfig",
            Actor = "Admin",
            EntityType = "System",
            EntityId = "ForecastingService",
            Metadata = System.Text.Json.JsonSerializer.Serialize(configData)
        });

        await _db.SaveChangesAsync();
        return Ok(new { message = "Forecasting configuration updated", config = configData });
    }

    // ========== SYSTEM HEALTH & DATASETS ==========
    [HttpGet("system-health")]
    public async Task<IActionResult> GetSystemHealth()
    {
        return Ok(new
        {
            Status = "Operational",
            Database = "Connected",
            LastAuditLog = await _db.AuditLogs.MaxAsync(a => (DateTime?)a.Timestamp),
            TotalAuditLogs = await _db.AuditLogs.CountAsync(),
            RecentErrors = await _db.AuditLogs
                .Where(a => a.Action.Contains("Error") || a.Action.Contains("Failed"))
                .OrderByDescending(a => a.Timestamp)
                .Take(5)
                .ToListAsync()
        });
    }

    [HttpPost("data/cleanup")]
    public async Task<IActionResult> CleanupOldData([FromQuery] int daysToKeep = 90)
    {
        var cutoff = DateTime.UtcNow.AddDays(-daysToKeep);

        // Only cleanup old audit logs (preserve other data)
        var oldLogs = await _db.AuditLogs
            .Where(a => a.Timestamp < cutoff && a.Action != "SystemConfigUpdated" && a.Action != "ForecastingConfig")
            .ToListAsync();

        var count = oldLogs.Count;
        _db.AuditLogs.RemoveRange(oldLogs);
        await _db.SaveChangesAsync();

        return Ok(new { message = $"Cleaned up {count} old audit log entries" });
    }
}

