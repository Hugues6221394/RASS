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
public class ChatController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IHubContext<NotificationHub> _hubContext;

    public ChatController(AppDbContext db, IHubContext<NotificationHub> hubContext)
    {
        _db = db;
        _hubContext = hubContext;
    }

    /// <summary>
    /// Get conversation history with another user
    /// </summary>
    [HttpGet("conversation/{otherUserId}")]
    public async Task<IActionResult> GetConversation(Guid otherUserId, [FromQuery] int skip = 0, [FromQuery] int take = 50)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var messages = await _db.ChatMessages
            .Where(m => 
                (m.SenderId == userId.Value && m.ReceiverId == otherUserId) ||
                (m.SenderId == otherUserId && m.ReceiverId == userId.Value))
            .OrderByDescending(m => m.SentAt)
            .Skip(skip)
            .Take(take)
            .Select(m => new
            {
                m.Id,
                m.SenderId,
                m.ReceiverId,
                m.Content,
                m.SentAt,
                m.IsRead,
                IsMine = m.SenderId == userId.Value
            })
            .ToListAsync();

        // Mark received messages as read
        await _db.ChatMessages
            .Where(m => m.SenderId == otherUserId && m.ReceiverId == userId.Value && !m.IsRead)
            .ExecuteUpdateAsync(s => s.SetProperty(m => m.IsRead, true));

        return Ok(messages.OrderBy(m => m.SentAt));
    }

    /// <summary>
    /// Get list of conversations (recent chats)
    /// </summary>
    [HttpGet("conversations")]
    public async Task<IActionResult> GetConversations()
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        // Get last message from each unique conversation
        var conversations = await _db.ChatMessages
            .Where(m => m.SenderId == userId.Value || m.ReceiverId == userId.Value)
            .GroupBy(m => m.SenderId == userId.Value ? m.ReceiverId : m.SenderId)
            .Select(g => new
            {
                OtherUserId = g.Key,
                LastMessage = g.OrderByDescending(m => m.SentAt).FirstOrDefault(),
                UnreadCount = g.Count(m => m.ReceiverId == userId.Value && !m.IsRead)
            })
            .ToListAsync();

        // Get user details for each conversation
        var userIds = conversations.Select(c => c.OtherUserId).ToList();
        var users = await _db.Users
            .Where(u => userIds.Contains(u.Id))
            .Select(u => new { u.Id, u.FullName, u.Email })
            .ToDictionaryAsync(u => u.Id);

        var result = conversations.Select(c => new
        {
            c.OtherUserId,
            OtherUserName = users.ContainsKey(c.OtherUserId) ? users[c.OtherUserId].FullName : "Unknown",
            OtherUserEmail = users.ContainsKey(c.OtherUserId) ? users[c.OtherUserId].Email : "",
            LastMessageContent = c.LastMessage?.Content,
            LastMessageTime = c.LastMessage?.SentAt,
            c.UnreadCount
        }).OrderByDescending(c => c.LastMessageTime);

        return Ok(result);
    }

    /// <summary>
    /// Send a message to another user
    /// </summary>
    [HttpPost("send")]
    public async Task<IActionResult> SendMessage(SendMessageRequest request)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        // Verify receiver exists
        var receiver = await _db.Users.FindAsync(request.ReceiverId);
        if (receiver == null) return NotFound("Recipient not found");

        var message = new ChatMessage
        {
            Id = Guid.NewGuid(),
            SenderId = userId.Value,
            ReceiverId = request.ReceiverId,
            Content = request.Content,
            SentAt = DateTime.UtcNow
        };

        _db.ChatMessages.Add(message);
        await _db.SaveChangesAsync();

        // Get sender name
        var sender = await _db.Users.FindAsync(userId.Value);

        // Push message via SignalR
        await _hubContext.Clients.Group($"user-{request.ReceiverId}")
            .SendAsync("ReceiveMessage", new
            {
                message.Id,
                message.SenderId,
                SenderName = sender?.FullName ?? "Unknown",
                message.Content,
                message.SentAt
            });

        return Ok(new { message.Id, message.SentAt });
    }

    /// <summary>
    /// Get unread message count
    /// </summary>
    [HttpGet("unread-count")]
    public async Task<IActionResult> GetUnreadCount()
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var count = await _db.ChatMessages
            .CountAsync(m => m.ReceiverId == userId.Value && !m.IsRead);

        return Ok(new { count });
    }

    /// <summary>
    /// Get available users to chat with based on role context
    /// </summary>
    [HttpGet("available-users")]
    public async Task<IActionResult> GetAvailableUsers()
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        // Get current user's role
        var userRoles = await _db.UserRoles
            .Include(ur => ur.Role)
            .Where(ur => ur.UserId == userId.Value)
            .Select(ur => ur.Role.Name)
            .ToListAsync();

        // Define who can chat with whom
        var targetRoles = new List<string>();
        
        if (userRoles.Contains("Buyer"))
        {
            targetRoles.AddRange(new[] { "CooperativeManager", "Admin" });
        }
        else if (userRoles.Contains("Farmer"))
        {
            targetRoles.AddRange(new[] { "CooperativeManager" });
        }
        else if (userRoles.Contains("CooperativeManager"))
        {
            targetRoles.AddRange(new[] { "Farmer", "Buyer", "Transporter", "Admin" });
        }
        else if (userRoles.Contains("Transporter"))
        {
            targetRoles.AddRange(new[] { "CooperativeManager", "Buyer" });
        }
        else if (userRoles.Contains("Admin"))
        {
            // Admin can chat with everyone
            targetRoles.AddRange(new[] { "Farmer", "CooperativeManager", "Buyer", "Transporter" });
        }

        var users = await _db.Users
            .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
            .Where(u => u.Id != userId.Value && 
                        u.UserRoles.Any(ur => targetRoles.Contains(ur.Role.Name)))
            .Select(u => new
            {
                u.Id,
                u.FullName,
                u.Email,
                Role = u.UserRoles.First().Role.Name
            })
            .Take(50)
            .ToListAsync();

        return Ok(users);
    }

    private Guid? GetUserId()
    {
        var claim = User.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier") ??
                   User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
        return Guid.TryParse(claim?.Value, out var guid) ? guid : null;
    }
}

public record SendMessageRequest(Guid ReceiverId, string Content);
