using System.ComponentModel.DataAnnotations;

namespace Rass.Api.Domain.Entities;

/// <summary>
/// Government-set price regulation for agricultural crops.
/// Enforced when cooperatives create market listings — prices exceeding
/// the regulated maximum are blocked by the system.
/// </summary>
public class PriceRegulation
{
    public Guid Id { get; set; } = Guid.NewGuid();

    [MaxLength(100)]
    public string Crop { get; set; } = string.Empty;

    [MaxLength(50)]
    public string Region { get; set; } = string.Empty; // Province: Northern, Southern, etc.

    [MaxLength(100)]
    public string? Market { get; set; } // Optional market-specific regulation

    [MaxLength(100)]
    public string? District { get; set; } // Optional district-specific regulation

    public decimal? MinPricePerKg { get; set; }

    public decimal MaxPricePerKg { get; set; }

    public DateTime EffectiveFrom { get; set; }

    public DateTime EffectiveTo { get; set; }

    [MaxLength(30)]
    public string Status { get; set; } = "Active"; // Active, Expired, Draft

    [MaxLength(500)]
    public string? Notes { get; set; }

    public Guid CreatedBy { get; set; }
    public User? CreatedByUser { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}
