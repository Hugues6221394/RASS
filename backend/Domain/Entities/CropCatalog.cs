using System.ComponentModel.DataAnnotations;

namespace Rass.Api.Domain.Entities;

public class CropCatalog
{
    public Guid Id { get; set; } = Guid.NewGuid();

    [MaxLength(120)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(160)]
    public string NormalizedName { get; set; } = string.Empty;

    [MaxLength(40)]
    public string Status { get; set; } = "Active"; // Active, Archived

    public bool IsGovernmentRegistered { get; set; }

    public bool RequiresGovernmentReview { get; set; }

    [MaxLength(40)]
    public string SourceRole { get; set; } = "Government";

    public Guid? CreatedByUserId { get; set; }
    public User? CreatedByUser { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}
