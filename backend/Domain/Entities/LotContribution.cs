using System.ComponentModel.DataAnnotations;

namespace Rass.Api.Domain.Entities;

public class LotContribution
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid LotId { get; set; }
    public Lot Lot { get; set; } = default!;

    public Guid FarmerId { get; set; }
    public Farmer Farmer { get; set; } = default!;

    public double QuantityKg { get; set; }

    public DateTime ContributedAt { get; set; } = DateTime.UtcNow;
}
