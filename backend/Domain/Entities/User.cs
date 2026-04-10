using System.ComponentModel.DataAnnotations;

namespace Rass.Api.Domain.Entities;

public class User
{
    public Guid Id { get; set; } = Guid.NewGuid();

    [MaxLength(200)]
    public string Email { get; set; } = string.Empty;

    [MaxLength(200)]
    public string FullName { get; set; } = string.Empty;

    [MaxLength(400)]
    public string PasswordHash { get; set; } = string.Empty;

    public bool IsActive { get; set; } = true;

    [MaxLength(200)]
    public string? ResetOtp { get; set; }

    public DateTime? ResetOtpExpiry { get; set; }

    public DateTime? LastLogin { get; set; }

    [MaxLength(50)]
    public string? PhoneNumber { get; set; }

    public bool TwoFactorEnabled { get; set; } = false;

    [MaxLength(200)]
    public string? TwoFactorSecret { get; set; }

    [MaxLength(200)]
    public string? PendingEmail { get; set; }

    [MaxLength(200)]
    public string? PendingEmailOtpHash { get; set; }
    public DateTime? PendingEmailOtpExpiry { get; set; }

    [MaxLength(50)]
    public string? PendingPhone { get; set; }

    [MaxLength(200)]
    public string? PendingPhoneOtpHash { get; set; }
    public DateTime? PendingPhoneOtpExpiry { get; set; }

    public bool NotifyInApp { get; set; } = true;
    public bool NotifyEmail { get; set; } = true;
    public bool NotifySecurityAlerts { get; set; } = true;
    public bool NotifyMarketing { get; set; } = false;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<UserRole> UserRoles { get; set; } = new List<UserRole>();
}

public class Role
{
    public Guid Id { get; set; } = Guid.NewGuid();

    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    public ICollection<UserRole> UserRoles { get; set; } = new List<UserRole>();
}

public class UserRole
{
    public Guid UserId { get; set; }
    public User User { get; set; } = default!;

    public Guid RoleId { get; set; }
    public Role Role { get; set; } = default!;
}

