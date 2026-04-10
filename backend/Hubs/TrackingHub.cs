using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.Authorization;

namespace Rass.Api.Hubs;

/// <summary>
/// SignalR Hub for real-time GPS tracking of deliveries
/// Buyers and farmers can subscribe to track their deliveries
/// Transporters push location updates
/// </summary>
[Authorize]
public class TrackingHub : Hub
{
    private readonly ILogger<TrackingHub> _logger;

    public TrackingHub(ILogger<TrackingHub> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Subscribe to location updates for a specific delivery
    /// </summary>
    public async Task SubscribeToDelivery(string transportRequestId)
    {
        var userId = Context.User?.FindFirst("sub")?.Value ?? Context.User?.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")?.Value;
        
        if (string.IsNullOrEmpty(userId))
        {
            _logger.LogWarning("Unauthorized tracking subscription attempt");
            throw new HubException("Unauthorized");
        }

        // Add user to the delivery tracking group
        var groupName = $"delivery-{transportRequestId}";
        await Groups.AddToGroupAsync(Context.ConnectionId, groupName);
        
        _logger.LogInformation("User {UserId} subscribed to delivery {DeliveryId}", userId, transportRequestId);
        
        await Clients.Caller.SendAsync("SubscriptionConfirmed", new
        {
            transportRequestId,
            message = "You are now tracking this delivery"
        });
    }

    /// <summary>
    /// Unsubscribe from delivery updates
    /// </summary>
    public async Task UnsubscribeFromDelivery(string transportRequestId)
    {
        var groupName = $"delivery-{transportRequestId}";
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, groupName);
        
        await Clients.Caller.SendAsync("UnsubscriptionConfirmed", transportRequestId);
    }

    /// <summary>
    /// Transporter sends location update
    /// Called by TrackingController, not directly from client
    /// </summary>
    public async Task BroadcastLocationUpdate(string transportRequestId, object locationData)
    {
        var groupName = $"delivery-{transportRequestId}";
        await Clients.Group(groupName).SendAsync("LocationUpdate", locationData);
    }

    /// <summary>
    /// Broadcast delivery status change
    /// </summary>
    public async Task BroadcastStatusChange(string transportRequestId, object statusData)
    {
        var groupName = $"delivery-{transportRequestId}";
        await Clients.Group(groupName).SendAsync("DeliveryStatusChanged", statusData);
    }

    /// <summary>
    /// Broadcast ETA update
    /// </summary>
    public async Task BroadcastEtaUpdate(string transportRequestId, object etaData)
    {
        var groupName = $"delivery-{transportRequestId}";
        await Clients.Group(groupName).SendAsync("EtaUpdated", etaData);
    }

    /// <summary>
    /// Broadcast delay alert
    /// </summary>
    public async Task BroadcastDelayAlert(string transportRequestId, object delayData)
    {
        var groupName = $"delivery-{transportRequestId}";
        await Clients.Group(groupName).SendAsync("DeliveryDelayed", delayData);
    }

    /// <summary>
    /// Broadcast delivery completion
    /// </summary>
    public async Task BroadcastDeliveryComplete(string transportRequestId, object completionData)
    {
        var groupName = $"delivery-{transportRequestId}";
        await Clients.Group(groupName).SendAsync("DeliveryCompleted", completionData);
    }

    public override async Task OnConnectedAsync()
    {
        var userId = Context.User?.FindFirst("sub")?.Value ?? Context.User?.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")?.Value;
        _logger.LogInformation("Tracking connection established for user {UserId}", userId);
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userId = Context.User?.FindFirst("sub")?.Value ?? Context.User?.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")?.Value;
        _logger.LogInformation("Tracking connection closed for user {UserId}", userId);
        await base.OnDisconnectedAsync(exception);
    }
}
