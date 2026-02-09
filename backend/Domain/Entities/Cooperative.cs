using System.ComponentModel.DataAnnotations;

namespace Rass.Api.Domain.Entities;

public class Cooperative
{
    public Guid Id { get; set; } = Guid.NewGuid();

    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(100)]
    public string Region { get; set; } = string.Empty;

    [MaxLength(100)]
    public string District { get; set; } = string.Empty;

    [MaxLength(200)]
    public string Location { get; set; } = string.Empty;

    [MaxLength(50)]
    public string Phone { get; set; } = string.Empty;

    [MaxLength(200)]
    public string Email { get; set; } = string.Empty;

    public bool IsVerified { get; set; } = false;

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Guid? ManagerId { get; set; } // User ID of the Cooperative Manager
    public User? Manager { get; set; }

    public ICollection<Farmer> Farmers { get; set; } = new List<Farmer>();
    public ICollection<Lot> Lots { get; set; } = new List<Lot>();
    public ICollection<MarketListing> MarketListings { get; set; } = new List<MarketListing>();
}

