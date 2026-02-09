using System.ComponentModel.DataAnnotations;

namespace Rass.Api.Domain.Entities;

public class MarketPrice
{
    public Guid Id { get; set; } = Guid.NewGuid();

    [MaxLength(100)]
    public string Market { get; set; } = string.Empty;

    [MaxLength(100)]
    public string Crop { get; set; } = string.Empty;

    public DateTime ObservedAt { get; set; }

    public decimal PricePerKg { get; set; }

    public Guid? AgentId { get; set; }
    public User? Agent { get; set; }
}

