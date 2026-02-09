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
    
    // New entities for real-time features
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<ChatMessage> ChatMessages => Set<ChatMessage>();
    public DbSet<CartItem> CartItems => Set<CartItem>();

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
    }
}

