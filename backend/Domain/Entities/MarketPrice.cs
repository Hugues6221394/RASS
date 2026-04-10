using System.ComponentModel.DataAnnotations;

namespace Rass.Api.Domain.Entities;

public class MarketPrice
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid? RegisteredMarketId { get; set; }
    public RegisteredMarket? RegisteredMarket { get; set; }

    [MaxLength(100)]
    public string Market { get; set; } = string.Empty;

    [MaxLength(50)]
    public string Region { get; set; } = string.Empty;

    [MaxLength(100)]
    public string? District { get; set; }

    [MaxLength(100)]
    public string? Sector { get; set; }

    [MaxLength(100)]
    public string? Cell { get; set; }

    [MaxLength(100)]
    public string Crop { get; set; } = string.Empty;

    public DateTime ObservedAt { get; set; }

    public decimal PricePerKg { get; set; }

    public Guid? AgentId { get; set; }
    public User? Agent { get; set; }

    /// <summary>Auto-approved if within regulation range, Flagged if outside or no regulation.</summary>
    [MaxLength(30)]
    public string VerificationStatus { get; set; } = "Approved"; // Approved, Pending, Flagged, Rejected

    [MaxLength(500)]
    public string? ModerationNote { get; set; }

    public Guid? ModeratedByUserId { get; set; }
    public DateTime? ModeratedAt { get; set; }
}

/// <summary>
/// Maps Rwandan market/district names to the 5 provinces.
/// Used to auto-populate Region when Market Agents submit prices.
/// </summary>
public static class RwandaGeography
{
    private static readonly Dictionary<string, string> MarketToRegion = new(StringComparer.OrdinalIgnoreCase)
    {
        // Kigali City
        { "Kigali", "Kigali City" },
        { "Nyarugenge", "Kigali City" },
        { "Kicukiro", "Kigali City" },
        { "Gasabo", "Kigali City" },

        // Northern Province
        { "Musanze", "Northern" },
        { "Burera", "Northern" },
        { "Gakenke", "Northern" },
        { "Gicumbi", "Northern" },
        { "Rulindo", "Northern" },

        // Southern Province
        { "Huye", "Southern" },
        { "Gisagara", "Southern" },
        { "Kamonyi", "Southern" },
        { "Muhanga", "Southern" },
        { "Nyamagabe", "Southern" },
        { "Nyanza", "Southern" },
        { "Nyaruguru", "Southern" },
        { "Ruhango", "Southern" },

        // Eastern Province
        { "Rwamagana", "Eastern" },
        { "Bugesera", "Eastern" },
        { "Gatsibo", "Eastern" },
        { "Kayonza", "Eastern" },
        { "Kirehe", "Eastern" },
        { "Ngoma", "Eastern" },
        { "Nyagatare", "Eastern" },

        // Western Province
        { "Rubavu", "Western" },
        { "Karongi", "Western" },
        { "Ngororero", "Western" },
        { "Nyabihu", "Western" },
        { "Nyamasheke", "Western" },
        { "Rusizi", "Western" },
        { "Rutsiro", "Western" },
    };

    public static readonly string[] AllRegions = { "Kigali City", "Northern", "Southern", "Eastern", "Western" };

    public static readonly string[] AllMarkets = { "Kigali", "Musanze", "Huye", "Rubavu", "Rwamagana", "Nyagatare", "Muhanga", "Rusizi" };

    public static readonly string[] AllCrops = { "Maize", "Beans", "Sorghum", "Cassava", "Potatoes", "Tomatoes", "Rice", "Wheat" };

    public static string ResolveRegion(string market)
    {
        if (string.IsNullOrWhiteSpace(market)) return "Unknown";
        return MarketToRegion.TryGetValue(market.Trim(), out var region) ? region : "Unknown";
    }
}

