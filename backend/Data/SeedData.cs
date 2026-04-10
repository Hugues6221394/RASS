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
            IsActive = true,
            ManagerId = users["coop"].Id
        };
        context.Cooperatives.Add(cooperative);

        // Add second cooperative
        var cooperative2 = new Cooperative
        {
            Id = Guid.Parse("b9b5fe97-3699-5f64-0b84-3b4bcf8f7f1b"),
            Name = "Huye Farmers Collective",
            Region = "Southern",
            District = "Huye",
            Location = "Huye Center",
            Phone = "0788-222-333",
            Email = "info@huyefarmers.rw",
            IsVerified = true,
            IsActive = true
        };
        context.Cooperatives.Add(cooperative2);

        // Add third cooperative
        var cooperative3 = new Cooperative
        {
            Id = Guid.Parse("c0c6ff08-4700-6075-1c95-4c5cd909808c"),
            Name = "Rubavu Fresh Produce",
            Region = "Western",
            District = "Rubavu",
            Location = "Gisenyi",
            Phone = "0788-444-555",
            Email = "contact@rubavufresh.rw",
            IsVerified = true,
            IsActive = true
        };
        context.Cooperatives.Add(cooperative3);

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

        // Additional farmers across regions for realistic national coverage
        var additionalFarmers = BuildAdditionalFarmers(passwordHash, cooperative, cooperative2, cooperative3);
        context.Users.AddRange(additionalFarmers.Select(f => f.user));
        context.UserRoles.AddRange(additionalFarmers.Select(f => new UserRole { UserId = f.user.Id, RoleId = roles["farmer"].Id }));
        context.Farmers.AddRange(additionalFarmers.Select(f => f.farmer));

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
            AvailabilityWindowEnd = DateTime.UtcNow.AddDays(14),
            Description = "Premium quality tomatoes from Musanze region",
            QualityGrade = "A",
            Status = "Active",
            CreatedAt = DateTime.UtcNow.AddDays(-1)
        };
        context.MarketListings.Add(marketListing);

        // Add more market listings for variety
        var additionalListings = new List<MarketListing>
        {
            new MarketListing
            {
                Id = Guid.Parse("8b0d9e34-5c6f-5a7b-0e9d-3f2e6c8b0d4e"),
                CooperativeId = cooperative.Id,
                Crop = "Potatoes",
                QuantityKg = 3000,
                MinimumPrice = 350m,
                AvailabilityWindowStart = DateTime.UtcNow,
                AvailabilityWindowEnd = DateTime.UtcNow.AddDays(21),
                Description = "Fresh Irish potatoes, ideal for restaurants and hotels",
                QualityGrade = "A",
                Status = "Active",
                CreatedAt = DateTime.UtcNow.AddDays(-2)
            },
            new MarketListing
            {
                Id = Guid.Parse("9c1e0f45-6d7f-6b8c-1f0e-4f3f7d9c1e5f"),
                CooperativeId = cooperative.Id,
                Crop = "Maize",
                QuantityKg = 5000,
                MinimumPrice = 280m,
                AvailabilityWindowStart = DateTime.UtcNow,
                AvailabilityWindowEnd = DateTime.UtcNow.AddDays(30),
                Description = "Premium quality maize grain, dry and ready for processing",
                QualityGrade = "A",
                Status = "Active",
                CreatedAt = DateTime.UtcNow.AddDays(-3)
            },
            new MarketListing
            {
                Id = Guid.Parse("0d2f1056-7e80-7c9d-2010-503080e0d260"),
                CooperativeId = cooperative2.Id,
                Crop = "Beans",
                QuantityKg = 2500,
                MinimumPrice = 650m,
                AvailabilityWindowStart = DateTime.UtcNow,
                AvailabilityWindowEnd = DateTime.UtcNow.AddDays(25),
                Description = "Red kidney beans from Huye, excellent protein content",
                QualityGrade = "A",
                Status = "Active",
                CreatedAt = DateTime.UtcNow.AddDays(-1)
            },
            new MarketListing
            {
                Id = Guid.Parse("1e302167-8f91-8d0e-3121-614191f1e371"),
                CooperativeId = cooperative2.Id,
                Crop = "Rice",
                QuantityKg = 4000,
                MinimumPrice = 580m,
                AvailabilityWindowStart = DateTime.UtcNow,
                AvailabilityWindowEnd = DateTime.UtcNow.AddDays(20),
                Description = "Locally grown Rwandan rice, premium quality",
                QualityGrade = "A",
                Status = "Active",
                CreatedAt = DateTime.UtcNow.AddDays(-2)
            },
            new MarketListing
            {
                Id = Guid.Parse("2f413278-9002-9e1f-4232-725202020482"),
                CooperativeId = cooperative2.Id,
                Crop = "Sorghum",
                QuantityKg = 3500,
                MinimumPrice = 320m,
                AvailabilityWindowStart = DateTime.UtcNow,
                AvailabilityWindowEnd = DateTime.UtcNow.AddDays(28),
                Description = "Traditional sorghum for brewing and food production",
                QualityGrade = "B",
                Status = "Active",
                CreatedAt = DateTime.UtcNow.AddDays(-4)
            },
            new MarketListing
            {
                Id = Guid.Parse("30524389-0113-0f20-5343-836313131593"),
                CooperativeId = cooperative3.Id,
                Crop = "Banana",
                QuantityKg = 2000,
                MinimumPrice = 200m,
                AvailabilityWindowStart = DateTime.UtcNow,
                AvailabilityWindowEnd = DateTime.UtcNow.AddDays(7),
                Description = "Fresh cooking bananas from Lake Kivu region",
                QualityGrade = "A",
                Status = "Active",
                CreatedAt = DateTime.UtcNow.AddDays(-1)
            },
            new MarketListing
            {
                Id = Guid.Parse("41635490-1224-1031-6454-947424242604"),
                CooperativeId = cooperative3.Id,
                Crop = "Cassava",
                QuantityKg = 6000,
                MinimumPrice = 180m,
                AvailabilityWindowStart = DateTime.UtcNow,
                AvailabilityWindowEnd = DateTime.UtcNow.AddDays(35),
                Description = "Fresh cassava roots, perfect for flour production",
                QualityGrade = "A",
                Status = "Active",
                CreatedAt = DateTime.UtcNow.AddDays(-3)
            },
            new MarketListing
            {
                Id = Guid.Parse("52746501-2335-2142-7565-058535353715"),
                CooperativeId = cooperative3.Id,
                Crop = "Avocado",
                QuantityKg = 1200,
                MinimumPrice = 450m,
                AvailabilityWindowStart = DateTime.UtcNow,
                AvailabilityWindowEnd = DateTime.UtcNow.AddDays(10),
                Description = "Export-quality Hass avocados from Western Province",
                QualityGrade = "A",
                Status = "Active",
                CreatedAt = DateTime.UtcNow.AddDays(-2)
            },
            new MarketListing
            {
                Id = Guid.Parse("63857612-3446-3253-8676-169646464826"),
                CooperativeId = cooperative.Id,
                Crop = "Cabbage",
                QuantityKg = 2200,
                MinimumPrice = 150m,
                AvailabilityWindowStart = DateTime.UtcNow,
                AvailabilityWindowEnd = DateTime.UtcNow.AddDays(14),
                Description = "Fresh green cabbage, perfect for markets and restaurants",
                QualityGrade = "A",
                Status = "Active",
                CreatedAt = DateTime.UtcNow.AddDays(-1)
            },
            new MarketListing
            {
                Id = Guid.Parse("74968723-4557-4364-9787-270757575937"),
                CooperativeId = cooperative2.Id,
                Crop = "Onion",
                QuantityKg = 1800,
                MinimumPrice = 400m,
                AvailabilityWindowStart = DateTime.UtcNow,
                AvailabilityWindowEnd = DateTime.UtcNow.AddDays(18),
                Description = "Red onions, properly cured and ready for sale",
                QualityGrade = "A",
                Status = "Active",
                CreatedAt = DateTime.UtcNow.AddDays(-2)
            },
            new MarketListing
            {
                Id = Guid.Parse("85079834-5668-5475-0898-381868686048"),
                CooperativeId = cooperative3.Id,
                Crop = "Carrot",
                QuantityKg = 1500,
                MinimumPrice = 380m,
                AvailabilityWindowStart = DateTime.UtcNow,
                AvailabilityWindowEnd = DateTime.UtcNow.AddDays(12),
                Description = "Fresh organic carrots from volcanic soil",
                QualityGrade = "A",
                Status = "Active",
                CreatedAt = DateTime.UtcNow
            }
        };
        context.MarketListings.AddRange(additionalListings);

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

        // Additional market prices are now generated by BuildMarketPrices which includes 60-day national history

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

    /// <summary>
    /// Generates 60 days of realistic market price data across all 8 markets and 8 crops.
    /// Prices reflect real Rwandan agricultural economics with seasonal variation, regional premiums,
    /// and realistic volatility patterns.
    /// </summary>
    private static List<MarketPrice> BuildMarketPrices(Dictionary<string, User> users)
    {
        var agentId = users["agent"].Id;
        var prices = new List<MarketPrice>();
        var rng = new Random(42); // deterministic for reproducibility

        // Base prices in RWF/kg — aligned with real Rwandan market averages
        var cropData = new Dictionary<string, (decimal basePrice, double volatility, double seasonalAmp)>
        {
            ["Maize"]    = (350m,  0.12, 0.15),
            ["Beans"]    = (680m,  0.18, 0.20),
            ["Sorghum"]  = (280m,  0.14, 0.12),
            ["Cassava"]  = (180m,  0.10, 0.10),
            ["Potatoes"] = (420m,  0.22, 0.25),
            ["Tomatoes"] = (500m,  0.45, 0.35),
            ["Rice"]     = (780m,  0.13, 0.18),
            ["Wheat"]    = (520m,  0.16, 0.14),
        };

        // Market premiums relative to national average — Kigali is highest, rural markets lower
        var marketPremiums = new Dictionary<string, double>
        {
            ["Kigali"]     = 1.05,
            ["Musanze"]    = 0.96,
            ["Huye"]       = 0.97,
            ["Rubavu"]     = 0.98,
            ["Rwamagana"]  = 0.99,
            ["Nyagatare"]  = 0.94,
            ["Muhanga"]    = 0.97,
            ["Rusizi"]     = 0.95,
        };

        const int days = 60;

        foreach (var (crop, (basePrice, volatility, seasonalAmp)) in cropData)
        {
            foreach (var (market, premium) in marketPremiums)
            {
                var adjustedBase = basePrice * (decimal)premium;
                var price = (double)adjustedBase;

                for (var d = days; d >= 0; d--)
                {
                    var date = DateTime.UtcNow.AddDays(-d);
                    var dayOfYear = date.DayOfYear;
                    var seasonal = 1.0 + seasonalAmp * Math.Sin(2.0 * Math.PI * dayOfYear / 365.0);
                    var noise = (rng.NextDouble() - 0.5) * 2.0 * (double)adjustedBase * volatility * 0.1;
                    price = Math.Max((double)adjustedBase * 0.4, price * 0.97 + (double)adjustedBase * seasonal * 0.03 + noise);

                    prices.Add(new MarketPrice
                    {
                        Id = Guid.NewGuid(),
                        Market = market,
                        Region = RwandaGeography.ResolveRegion(market),
                        Crop = crop,
                        PricePerKg = Math.Round((decimal)price, 2),
                        ObservedAt = date.Date.AddHours(8 + rng.Next(0, 10)), // observed between 8am-6pm
                        AgentId = agentId,
                    });
                }
            }
        }

        return prices;
    }

    private static List<(User user, Farmer farmer)> BuildAdditionalFarmers(
        string passwordHash, Cooperative coop1, Cooperative coop2, Cooperative coop3)
    {
        var farmers = new (string name, string email, string phone, string nationalId, string district, string sector, string crops, double hectares, Cooperative coop)[]
        {
            ("Uwimana Jean", "uwimana@rass.rw", "0788-100-001", "1199080012345601", "Musanze", "Kinigi", "Potatoes,Beans", 1.8, coop1),
            ("Habimana Pierre", "habimana@rass.rw", "0788-100-002", "1199080012345602", "Musanze", "Cyuve", "Maize,Wheat", 3.0, coop1),
            ("Mukamana Grace", "mukamana@rass.rw", "0788-100-003", "1199080012345603", "Musanze", "Gataraga", "Tomatoes,Cabbage", 1.2, coop1),
            ("Niyonzima Claude", "niyonzima@rass.rw", "0788-100-004", "1199080012345604", "Huye", "Ngoma", "Beans,Rice", 2.0, coop2),
            ("Uwamahoro Diane", "uwamahoro@rass.rw", "0788-100-005", "1199080012345605", "Huye", "Tumba", "Sorghum,Cassava", 2.8, coop2),
            ("Mugisha Eric", "mugisha@rass.rw", "0788-100-006", "1199080012345606", "Huye", "Mbazi", "Maize,Beans", 1.5, coop2),
            ("Ingabire Aline", "ingabire@rass.rw", "0788-100-007", "1199080012345607", "Rubavu", "Gisenyi", "Cassava,Beans", 2.2, coop3),
            ("Nsabimana Felix", "nsabimana@rass.rw", "0788-100-008", "1199080012345608", "Rubavu", "Nyamyumba", "Rice,Tomatoes", 1.6, coop3),
            ("Umutoniwase Olive", "umutoniwase@rass.rw", "0788-100-009", "1199080012345609", "Rubavu", "Kanama", "Potatoes,Wheat", 3.5, coop3),
            ("Bizimungu Patrick", "bizimungu@rass.rw", "0788-100-010", "1199080012345610", "Musanze", "Busogo", "Maize,Sorghum", 2.0, coop1),
            ("Nyirahabimana Jane", "nyirahabimana@rass.rw", "0788-100-011", "1199080012345611", "Huye", "Karama", "Beans,Potatoes", 1.4, coop2),
            ("Tuyisenge Albert", "tuyisenge@rass.rw", "0788-100-012", "1199080012345612", "Rubavu", "Rubavu", "Cassava,Maize", 2.6, coop3),
        };

        return farmers.Select(f =>
        {
            var user = new User
            {
                Id = Guid.NewGuid(),
                Email = f.email,
                FullName = f.name,
                PasswordHash = passwordHash,
            };
            var farmer = new Farmer
            {
                Id = Guid.NewGuid(),
                UserId = user.Id,
                CooperativeId = f.coop.Id,
                District = f.district,
                Sector = f.sector,
                Phone = f.phone,
                NationalId = f.nationalId,
                Crops = f.crops,
                FarmSizeHectares = f.hectares,
            };
            return (user, farmer);
        }).ToList();
    }
}

