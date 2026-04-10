using System.ComponentModel.DataAnnotations;

namespace Rass.Api.Domain.Entities;

/// <summary>
/// Real-time GPS location tracking for transporters during delivery
/// </summary>
public class TransporterLocation
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid TransportRequestId { get; set; }
    public TransportRequest TransportRequest { get; set; } = default!;

    public Guid TransporterId { get; set; }
    public TransporterProfile Transporter { get; set; } = default!;

    // === GPS Coordinates ===
    public double Latitude { get; set; }
    public double Longitude { get; set; }

    /// <summary>
    /// Accuracy in meters (from GPS device)
    /// </summary>
    public double? Accuracy { get; set; }

    /// <summary>
    /// Speed in km/h
    /// </summary>
    public double? Speed { get; set; }

    /// <summary>
    /// Heading/bearing in degrees (0-360)
    /// </summary>
    public double? Heading { get; set; }

    /// <summary>
    /// Altitude in meters above sea level
    /// </summary>
    public double? Altitude { get; set; }

    // === Calculated Fields ===
    /// <summary>
    /// Distance remaining to destination in km
    /// </summary>
    public double? DistanceRemainingKm { get; set; }

    /// <summary>
    /// Estimated time of arrival
    /// </summary>
    public DateTime? EstimatedArrival { get; set; }

    /// <summary>
    /// Current delivery status at this point
    /// </summary>
    [MaxLength(40)]
    public string Status { get; set; } = "EnRoute"; // EnRouteToPickup, AtPickup, EnRouteToDestination, AtDestination

    public DateTime RecordedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Aggregated delivery tracking info for quick access
/// </summary>
public class DeliveryTrackingInfo
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid TransportRequestId { get; set; }
    public TransportRequest TransportRequest { get; set; } = default!;

    // === Origin ===
    public double OriginLatitude { get; set; }
    public double OriginLongitude { get; set; }

    // === Destination ===
    public double DestinationLatitude { get; set; }
    public double DestinationLongitude { get; set; }

    // === Current Position (updated on each GPS ping) ===
    public double? CurrentLatitude { get; set; }
    public double? CurrentLongitude { get; set; }
    public DateTime? LastLocationUpdate { get; set; }

    // === Route Info ===
    /// <summary>
    /// Total route distance in km
    /// </summary>
    public double TotalDistanceKm { get; set; }

    /// <summary>
    /// Distance already traveled in km
    /// </summary>
    public double DistanceTraveledKm { get; set; }

    /// <summary>
    /// Percentage of route completed (0-100)
    /// </summary>
    public int ProgressPercent { get; set; }

    /// <summary>
    /// Original ETA when delivery started
    /// </summary>
    public DateTime? OriginalEta { get; set; }

    /// <summary>
    /// Current ETA based on real-time tracking
    /// </summary>
    public DateTime? CurrentEta { get; set; }

    /// <summary>
    /// Is delivery delayed beyond original ETA?
    /// </summary>
    public bool IsDelayed { get; set; }

    /// <summary>
    /// Delay duration in minutes
    /// </summary>
    public int DelayMinutes { get; set; }

    // === Status ===
    [MaxLength(40)]
    public string TrackingStatus { get; set; } = "NotStarted"; // NotStarted, EnRouteToPickup, WaitingAtPickup, EnRouteToDestination, NearDestination, Arrived, Completed

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
