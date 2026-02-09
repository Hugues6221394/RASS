using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace Rass.Api.Hubs;

/// <summary>
/// SignalR Hub for real-time notifications and messaging
/// </summary>
[Authorize]
public class NotificationHub : Hub
{
    /// <summary>
    /// Called when a new connection is established
    /// </summary>
    public override async Task OnConnectedAsync()
    {
        var userId = Context.UserIdentifier;
        if (!string.IsNullOrEmpty(userId))
        {
            // Add user to their personal group for targeted notifications
            await Groups.AddToGroupAsync(Context.ConnectionId, $"user-{userId}");
        }
        await base.OnConnectedAsync();
    }

    /// <summary>
    /// Called when a connection is terminated
    /// </summary>
    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userId = Context.UserIdentifier;
        if (!string.IsNullOrEmpty(userId))
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"user-{userId}");
        }
        await base.OnDisconnectedAsync(exception);
    }

    /// <summary>
    /// Join a role-based group for broadcast notifications
    /// </summary>
    public async Task JoinRoleGroup(string role)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"role-{role}");
    }

    /// <summary>
    /// Leave a role-based group
    /// </summary>
    public async Task LeaveRoleGroup(string role)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"role-{role}");
    }

    /// <summary>
    /// Send a direct message to another user
    /// </summary>
    public async Task SendDirectMessage(string receiverId, string message)
    {
        var senderId = Context.UserIdentifier;
        if (string.IsNullOrEmpty(senderId)) return;

        await Clients.Group($"user-{receiverId}").SendAsync("ReceiveMessage", new
        {
            SenderId = senderId,
            Message = message,
            SentAt = DateTime.UtcNow
        });
    }

    /// <summary>
    /// Mark user as typing in a conversation
    /// </summary>
    public async Task SendTypingIndicator(string receiverId)
    {
        var senderId = Context.UserIdentifier;
        if (string.IsNullOrEmpty(senderId)) return;

        await Clients.Group($"user-{receiverId}").SendAsync("UserTyping", senderId);
    }
}
