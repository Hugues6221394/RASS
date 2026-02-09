using System.ComponentModel.DataAnnotations;

namespace Rass.Api.Domain.Entities;

public class FarmerBalance
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid FarmerId { get; set; }
    public Farmer Farmer { get; set; } = default!;

    public Guid? ContractId { get; set; }
    public Contract? Contract { get; set; }

    public decimal Amount { get; set; }

    [MaxLength(40)]
    public string Status { get; set; } = "Pending"; // Pending, Paid, Failed

    [MaxLength(100)]
    public string PaymentMethod { get; set; } = "MobileMoney"; // MobileMoney, BankTransfer

    [MaxLength(50)]
    public string TransactionReference { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? PaidAt { get; set; }
}

