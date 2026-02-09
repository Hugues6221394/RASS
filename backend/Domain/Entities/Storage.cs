using System.ComponentModel.DataAnnotations;

namespace Rass.Api.Domain.Entities;

public class StorageFacility
{
    public Guid Id { get; set; } = Guid.NewGuid();

    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(200)]
    public string Location { get; set; } = string.Empty;

    public double CapacityKg { get; set; }

    public double AvailableKg { get; set; }

    [MaxLength(400)]
    public string Features { get; set; } = string.Empty;

    public ICollection<StorageBooking> Bookings { get; set; } = new List<StorageBooking>();
}

public class StorageBooking
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid StorageFacilityId { get; set; }
    public StorageFacility StorageFacility { get; set; } = default!;

    public Guid? ContractId { get; set; }
    public Contract? Contract { get; set; }

    public Guid? LotId { get; set; }
    public Lot? Lot { get; set; }

    public double QuantityKg { get; set; }

    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }

    [MaxLength(40)]
    public string Status { get; set; } = "Reserved";
}

