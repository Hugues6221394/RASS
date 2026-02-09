using System.ComponentModel.DataAnnotations;

namespace Rass.Api.Domain.Entities;

public class PaymentLedger
{
    public Guid Id { get; set; } = Guid.NewGuid();

    [MaxLength(50)]
    public string Reference { get; set; } = string.Empty;

    [MaxLength(40)]
    public string Type { get; set; } = "Escrow";

    public decimal Amount { get; set; }

    [MaxLength(40)]
    public string Status { get; set; } = "Pending";

    public Guid? ContractId { get; set; }
    public Contract? Contract { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

