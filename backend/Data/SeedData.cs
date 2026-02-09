using BCrypt.Net;
using Rass.Api.Domain.Entities;

namespace Rass.Api.Data;

public static class SeedData
{
    public static void Apply(AppDbContext context)
    {
        if (context.Users.Any())
        {
            return;
        }

        var roles = BuildRoles();
        context.Roles.AddRange(roles.Values);

        var passwordHash = BCrypt.Net.BCrypt.HashPassword("Pass@123");

        var users = BuildUsers(passwordHash);
        context.Users.AddRange(users.Values);

        context.UserRoles.AddRange(BuildUserRoles(users, roles));

        var cooperative = new Cooperative
        {
            Id = Guid.Parse("a8a4fe86-2588-4f53-9b73-2a3abf7e6f0a"),
            Name = "Musanze Agricultural Hub",
            Region = "Northern",
            District = "Musanze",
            Location = "Musanze Town",
            Phone = "0788-000-111",
            Email = "info@musanzehub.rw",
            IsVerified = true,
            IsActive = true
        };
        context.Cooperatives.Add(cooperative);

        var buyerProfile = new BuyerProfile
        {
            Id = Guid.Parse("66a57e39-5d0b-4af0-92db-0b94e91337af"),
            UserId = users["buyer"].Id,
            Organization = "Kigali Fresh Market",
            Location = "Kigali",
            Phone = "0788-321-654",
            TaxId = "TX-123456789",
            IsVerified = true,
            IsActive = true
        };
        context.BuyerProfiles.Add(buyerProfile);

        var farmer = new Farmer
        {
            Id = Guid.Parse("bfaf6fb9-8e4f-4e60-9c1d-891d0950b112"),
            UserId = users["farmer"].Id,
            CooperativeId = cooperative.Id,
            District = "Musanze",
            Sector = "Muhoza",
            Phone = "0788-123-123",
            NationalId = "1198880012345678",
            Crops = "Tomatoes,Potatoes",
            FarmSizeHectares = 2.5
        };
        context.Farmers.Add(farmer);

        var lots = BuildLots(cooperative, farmer);
        context.Lots.AddRange(lots);


        var orders = BuildOrders(buyerProfile);
        context.BuyerOrders.AddRange(orders);

        var contract = new Contract
        {
            Id = Guid.Parse("3e6e6724-0d6a-4ad5-a42c-c1e7cae8420a"),
            BuyerOrderId = orders.First().Id,
            AgreedPrice = 520m,
            Status = "Active",
            TrackingId = "RASS-123456"
        };
        context.Contracts.Add(contract);

        context.ContractLots.AddRange(new[]
        {
            new ContractLot
            {
                ContractId = contract.Id,
                LotId = lots[0].Id
            }
        });

        var transportRequests = BuildTransports(contract);
        context.TransportRequests.AddRange(transportRequests);

        var storageFacilities = BuildStorageFacilities();
        context.StorageFacilities.AddRange(storageFacilities);

        var storageBooking = new StorageBooking
        {
            Id = Guid.Parse("0b1d1ae6-8ebc-4ce6-920d-684a02e721e9"),
            StorageFacilityId = storageFacilities[1].Id,
            ContractId = contract.Id,
            LotId = lots[0].Id,
            QuantityKg = 1500,
            StartDate = DateTime.UtcNow.AddDays(-1),
            EndDate = DateTime.UtcNow.AddDays(5),
            Status = "Reserved"
        };
        context.StorageBookings.Add(storageBooking);

        context.MarketPrices.AddRange(BuildMarketPrices(users));

        context.PaymentLedgers.Add(new PaymentLedger
        {
            Id = Guid.Parse("f1b33c1f-8430-4e72-a1dd-85213fbb1b95"),
            ContractId = contract.Id,
            Amount = 780000m,
            Reference = "ESCROW-001",
            Status = "Completed",
            Type = "Escrow",
            CreatedAt = DateTime.UtcNow.AddDays(-2)
        });

        // Add harvest declarations
        var harvestDeclaration = new HarvestDeclaration
        {
            Id = Guid.Parse("5f8b6c12-9d4e-4a7b-8c2f-3e5f1a9b7c8d"),
            FarmerId = farmer.Id,
            Crop = "Tomatoes",
            ExpectedQuantityKg = 2000,
            ExpectedHarvestDate = DateTime.UtcNow.AddDays(5),
            QualityIndicators = "Good size, red color, firm texture",
            Status = "Approved",
            CreatedAt = DateTime.UtcNow.AddDays(-2),
            ReviewedAt = DateTime.UtcNow.AddDays(-1)
        };
        context.HarvestDeclarations.Add(harvestDeclaration);

        // Add market listing
        var marketListing = new MarketListing
        {
            Id = Guid.Parse("7a9c8d23-4b5e-4f6a-9d8c-2f1e5b7a9c3d"),
            CooperativeId = cooperative.Id,
            Crop = "Tomatoes",
            QuantityKg = 1500,
            MinimumPrice = 480m,
            AvailabilityWindowStart = DateTime.UtcNow.AddDays(1),
            AvailabilityWindowEnd = DateTime.UtcNow.AddDays(7),
            Description = "Premium quality tomatoes from Musanze region",
            QualityGrade = "A",
            Status = "Active",
            CreatedAt = DateTime.UtcNow.AddDays(-1)
        };
        context.MarketListings.Add(marketListing);

        // Add transporter profile
        var transporterProfile = new TransporterProfile
        {
            Id = Guid.Parse("9b8c7d45-6e7f-4a8b-9c2d-3f4e6a8b9c0d"),
            UserId = users["transporter"].Id,
            CompanyName = "Mugenzi Logistics Ltd",
            LicenseNumber = "TL-2024-00123",
            Phone = "0788-456-789",
            CapacityKg = 5000,
            VehicleType = "Truck",
            LicensePlate = "RWA-KC-2847",
            OperatingRegions = "Kigali,Northern Province",
            IsVerified = true,
            IsActive = true
        };
        context.TransporterProfiles.Add(transporterProfile);

        // Buyer profile already created above

        // Add more market prices for better data
        var additionalPrices = new List<MarketPrice>
        {
            new MarketPrice
            {
                Id = Guid.Parse("c1d2e34f-5a6b-4c7d-8e9f-0a1b2c3d4e5f"),
                Market = "Kigali",
                Crop = "Potatoes",
                ObservedAt = DateTime.UtcNow.AddHours(-6),
                PricePerKg = 350m,
                AgentId = users["agent"].Id
            },
            new MarketPrice
            {
                Id = Guid.Parse("d2e3f45a-6b7c-4d8e-9f0a-1b2c3d4e5f6a"),
                Market = "Huye",
                Crop = "Maize",
                ObservedAt = DateTime.UtcNow.AddHours(-4),
                PricePerKg = 280m,
                AgentId = users["agent"].Id
            },
            new MarketPrice
            {
                Id = Guid.Parse("e3f4a56b-7c8d-4e9f-0a1b-2c3d4e5f6a7b"),
                Market = "Musanze",
                Crop = "Beans",
                ObservedAt = DateTime.UtcNow.AddHours(-2),
                PricePerKg = 650m,
                AgentId = users["agent"].Id
            }
        };
        context.MarketPrices.AddRange(additionalPrices);

        context.AuditLogs.Add(new AuditLog
        {
            Id = Guid.Parse("8e946b77-e8e1-4f4a-a6f1-1608a2e48e40"),
            Action = "Seed",
            Actor = "system",
            Metadata = "Initial seed data applied"
        });

        context.SaveChanges();
    }

    private static Dictionary<string, Role> BuildRoles()
    {
        return new Dictionary<string, Role>
        {
            ["admin"] = new Role { Id = Guid.Parse("7abf1cf3-97de-4f2c-89a6-1f6a32a5785a"), Name = "Admin" },
            ["farmer"] = new Role { Id = Guid.Parse("f6c8f1f3-1b7a-46d4-9d3a-76b167a5e7da"), Name = "Farmer" },
            ["coop"] = new Role { Id = Guid.Parse("aa5a3963-5a1d-4d8c-9fc5-dc0c628fb825"), Name = "CooperativeManager" },
            ["buyer"] = new Role { Id = Guid.Parse("6868b45d-93d8-4709-9c12-7adf305a4127"), Name = "Buyer" },
            ["transporter"] = new Role { Id = Guid.Parse("c3e47aab-91db-40d1-878b-284768dfc7d9"), Name = "Transporter" },
            ["storage"] = new Role { Id = Guid.Parse("0cc2a227-667a-45ea-81c0-0c8684a2b282"), Name = "StorageOperator" },
            ["agent"] = new Role { Id = Guid.Parse("3c2c8629-cd01-4dee-97b3-6894cff6c1d9"), Name = "MarketAgent" },
            ["gov"] = new Role { Id = Guid.Parse("e11a4c5c-86f2-4b3e-95b5-9f6022ed0d34"), Name = "Government" }
        };
    }

    private static Dictionary<string, User> BuildUsers(string passwordHash)
    {
        return new Dictionary<string, User>
        {
            ["admin"] = new User { Id = Guid.Parse("4b57d3bc-e994-4040-9cd6-4f02a3fae9c4"), Email = "admin@rass.rw", FullName = "Platform Admin", PasswordHash = passwordHash },
            ["farmer"] = new User { Id = Guid.Parse("7aeb1e9f-501f-49fe-bb07-473ed7f91f49"), Email = "farmer@rass.rw", FullName = "Jean Baptiste", PasswordHash = passwordHash },
            ["coop"] = new User { Id = Guid.Parse("bc9f7dd2-2868-4c25-8d56-d4405d9f8599"), Email = "coop@rass.rw", FullName = "Marie Claire", PasswordHash = passwordHash },
            ["buyer"] = new User { Id = Guid.Parse("d07c3d83-bc1e-4805-8627-08b0a95361f4"), Email = "buyer@rass.rw", FullName = "Kigali Buyer", PasswordHash = passwordHash },
            ["transporter"] = new User { Id = Guid.Parse("c0777c52-68bb-4c7c-93ce-50f5183fe8b9"), Email = "transporter@rass.rw", FullName = "Mugenzi Logistics", PasswordHash = passwordHash },
            ["storage"] = new User { Id = Guid.Parse("e32c9b74-98f2-456a-bb41-6957b3b4cf22"), Email = "storage@rass.rw", FullName = "Huye Storage Ops", PasswordHash = passwordHash },
            ["agent"] = new User { Id = Guid.Parse("142ef666-4fb9-4939-9baa-5ca71b56e730"), Email = "agent@rass.rw", FullName = "Market Agent", PasswordHash = passwordHash },
            ["gov"] = new User { Id = Guid.Parse("e87f473b-3a43-43c5-9c48-7715e5aa1d23"), Email = "gov@rass.rw", FullName = "Policy Dashboard", PasswordHash = passwordHash }
        };
    }

    private static IEnumerable<UserRole> BuildUserRoles(Dictionary<string, User> users, Dictionary<string, Role> roles)
    {
        return new[]
        {
            new UserRole { UserId = users["admin"].Id, RoleId = roles["admin"].Id },
            new UserRole { UserId = users["farmer"].Id, RoleId = roles["farmer"].Id },
            new UserRole { UserId = users["coop"].Id, RoleId = roles["coop"].Id },
            new UserRole { UserId = users["buyer"].Id, RoleId = roles["buyer"].Id },
            new UserRole { UserId = users["transporter"].Id, RoleId = roles["transporter"].Id },
            new UserRole { UserId = users["storage"].Id, RoleId = roles["storage"].Id },
            new UserRole { UserId = users["agent"].Id, RoleId = roles["agent"].Id },
            new UserRole { UserId = users["gov"].Id, RoleId = roles["gov"].Id }
        };
    }

    private static List<Lot> BuildLots(Cooperative cooperative, Farmer farmer)
    {
        return new List<Lot>
        {
            new Lot
            {
                Id = Guid.Parse("73b75d4e-8cf9-4a99-9f0d-64e3a842df0e"),
                CooperativeId = cooperative.Id,
                FarmerId = farmer.Id,
                Crop = "Tomatoes",
                QuantityKg = 2500,
                QualityGrade = "A",
                ExpectedHarvestDate = DateTime.UtcNow.AddDays(3),
                Status = "Listed",
                Verified = true
            },
            new Lot
            {
                Id = Guid.Parse("df13f789-b41d-4e79-ae3f-1e57f14cc8cb"),
                CooperativeId = cooperative.Id,
                FarmerId = farmer.Id,
                Crop = "Potatoes",
                QuantityKg = 5000,
                QualityGrade = "B",
                ExpectedHarvestDate = DateTime.UtcNow.AddDays(5),
                Status = "Listed",
                Verified = true
            }
        };
    }

    private static List<BuyerOrder> BuildOrders(BuyerProfile buyerProfile)
    {
        return new List<BuyerOrder>
        {
            new BuyerOrder
            {
                Id = Guid.Parse("65b69b75-56f9-4104-93be-a9c4c5d6d37c"),
                BuyerProfileId = buyerProfile.Id,
                Crop = "Tomatoes",
                QuantityKg = 2000,
                PriceOffer = 520m,
                DeliveryLocation = "Kigali Central Market",
                DeliveryWindowStart = DateTime.UtcNow.AddDays(2),
                DeliveryWindowEnd = DateTime.UtcNow.AddDays(4),
                Status = "Open"
            }
        };
    }

    private static List<TransportRequest> BuildTransports(Contract contract)
    {
        return new List<TransportRequest>
        {
            new TransportRequest
            {
                Id = Guid.Parse("20a9e0ab-2bb9-4873-afd7-bb00ee6b6b62"),
                ContractId = contract.Id,
                Origin = "Musanze",
                Destination = "Kigali",
                LoadKg = 1500,
                PickupStart = DateTime.UtcNow.AddHours(6),
                PickupEnd = DateTime.UtcNow.AddHours(18),
                Price = 42000m,
                Status = "Scheduled",
                AssignedTruck = "RWA-KC-2847"
            }
        };
    }

    private static List<StorageFacility> BuildStorageFacilities()
    {
        return new List<StorageFacility>
        {
            new StorageFacility
            {
                Id = Guid.Parse("3f5b9bd1-0d21-44d6-8e05-758995702d13"),
                Name = "Kigali Central Storage",
                Location = "Kigali",
                CapacityKg = 5000000,
                AvailableKg = 2800000,
                Features = "Climate Controlled,Digital Receipts,GPS Monitored,Insurance Covered"
            },
            new StorageFacility
            {
                Id = Guid.Parse("e7cddf06-b919-46f3-a3d8-35fde8724bdb"),
                Name = "Musanze Agricultural Hub",
                Location = "Musanze",
                CapacityKg = 3000000,
                AvailableKg = 1500000,
                Features = "Ambient,Quick Access,Sorting Facility,Quality Testing"
            },
            new StorageFacility
            {
                Id = Guid.Parse("3bce41cb-2e3c-4c5b-b4b0-f2c055994e5a"),
                Name = "Huye Processing Center",
                Location = "Huye",
                CapacityKg = 4000000,
                AvailableKg = 2200000,
                Features = "Cold Storage,Processing Ready,Export Certified,Bulk Handling"
            }
        };
    }

    private static List<MarketPrice> BuildMarketPrices(Dictionary<string, User> users)
    {
        return new List<MarketPrice>
        {
            new MarketPrice
            {
                Id = Guid.Parse("52e75d0a-0c5f-4d17-8cf9-1864ad7bc83d"),
                Market = "Kigali",
                Crop = "Tomatoes",
                ObservedAt = DateTime.UtcNow.AddHours(-3),
                PricePerKg = 420m,
                AgentId = users["agent"].Id
            },
            new MarketPrice
            {
                Id = Guid.Parse("9d1d49f3-9c34-42e0-94b8-8de894962de8"),
                Market = "Huye",
                Crop = "Potatoes",
                ObservedAt = DateTime.UtcNow.AddHours(-2),
                PricePerKg = 380m,
                AgentId = users["agent"].Id
            },
            new MarketPrice
            {
                Id = Guid.Parse("a5d0991f-e77e-4d12-8e5c-b8c4aa8d0bc0"),
                Market = "Musanze",
                Crop = "Maize",
                ObservedAt = DateTime.UtcNow.AddHours(-1),
                PricePerKg = 310m,
                AgentId = users["agent"].Id
            }
        };
    }
}

