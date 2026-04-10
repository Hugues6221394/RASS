using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;
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

        object? profileData = null;
        if (roles.Contains("Farmer"))
        {
            var farmer = await _db.Farmers.Include(f => f.Cooperative).FirstOrDefaultAsync(f => f.UserId == userId.Value);
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
            var buyer = await _db.BuyerProfiles.FirstOrDefaultAsync(b => b.UserId == userId.Value);
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
                    buyer.IsActive
                };
            }
        }
        else if (roles.Contains("Transporter"))
        {
            var transporter = await _db.TransporterProfiles.FirstOrDefaultAsync(t => t.UserId == userId.Value);
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
            var cooperative = await _db.Cooperatives.FirstOrDefaultAsync(c => c.Farmers.Any(f => f.UserId == userId.Value));
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
            user.PhoneNumber,
            user.IsActive,
            Roles = roles,
            Profile = profileData,
            Settings = new
            {
                user.TwoFactorEnabled,
                user.NotifyInApp,
                user.NotifyEmail,
                user.NotifySecurityAlerts,
                user.NotifyMarketing
            }
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
        if (!string.IsNullOrWhiteSpace(request.Phone)) user.PhoneNumber = request.Phone.Trim();

        if (roles.Contains("Farmer"))
        {
            var farmer = await _db.Farmers.FirstOrDefaultAsync(f => f.UserId == userId.Value);
            if (farmer != null)
            {
                if (!string.IsNullOrWhiteSpace(request.Phone)) farmer.Phone = request.Phone.Trim();
                if (!string.IsNullOrWhiteSpace(request.District)) farmer.District = request.District.Trim();
                if (!string.IsNullOrWhiteSpace(request.Sector)) farmer.Sector = request.Sector.Trim();
                if (!string.IsNullOrWhiteSpace(request.Crops)) farmer.Crops = request.Crops.Trim();
            }
        }
        else if (roles.Contains("Buyer"))
        {
            var buyer = await _db.BuyerProfiles.FirstOrDefaultAsync(b => b.UserId == userId.Value);
            if (buyer != null)
            {
                if (!string.IsNullOrWhiteSpace(request.Organization)) buyer.Organization = request.Organization.Trim();
                if (!string.IsNullOrWhiteSpace(request.BusinessType)) buyer.BusinessType = request.BusinessType.Trim();
                if (!string.IsNullOrWhiteSpace(request.Location)) buyer.Location = request.Location.Trim();
                if (!string.IsNullOrWhiteSpace(request.Phone)) buyer.Phone = request.Phone.Trim();
            }
        }
        else if (roles.Contains("Transporter"))
        {
            var transporter = await _db.TransporterProfiles.FirstOrDefaultAsync(t => t.UserId == userId.Value);
            if (transporter != null)
            {
                if (!string.IsNullOrWhiteSpace(request.CompanyName)) transporter.CompanyName = request.CompanyName.Trim();
                if (!string.IsNullOrWhiteSpace(request.VehicleType)) transporter.VehicleType = request.VehicleType.Trim();
                if (!string.IsNullOrWhiteSpace(request.VehiclePlate)) transporter.LicensePlate = request.VehiclePlate.Trim();
                if (request.CapacityKg.HasValue) transporter.CapacityKg = request.CapacityKg.Value;
                if (!string.IsNullOrWhiteSpace(request.Phone)) transporter.Phone = request.Phone.Trim();
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
            return BadRequest("Current password is incorrect.");

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        AddSettingsAudit(user.Id, "profile.password.changed", new { changed = true }, null);
        await _db.SaveChangesAsync();

        return Ok(new { message = "Password updated successfully" });
    }

    [HttpPost("otp/setup")]
    public async Task<IActionResult> BeginOtpSetup()
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var user = await _db.Users.FindAsync(userId.Value);
        if (user == null) return NotFound();

        var secret = GenerateBase32Secret();
        user.TwoFactorSecret = secret;
        user.TwoFactorEnabled = false;
        await _db.SaveChangesAsync();

        var issuer = "RASS";
        var account = Uri.EscapeDataString(user.Email);
        var otpAuthUrl = $"otpauth://totp/{issuer}:{account}?secret={secret}&issuer={issuer}&algorithm=SHA1&digits=6&period=30";
        var qrCodeUrl = $"https://api.qrserver.com/v1/create-qr-code/?size=220x220&data={Uri.EscapeDataString(otpAuthUrl)}";

        return Ok(new
        {
            secret,
            otpAuthUrl,
            qrCodeUrl,
            manualEntryKey = secret
        });
    }

    [HttpPost("otp/setup/verify")]
    public async Task<IActionResult> VerifyOtpSetup([FromBody] VerifyOtpSetupRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var user = await _db.Users.FindAsync(userId.Value);
        if (user == null) return NotFound();
        if (string.IsNullOrWhiteSpace(user.TwoFactorSecret))
            return BadRequest("OTP setup was not initialized.");

        if (!VerifyTotpCode(user.TwoFactorSecret, request.OtpCode))
            return BadRequest("Invalid OTP code.");

        var before = new { user.TwoFactorEnabled };
        user.TwoFactorEnabled = true;
        AddSettingsAudit(user.Id, "profile.otp.enabled", before, new { user.TwoFactorEnabled });
        await _db.SaveChangesAsync();
        return Ok(new { message = "Two-factor authentication enabled successfully." });
    }

    [HttpPost("otp/disable")]
    public async Task<IActionResult> DisableOtp([FromBody] DisableOtpRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var user = await _db.Users.FindAsync(userId.Value);
        if (user == null) return NotFound();
        if (!user.TwoFactorEnabled || string.IsNullOrWhiteSpace(user.TwoFactorSecret))
            return BadRequest("Two-factor authentication is not enabled.");

        if (!VerifyTotpCode(user.TwoFactorSecret, request.OtpCode))
            return BadRequest("Invalid OTP code.");

        var before = new { user.TwoFactorEnabled };
        user.TwoFactorEnabled = false;
        user.TwoFactorSecret = null;
        AddSettingsAudit(user.Id, "profile.otp.disabled", before, new { user.TwoFactorEnabled });
        await _db.SaveChangesAsync();
        return Ok(new { message = "Two-factor authentication disabled successfully." });
    }

    [HttpPost("email-change/request")]
    public async Task<IActionResult> RequestEmailChange([FromBody] RequestEmailChangeRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var user = await _db.Users.FindAsync(userId.Value);
        if (user == null) return NotFound();

        var newEmail = request.NewEmail.Trim().ToLowerInvariant();
        if (newEmail == user.Email.ToLowerInvariant()) return BadRequest("New email must be different.");
        var exists = await _db.Users.AnyAsync(u => u.Email.ToLower() == newEmail && u.Id != user.Id);
        if (exists) return Conflict(new { message = "Email is already in use." });

        var otp = new Random().Next(100000, 999999).ToString();
        user.PendingEmail = newEmail;
        user.PendingEmailOtpHash = BCrypt.Net.BCrypt.HashPassword(otp);
        user.PendingEmailOtpExpiry = DateTime.UtcNow.AddMinutes(10);

        _db.Notifications.Add(new Notification
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            Title = "Email change verification",
            Message = $"Use this code to confirm your new email: {otp}",
            Type = "AccountSecurity",
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        });
        AddSettingsAudit(user.Id, "profile.email.change.requested", new { email = MaskEmail(user.Email) }, new { email = MaskEmail(newEmail) });
        await _db.SaveChangesAsync();
        return Ok(new { message = "Verification code sent. Check notifications." });
    }

    [HttpPost("email-change/confirm")]
    public async Task<IActionResult> ConfirmEmailChange([FromBody] ConfirmEmailChangeRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var user = await _db.Users.FindAsync(userId.Value);
        if (user == null) return NotFound();
        if (string.IsNullOrWhiteSpace(user.PendingEmail) || string.IsNullOrWhiteSpace(user.PendingEmailOtpHash) || user.PendingEmailOtpExpiry is null)
            return BadRequest("No pending email change request.");
        if (DateTime.UtcNow > user.PendingEmailOtpExpiry.Value) return BadRequest("Verification code expired.");
        if (!BCrypt.Net.BCrypt.Verify(request.OtpCode, user.PendingEmailOtpHash)) return BadRequest("Invalid verification code.");

        var before = new { email = MaskEmail(user.Email) };
        user.Email = user.PendingEmail;
        user.PendingEmail = null;
        user.PendingEmailOtpHash = null;
        user.PendingEmailOtpExpiry = null;
        AddSettingsAudit(user.Id, "profile.email.changed", before, new { email = MaskEmail(user.Email) });
        await _db.SaveChangesAsync();
        return Ok(new { message = "Email updated successfully." });
    }

    [HttpPost("phone-change/request")]
    public async Task<IActionResult> RequestPhoneChange([FromBody] RequestPhoneChangeRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var user = await _db.Users.FindAsync(userId.Value);
        if (user == null) return NotFound();

        var newPhone = request.NewPhone.Trim();
        if (string.IsNullOrWhiteSpace(newPhone)) return BadRequest("Phone is required.");
        if (string.Equals(user.PhoneNumber, newPhone, StringComparison.OrdinalIgnoreCase)) return BadRequest("New phone must be different.");

        var otp = new Random().Next(100000, 999999).ToString();
        user.PendingPhone = newPhone;
        user.PendingPhoneOtpHash = BCrypt.Net.BCrypt.HashPassword(otp);
        user.PendingPhoneOtpExpiry = DateTime.UtcNow.AddMinutes(10);

        _db.Notifications.Add(new Notification
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            Title = "Phone change verification",
            Message = $"Use this code to confirm your new phone number: {otp}",
            Type = "AccountSecurity",
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        });
        AddSettingsAudit(user.Id, "profile.phone.change.requested", new { phone = MaskPhone(user.PhoneNumber) }, new { phone = MaskPhone(newPhone) });
        await _db.SaveChangesAsync();
        return Ok(new { message = "Verification code sent. Check notifications." });
    }

    [HttpPost("phone-change/confirm")]
    public async Task<IActionResult> ConfirmPhoneChange([FromBody] ConfirmPhoneChangeRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var user = await _db.Users
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.Id == userId.Value);
        if (user == null) return NotFound();
        if (string.IsNullOrWhiteSpace(user.PendingPhone) || string.IsNullOrWhiteSpace(user.PendingPhoneOtpHash) || user.PendingPhoneOtpExpiry is null)
            return BadRequest("No pending phone change request.");
        if (DateTime.UtcNow > user.PendingPhoneOtpExpiry.Value) return BadRequest("Verification code expired.");
        if (!BCrypt.Net.BCrypt.Verify(request.OtpCode, user.PendingPhoneOtpHash)) return BadRequest("Invalid verification code.");

        var before = new { phone = MaskPhone(user.PhoneNumber) };
        user.PhoneNumber = user.PendingPhone;
        var roles = user.UserRoles.Select(r => r.Role.Name).ToList();
        if (roles.Contains("Farmer"))
        {
            var farmer = await _db.Farmers.FirstOrDefaultAsync(f => f.UserId == user.Id);
            if (farmer != null) farmer.Phone = user.PendingPhone;
        }
        if (roles.Contains("Buyer"))
        {
            var buyer = await _db.BuyerProfiles.FirstOrDefaultAsync(b => b.UserId == user.Id);
            if (buyer != null) buyer.Phone = user.PendingPhone;
        }
        if (roles.Contains("Transporter"))
        {
            var transporter = await _db.TransporterProfiles.FirstOrDefaultAsync(t => t.UserId == user.Id);
            if (transporter != null) transporter.Phone = user.PendingPhone;
        }

        user.PendingPhone = null;
        user.PendingPhoneOtpHash = null;
        user.PendingPhoneOtpExpiry = null;
        AddSettingsAudit(user.Id, "profile.phone.changed", before, new { phone = MaskPhone(user.PhoneNumber) });
        await _db.SaveChangesAsync();
        return Ok(new { message = "Phone number updated successfully." });
    }

    [HttpPut("notifications/preferences")]
    public async Task<IActionResult> UpdateNotificationPreferences([FromBody] UpdateNotificationPreferencesRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();
        var user = await _db.Users.FindAsync(userId.Value);
        if (user == null) return NotFound();

        var before = new
        {
            user.NotifyInApp,
            user.NotifyEmail,
            user.NotifySecurityAlerts,
            user.NotifyMarketing
        };
        user.NotifyInApp = request.NotifyInApp;
        user.NotifyEmail = request.NotifyEmail;
        user.NotifySecurityAlerts = request.NotifySecurityAlerts;
        user.NotifyMarketing = request.NotifyMarketing;
        AddSettingsAudit(user.Id, "profile.notifications.updated", before, new
        {
            user.NotifyInApp,
            user.NotifyEmail,
            user.NotifySecurityAlerts,
            user.NotifyMarketing
        });
        await _db.SaveChangesAsync();

        return Ok(new { message = "Notification preferences updated." });
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

    private static string GenerateBase32Secret(int length = 32)
    {
        const string alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
        var bytes = new byte[length];
        RandomNumberGenerator.Fill(bytes);
        var sb = new StringBuilder(length);
        for (var i = 0; i < bytes.Length; i++) sb.Append(alphabet[bytes[i] % alphabet.Length]);
        return sb.ToString();
    }

    private static bool VerifyTotpCode(string base32Secret, string otp)
    {
        if (string.IsNullOrWhiteSpace(base32Secret) || string.IsNullOrWhiteSpace(otp)) return false;
        if (!System.Text.RegularExpressions.Regex.IsMatch(otp, @"^\d{6}$")) return false;
        var secret = Base32Decode(base32Secret);
        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds() / 30;
        for (var offset = -1; offset <= 1; offset++)
        {
            var expected = ComputeTotp(secret, now + offset);
            if (string.Equals(expected, otp, StringComparison.Ordinal)) return true;
        }
        return false;
    }

    private static byte[] Base32Decode(string input)
    {
        const string alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
        var clean = input.Trim().Replace("=", "").Replace(" ", "").ToUpperInvariant();
        var output = new List<byte>();
        var buffer = 0;
        var bitsLeft = 0;
        foreach (var c in clean)
        {
            var val = alphabet.IndexOf(c);
            if (val < 0) continue;
            buffer = (buffer << 5) | val;
            bitsLeft += 5;
            if (bitsLeft >= 8)
            {
                output.Add((byte)((buffer >> (bitsLeft - 8)) & 0xFF));
                bitsLeft -= 8;
            }
        }
        return output.ToArray();
    }

    private static string ComputeTotp(byte[] secret, long timestep)
    {
        var counter = BitConverter.GetBytes(timestep);
        if (BitConverter.IsLittleEndian) Array.Reverse(counter);
        using var hmac = new HMACSHA1(secret);
        var hash = hmac.ComputeHash(counter);
        var offset = hash[^1] & 0x0F;
        var binaryCode = ((hash[offset] & 0x7F) << 24)
                       | (hash[offset + 1] << 16)
                       | (hash[offset + 2] << 8)
                       | hash[offset + 3];
        var code = binaryCode % 1_000_000;
        return code.ToString("D6");
    }

    private void AddSettingsAudit(Guid actorId, string action, object? beforeState, object? afterState)
    {
        var actorRole = User.FindFirst(ClaimTypes.Role)?.Value ?? "User";
        var metadata = new JsonObject
        {
            ["actor_id"] = actorId.ToString(),
            ["actor_role"] = actorRole,
            ["before_state"] = beforeState is null ? null : System.Text.Json.JsonSerializer.SerializeToNode(beforeState),
            ["after_state"] = afterState is null ? null : System.Text.Json.JsonSerializer.SerializeToNode(afterState),
            ["ip_address"] = HttpContext.Connection.RemoteIpAddress?.ToString()
        };

        _db.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            Action = action,
            Actor = actorId.ToString(),
            EntityType = "UserSettings",
            EntityId = actorId.ToString(),
            Metadata = metadata.ToJsonString(),
            Timestamp = DateTime.UtcNow
        });
    }

    private static string MaskEmail(string? email)
    {
        if (string.IsNullOrWhiteSpace(email) || !email.Contains('@')) return "***";
        var parts = email.Split('@');
        var local = parts[0];
        var maskedLocal = local.Length <= 2 ? "**" : $"{local[0]}***{local[^1]}";
        return $"{maskedLocal}@{parts[1]}";
    }

    private static string MaskPhone(string? phone)
    {
        if (string.IsNullOrWhiteSpace(phone)) return "***";
        var digits = new string(phone.Where(char.IsDigit).ToArray());
        if (digits.Length < 4) return "***";
        return $"***{digits[^4]}{digits[^3]}{digits[^2]}{digits[^1]}";
    }
}
