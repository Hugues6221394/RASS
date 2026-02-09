namespace Rass.Api.Domain.Entities;

/// <summary>
/// Represents a shopping cart item for a buyer
/// </summary>
public class CartItem
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid MarketListingId { get; set; }
    public double QuantityKg { get; set; }
    public DateTime AddedAt { get; set; } = DateTime.UtcNow;
    
    // Navigation
    public User? User { get; set; }
    public MarketListing? MarketListing { get; set; }
}
