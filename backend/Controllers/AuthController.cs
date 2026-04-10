using BCrypt.Net;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Rass.Api.Data;
using Rass.Api.Domain.Entities;
using Rass.Api.Dtos;
using Rass.Api.Services;
using System.Text.RegularExpressions;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Security.Cryptography;

namespace Rass.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly TokenService _tokenService;
    private readonly ILocalizationService _localizer;

    public AuthController(AppDbContext db, TokenService tokenService, ILocalizationService localizer)
    {
        _db = db;
        _tokenService = tokenService;
        _localizer = localizer;
    }

    /// <summary>
    /// Login – Farmers may use phone or email. All other roles must use email only.
    /// </summary>
    [HttpPost("login")]
    public async Task<ActionResult<LoginResponse>> Login(LoginRequest request)
    {
        var lang = _localizer.GetLanguage(Request);
        var identifier = request.Identifier.Trim();
        var isPhone = IsPhoneNumber(identifier);

        User? user = null;

        if (isPhone)
        {
            // Phone login: only valid for Farmers
            var normalizedPhone = NormalizePhone(identifier);

            // Find Farmer by phone, then get User
            var phoneTail = normalizedPhone.Length > 4 ? normalizedPhone[^4..] : normalizedPhone;
            var farmer = (await _db.Farmers
                .Include(f => f.User)
                    .ThenInclude(u => u.UserRoles)
                        .ThenInclude(ur => ur.Role)
                .Where(f => f.Phone.Contains(phoneTail))
                .ToListAsync())
                .FirstOrDefault(f => NormalizePhone(f.Phone) == normalizedPhone);

            if (farmer == null)
                return Unauthorized(LocalizedError("auth.farmer_not_found_phone", lang));

            user = farmer.User;

            // Verify this user actually has the Farmer role
            var isFarmer = user.UserRoles.Any(ur => ur.Role.Name == "Farmer");
            if (!isFarmer)
                return Unauthorized(LocalizedError("auth.farmer_phone_only", lang));
        }
        else
        {
            // Email login: valid for all roles
            var email = identifier.ToLowerInvariant();

            user = await _db.Users
                .Include(u => u.UserRoles)
                    .ThenInclude(ur => ur.Role)
                .FirstOrDefaultAsync(u => u.Email.ToLower() == email);

            if (user == null)
                return Unauthorized(LocalizedError("auth.invalid_credentials", lang));

            // If this user is NOT a farmer but is trying unusual things, standard email login is fine for everyone.
        }

        // Verify password
        if (string.IsNullOrEmpty(user.PasswordHash))
            return Unauthorized(LocalizedError("auth.account_not_activated", lang));

        if (!BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            return Unauthorized(LocalizedError("auth.invalid_credentials", lang));

        if (!user.IsActive)
            return Unauthorized(LocalizedError("auth.account_inactive", lang));

        if (user.TwoFactorEnabled)
        {
            var otp = (request.Otp ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(user.TwoFactorSecret))
            {
                return Unauthorized(new { message = "Two-factor authentication is not configured correctly.", requiresTwoFactor = true });
            }

            if (string.IsNullOrWhiteSpace(otp))
            {
                return Unauthorized(new { message = "OTP code is required.", requiresTwoFactor = true });
            }

            if (!VerifyTotpCode(user.TwoFactorSecret, otp))
            {
                return Unauthorized(new { message = "Invalid OTP code.", requiresTwoFactor = true });
            }
        }

        var roles = user.UserRoles.Select(ur => ur.Role.Name).ToList();
        var maintenanceEnabledValue = await _db.SystemConfigurations
            .Where(c => c.Key == "system.maintenance.enabled")
            .Select(c => c.Value)
            .FirstOrDefaultAsync();
        var maintenanceEnabled = bool.TryParse(maintenanceEnabledValue, out var parsed) && parsed;
        if (maintenanceEnabled && !roles.Contains("Admin"))
            return StatusCode(503, "System is under maintenance. Please try again later.");

        // Update last login timestamp for AI analytics
        var previousLogin = user.LastLogin;
        user.LastLogin = DateTime.UtcNow;
        AddAuditLog("LOGIN", user.Id.ToString(), string.Join(",", roles), "USER", user.Id.ToString(), new { lastLogin = previousLogin }, new { user.LastLogin }, "LOGIN");
        await _db.SaveChangesAsync();

        var token = _tokenService.GenerateToken(user, roles);

        return Ok(new LoginResponse(user.Id, token, user.FullName, roles, false, null));
    }

    /// <summary>
    /// Check if a Farmer exists by phone or email (for first-time activation).
    /// </summary>
    [HttpPost("farmer/activate-check")]
    public async Task<IActionResult> FarmerActivationCheck(FarmerActivationCheckRequest request)
    {
        var lang = _localizer.GetLanguage(Request);
        var identifier = request.Identifier.Trim();
        var isPhone = IsPhoneNumber(identifier);

        User? user = null;
        string fullName = "";

        if (isPhone)
        {
            var normalizedPhone = NormalizePhone(identifier);
            var phoneTail = normalizedPhone.Length > 4 ? normalizedPhone[^4..] : normalizedPhone;
            var farmer = (await _db.Farmers
                .Include(f => f.User)
                    .ThenInclude(u => u.UserRoles)
                        .ThenInclude(ur => ur.Role)
                .Where(f => f.Phone.Contains(phoneTail))
                .ToListAsync())
                .FirstOrDefault(f => NormalizePhone(f.Phone) == normalizedPhone);

            if (farmer == null)
                return NotFound(LocalizedError("auth.farmer_not_found_phone", lang));

            user = farmer.User;
            fullName = user.FullName;
        }
        else
        {
            var email = identifier.ToLowerInvariant();
            user = await _db.Users
                .Include(u => u.UserRoles)
                    .ThenInclude(ur => ur.Role)
                .FirstOrDefaultAsync(u => u.Email.ToLower() == email);

            if (user == null)
                return NotFound(LocalizedError("auth.farmer_not_found_phone", lang));

            // Verify this user has the Farmer role
            var isFarmer = user.UserRoles.Any(ur => ur.Role.Name == "Farmer");
            if (!isFarmer)
                return BadRequest(LocalizedError("auth.activation_only_farmer", lang));

            fullName = user.FullName;
        }

        // Check if already activated (password already set)
        bool needsPasswordSetup = string.IsNullOrEmpty(user.PasswordHash);

        if (!needsPasswordSetup)
            return BadRequest(LocalizedError("auth.activation_already_done", lang));

        return Ok(new FarmerActivationCheckResponse(user.Id, fullName, needsPasswordSetup));
    }

    /// <summary>
    /// Complete Farmer first-time activation by setting password.
    /// </summary>
    [HttpPost("farmer/activate-complete")]
    public async Task<IActionResult> FarmerActivationComplete(FarmerActivationCompleteRequest request)
    {
        var lang = _localizer.GetLanguage(Request);
        if (request.Password != request.ConfirmPassword)
            return BadRequest(new FarmerActivationCompleteResponse(false, _localizer.Message("auth.activation_password_mismatch", lang).Message));

        var user = await _db.Users
            .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.Id == request.UserId);

        if (user == null)
            return NotFound(new FarmerActivationCompleteResponse(false, _localizer.Message("auth.activation_user_not_found", lang).Message));

        // Verify is Farmer
        var isFarmer = user.UserRoles.Any(ur => ur.Role.Name == "Farmer");
        if (!isFarmer)
            return BadRequest(new FarmerActivationCompleteResponse(false, _localizer.Message("auth.activation_only_farmer", lang).Message));

        // Check not already activated
        if (!string.IsNullOrEmpty(user.PasswordHash))
            return BadRequest(new FarmerActivationCompleteResponse(false, _localizer.Message("auth.activation_already_done", lang).Message));

        // Set password and activate
        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);
        user.IsActive = true;

        await _db.SaveChangesAsync();

        return Ok(new FarmerActivationCompleteResponse(true, _localizer.Message("auth.activation_success", lang).Message));
    }

    /// <summary>
    /// Self-register as a Buyer.
    /// </summary>
    [HttpPost("register/buyer")]
    public async Task<IActionResult> RegisterBuyer(RegisterBuyerRequest request)
    {
        // Check email uniqueness
        var emailLower = request.Email.Trim().ToLowerInvariant();
        var exists = await _db.Users.AnyAsync(u => u.Email.ToLower() == emailLower);
        if (exists)
            return Conflict(new { message = "An account with this email already exists." });

        // Get Buyer role
        var buyerRole = await _db.Roles.FirstOrDefaultAsync(r => r.Name == "Buyer");
        if (buyerRole == null)
            return StatusCode(500, new { message = "Buyer role not configured. Contact admin." });

        // Create user
        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = emailLower,
            FullName = request.FullName.Trim(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            IsActive = true
        };

        user.UserRoles.Add(new UserRole { UserId = user.Id, RoleId = buyerRole.Id });

        // Create BuyerProfile
        var profile = new BuyerProfile
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            Organization = request.Organization ?? "",
            BusinessType = request.BusinessType ?? "",
            Location = request.Location ?? "",
            Phone = request.Phone?.Trim() ?? "",
            TaxId = request.TaxId ?? "",
            IsVerified = false,
            IsActive = true
        };

        user.LastLogin = DateTime.UtcNow;
        _db.Users.Add(user);
        _db.BuyerProfiles.Add(profile);
        AddAuditLog("CREATE", user.Id.ToString(), "Buyer", "USER", user.Id.ToString(), null, new { user.Email, role = "Buyer" }, "CREATE");
        await _db.SaveChangesAsync();

        // Return token so user is auto-logged-in
        var roles = new List<string> { "Buyer" };
        var token = _tokenService.GenerateToken(user, roles);

        return Ok(new LoginResponse(user.Id, token, user.FullName, roles, false, null));
    }

    // ============================================================
    // PASSWORD RESET WITH OTP
    // ============================================================

    /// <summary>
    /// Request a password reset OTP.
    /// </summary>
    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword(ForgotPasswordRequest request)
    {
        var lang = _localizer.GetLanguage(Request);
        var identifier = request.Identifier.Trim();
        var isPhone = IsPhoneNumber(identifier);

        User? user = null;
        if (isPhone)
        {
            var normalizedPhone = NormalizePhone(identifier);
            var phoneTail = normalizedPhone.Length > 4 ? normalizedPhone[^4..] : normalizedPhone;
            var farmer = (await _db.Farmers
                .Include(f => f.User)
                .Where(f => f.Phone.Contains(phoneTail))
                .ToListAsync())
                .FirstOrDefault(f => NormalizePhone(f.Phone) == normalizedPhone);

            if (farmer == null)
                return Ok(new ResetPasswordResponse(true, _localizer.Message("auth.otp_sent_if_exists", lang).Message, "auth.otp_sent_if_exists"));

            user = farmer.User;
        }
        else
        {
            var email = identifier.ToLowerInvariant();
            user = await _db.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == email);

            if (user == null)
                return Ok(new ResetPasswordResponse(true, _localizer.Message("auth.otp_sent_if_exists", lang).Message, "auth.otp_sent_if_exists"));

        }

        // Generate 6-digit OTP
        var otp = new Random().Next(100000, 999999).ToString();
        user.ResetOtp = BCrypt.Net.BCrypt.HashPassword(otp);
        user.ResetOtpExpiry = DateTime.UtcNow.AddMinutes(10);
        _db.Notifications.Add(new Notification
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            Title = "Password reset verification",
            Message = $"Your RASS password reset code is: {otp}",
            Type = "auth.password_reset_otp",
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync();

        return Ok(new
        {
            success = true,
            message = _localizer.Message("auth.otp_sent_if_exists", lang).Message,
            code = "auth.otp_sent_if_exists"
        });
    }

    /// <summary>
    /// Verify the OTP code (step 2 of password reset).
    /// </summary>
    [HttpPost("verify-otp")]
    public async Task<IActionResult> VerifyOtp(VerifyOtpRequest request)
    {
        var lang = _localizer.GetLanguage(Request);
        var user = await FindUserByIdentifier(request.Identifier);
        if (user == null)
            return BadRequest(new ResetPasswordResponse(false, _localizer.Message("auth.otp_invalid_or_expired", lang).Message, "auth.otp_invalid_or_expired"));

        if (string.IsNullOrEmpty(user.ResetOtp) || user.ResetOtpExpiry == null)
            return BadRequest(new ResetPasswordResponse(false, _localizer.Message("auth.otp_not_requested", lang).Message, "auth.otp_not_requested"));

        if (DateTime.UtcNow > user.ResetOtpExpiry)
            return BadRequest(new ResetPasswordResponse(false, _localizer.Message("auth.otp_expired", lang).Message, "auth.otp_expired"));

        if (!BCrypt.Net.BCrypt.Verify(request.Otp, user.ResetOtp))
            return BadRequest(new ResetPasswordResponse(false, _localizer.Message("auth.otp_invalid", lang).Message, "auth.otp_invalid"));

        return Ok(new ResetPasswordResponse(true, _localizer.Message("auth.otp_verified", lang).Message, "auth.otp_verified"));
    }

    /// <summary>
    /// Reset password using a valid OTP (step 3 of password reset).
    /// </summary>
    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword(ResetPasswordRequest request)
    {
        var lang = _localizer.GetLanguage(Request);
        if (request.NewPassword != request.ConfirmPassword)
            return BadRequest(new ResetPasswordResponse(false, _localizer.Message("auth.passwords_mismatch", lang).Message, "auth.passwords_mismatch"));

        var user = await FindUserByIdentifier(request.Identifier);
        if (user == null)
            return BadRequest(new ResetPasswordResponse(false, _localizer.Message("auth.reset_invalid_request", lang).Message, "auth.reset_invalid_request"));

        if (string.IsNullOrEmpty(user.ResetOtp) || user.ResetOtpExpiry == null)
            return BadRequest(new ResetPasswordResponse(false, _localizer.Message("auth.reset_no_otp", lang).Message, "auth.reset_no_otp"));

        if (DateTime.UtcNow > user.ResetOtpExpiry)
            return BadRequest(new ResetPasswordResponse(false, _localizer.Message("auth.otp_expired", lang).Message, "auth.otp_expired"));

        if (!BCrypt.Net.BCrypt.Verify(request.Otp, user.ResetOtp))
            return BadRequest(new ResetPasswordResponse(false, _localizer.Message("auth.otp_invalid", lang).Message, "auth.otp_invalid"));

        // Set new password and clear OTP
        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        user.ResetOtp = null;
        user.ResetOtpExpiry = null;
        user.IsActive = true; // Reactivate if was pending
        AddAuditLog("PASSWORD_RESET", user.Id.ToString(), string.Join(",", await _db.UserRoles.Where(ur => ur.UserId == user.Id).Select(ur => ur.Role.Name).ToListAsync()), "USER", user.Id.ToString(), null, new { reset = true }, "UPDATE");
        await _db.SaveChangesAsync();

        return Ok(new ResetPasswordResponse(true, _localizer.Message("auth.reset_success", lang).Message, "auth.reset_success"));
    }

    private object LocalizedError(string code, string lang)
    {
        var msg = _localizer.Message(code, lang);
        return new { message = msg.Message, code = msg.Code };
    }

    // --- Helpers ---

    private async Task<User?> FindUserByIdentifier(string identifier)
    {
        identifier = identifier.Trim();
        if (IsPhoneNumber(identifier))
        {
            var normalizedPhone = NormalizePhone(identifier);
            var phoneTail = normalizedPhone.Length > 4 ? normalizedPhone[^4..] : normalizedPhone;
            var farmer = (await _db.Farmers
                .Include(f => f.User)
                .Where(f => f.Phone.Contains(phoneTail))
                .ToListAsync())
                .FirstOrDefault(f => NormalizePhone(f.Phone) == normalizedPhone);
            return farmer?.User;
        }
        else
        {
            var email = identifier.ToLowerInvariant();
            return await _db.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == email);
        }
    }

    private static bool IsPhoneNumber(string input)
    {
        // Matches Rwandan formats: 078..., 073..., +2507..., 07...
        // Also generic: starts with + or digit followed by mostly digits
        var cleaned = Regex.Replace(input, @"[\s\-\(\)]", "");
        return Regex.IsMatch(cleaned, @"^(\+?\d{9,15})$") && !cleaned.Contains("@");
    }

    private static string NormalizePhone(string phone)
    {
        // Remove spaces, dashes, parentheses
        var cleaned = Regex.Replace(phone, @"[\s\-\(\)]", "");

        // Convert local format to international (+250)
        if (cleaned.StartsWith("07") && cleaned.Length == 10)
            cleaned = "+250" + cleaned.Substring(1);
        else if (cleaned.StartsWith("2507") && cleaned.Length == 12)
            cleaned = "+" + cleaned;
        else if (!cleaned.StartsWith("+"))
            cleaned = "+" + cleaned;

        return cleaned;
    }

    private void AddAuditLog(string action, string actorId, string actorRole, string entityType, string? entityId, object? beforeState, object? afterState, string actionType)
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

    private static bool VerifyTotpCode(string base32Secret, string otp)
    {
        if (string.IsNullOrWhiteSpace(base32Secret) || string.IsNullOrWhiteSpace(otp)) return false;
        if (!Regex.IsMatch(otp, @"^\d{6}$")) return false;
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
}
