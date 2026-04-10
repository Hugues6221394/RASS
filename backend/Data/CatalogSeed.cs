using Microsoft.EntityFrameworkCore;
using Rass.Api.Domain.Entities;
using Rass.Api.Services;

namespace Rass.Api.Data;

public static class CatalogSeed
{
    private static readonly string[] DefaultGovernmentCrops =
    {
        "Maize", "Beans", "Rice", "Irish Potato", "Cassava", "Wheat", "Sorghum", "Soybean", "Banana", "Tomato", "Onion", "Coffee", "Tea"
    };

    private static readonly (string Name, string Province, string District, string Sector, string? Cell, string? Location)[] DefaultMarkets =
    {
        ("Kimironko Market", "Kigali City", "Gasabo", "Kimironko", null, "Kimironko trading center"),
        ("Nyabugogo Market", "Kigali City", "Nyarugenge", "Kigali", null, "Nyabugogo wholesale corridor"),
        ("Musanze Central Market", "Northern", "Musanze", "Muhoza", null, "Muhoza town center"),
        ("Huye Central Market", "Southern", "Huye", "Ngoma", null, "Huye urban market"),
        ("Muhanga Main Market", "Southern", "Muhanga", "Nyamabuye", null, "Muhanga commercial hub"),
        ("Rwamagana Main Market", "Eastern", "Rwamagana", "Kigabiro", null, "Rwamagana town market"),
        ("Nyagatare Main Market", "Eastern", "Nyagatare", "Nyagatare", null, "Nyagatare trading zone"),
        ("Rubavu Central Market", "Western", "Rubavu", "Gisenyi", null, "Gisenyi market center"),
        ("Kamembe Market", "Western", "Rusizi", "Kamembe", null, "Kamembe border market")
    };

    public static async Task ApplyAsync(AppDbContext db)
    {
        // Track normalized names we've already queued to avoid duplicates in the change tracker
        var seenCrops = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var seenMarkets = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var cropName in DefaultGovernmentCrops)
        {
            var normalized = CatalogManagementService.NormalizeCropName(cropName);
            if (seenCrops.Contains(normalized)) continue;
            if (await db.CropCatalogs.AnyAsync(c => c.NormalizedName == normalized))
            {
                seenCrops.Add(normalized);
                continue;
            }
            seenCrops.Add(normalized);
            db.CropCatalogs.Add(new CropCatalog
            {
                Id = Guid.NewGuid(),
                Name = CatalogManagementService.FormatCropName(cropName),
                NormalizedName = normalized,
                Status = "Active",
                IsGovernmentRegistered = true,
                RequiresGovernmentReview = false,
                SourceRole = "Government",
                CreatedAt = DateTime.UtcNow
            });
        }

        var observedCrops = await db.Lots.Select(l => l.Crop)
            .Union(db.MarketPrices.Select(m => m.Crop))
            .Union(db.HarvestDeclarations.Select(h => h.Crop))
            .Union(db.MarketListings.Select(l => l.Crop))
            .Where(c => c != null && c != "")
            .Distinct()
            .ToListAsync();

        foreach (var cropName in observedCrops)
        {
            var normalized = CatalogManagementService.NormalizeCropName(cropName);
            if (seenCrops.Contains(normalized)) continue;
            if (await db.CropCatalogs.AnyAsync(c => c.NormalizedName == normalized))
            {
                seenCrops.Add(normalized);
                continue;
            }
            seenCrops.Add(normalized);
            db.CropCatalogs.Add(new CropCatalog
            {
                Id = Guid.NewGuid(),
                Name = CatalogManagementService.FormatCropName(cropName),
                NormalizedName = normalized,
                Status = "Active",
                IsGovernmentRegistered = false,
                RequiresGovernmentReview = true,
                SourceRole = "SystemMigration",
                CreatedAt = DateTime.UtcNow
            });
        }

        foreach (var market in DefaultMarkets)
        {
            var normalized = CatalogManagementService.NormalizeMarketName(market.Name);
            if (seenMarkets.Contains(normalized)) continue;
            if (await db.RegisteredMarkets.AnyAsync(m => m.NormalizedName == normalized))
            {
                seenMarkets.Add(normalized);
                continue;
            }
            seenMarkets.Add(normalized);
            db.RegisteredMarkets.Add(new RegisteredMarket
            {
                Id = Guid.NewGuid(),
                Name = market.Name,
                NormalizedName = normalized,
                Province = market.Province,
                District = market.District,
                Sector = market.Sector,
                Cell = market.Cell,
                Location = market.Location,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            });
        }

        await db.SaveChangesAsync();
    }
}
