using System.ComponentModel.DataAnnotations;

namespace Rass.Api.Domain.Entities;

public class Contract
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid BuyerOrderId { get; set; }
    public BuyerOrder BuyerOrder { get; set; } = default!;

    public decimal AgreedPrice { get; set; }

    [MaxLength(40)]
    public string Status { get; set; } = "Draft";

    [MaxLength(100)]
    public string TrackingId { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<ContractLot> ContractLots { get; set; } = new List<ContractLot>();
    public ICollection<TransportRequest> TransportRequests { get; set; } = new List<TransportRequest>();
    public ICollection<StorageBooking> StorageBookings { get; set; } = new List<StorageBooking>();
    public ICollection<PaymentLedger> PaymentLedgers { get; set; } = new List<PaymentLedger>();
}

public class ContractLot
{
    public Guid ContractId { get; set; }
    public Contract Contract { get; set; } = default!;

    public Guid LotId { get; set; }
    public Lot Lot { get; set; } = default!;
}

