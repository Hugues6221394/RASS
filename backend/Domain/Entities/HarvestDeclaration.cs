using System.ComponentModel.DataAnnotations;

namespace Rass.Api.Domain.Entities;

public class HarvestDeclaration
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid FarmerId { get; set; }
    public Farmer Farmer { get; set; } = default!;

    [MaxLength(100)]
    public string Crop { get; set; } = string.Empty;

    public double ExpectedQuantityKg { get; set; }

    public DateTime ExpectedHarvestDate { get; set; }

    [MaxLength(500)]
    public string QualityIndicators { get; set; } = string.Empty;

    [MaxLength(40)]
    public string Status { get; set; } = "Pending"; // Pending, Approved, Rejected

    /// <summary>
    /// Condition grade set by cooperative manager during approval.
    /// </summary>
    [MaxLength(30)]
    public string? ConditionGrade { get; set; } // Excellent, Good, MinorDefects, ModerateDamage, HighSpoilage

    /// <summary>
    /// Detailed condition note from cooperative manager.
    /// </summary>
    [MaxLength(1000)]
    public string? ConditionNote { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? ReviewedAt { get; set; }
}
