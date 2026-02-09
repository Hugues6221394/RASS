using System.ComponentModel.DataAnnotations;

namespace Rass.Api.Domain.Entities;

public class TransporterProfile
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid UserId { get; set; }
    public User User { get; set; } = default!;

    [MaxLength(200)]
    public string CompanyName { get; set; } = string.Empty;

    [MaxLength(50)]
    public string LicenseNumber { get; set; } = string.Empty;

    [MaxLength(50)]
    public string Phone { get; set; } = string.Empty;

    public double CapacityKg { get; set; }

    [MaxLength(100)]
    public string VehicleType { get; set; } = string.Empty;

    [MaxLength(20)]
    public string LicensePlate { get; set; } = string.Empty;

    [MaxLength(500)]
    public string OperatingRegions { get; set; } = string.Empty; // Comma-separated regions

    public bool IsVerified { get; set; } = false;

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<TransportRequest> TransportRequests { get; set; } = new List<TransportRequest>();
}
