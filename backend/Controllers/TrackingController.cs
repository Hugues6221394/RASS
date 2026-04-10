using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Rass.Api.Data;
using Rass.Api.Domain.Entities;
using Rass.Api.Hubs;
using System.Security.Claims;

namespace Rass.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TrackingController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IHubContext<TrackingHub> _trackingHub;
    private readonly ILogger<TrackingController> _logger;

    public TrackingController(
        AppDbContext db,
        IHubContext<TrackingHub> trackingHub,
        ILogger<TrackingController> logger)
    {
        _db = db;
        _trackingHub = trackingHub;
        _logger = logger;
    }

    /// <summary>
    /// Get tracking info by tracking ID
    /// </summary>
    [HttpGet("{trackingId}")]
    [Authorize]
    public async Task<IActionResult> GetTracking(string trackingId)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(userId)) return Unauthorized();

        var contract = await _db.Contracts
            .Include(c => c.TransportRequests)
            .Include(c => c.StorageBookings).ThenInclude(b => b.StorageFacility)
            .Include(c => c.BuyerOrder)
            .Include(c => c.ContractLots).ThenInclude(cl => cl.Lot).ThenInclude(l => l.Contributions)
            .FirstOrDefaultAsync(c => c.TrackingId == trackingId);

        if (contract == null)
        {
            return NotFound();
        }

        if (!await IsUserAuthorizedForContract(Guid.Parse(userId), contract))
        {
            return Forbid();
        }

        var response = new
        {
            contract.TrackingId,
            contract.Status,
            Order = new { contract.BuyerOrder.Crop, contract.BuyerOrder.DeliveryLocation, contract.BuyerOrder.DeliveryWindowStart, contract.BuyerOrder.DeliveryWindowEnd },
            Transports = contract.TransportRequests.Select(t => new { t.Id, t.Status, t.Origin, t.Destination, t.AssignedTruck, t.PickupStart, t.PickupEnd }),
            Storage = contract.StorageBookings.Select(s => new { s.Status, Facility = s.StorageFacility.Name, s.StartDate, s.EndDate }),
        };

        return Ok(response);
    }

    /// <summary>
    /// List deliveries where transporter has already shared GPS location.
    /// Used by delivery owners (buyers/cooperative managers) to quickly start live tracking.
    /// </summary>
    [HttpGet("live-shares")]
    [Authorize]
    public async Task<IActionResult> GetLiveShares([FromQuery] int take = 20)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(userId)) return Unauthorized();

        take = Math.Clamp(take, 1, 100);
        var activeStatuses = new[] { "Assigned", "Accepted", "PickedUp", "InTransit" };

        var candidateTransports = await _db.TransportRequests
            .Include(t => t.Contract)
            .ThenInclude(c => c!.BuyerOrder)
            .Where(t => activeStatuses.Contains(t.Status) && t.ContractId != null)
            .OrderByDescending(t => t.CreatedAt)
            .Take(300)
            .ToListAsync();

        var authorized = new List<TransportRequest>(capacity: candidateTransports.Count);
        foreach (var transport in candidateTransports)
        {
            if (await IsUserAuthorizedForDelivery(userId, transport))
                authorized.Add(transport);
        }

        if (authorized.Count == 0) return Ok(Array.Empty<object>());

        var transportIds = authorized.Select(t => t.Id).ToHashSet();

        var trackingInfos = await _db.DeliveryTrackingInfos
            .Where(i => transportIds.Contains(i.TransportRequestId))
            .ToListAsync();
        var trackingByTransport = trackingInfos.ToDictionary(i => i.TransportRequestId, i => i);

        var latestLocations = await _db.TransporterLocations
            .Where(l => transportIds.Contains(l.TransportRequestId))
            .OrderByDescending(l => l.RecordedAt)
            .ToListAsync();

        var latestByTransport = new Dictionary<Guid, TransporterLocation>();
        foreach (var loc in latestLocations)
        {
            if (!latestByTransport.ContainsKey(loc.TransportRequestId))
                latestByTransport[loc.TransportRequestId] = loc;
        }

        var sharedRows = authorized
            .Where(t => latestByTransport.ContainsKey(t.Id))
            .Select(t =>
            {
                var latest = latestByTransport[t.Id];
                trackingByTransport.TryGetValue(t.Id, out var info);
                var trackingId = t.Contract?.TrackingId;
                return new
                {
                    transportRequestId = t.Id,
                    trackingId,
                    status = t.Status,
                    origin = t.Origin,
                    destination = t.Destination,
                    assignedTruck = t.AssignedTruck,
                    crop = t.Contract?.BuyerOrder?.Crop,
                    lastLocation = new
                    {
                        latitude = latest.Latitude,
                        longitude = latest.Longitude,
                        speed = latest.Speed,
                        recordedAt = latest.RecordedAt
                    },
                    trackingInfo = info == null ? null : new
                    {
                        info.ProgressPercent,
                        info.CurrentEta,
                        info.TrackingStatus,
                        info.IsDelayed,
                        info.DelayMinutes,
                        info.LastLocationUpdate
                    },
                    isLive = latest.RecordedAt >= DateTime.UtcNow.AddMinutes(-5)
                };
            })
            .Where(x => !string.IsNullOrWhiteSpace(x.trackingId))
            .OrderByDescending(x => x.lastLocation.recordedAt)
            .Take(take)
            .ToList();

        return Ok(sharedRows);
    }

    /// <summary>
    /// Find a live shared delivery near provided coordinates for authorized users.
    /// </summary>
    [HttpGet("live-shares/lookup")]
    [Authorize]
    public async Task<IActionResult> LookupLiveShareByCoordinates(
        [FromQuery] double latitude,
        [FromQuery] double longitude,
        [FromQuery] double radiusKm = 5)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(userId)) return Unauthorized();
        if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180)
            return BadRequest("Invalid coordinates.");

        radiusKm = Math.Clamp(radiusKm, 0.2, 50);
        var activeStatuses = new[] { "Assigned", "Accepted", "PickedUp", "InTransit" };

        var candidateTransports = await _db.TransportRequests
            .Include(t => t.Contract)
            .ThenInclude(c => c!.BuyerOrder)
            .Where(t => activeStatuses.Contains(t.Status) && t.ContractId != null)
            .OrderByDescending(t => t.CreatedAt)
            .Take(300)
            .ToListAsync();

        var authorized = new List<TransportRequest>(capacity: candidateTransports.Count);
        foreach (var transport in candidateTransports)
        {
            if (await IsUserAuthorizedForDelivery(userId, transport))
                authorized.Add(transport);
        }
        if (authorized.Count == 0) return NotFound("No authorized live deliveries.");

        var transportIds = authorized.Select(t => t.Id).ToHashSet();
        var latestLocations = await _db.TransporterLocations
            .Where(l => transportIds.Contains(l.TransportRequestId))
            .OrderByDescending(l => l.RecordedAt)
            .ToListAsync();

        var latestByTransport = new Dictionary<Guid, TransporterLocation>();
        foreach (var loc in latestLocations)
        {
            if (!latestByTransport.ContainsKey(loc.TransportRequestId))
                latestByTransport[loc.TransportRequestId] = loc;
        }

        var nearest = authorized
            .Where(t => latestByTransport.ContainsKey(t.Id) && !string.IsNullOrWhiteSpace(t.Contract?.TrackingId))
            .Select(t =>
            {
                var latest = latestByTransport[t.Id];
                var distance = CalculateDistance(latitude, longitude, latest.Latitude, latest.Longitude);
                return new { transport = t, latest, distance };
            })
            .Where(x => x.distance <= radiusKm)
            .OrderBy(x => x.distance)
            .ThenByDescending(x => x.latest.RecordedAt)
            .FirstOrDefault();

        if (nearest == null) return NotFound("No live transporter found near provided coordinates.");

        return Ok(new
        {
            trackingId = nearest.transport.Contract?.TrackingId,
            transportRequestId = nearest.transport.Id,
            status = nearest.transport.Status,
            origin = nearest.transport.Origin,
            destination = nearest.transport.Destination,
            assignedTruck = nearest.transport.AssignedTruck,
            crop = nearest.transport.Contract?.BuyerOrder?.Crop,
            matchedDistanceKm = Math.Round(nearest.distance, 3),
            lastLocation = new
            {
                latitude = nearest.latest.Latitude,
                longitude = nearest.latest.Longitude,
                speed = nearest.latest.Speed,
                recordedAt = nearest.latest.RecordedAt
            }
        });
    }

    #region Live GPS Tracking

    /// <summary>
    /// Get live tracking info for a transport request
    /// </summary>
    [HttpGet("live/{transportRequestId}")]
    [Authorize]
    public async Task<IActionResult> GetLiveTracking(Guid transportRequestId)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        
        var transport = await _db.TransportRequests
            .Include(t => t.Contract)
            .ThenInclude(c => c!.BuyerOrder)
            .FirstOrDefaultAsync(t => t.Id == transportRequestId);

        if (transport == null) return NotFound();

        // Verify user has access to this delivery
        var isAuthorized = await IsUserAuthorizedForDelivery(userId!, transport);
        if (!isAuthorized) return Forbid();

        var trackingInfo = await _db.DeliveryTrackingInfos
            .FirstOrDefaultAsync(t => t.TransportRequestId == transportRequestId);

        var latestLocation = await _db.TransporterLocations
            .Where(l => l.TransportRequestId == transportRequestId)
            .OrderByDescending(l => l.RecordedAt)
            .FirstOrDefaultAsync();

        return Ok(new
        {
            transportRequestId,
            transport.Status,
            transport.Origin,
            transport.Destination,
            transport.AssignedTruck,
            transport.DriverPhone,
            trackingInfo = trackingInfo != null ? new
            {
                trackingInfo.OriginLatitude,
                trackingInfo.OriginLongitude,
                trackingInfo.DestinationLatitude,
                trackingInfo.DestinationLongitude,
                trackingInfo.CurrentLatitude,
                trackingInfo.CurrentLongitude,
                trackingInfo.TotalDistanceKm,
                trackingInfo.DistanceTraveledKm,
                trackingInfo.ProgressPercent,
                trackingInfo.OriginalEta,
                trackingInfo.CurrentEta,
                trackingInfo.IsDelayed,
                trackingInfo.DelayMinutes,
                trackingInfo.TrackingStatus,
                trackingInfo.LastLocationUpdate
            } : null,
            latestLocation = latestLocation != null ? new
            {
                latestLocation.Latitude,
                latestLocation.Longitude,
                latestLocation.Speed,
                latestLocation.Heading,
                latestLocation.EstimatedArrival,
                latestLocation.RecordedAt
            } : null
        });
    }

    /// <summary>
    /// Transporter updates their GPS location
    /// </summary>
    [HttpPost("location")]
    [Authorize(Roles = "Transporter")]
    public async Task<IActionResult> UpdateLocation([FromBody] LocationUpdateDto dto)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        
        var transporter = await _db.TransporterProfiles
            .FirstOrDefaultAsync(t => t.UserId == Guid.Parse(userId!));

        if (transporter == null) return NotFound("Transporter profile not found");

        var transport = await _db.TransportRequests
            .FirstOrDefaultAsync(t => t.Id == dto.TransportRequestId && t.TransporterId == transporter.Id);

        if (transport == null) return NotFound("Transport request not found or not assigned to you");

        // Only allow updates for active deliveries
        var activeStatuses = new[] { "Assigned", "Accepted", "PickedUp", "InTransit" };
        if (!activeStatuses.Contains(transport.Status))
        {
            return BadRequest("Cannot update location for non-active delivery");
        }

        // Save location record
        var location = new TransporterLocation
        {
            TransportRequestId = dto.TransportRequestId,
            TransporterId = transporter.Id,
            Latitude = dto.Latitude,
            Longitude = dto.Longitude,
            Accuracy = dto.Accuracy,
            Speed = dto.Speed,
            Heading = dto.Heading,
            Altitude = dto.Altitude,
            Status = MapStatusToLocationStatus(transport.Status)
        };

        // Calculate ETA and distance
        var trackingInfo = await _db.DeliveryTrackingInfos
            .FirstOrDefaultAsync(t => t.TransportRequestId == dto.TransportRequestId);

        if (trackingInfo != null)
        {
            var distanceRemaining = CalculateDistance(
                dto.Latitude, dto.Longitude,
                trackingInfo.DestinationLatitude, trackingInfo.DestinationLongitude
            );
            
            location.DistanceRemainingKm = distanceRemaining;

            if (dto.Speed > 0)
            {
                var hoursRemaining = distanceRemaining / dto.Speed.Value;
                location.EstimatedArrival = DateTime.UtcNow.AddHours(hoursRemaining);
            }

            // Update tracking info
            trackingInfo.CurrentLatitude = dto.Latitude;
            trackingInfo.CurrentLongitude = dto.Longitude;
            trackingInfo.LastLocationUpdate = DateTime.UtcNow;
            trackingInfo.DistanceTraveledKm = trackingInfo.TotalDistanceKm - distanceRemaining;
            trackingInfo.ProgressPercent = trackingInfo.TotalDistanceKm > 0 
                ? (int)((trackingInfo.DistanceTraveledKm / trackingInfo.TotalDistanceKm) * 100) 
                : 0;
            trackingInfo.CurrentEta = location.EstimatedArrival;
            trackingInfo.UpdatedAt = DateTime.UtcNow;

            // Check for delays
            if (trackingInfo.OriginalEta.HasValue && location.EstimatedArrival.HasValue)
            {
                var delay = (location.EstimatedArrival.Value - trackingInfo.OriginalEta.Value).TotalMinutes;
                if (delay > 15) // 15 min threshold
                {
                    trackingInfo.IsDelayed = true;
                    trackingInfo.DelayMinutes = (int)delay;

                    // Broadcast delay alert
                    await _trackingHub.Clients
                        .Group($"delivery-{dto.TransportRequestId}")
                        .SendAsync("DeliveryDelayed", new
                        {
                            transportRequestId = dto.TransportRequestId,
                            delayMinutes = (int)delay,
                            newEta = location.EstimatedArrival
                        });
                }
            }

            // Update tracking status based on proximity
            if (distanceRemaining < 0.5) // Within 500m
            {
                trackingInfo.TrackingStatus = "NearDestination";
            }
            else if (distanceRemaining < 0.1) // Within 100m
            {
                trackingInfo.TrackingStatus = "Arrived";
            }
        }

        _db.TransporterLocations.Add(location);
        await _db.SaveChangesAsync();

        // Broadcast location update via SignalR
        await _trackingHub.Clients
            .Group($"delivery-{dto.TransportRequestId}")
            .SendAsync("LocationUpdate", new
            {
                transportRequestId = dto.TransportRequestId,
                latitude = dto.Latitude,
                longitude = dto.Longitude,
                speed = dto.Speed,
                heading = dto.Heading,
                distanceRemainingKm = location.DistanceRemainingKm,
                estimatedArrival = location.EstimatedArrival,
                progressPercent = trackingInfo?.ProgressPercent,
                status = location.Status,
                recordedAt = location.RecordedAt
            });

        _logger.LogInformation(
            "Location update for transport {TransportId}: {Lat}, {Lng}",
            dto.TransportRequestId, dto.Latitude, dto.Longitude
        );

        return Ok(new { success = true, locationId = location.Id });
    }

    /// <summary>
    /// Initialize tracking info when delivery starts
    /// </summary>
    [HttpPost("initialize/{transportRequestId}")]
    [Authorize(Roles = "Transporter,Admin")]
    public async Task<IActionResult> InitializeTracking(Guid transportRequestId, [FromBody] TrackingInitDto dto)
    {
        var transport = await _db.TransportRequests.FindAsync(transportRequestId);
        if (transport == null) return NotFound();

        var existingTracking = await _db.DeliveryTrackingInfos
            .FirstOrDefaultAsync(t => t.TransportRequestId == transportRequestId);

        if (existingTracking != null)
        {
            return BadRequest("Tracking already initialized for this delivery");
        }

        var distance = CalculateDistance(
            dto.OriginLatitude, dto.OriginLongitude,
            dto.DestinationLatitude, dto.DestinationLongitude
        );

        // Estimate ETA (assume average speed of 40 km/h in Rwanda)
        var hoursEstimate = distance / 40.0;
        var eta = DateTime.UtcNow.AddHours(hoursEstimate);

        var trackingInfo = new DeliveryTrackingInfo
        {
            TransportRequestId = transportRequestId,
            OriginLatitude = dto.OriginLatitude,
            OriginLongitude = dto.OriginLongitude,
            DestinationLatitude = dto.DestinationLatitude,
            DestinationLongitude = dto.DestinationLongitude,
            TotalDistanceKm = distance,
            OriginalEta = eta,
            CurrentEta = eta,
            TrackingStatus = "EnRouteToPickup"
        };

        _db.DeliveryTrackingInfos.Add(trackingInfo);
        await _db.SaveChangesAsync();

        return Ok(new
        {
            trackingInfo.Id,
            trackingInfo.TotalDistanceKm,
            trackingInfo.OriginalEta,
            message = "Tracking initialized successfully"
        });
    }

    /// <summary>
    /// Get location history for a delivery
    /// </summary>
    [HttpGet("history/{transportRequestId}")]
    [Authorize]
    public async Task<IActionResult> GetLocationHistory(Guid transportRequestId)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

        var transport = await _db.TransportRequests
            .Include(t => t.Contract)
            .ThenInclude(c => c!.BuyerOrder)
            .FirstOrDefaultAsync(t => t.Id == transportRequestId);

        if (transport == null) return NotFound();

        if (!await IsUserAuthorizedForDelivery(userId!, transport)) return Forbid();

        var locations = await _db.TransporterLocations
            .Where(l => l.TransportRequestId == transportRequestId)
            .OrderBy(l => l.RecordedAt)
            .Select(l => new
            {
                l.Latitude,
                l.Longitude,
                l.Speed,
                l.Status,
                l.RecordedAt
            })
            .ToListAsync();

        return Ok(locations);
    }

    #endregion

    #region Helper Methods

    private async Task<bool> IsUserAuthorizedForDelivery(string userId, TransportRequest transport)
    {
        var userGuid = Guid.Parse(userId);

        // Check if user is the transporter
        var transporter = await _db.TransporterProfiles
            .FirstOrDefaultAsync(t => t.UserId == userGuid);
        if (transporter != null && transport.TransporterId == transporter.Id) return true;

        // Check if user is the buyer
        if (transport.Contract?.BuyerOrder != null)
        {
            var buyer = await _db.BuyerProfiles
                .FirstOrDefaultAsync(b => b.UserId == userGuid);
            if (buyer != null && transport.Contract.BuyerOrder.BuyerProfileId == buyer.Id) return true;
        }

        // Check if user is the cooperative manager (seller)
        if (transport.Contract?.BuyerOrder?.MarketListingId != null)
        {
            var listing = await _db.MarketListings
                .Include(l => l.Cooperative)
                .FirstOrDefaultAsync(l => l.Id == transport.Contract.BuyerOrder.MarketListingId);
            if (listing?.Cooperative?.ManagerId == userGuid) return true;
        }

        // Check if user is farmer involved in contract lots tied to this transport
        var farmer = await _db.Farmers.FirstOrDefaultAsync(f => f.UserId == userGuid);
        if (farmer != null && transport.ContractId.HasValue)
        {
            var involvedInContractLots = await _db.ContractLots
                .Include(cl => cl.Lot)
                .ThenInclude(l => l.Contributions)
                .AnyAsync(cl => cl.ContractId == transport.ContractId.Value &&
                    (cl.Lot.FarmerId == farmer.Id || cl.Lot.Contributions.Any(c => c.FarmerId == farmer.Id)));
            if (involvedInContractLots) return true;
        }

        // Check if user is admin
        var isAdmin = await _db.UserRoles
            .Include(ur => ur.Role)
            .AnyAsync(ur => ur.UserId == userGuid && ur.Role.Name == "Admin");
        if (isAdmin) return true;

        return false;
    }

    private async Task<bool> IsUserAuthorizedForContract(Guid userGuid, Contract contract)
    {
        // Admin always allowed
        var isAdmin = await _db.UserRoles
            .Include(ur => ur.Role)
            .AnyAsync(ur => ur.UserId == userGuid && ur.Role.Name == "Admin");
        if (isAdmin) return true;

        // Buyer who owns the order
        var buyer = await _db.BuyerProfiles.FirstOrDefaultAsync(b => b.UserId == userGuid);
        if (buyer != null && contract.BuyerOrder?.BuyerProfileId == buyer.Id) return true;

        // Cooperative manager for listing in the order
        if (contract.BuyerOrder?.MarketListingId != null)
        {
            var listing = await _db.MarketListings
                .Include(l => l.Cooperative)
                .FirstOrDefaultAsync(l => l.Id == contract.BuyerOrder.MarketListingId);
            if (listing?.Cooperative?.ManagerId == userGuid) return true;
        }

        // Assigned transporter
        var transporter = await _db.TransporterProfiles.FirstOrDefaultAsync(t => t.UserId == userGuid);
        if (transporter != null && contract.TransportRequests.Any(t => t.TransporterId == transporter.Id)) return true;

        // Farmer directly tied to lots/contributions in this contract
        var farmer = await _db.Farmers.FirstOrDefaultAsync(f => f.UserId == userGuid);
        if (farmer != null)
        {
            var involved = contract.ContractLots.Any(cl =>
                cl.Lot.FarmerId == farmer.Id ||
                cl.Lot.Contributions.Any(c => c.FarmerId == farmer.Id));
            if (involved) return true;
        }

        return false;
    }

    private static string MapStatusToLocationStatus(string transportStatus)
    {
        return transportStatus switch
        {
            "Assigned" or "Accepted" => "EnRouteToPickup",
            "PickedUp" => "AtPickup",
            "InTransit" => "EnRouteToDestination",
            _ => "EnRoute"
        };
    }

    /// <summary>
    /// Calculate distance between two GPS coordinates using Haversine formula
    /// </summary>
    private static double CalculateDistance(double lat1, double lon1, double lat2, double lon2)
    {
        const double R = 6371; // Earth's radius in km

        var dLat = ToRadians(lat2 - lat1);
        var dLon = ToRadians(lon2 - lon1);

        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                Math.Cos(ToRadians(lat1)) * Math.Cos(ToRadians(lat2)) *
                Math.Sin(dLon / 2) * Math.Sin(dLon / 2);

        var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));

        return R * c;
    }

    private static double ToRadians(double degrees) => degrees * Math.PI / 180;

    #endregion
}

#region DTOs

public class LocationUpdateDto
{
    public Guid TransportRequestId { get; set; }
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public double? Accuracy { get; set; }
    public double? Speed { get; set; }
    public double? Heading { get; set; }
    public double? Altitude { get; set; }
}

public class TrackingInitDto
{
    public double OriginLatitude { get; set; }
    public double OriginLongitude { get; set; }
    public double DestinationLatitude { get; set; }
    public double DestinationLongitude { get; set; }
}

#endregion

