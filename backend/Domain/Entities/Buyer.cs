using System.ComponentModel.DataAnnotations;

namespace Rass.Api.Domain.Entities;

public class BuyerProfile
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid UserId { get; set; }
    public User User { get; set; } = default!;

    [MaxLength(200)]
    public string Organization { get; set; } = string.Empty;

    [MaxLength(100)]
    public string BusinessType { get; set; } = string.Empty;

    [MaxLength(200)]
    public string Location { get; set; } = string.Empty;

    [MaxLength(50)]
    public string Phone { get; set; } = string.Empty;

    [MaxLength(200)]
    public string TaxId { get; set; } = string.Empty;

    public bool IsVerified { get; set; } = false;

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<BuyerOrder> Orders { get; set; } = new List<BuyerOrder>();
}

public class BuyerOrder
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid BuyerProfileId { get; set; }
    public BuyerProfile BuyerProfile { get; set; } = default!;

    public Guid? MarketListingId { get; set; }
    public MarketListing? MarketListing { get; set; }

    [MaxLength(100)]
    public string Crop { get; set; } = string.Empty;

    public double QuantityKg { get; set; }

    public decimal PriceOffer { get; set; }

    [MaxLength(200)]
    public string DeliveryLocation { get; set; } = string.Empty;

    public DateTime DeliveryWindowStart { get; set; }
    public DateTime DeliveryWindowEnd { get; set; }

    [MaxLength(40)]
    public string Status { get; set; } = "Open"; // Open, Accepted, Rejected, Cancelled

    [MaxLength(1000)]
    public string Notes { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Contract> Contracts { get; set; } = new List<Contract>();
}

