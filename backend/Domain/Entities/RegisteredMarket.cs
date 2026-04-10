using System.ComponentModel.DataAnnotations;

namespace Rass.Api.Domain.Entities;

public class RegisteredMarket
{
    public Guid Id { get; set; } = Guid.NewGuid();

    [MaxLength(150)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(180)]
    public string NormalizedName { get; set; } = string.Empty;

    [MaxLength(80)]
    public string Province { get; set; } = string.Empty;

    [MaxLength(100)]
    public string District { get; set; } = string.Empty;

    [MaxLength(100)]
    public string Sector { get; set; } = string.Empty;

    [MaxLength(100)]
    public string? Cell { get; set; }

    [MaxLength(250)]
    public string? Location { get; set; }

    public bool IsActive { get; set; } = true;

    public Guid? CreatedByUserId { get; set; }
    public User? CreatedByUser { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}
