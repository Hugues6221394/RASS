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
    public string QualityGrade { get; set; } = "A";

    public DateTime ExpectedHarvestDate { get; set; }

    public DateTime? HarvestedAt { get; set; }

    [MaxLength(40)]
    public string Status { get; set; } = "Listed";

    public bool Verified { get; set; }

    public ICollection<ContractLot> ContractLots { get; set; } = new List<ContractLot>();
}

