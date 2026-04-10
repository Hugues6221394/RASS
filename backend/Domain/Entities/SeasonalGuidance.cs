using System.ComponentModel.DataAnnotations;

namespace Rass.Api.Domain.Entities;

/// <summary>
/// Government-issued seasonal guidance for agricultural planning.
/// Informs farmers about expected price stability periods and recommended crops.
/// </summary>
public class SeasonalGuidance
{
    public Guid Id { get; set; } = Guid.NewGuid();

    [MaxLength(100)]
    public string Crop { get; set; } = string.Empty;

    [MaxLength(50)]
    public string Region { get; set; } = string.Empty;

    [MaxLength(30)]
    public string Season { get; set; } = string.Empty; // Season A (Sep-Feb), Season B (Mar-Jun), Season C (Jul-Aug)

    public DateTime StabilityStart { get; set; }

    public DateTime StabilityEnd { get; set; }

    [MaxLength(20)]
    public string ExpectedTrend { get; set; } = "Stable"; // Rise, Fall, Stable

    public decimal? ExpectedMinPrice { get; set; }
    public decimal? ExpectedMaxPrice { get; set; }

    [MaxLength(1000)]
    public string? Notes { get; set; }

    [MaxLength(1000)]
    public string? RecommendationForFarmers { get; set; }

    public Guid CreatedBy { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
