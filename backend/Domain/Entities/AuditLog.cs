using System.ComponentModel.DataAnnotations;

namespace Rass.Api.Domain.Entities;

public class AuditLog
{
    public Guid Id { get; set; } = Guid.NewGuid();

    [MaxLength(200)]
    public string Action { get; set; } = string.Empty;

    [MaxLength(200)]
    public string Actor { get; set; } = string.Empty;

    [MaxLength(100)]
    public string? ActorRole { get; set; }

    [MaxLength(50)]
    public string? ActionType { get; set; }

    [MaxLength(100)]
    public string? EntityType { get; set; }

    [MaxLength(200)]
    public string? EntityId { get; set; }

    [MaxLength(60)]
    public string? IpAddress { get; set; }

    [MaxLength(500)]
    public string? DeviceInfo { get; set; }

    public string? BeforeState { get; set; }

    public string? AfterState { get; set; }

    public DateTime Timestamp { get; set; } = DateTime.UtcNow;

    /// <summary>Legacy JSON metadata column — new fields above are preferred for queries</summary>
    public string? Metadata { get; set; }

    public int? StatusCode { get; set; }

    public double? DurationMs { get; set; }
}
