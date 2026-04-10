using System.ComponentModel.DataAnnotations;

namespace Rass.Api.Domain.Entities;

/// <summary>
/// Bid submitted by a supplier cooperative against a crop sharing request.
/// Requester cooperative can review and select a winning bid.
/// </summary>
public class CropShareBid
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid CropShareRequestId { get; set; }
    public CropShareRequest? CropShareRequest { get; set; }

    public Guid SupplierCooperativeId { get; set; }
    public Cooperative? SupplierCooperative { get; set; }

    public decimal ProposedPricePerKg { get; set; }
    public double ProposedQuantityKg { get; set; }

    [MaxLength(500)]
    public string? DeliveryTerms { get; set; }

    [MaxLength(1000)]
    public string? Notes { get; set; }

    [MaxLength(20)]
    public string Status { get; set; } = "Pending"; // Pending, Selected, Rejected, Withdrawn

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}
