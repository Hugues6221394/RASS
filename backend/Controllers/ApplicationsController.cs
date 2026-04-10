using BCrypt.Net;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Rass.Api.Data;
using Rass.Api.Domain.Entities;
using Rass.Api.Dtos;
using System.Security.Claims;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Rass.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ApplicationsController : ControllerBase
{
    private static readonly HashSet<string> AllowedRoles = new(StringComparer.OrdinalIgnoreCase)
    {
        "CooperativeManager", "Transporter", "StorageOperator", "StorageManager", "MarketAgent"
    };

    private readonly AppDbContext _db;
    public ApplicationsController(AppDbContext db) { _db = db; }

    [HttpPost("submit")]
    [AllowAnonymous]
    public async Task<IActionResult> Submit(SubmitRoleApplicationRequest request)
    {
        if (!AllowedRoles.Contains(request.TargetRole)) return BadRequest("Selected role does not require application.");
        if (request.TargetRole.Equals("Transporter", StringComparison.OrdinalIgnoreCase))
        {
            if (string.IsNullOrWhiteSpace(request.PlateNumber) || request.DrivingLicenseDocument == null)
                return BadRequest("Transporter applications require plate number and a driving license file upload.");
        }
        var email = request.Email.Trim().ToLowerInvariant();
        if (await _db.Users.AnyAsync(u => u.Email == email)) return Conflict("Email already registered.");

        var applicantRole = await _db.Roles.FirstOrDefaultAsync(r => r.Name == "Applicant");
        if (applicantRole == null)
        {
            applicantRole = new Role { Id = Guid.NewGuid(), Name = "Applicant" };
            _db.Roles.Add(applicantRole);
        }

        var user = new User
        {
            Id = Guid.NewGuid(),
            FullName = request.FullName.Trim(),
            Email = email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            IsActive = true
        };
        _db.Users.Add(user);
        _db.UserRoles.Add(new UserRole { UserId = user.Id, RoleId = applicantRole.Id });

        var app = new RoleApplication
        {
            Id = Guid.NewGuid(),
            ApplicantUserId = user.Id,
            TargetRole = request.TargetRole,
            Status = "Pending",
            FormDataJson = JsonSerializer.Serialize(new
            {
                request.Phone,
                request.OrganizationName,
                request.FarmersCount,
                request.FarmSizeHectares,
                request.Province,
                request.District,
                request.Sector,
                request.Cell,
                request.Location,
                request.OrganizationEmail,
                request.OrganizationPhone,
                request.VehicleType,
                request.LicenseNumber,
                request.PlateNumber,
                request.StorageLocation,
                request.WarehouseCapacity,
                request.Notes
            }),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _db.RoleApplications.Add(app);

        try
        {
            if (request.DrivingLicenseDocument != null)
            {
                var drivingLicense = SaveApplicationDocument(app.Id, "Driving License", request.DrivingLicenseDocument, "Applicant");
                app.Documents.Add(drivingLicense);
            }

            if (request.RdbCertificateDocument != null)
            {
                var certificate = SaveApplicationDocument(app.Id, "RDB Certificate", request.RdbCertificateDocument, "Applicant");
                app.Documents.Add(certificate);
            }
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }

        AddAuditLog(
            action: "CREATE",
            entityType: "APPLICATION",
            entityId: app.Id.ToString(),
            actorId: user.Id.ToString(),
            actorRole: "Applicant",
            beforeState: null,
            afterState: new { app.TargetRole, app.Status, request.OrganizationName, request.PlateNumber },
            actionType: "CREATE");
        await _db.SaveChangesAsync();
        return Ok(new { message = "Application submitted successfully. Login with your credentials to track status." });
    }

    [HttpGet("me")]
    [Authorize(Roles = "Applicant")]
    public async Task<IActionResult> MyApplication()
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();
        var app = await _db.RoleApplications
            .Include(a => a.Messages)
            .Include(a => a.Documents)
            .Where(a => a.ApplicantUserId == userId.Value)
            .OrderByDescending(a => a.UpdatedAt)
            .FirstOrDefaultAsync();
        if (app == null) return NotFound("No application found.");
        return Ok(new
        {
            app.Id,
            app.TargetRole,
            app.Status,
            app.FormDataJson,
            app.AdminNote,
            app.CreatedAt,
            app.UpdatedAt,
            Messages = app.Messages.OrderBy(m => m.CreatedAt),
            Documents = app.Documents.OrderByDescending(d => d.CreatedAt)
        });
    }

    [HttpPost("me/messages")]
    [Authorize(Roles = "Applicant")]
    public async Task<IActionResult> SendApplicantMessage(ApplicationMessageRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();
        var app = await _db.RoleApplications.Include(a => a.ApplicantUser).FirstOrDefaultAsync(a => a.ApplicantUserId == userId.Value);
        if (app == null) return NotFound("No application found.");
        app.Messages.Add(new RoleApplicationMessage
        {
            Id = Guid.NewGuid(),
            RoleApplicationId = app.Id,
            SenderType = "Applicant",
            SenderName = app.ApplicantUser.FullName,
            Message = request.Message.Trim(),
            IsReadByAdmin = false,
            IsReadByApplicant = true,
            CreatedAt = DateTime.UtcNow
        });
        app.UpdatedAt = DateTime.UtcNow;
        AddAuditLog(
            action: "MESSAGE",
            entityType: "APPLICATION",
            entityId: app.Id.ToString(),
            actorId: userId.Value.ToString(),
            actorRole: "Applicant",
            beforeState: null,
            afterState: new { message = request.Message.Trim() },
            actionType: "UPDATE");
        await _db.SaveChangesAsync();
        return Ok(new { message = "Message sent." });
    }

    [HttpPost("me/documents")]
    [Authorize(Roles = "Applicant")]
    public async Task<IActionResult> UploadApplicantDocument(ApplicationDocumentRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();
        var app = await _db.RoleApplications.FirstOrDefaultAsync(a => a.ApplicantUserId == userId.Value);
        if (app == null) return NotFound("No application found.");
        RoleApplicationDocument document;
        try
        {
            document = SaveApplicationDocument(
                app.Id,
                request.DocumentName.Trim(),
                new FileUploadPayload(request.FileName, request.ContentType, request.Base64Content),
                "Applicant");
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
        app.Documents.Add(document);
        app.UpdatedAt = DateTime.UtcNow;
        AddAuditLog(
            action: "DOCUMENT_UPLOAD",
            entityType: "APPLICATION",
            entityId: app.Id.ToString(),
            actorId: userId.Value.ToString(),
            actorRole: "Applicant",
            beforeState: null,
            afterState: new { request.DocumentName, request.FileName, request.ContentType },
            actionType: "UPDATE");
        await _db.SaveChangesAsync();
        return Ok(new { message = "Document uploaded." });
    }

    [HttpGet("admin")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> AdminList()
    {
        var apps = await _db.RoleApplications
            .Include(a => a.ApplicantUser)
            .Include(a => a.Messages)
            .OrderByDescending(a => a.UpdatedAt)
            .Select(a => new
            {
                a.Id,
                a.TargetRole,
                a.Status,
                ApplicantName = a.ApplicantUser.FullName,
                ApplicantEmail = a.ApplicantUser.Email,
                a.CreatedAt,
                a.UpdatedAt,
                UnreadAdminCount = a.Messages.Count(m => m.SenderType == "Applicant" && !m.IsReadByAdmin)
            })
            .ToListAsync();
        var unreadCount = apps.Sum(a => a.UnreadAdminCount);
        return Ok(new { items = apps, unreadCount });
    }

    [HttpGet("admin/{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> AdminGet(Guid id)
    {
        var app = await _db.RoleApplications
            .Include(a => a.ApplicantUser)
            .Include(a => a.Messages)
            .Include(a => a.Documents)
            .FirstOrDefaultAsync(a => a.Id == id);
        if (app == null) return NotFound();

        foreach (var msg in app.Messages.Where(m => m.SenderType == "Applicant" && !m.IsReadByAdmin))
        {
            msg.IsReadByAdmin = true;
        }
        await _db.SaveChangesAsync();

        return Ok(new
        {
            app.Id,
            app.TargetRole,
            app.Status,
            ApplicantName = app.ApplicantUser.FullName,
            ApplicantEmail = app.ApplicantUser.Email,
            app.FormDataJson,
            app.AdminNote,
            app.CreatedAt,
            app.UpdatedAt,
            Messages = app.Messages.OrderBy(m => m.CreatedAt),
            Documents = app.Documents.OrderByDescending(d => d.CreatedAt)
        });
    }

    [HttpPost("admin/{id}/message")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> AdminMessage(Guid id, ApplicationMessageRequest request)
    {
        var app = await _db.RoleApplications.FirstOrDefaultAsync(a => a.Id == id);
        if (app == null) return NotFound();
        app.Messages.Add(new RoleApplicationMessage
        {
            Id = Guid.NewGuid(),
            RoleApplicationId = app.Id,
            SenderType = "Admin",
            SenderName = "System Admin",
            Message = request.Message.Trim(),
            IsReadByAdmin = true,
            IsReadByApplicant = false,
            CreatedAt = DateTime.UtcNow
        });
        app.UpdatedAt = DateTime.UtcNow;
        AddAuditLog(
            action: "MESSAGE",
            entityType: "APPLICATION",
            entityId: app.Id.ToString(),
            actorId: GetUserId()?.ToString() ?? "Admin",
            actorRole: "Admin",
            beforeState: null,
            afterState: new { message = request.Message.Trim() },
            actionType: "UPDATE");
        await _db.SaveChangesAsync();
        return Ok(new { message = "Message sent to applicant." });
    }

    [HttpPost("admin/{id}/process")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Process(Guid id, ProcessApplicationRequest request)
    {
        var app = await _db.RoleApplications
            .Include(a => a.ApplicantUser)
            .FirstOrDefaultAsync(a => a.Id == id);
        if (app == null) return NotFound();
        if (app.Status != "Pending") return BadRequest("Application already processed.");

        var before = new { app.Status, app.AdminNote };
        app.Status = request.Approved ? "Approved" : "Rejected";
        app.AdminNote = request.Note;
        app.UpdatedAt = DateTime.UtcNow;

        if (request.Approved)
        {
            var targetRole = await _db.Roles.FirstOrDefaultAsync(r => r.Name == app.TargetRole);
            if (targetRole == null) return BadRequest("Target role not configured.");
            var applicantRole = await _db.Roles.FirstOrDefaultAsync(r => r.Name == "Applicant");
            if (applicantRole != null)
            {
                var oldLink = await _db.UserRoles.FirstOrDefaultAsync(ur => ur.UserId == app.ApplicantUserId && ur.RoleId == applicantRole.Id);
                if (oldLink != null) _db.UserRoles.Remove(oldLink);
            }
            if (!await _db.UserRoles.AnyAsync(ur => ur.UserId == app.ApplicantUserId && ur.RoleId == targetRole.Id))
            {
                _db.UserRoles.Add(new UserRole { UserId = app.ApplicantUserId, RoleId = targetRole.Id });
            }
        }

        _db.Notifications.Add(new Notification
        {
            Id = Guid.NewGuid(),
            UserId = app.ApplicantUserId,
            Title = request.Approved ? "Application approved" : "Application rejected",
            Message = request.Approved
                ? $"Your application for {app.TargetRole} was approved."
                : $"Your application for {app.TargetRole} was rejected. {request.Note ?? string.Empty}".Trim(),
            Type = request.Approved ? "Success" : "Warning",
            ActionUrl = "/applicant-dashboard"
        });
        AddAuditLog(
            action: request.Approved ? "APPROVE" : "REJECT",
            entityType: "APPLICATION",
            entityId: app.Id.ToString(),
            actorId: GetUserId()?.ToString() ?? "Admin",
            actorRole: "Admin",
            beforeState: before,
            afterState: new { app.Status, app.AdminNote, app.TargetRole, app.ApplicantUserId },
            actionType: request.Approved ? "APPROVE" : "REJECT");
        await _db.SaveChangesAsync();
        return Ok(new { processed = true, status = app.Status });
    }

    [HttpDelete("admin/{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteApplication(Guid id)
    {
        var app = await _db.RoleApplications
            .Include(a => a.Messages)
            .Include(a => a.Documents)
            .FirstOrDefaultAsync(a => a.Id == id);
        if (app == null) return NotFound();

        AddAuditLog(
            action: "DELETE",
            entityType: "APPLICATION",
            entityId: app.Id.ToString(),
            actorId: GetUserId()?.ToString() ?? "Admin",
            actorRole: "Admin",
            beforeState: new { app.TargetRole, app.Status },
            afterState: null,
            actionType: "DELETE");

        _db.RoleApplications.Remove(app);
        await _db.SaveChangesAsync();
        return Ok(new { message = "Application deleted." });
    }

    private void AddAuditLog(
        string action,
        string entityType,
        string? entityId,
        string actorId,
        string actorRole,
        object? beforeState,
        object? afterState,
        string actionType)
    {
        var metadata = new JsonObject
        {
            ["actor_id"] = actorId,
            ["actor_role"] = actorRole,
            ["action_type"] = actionType,
            ["entity_type"] = entityType,
            ["entity_id"] = entityId,
            ["before_state"] = beforeState is null ? null : JsonSerializer.SerializeToNode(beforeState),
            ["after_state"] = afterState is null ? null : JsonSerializer.SerializeToNode(afterState),
            ["ip_address"] = HttpContext.Connection.RemoteIpAddress?.ToString(),
            ["device_info"] = Request.Headers.UserAgent.ToString()
        };
        _db.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            Action = action,
            Actor = actorId,
            EntityType = entityType,
            EntityId = entityId,
            Metadata = metadata.ToJsonString(),
            Timestamp = DateTime.UtcNow
        });
    }

    private RoleApplicationDocument SaveApplicationDocument(Guid applicationId, string documentName, FileUploadPayload file, string uploadedBy)
    {
        if (string.IsNullOrWhiteSpace(file.Base64Content))
            throw new InvalidOperationException("File content is required.");

        var safeFileName = Path.GetFileName(file.FileName ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(safeFileName))
            throw new InvalidOperationException("A valid file name is required.");

        byte[] bytes;
        try
        {
            bytes = Convert.FromBase64String(file.Base64Content);
        }
        catch (FormatException)
        {
            throw new InvalidOperationException("Uploaded document content is invalid.");
        }
        const int maxBytes = 8 * 1024 * 1024;
        if (bytes.Length == 0 || bytes.Length > maxBytes)
            throw new InvalidOperationException("Uploaded document must be between 1 byte and 8 MB.");

        var allowedTypes = new[]
        {
            "application/pdf",
            "image/jpeg",
            "image/png",
            "image/webp"
        };
        if (!allowedTypes.Contains(file.ContentType, StringComparer.OrdinalIgnoreCase))
            throw new InvalidOperationException("Unsupported file type. Upload PDF, JPG, PNG, or WEBP files.");

        var appFolder = Path.Combine(Directory.GetCurrentDirectory(), "uploads", "applications", applicationId.ToString());
        Directory.CreateDirectory(appFolder);

        var storedFileName = $"{Guid.NewGuid():N}_{safeFileName}";
        var fullPath = Path.Combine(appFolder, storedFileName);
        System.IO.File.WriteAllBytes(fullPath, bytes);

        return new RoleApplicationDocument
        {
            Id = Guid.NewGuid(),
            RoleApplicationId = applicationId,
            DocumentName = documentName,
            DocumentUrl = $"/uploads/applications/{applicationId}/{storedFileName}",
            OriginalFileName = safeFileName,
            ContentType = file.ContentType,
            UploadedBy = uploadedBy,
            CreatedAt = DateTime.UtcNow
        };
    }

    private Guid? GetUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier) ?? User.FindFirst("sub");
        return Guid.TryParse(claim?.Value, out var id) ? id : null;
    }
}
