using System.ComponentModel.DataAnnotations;

namespace Rass.Api.Domain.Entities;

public class Lot
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid? FarmerId { get; set; }
    public Farmer? Farmer { get; set; }

    public Guid? CooperativeId { get; set; }
    public Cooperative? Cooperative { get; set; }

    [MaxLength(100)]
    public string Crop { get; set; } = string.Empty;

    public double QuantityKg { get; set; }

    [MaxLength(20)]
    public string QualityGrade { get; set; } = "A"; // A, B, C, D

    public DateTime ExpectedHarvestDate { get; set; }

    public DateTime? HarvestedAt { get; set; }

    [MaxLength(40)]
    public string Status { get; set; } = "Listed"; // Listed, Reserved, Sold, Expired

    public bool Verified { get; set; }

    // === Enhanced Data Fields for AI ===

    /// <summary>
    /// Moisture level percentage (critical for storage and pricing)
    /// </summary>
    public double? MoisturePercent { get; set; }

    /// <summary>
    /// Storage location identifier
    /// </summary>
    public Guid? StorageFacilityId { get; set; }
    public StorageFacility? StorageFacility { get; set; }

    /// <summary>
    /// Price expectation from the farmer/cooperative (RWF per kg)
    /// </summary>
    public decimal? ExpectedPricePerKg { get; set; }

    /// <summary>
    /// Actual market price at time of listing (for AI training)
    /// </summary>
    public decimal? MarketPriceAtListing { get; set; }

    /// <summary>
    /// Growing season (A = Sep-Feb, B = Mar-Jun, C = Jul-Aug)
    /// </summary>
    [MaxLength(20)]
    public string? Season { get; set; }

    /// <summary>
    /// Production method (Organic, Conventional, IPM)
    /// </summary>
    [MaxLength(50)]
    public string? ProductionMethod { get; set; }

    /// <summary>
    /// Land area used for this lot in hectares
    /// </summary>
    public double? LandAreaHectares { get; set; }

    /// <summary>
    /// Yield per hectare for AI analysis
    /// </summary>
    public double? YieldPerHectare { get; set; }

    /// <summary>
    /// Days since harvest (calculated or updated)
    /// </summary>
    public int? DaysSinceHarvest { get; set; }

    /// <summary>
    /// Expiry/best-before date
    /// </summary>
    public DateTime? ExpiryDate { get; set; }

    /// <summary>
    /// GPS coordinates of farm/source (for regional analysis)
    /// </summary>
    public double? SourceLatitude { get; set; }
    public double? SourceLongitude { get; set; }

    /// <summary>
    /// Notes from quality inspection
    /// </summary>
    [MaxLength(1000)]
    public string? QualityNotes { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    public ICollection<ContractLot> ContractLots { get; set; } = new List<ContractLot>();
    public ICollection<LotContribution> Contributions { get; set; } = new List<LotContribution>();
}

