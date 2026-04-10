using Microsoft.EntityFrameworkCore;
using Rass.Api.Domain.Entities;

namespace Rass.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<User> Users => Set<User>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<UserRole> UserRoles => Set<UserRole>();

    public DbSet<Farmer> Farmers => Set<Farmer>();
    public DbSet<Cooperative> Cooperatives => Set<Cooperative>();
    public DbSet<HarvestDeclaration> HarvestDeclarations => Set<HarvestDeclaration>();
    public DbSet<Lot> Lots => Set<Lot>();

    public DbSet<MarketPrice> MarketPrices => Set<MarketPrice>();
    public DbSet<MarketListing> MarketListings => Set<MarketListing>();

    public DbSet<BuyerProfile> BuyerProfiles => Set<BuyerProfile>();
    public DbSet<BuyerOrder> BuyerOrders => Set<BuyerOrder>();
    public DbSet<Contract> Contracts => Set<Contract>();
    public DbSet<ContractLot> ContractLots => Set<ContractLot>();

    public DbSet<TransporterProfile> TransporterProfiles => Set<TransporterProfile>();
    public DbSet<TransportRequest> TransportRequests => Set<TransportRequest>();
    public DbSet<StorageFacility> StorageFacilities => Set<StorageFacility>();
    public DbSet<StorageBooking> StorageBookings => Set<StorageBooking>();
    public DbSet<Telemetry> Telemetries => Set<Telemetry>();
    public DbSet<PaymentLedger> PaymentLedgers => Set<PaymentLedger>();
    public DbSet<FarmerBalance> FarmerBalances => Set<FarmerBalance>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    
    // Real-time features
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<ChatMessage> ChatMessages => Set<ChatMessage>();
    public DbSet<CartItem> CartItems => Set<CartItem>();
    public DbSet<ListingImage> ListingImages { get; set; }
    public DbSet<LotContribution> LotContributions { get; set; }
    public DbSet<MarketReport> MarketReports => Set<MarketReport>();

    // === NEW: GPS Tracking ===
    public DbSet<TransporterLocation> TransporterLocations => Set<TransporterLocation>();
    public DbSet<DeliveryTrackingInfo> DeliveryTrackingInfos => Set<DeliveryTrackingInfo>();

    // === NEW: AI Insights & Admin Intelligence ===
    public DbSet<PlatformAlert> PlatformAlerts => Set<PlatformAlert>();
    public DbSet<ModelPerformanceLog> ModelPerformanceLogs => Set<ModelPerformanceLog>();
    public DbSet<DataQualityIssue> DataQualityIssues => Set<DataQualityIssue>();
    public DbSet<SystemConfiguration> SystemConfigurations => Set<SystemConfiguration>();
    public DbSet<ScheduledTask> ScheduledTasks => Set<ScheduledTask>();
    public DbSet<RoleApplication> RoleApplications => Set<RoleApplication>();
    public DbSet<RoleApplicationMessage> RoleApplicationMessages => Set<RoleApplicationMessage>();
    public DbSet<RoleApplicationDocument> RoleApplicationDocuments => Set<RoleApplicationDocument>();
    public DbSet<CropCatalog> CropCatalogs => Set<CropCatalog>();
    public DbSet<RegisteredMarket> RegisteredMarkets => Set<RegisteredMarket>();

    // === Government Regulation & Agricultural Intelligence ===
    public DbSet<PriceRegulation> PriceRegulations => Set<PriceRegulation>();
    public DbSet<SeasonalGuidance> SeasonalGuidances => Set<SeasonalGuidance>();
    public DbSet<CropShareRequest> CropShareRequests => Set<CropShareRequest>();
    public DbSet<CropShareBid> CropShareBids => Set<CropShareBid>();

    // === Transport Jobs ===
    public DbSet<TransportJob> TransportJobs => Set<TransportJob>();
    public DbSet<TransportJobApplication> TransportJobApplications => Set<TransportJobApplication>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<User>()
            .HasIndex(u => u.Email)
            .IsUnique();

        modelBuilder.Entity<UserRole>()
            .HasKey(ur => new { ur.UserId, ur.RoleId });

        modelBuilder.Entity<ContractLot>()
            .HasKey(cl => new { cl.ContractId, cl.LotId });

        modelBuilder.Entity<BuyerOrder>()
            .HasMany(o => o.Contracts)
            .WithOne(c => c.BuyerOrder)
            .HasForeignKey(c => c.BuyerOrderId);

        modelBuilder.Entity<StorageFacility>()
            .Property(f => f.AvailableKg)
            .HasDefaultValue(0);

        modelBuilder.Entity<Cooperative>()
            .HasOne(c => c.Manager)
            .WithMany()
            .HasForeignKey(c => c.ManagerId)
            .OnDelete(DeleteBehavior.SetNull);

        // GPS Tracking indexes for performance
        modelBuilder.Entity<TransporterLocation>()
            .HasIndex(l => new { l.TransportRequestId, l.RecordedAt });

        modelBuilder.Entity<DeliveryTrackingInfo>()
            .HasIndex(t => t.TransportRequestId)
            .IsUnique();

        // Audit log indexes for efficient admin queries
        modelBuilder.Entity<AuditLog>()
            .HasIndex(a => new { a.Timestamp, a.ActionType });
        modelBuilder.Entity<AuditLog>()
            .HasIndex(a => a.ActorRole);

        // AI Insights indexes
        modelBuilder.Entity<PlatformAlert>()
            .HasIndex(a => new { a.Status, a.Severity, a.CreatedAt });

        modelBuilder.Entity<ModelPerformanceLog>()
            .HasIndex(m => new { m.ModelName, m.RecordedAt });

        modelBuilder.Entity<DataQualityIssue>()
            .HasIndex(d => new { d.Status, d.Severity });

        modelBuilder.Entity<SystemConfiguration>()
            .HasIndex(c => c.Key)
            .IsUnique();

        modelBuilder.Entity<RoleApplication>()
            .HasIndex(a => new { a.Status, a.UpdatedAt });

        modelBuilder.Entity<RoleApplication>()
            .HasOne(a => a.ApplicantUser)
            .WithMany()
            .HasForeignKey(a => a.ApplicantUserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<CropCatalog>()
            .HasIndex(c => c.NormalizedName)
            .IsUnique();

        modelBuilder.Entity<RegisteredMarket>()
            .HasIndex(m => m.NormalizedName)
            .IsUnique();

        // Price Regulation indexes
        modelBuilder.Entity<PriceRegulation>()
            .HasIndex(r => new { r.Crop, r.Region, r.Status });

        // Seasonal Guidance indexes
        modelBuilder.Entity<SeasonalGuidance>()
            .HasIndex(g => new { g.Crop, g.Region, g.Season });

        // Crop Share Request indexes
        modelBuilder.Entity<CropShareRequest>()
            .HasIndex(r => new { r.Status, r.Crop });

        modelBuilder.Entity<CropShareRequest>()
            .HasOne(r => r.RequesterCooperative)
            .WithMany()
            .HasForeignKey(r => r.RequesterCooperativeId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<CropShareRequest>()
            .HasOne(r => r.SupplierCooperative)
            .WithMany()
            .HasForeignKey(r => r.SupplierCooperativeId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<CropShareRequest>()
            .HasOne(r => r.TargetCooperative)
            .WithMany()
            .HasForeignKey(r => r.TargetCooperativeId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<CropShareBid>()
            .HasIndex(b => new { b.CropShareRequestId, b.SupplierCooperativeId })
            .IsUnique();

        modelBuilder.Entity<CropShareBid>()
            .HasIndex(b => new { b.Status, b.CreatedAt });

        modelBuilder.Entity<CropShareBid>()
            .HasOne(b => b.CropShareRequest)
            .WithMany(r => r.Bids)
            .HasForeignKey(b => b.CropShareRequestId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<CropShareBid>()
            .HasOne(b => b.SupplierCooperative)
            .WithMany()
            .HasForeignKey(b => b.SupplierCooperativeId)
            .OnDelete(DeleteBehavior.Restrict);

        // Transport Jobs
        modelBuilder.Entity<TransportJob>()
            .HasIndex(j => new { j.Status, j.CreatedAt });

        modelBuilder.Entity<TransportJob>()
            .HasOne(j => j.Cooperative)
            .WithMany()
            .HasForeignKey(j => j.CooperativeId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<TransportJobApplication>()
            .HasIndex(a => new { a.TransportJobId, a.TransporterUserId })
            .IsUnique();

        // MarketPrice verification index
        modelBuilder.Entity<MarketPrice>()
            .HasIndex(p => new { p.VerificationStatus, p.ObservedAt });
    }
}

