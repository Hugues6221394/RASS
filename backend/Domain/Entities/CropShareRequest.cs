using System.ComponentModel.DataAnnotations;

namespace Rass.Api.Domain.Entities;

/// <summary>
/// Inter-cooperative crop sharing request.
/// Enables cooperatives in regions with crop scarcity to request
/// surplus crops from cooperatives in other regions, creating a
/// balanced national supply chain.
/// </summary>
public class CropShareRequest
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid RequesterCooperativeId { get; set; }
    public Cooperative? RequesterCooperative { get; set; }

    public Guid? SupplierCooperativeId { get; set; }
    public Cooperative? SupplierCooperative { get; set; }

    public Guid? TargetCooperativeId { get; set; }
    public Cooperative? TargetCooperative { get; set; }

    [MaxLength(100)]
    public string Crop { get; set; } = string.Empty;

    public double QuantityKg { get; set; }

    public decimal? OfferedPricePerKg { get; set; }

    [MaxLength(20)]
    public string UrgencyLevel { get; set; } = "Medium"; // Low, Medium, High, Critical

    [MaxLength(30)]
    public string Status { get; set; } = "Open"; // Open, Matched, Negotiating, Contracted, Fulfilled, Cancelled

    public bool BroadcastToAll { get; set; } = true;

    [MaxLength(1000)]
    public string? Notes { get; set; }

    [MaxLength(1000)]
    public string? ResponseNotes { get; set; }

    public decimal? AgreedPricePerKg { get; set; }

    public double? AgreedQuantityKg { get; set; }

    [MaxLength(500)]
    public string? DeliveryTerms { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? RespondedAt { get; set; }

    public DateTime? FulfilledAt { get; set; }

    public ICollection<CropShareBid> Bids { get; set; } = new List<CropShareBid>();
}
