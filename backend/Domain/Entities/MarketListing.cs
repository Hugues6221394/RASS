using System.ComponentModel.DataAnnotations;

namespace Rass.Api.Domain.Entities;

public class MarketListing
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid CooperativeId { get; set; }
    public Cooperative Cooperative { get; set; } = default!;

    [MaxLength(100)]
    public string Crop { get; set; } = string.Empty;

    public double QuantityKg { get; set; }

    public decimal MinimumPrice { get; set; }

    public DateTime AvailabilityWindowStart { get; set; }

    public DateTime AvailabilityWindowEnd { get; set; }

    [MaxLength(1000)]
    public string Description { get; set; } = string.Empty;

    [MaxLength(20)]
    public string QualityGrade { get; set; } = "A";

    [MaxLength(40)]
    public string Status { get; set; } = "Active"; // Active, Sold, Expired, Cancelled

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<BuyerOrder> BuyerOrders { get; set; } = new List<BuyerOrder>();
}
