using System.ComponentModel.DataAnnotations;

namespace Rass.Api.Domain.Entities;

public class MarketReport
{
    public Guid Id { get; set; } = Guid.NewGuid();

    [MaxLength(200)]
    public string Market { get; set; } = string.Empty;

    [MaxLength(100)]
    public string ReportType { get; set; } = string.Empty;

    [MaxLength(50)]
    public string Severity { get; set; } = string.Empty;

    [MaxLength(1000)]
    public string Description { get; set; } = string.Empty;

    [MaxLength(500)]
    public string AffectedCrops { get; set; } = string.Empty;

    public Guid AgentUserId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
