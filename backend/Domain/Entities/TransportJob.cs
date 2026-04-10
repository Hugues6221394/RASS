using System.ComponentModel.DataAnnotations;

namespace Rass.Api.Domain.Entities;

/// <summary>
/// A delivery job posted by a cooperative manager for transporters to apply for.
/// </summary>
public class TransportJob
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid CooperativeId { get; set; }
    public Cooperative Cooperative { get; set; } = default!;

    public Guid PostedByUserId { get; set; }
    public User PostedByUser { get; set; } = default!;

    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    [MaxLength(2000)]
    public string? Description { get; set; }

    // Cargo details
    [MaxLength(100)]
    public string Crop { get; set; } = string.Empty;

    public double QuantityKg { get; set; }

    [MaxLength(50)]
    public string? QualityGrade { get; set; }

    // Route
    [MaxLength(250)]
    public string PickupLocation { get; set; } = string.Empty;

    [MaxLength(250)]
    public string DeliveryLocation { get; set; } = string.Empty;

    public double? DistanceKm { get; set; }

    // Timing
    public DateTime? PickupDate { get; set; }
    public DateTime? DeliveryDeadline { get; set; }

    // Payment
    public decimal? MinPaymentRwf { get; set; }
    public decimal? MaxPaymentRwf { get; set; }

    [MaxLength(50)]
    public string PaymentTerms { get; set; } = "OnDelivery"; // OnDelivery, OnPickup, Split

    // Requirements
    [MaxLength(50)]
    public string? RequiredVehicleType { get; set; } // Truck, Van, Motorcycle, Any

    public bool RequiresColdChain { get; set; }

    [MaxLength(1000)]
    public string? SpecialInstructions { get; set; }

    // Status
    [MaxLength(40)]
    public string Status { get; set; } = "Open"; // Open, Closed, Assigned, InTransit, Delivered, Cancelled

    public Guid? AssignedTransporterId { get; set; }
    public User? AssignedTransporter { get; set; }

    public Guid? TransportRequestId { get; set; }
    public TransportRequest? TransportRequest { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<TransportJobApplication> Applications { get; set; } = new List<TransportJobApplication>();
}

/// <summary>
/// A transporter's application to a delivery job.
/// </summary>
public class TransportJobApplication
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid TransportJobId { get; set; }
    public TransportJob TransportJob { get; set; } = default!;

    public Guid TransporterUserId { get; set; }
    public User TransporterUser { get; set; } = default!;

    // Application details
    public decimal ProposedPriceRwf { get; set; }

    [MaxLength(50)]
    public string? VehicleType { get; set; }

    [MaxLength(30)]
    public string? PlateNumber { get; set; }

    public double? VehicleCapacityKg { get; set; }

    [MaxLength(2000)]
    public string? CoverLetter { get; set; }

    public int? EstimatedDeliveryHours { get; set; }

    [MaxLength(20)]
    public string? DriverPhone { get; set; }

    // Documents
    [MaxLength(500)]
    public string? DrivingLicenseUrl { get; set; }

    [MaxLength(500)]
    public string? InsuranceDocUrl { get; set; }

    [MaxLength(500)]
    public string? VehicleInspectionUrl { get; set; }

    // Status
    [MaxLength(40)]
    public string Status { get; set; } = "Submitted"; // Submitted, Shortlisted, Accepted, Rejected

    [MaxLength(500)]
    public string? ReviewNote { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
