using System.ComponentModel.DataAnnotations;

namespace Rass.Api.Domain.Entities;

public class TransportRequest
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid? ContractId { get; set; }
    public Contract? Contract { get; set; }

    public Guid? TransporterId { get; set; }
    public TransporterProfile? Transporter { get; set; }

    [MaxLength(200)]
    public string Origin { get; set; } = string.Empty;

    [MaxLength(200)]
    public string Destination { get; set; } = string.Empty;

    public double LoadKg { get; set; }

    public DateTime PickupStart { get; set; }
    public DateTime PickupEnd { get; set; }

    public decimal Price { get; set; }

    [MaxLength(40)]
    public string Status { get; set; } = "Pending"; // Pending, Assigned, Accepted, PickedUp, InTransit, Delivered, Completed

    [MaxLength(100)]
    public string? AssignedTruck { get; set; }

    [MaxLength(50)]
    public string? DriverPhone { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? AssignedAt { get; set; }

    public DateTime? PickedUpAt { get; set; }

    public DateTime? DeliveredAt { get; set; }

    [MaxLength(500)]
    public string Notes { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? ProofOfDeliveryUrl { get; set; } // URL to uploaded proof of delivery image/document
}

