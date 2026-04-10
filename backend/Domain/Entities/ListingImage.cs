namespace Rass.Api.Domain.Entities;

public class ListingImage
{
    public Guid Id { get; set; } = Guid.NewGuid();
    
    public Guid MarketListingId { get; set; }
    public MarketListing MarketListing { get; set; } = default!;
    
    public string ImageUrl { get; set; } = string.Empty;
    
    public int DisplayOrder { get; set; } = 0;
    
    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
}
