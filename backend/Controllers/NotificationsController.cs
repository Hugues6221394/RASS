using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Rass.Api.Data;
using Rass.Api.Domain.Entities;
using Rass.Api.Hubs;

namespace Rass.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class NotificationsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IHubContext<NotificationHub> _hubContext;

    public NotificationsController(AppDbContext db, IHubContext<NotificationHub> hubContext)
    {
        _db = db;
        _hubContext = hubContext;
    }

    /// <summary>
    /// Get all notifications for the current user
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetMyNotifications([FromQuery] bool unreadOnly = false)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var query = _db.Notifications
            .Where(n => n.UserId == userId.Value)
            .OrderByDescending(n => n.CreatedAt);

        if (unreadOnly)
        {
            query = (IOrderedQueryable<Notification>)query.Where(n => !n.IsRead);
        }

        var notifications = await query
            .Take(50)
            .Select(n => new
            {
                n.Id,
                n.Title,
                n.Message,
                n.Type,
                n.IsRead,
                n.CreatedAt,
                n.ActionUrl
            })
            .ToListAsync();

        return Ok(notifications);
    }

    /// <summary>
    /// Get unread notification count
    /// </summary>
    [HttpGet("count")]
    public async Task<IActionResult> GetUnreadCount()
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var count = await _db.Notifications
            .CountAsync(n => n.UserId == userId.Value && !n.IsRead);

        return Ok(new { count });
    }

    /// <summary>
    /// Mark a notification as read
    /// </summary>
    [HttpPost("{id}/read")]
    public async Task<IActionResult> MarkAsRead(Guid id)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var notification = await _db.Notifications
            .FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId.Value);

        if (notification == null) return NotFound();

        notification.IsRead = true;
        await _db.SaveChangesAsync();

        return Ok();
    }

    /// <summary>
    /// Mark all notifications as read
    /// </summary>
    [HttpPost("read-all")]
    public async Task<IActionResult> MarkAllAsRead()
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        await _db.Notifications
            .Where(n => n.UserId == userId.Value && !n.IsRead)
            .ExecuteUpdateAsync(s => s.SetProperty(n => n.IsRead, true));

        return Ok();
    }

    /// <summary>
    /// Send a notification to a specific user (Admin only)
    /// </summary>
    [HttpPost("send")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> SendNotification(SendNotificationRequest request)
    {
        var notification = new Notification
        {
            Id = Guid.NewGuid(),
            UserId = request.UserId,
            Title = request.Title,
            Message = request.Message,
            Type = request.Type ?? "Info",
            ActionUrl = request.ActionUrl
        };

        _db.Notifications.Add(notification);
        await _db.SaveChangesAsync();

        // Push real-time notification via SignalR
        await _hubContext.Clients.Group($"user-{request.UserId}")
            .SendAsync("ReceiveNotification", new
            {
                notification.Id,
                notification.Title,
                notification.Message,
                notification.Type,
                notification.CreatedAt
            });

        return Created("", new { notification.Id });
    }

    /// <summary>
    /// Broadcast notification to all users in a role (Admin only)
    /// </summary>
    [HttpPost("broadcast")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> BroadcastNotification(BroadcastNotificationRequest request)
    {
        // Get all users with the specified role
        var userIds = await _db.UserRoles
            .Include(ur => ur.Role)
            .Where(ur => ur.Role.Name == request.Role)
            .Select(ur => ur.UserId)
            .ToListAsync();

        foreach (var userId in userIds)
        {
            var notification = new Notification
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                Title = request.Title,
                Message = request.Message,
                Type = request.Type ?? "Info"
            };
            _db.Notifications.Add(notification);
        }

        await _db.SaveChangesAsync();

        // Push to role group via SignalR
        await _hubContext.Clients.Group($"role-{request.Role}")
            .SendAsync("ReceiveNotification", new
            {
                Title = request.Title,
                Message = request.Message,
                Type = request.Type ?? "Info",
                CreatedAt = DateTime.UtcNow
            });

        return Ok(new { sentTo = userIds.Count });
    }

    private Guid? GetUserId()
    {
        var claim = User.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier") ??
                   User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
        return Guid.TryParse(claim?.Value, out var guid) ? guid : null;
    }
}

public record SendNotificationRequest(Guid UserId, string Title, string Message, string? Type, string? ActionUrl);
public record BroadcastNotificationRequest(string Role, string Title, string Message, string? Type);
