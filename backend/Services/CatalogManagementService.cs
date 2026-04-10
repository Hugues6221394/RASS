using Microsoft.EntityFrameworkCore;
using Rass.Api.Data;
using Rass.Api.Domain.Entities;

namespace Rass.Api.Services;

public class CatalogManagementService
{
    private readonly AppDbContext _db;

    public CatalogManagementService(AppDbContext db)
    {
        _db = db;
    }

    public static string NormalizeCropName(string raw)
    {
        return string.Join(" ", raw
            .Trim()
            .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            .ToLowerInvariant();
    }

    public static string FormatCropName(string raw)
    {
        var normalized = NormalizeCropName(raw);
        if (string.IsNullOrWhiteSpace(normalized))
            return string.Empty;

        return string.Join(" ", normalized
            .Split(' ', StringSplitOptions.RemoveEmptyEntries)
            .Select(segment => char.ToUpperInvariant(segment[0]) + segment[1..]));
    }

    public static string NormalizeMarketName(string raw)
    {
        return string.Join(" ", raw
            .Trim()
            .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            .ToLowerInvariant();
    }

    public async Task<string> EnsureCropAsync(string rawCrop, Guid? actorId, string actorRole, bool governmentRegistered)
    {
        var formattedName = FormatCropName(rawCrop);
        if (string.IsNullOrWhiteSpace(formattedName))
            throw new InvalidOperationException("Crop is required.");

        var normalizedName = NormalizeCropName(formattedName);
        var existing = await _db.CropCatalogs.FirstOrDefaultAsync(c => c.NormalizedName == normalizedName);
        if (existing != null)
        {
            if (governmentRegistered && !existing.IsGovernmentRegistered)
            {
                existing.IsGovernmentRegistered = true;
                existing.RequiresGovernmentReview = false;
                existing.UpdatedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync();
            }

            return existing.Name;
        }

        var crop = new CropCatalog
        {
            Id = Guid.NewGuid(),
            Name = formattedName,
            NormalizedName = normalizedName,
            Status = "Active",
            IsGovernmentRegistered = governmentRegistered,
            RequiresGovernmentReview = !governmentRegistered,
            SourceRole = string.IsNullOrWhiteSpace(actorRole) ? "System" : actorRole,
            CreatedByUserId = actorId,
            CreatedAt = DateTime.UtcNow,
        };

        _db.CropCatalogs.Add(crop);
        await _db.SaveChangesAsync();
        return crop.Name;
    }

    public async Task<RegisteredMarket?> FindMarketAsync(string? marketName)
    {
        if (string.IsNullOrWhiteSpace(marketName))
            return null;

        var normalizedName = NormalizeMarketName(marketName);
        return await _db.RegisteredMarkets
            .FirstOrDefaultAsync(m => m.NormalizedName == normalizedName && m.IsActive);
    }

    public async Task<RegisteredMarket> CreateMarketAsync(
        string name,
        string province,
        string district,
        string sector,
        string? cell,
        string? location,
        Guid? actorId)
    {
        var normalizedHierarchy = RwandaAdminData.NormalizeHierarchy(province, district, sector);
        if (normalizedHierarchy == null)
            throw new InvalidOperationException("Select a valid Province, District, and Sector combination for Rwanda.");

        var formattedName = string.Join(" ", name
            .Trim()
            .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));
        if (string.IsNullOrWhiteSpace(formattedName))
            throw new InvalidOperationException("Market name is required.");

        var normalizedName = NormalizeMarketName(formattedName);
        var existing = await _db.RegisteredMarkets.FirstOrDefaultAsync(m => m.NormalizedName == normalizedName);
        if (existing != null)
        {
            existing.Province = normalizedHierarchy.Value.Province;
            existing.District = normalizedHierarchy.Value.District;
            existing.Sector = normalizedHierarchy.Value.Sector;
            existing.Cell = string.IsNullOrWhiteSpace(cell) ? null : cell.Trim();
            existing.Location = string.IsNullOrWhiteSpace(location) ? null : location.Trim();
            existing.IsActive = true;
            existing.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return existing;
        }

        var market = new RegisteredMarket
        {
            Id = Guid.NewGuid(),
            Name = formattedName,
            NormalizedName = normalizedName,
            Province = normalizedHierarchy.Value.Province,
            District = normalizedHierarchy.Value.District,
            Sector = normalizedHierarchy.Value.Sector,
            Cell = string.IsNullOrWhiteSpace(cell) ? null : cell.Trim(),
            Location = string.IsNullOrWhiteSpace(location) ? null : location.Trim(),
            IsActive = true,
            CreatedByUserId = actorId,
            CreatedAt = DateTime.UtcNow
        };

        _db.RegisteredMarkets.Add(market);
        await _db.SaveChangesAsync();
        return market;
    }
}
