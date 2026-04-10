using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Rass.Api.Data;
using Rass.Api.Domain.Entities;
using Rass.Api.Hubs;
using System.Text.RegularExpressions;

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
        if (otherUserId == userId.Value) return BadRequest("Invalid conversation target.");

        var availableIds = await GetAvailableChatUserIds(userId.Value);
        if (!availableIds.Contains(otherUserId)) return Forbid();

        var messageEntities = await _db.ChatMessages
            .Where(m => 
                (m.SenderId == userId.Value && m.ReceiverId == otherUserId) ||
                (m.SenderId == otherUserId && m.ReceiverId == userId.Value))
            .OrderByDescending(m => m.SentAt)
            .Skip(skip)
            .Take(take)
            .ToListAsync();

        var messages = messageEntities
            .Select(m =>
            {
                var (content, replyToMessageId, isDeleted) = ParseStoredContent(m.Content);
                return new
                {
                    m.Id,
                    m.SenderId,
                    m.ReceiverId,
                    Content = content,
                    m.SentAt,
                    m.IsRead,
                    IsMine = m.SenderId == userId.Value,
                    ReplyToMessageId = replyToMessageId,
                    IsDeleted = isDeleted
                };
            })
            .ToList();

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
        if (request.ReceiverId == userId.Value) return BadRequest("Cannot message yourself.");
        if (string.IsNullOrWhiteSpace(request.Content)) return BadRequest("Message content is required.");
        if (request.Content.Length > 2000) return BadRequest("Message is too long.");

        // Verify receiver exists
        var receiver = await _db.Users.FindAsync(request.ReceiverId);
        if (receiver == null) return NotFound("Recipient not found");
        if (!receiver.IsActive) return BadRequest("Recipient account is inactive.");

        var sender = await _db.Users.FindAsync(userId.Value);
        if (sender == null || !sender.IsActive) return Unauthorized();

        var availableIds = await GetAvailableChatUserIds(userId.Value);
        if (!availableIds.Contains(request.ReceiverId)) return Forbid();

        var message = new ChatMessage
        {
            Id = Guid.NewGuid(),
            SenderId = userId.Value,
            ReceiverId = request.ReceiverId,
            Content = BuildStoredContent(request.Content, request.ReplyToMessageId),
            SentAt = DateTime.UtcNow
        };

        _db.ChatMessages.Add(message);
        await _db.SaveChangesAsync();

        var (parsedContent, replyToMessageId, isDeleted) = ParseStoredContent(message.Content);

        // Push message via SignalR
        await _hubContext.Clients.Group($"user-{request.ReceiverId}")
            .SendAsync("ReceiveMessage", new
            {
                message.Id,
                message.SenderId,
                SenderName = sender?.FullName ?? "Unknown",
                Content = parsedContent,
                message.SentAt,
                ReplyToMessageId = replyToMessageId,
                IsDeleted = isDeleted
            });

        return Ok(new { message.Id, message.SentAt, content = parsedContent, replyToMessageId, isDeleted });
    }

    /// <summary>
    /// Soft-delete a sent message
    /// </summary>
    [HttpDelete("messages/{id}")]
    public async Task<IActionResult> DeleteMessage(Guid id)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var message = await _db.ChatMessages.FirstOrDefaultAsync(m => m.Id == id);
        if (message == null) return NotFound("Message not found");
        if (message.SenderId != userId.Value) return Forbid();

        message.Content = "__deleted__";
        await _db.SaveChangesAsync();

        await _hubContext.Clients.Group($"user-{message.ReceiverId}")
            .SendAsync("MessageDeleted", new { messageId = message.Id });
        await _hubContext.Clients.Group($"user-{message.SenderId}")
            .SendAsync("MessageDeleted", new { messageId = message.Id });

        return Ok(new { message = "Message deleted", id = message.Id });
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
    /// Get available users to chat with based on relationship context
    /// </summary>
    [HttpGet("available-users")]
    public async Task<IActionResult> GetAvailableUsers()
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        // Get current user's roles
        var userRoles = await _db.UserRoles
            .Include(ur => ur.Role)
            .Where(ur => ur.UserId == userId.Value)
            .Select(ur => ur.Role.Name)
            .ToListAsync();

        var availableUserIds = await GetAvailableChatUserIds(userId.Value, userRoles);

        // Fetch user details
        var users = await _db.Users
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .Where(u => availableUserIds.Contains(u.Id))
            .Select(u => new
            {
                u.Id,
                u.FullName,
                u.Email,
                Role = u.UserRoles.FirstOrDefault() != null ? u.UserRoles.First().Role.Name : "Unknown"
            })
            .ToListAsync();

        return Ok(users);
    }

    [HttpGet("listing-target/{listingId}")]
    [Authorize(Roles = "Buyer")]
    public async Task<IActionResult> GetListingChatTarget(Guid listingId)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var listing = await _db.MarketListings
            .Include(l => l.Cooperative)
            .FirstOrDefaultAsync(l => l.Id == listingId);
        if (listing == null || listing.Cooperative?.ManagerId == null)
            return NotFound("Listing or cooperative manager not found.");

        var availableUserIds = await GetAvailableChatUserIds(userId.Value);
        if (!availableUserIds.Contains(listing.Cooperative.ManagerId.Value))
            return Forbid();

        var manager = await _db.Users.FirstOrDefaultAsync(u => u.Id == listing.Cooperative.ManagerId.Value);
        if (manager == null) return NotFound("Cooperative manager not found.");

        return Ok(new
        {
            userId = manager.Id,
            fullName = manager.FullName,
            listingId
        });
    }

    [HttpGet("lookup-by-phone")]
    public async Task<IActionResult> LookupUserByPhone([FromQuery] string phone)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();
        if (string.IsNullOrWhiteSpace(phone)) return BadRequest("Phone number is required.");

        var normalized = NormalizePhone(phone);
        if (string.IsNullOrWhiteSpace(normalized)) return BadRequest("Invalid phone number.");
        var tail = normalized.Length > 4 ? normalized[^4..] : normalized;

        var farmerCandidates = await _db.Farmers
            .Include(f => f.User)
            .Where(f => f.Phone.Contains(tail))
            .ToListAsync();
        var farmer = farmerCandidates.FirstOrDefault(f => NormalizePhone(f.Phone) == normalized);
        if (farmer?.User != null && farmer.User.Id != userId.Value)
            return await BuildLookupResult(userId.Value, farmer.User.Id, farmer.User.FullName, "Farmer");

        var buyerCandidates = await _db.BuyerProfiles
            .Include(b => b.User)
            .Where(b => b.Phone.Contains(tail))
            .ToListAsync();
        var buyer = buyerCandidates.FirstOrDefault(b => NormalizePhone(b.Phone) == normalized);
        if (buyer?.User != null && buyer.User.Id != userId.Value)
            return await BuildLookupResult(userId.Value, buyer.User.Id, buyer.User.FullName, "Buyer");

        var transporterCandidates = await _db.TransporterProfiles
            .Include(t => t.User)
            .Where(t => t.Phone.Contains(tail))
            .ToListAsync();
        var transporter = transporterCandidates.FirstOrDefault(t => NormalizePhone(t.Phone) == normalized);
        if (transporter?.User != null && transporter.User.Id != userId.Value)
            return await BuildLookupResult(userId.Value, transporter.User.Id, transporter.User.FullName, "Transporter");

        var cooperativeCandidates = await _db.Cooperatives
            .Include(c => c.Manager)
            .Where(c => c.ManagerId != null && c.Phone.Contains(tail))
            .ToListAsync();
        var cooperative = cooperativeCandidates.FirstOrDefault(c => NormalizePhone(c.Phone) == normalized);
        if (cooperative?.Manager != null && cooperative.Manager.Id != userId.Value)
            return await BuildLookupResult(userId.Value, cooperative.Manager.Id, cooperative.Manager.FullName, "CooperativeManager");

        return NotFound("No registered user found with that phone number.");
    }

    private async Task<HashSet<Guid>> GetAvailableChatUserIds(Guid userId, List<string>? userRoles = null)
    {
        userRoles ??= await _db.UserRoles
            .Include(ur => ur.Role)
            .Where(ur => ur.UserId == userId)
            .Select(ur => ur.Role.Name)
            .ToListAsync();

        var availableUserIds = new HashSet<Guid>();

        // FARMER: Can chat with their cooperative manager
        if (userRoles.Contains("Farmer"))
        {
            var farmerProfile = await _db.Farmers
                .Include(f => f.Cooperative)
                .FirstOrDefaultAsync(f => f.UserId == userId);

            if (farmerProfile?.Cooperative?.ManagerId != null)
            {
                availableUserIds.Add(farmerProfile.Cooperative.ManagerId.Value);
            }
        }

        // COOPERATIVE MANAGER: Can chat with farmers in their cooperative, 
        // buyers with active orders, and transporters assigned to their contracts
        if (userRoles.Contains("CooperativeManager"))
        {
            var cooperative = await _db.Cooperatives
                .FirstOrDefaultAsync(c => c.ManagerId == userId);

            if (cooperative != null)
            {
                // Add farmers in their cooperative
                var farmerUserIds = await _db.Farmers
                    .Where(f => f.CooperativeId == cooperative.Id)
                    .Select(f => f.UserId)
                    .ToListAsync();
                foreach (var fid in farmerUserIds) availableUserIds.Add(fid);

                // Add buyers who have ordered from their listings
                var buyerUserIds = await _db.BuyerOrders
                    .Include(o => o.MarketListing)
                    .Include(o => o.BuyerProfile)
                    .Where(o => o.MarketListing != null && o.MarketListing.CooperativeId == cooperative.Id)
                    .Select(o => o.BuyerProfile.UserId)
                    .Distinct()
                    .ToListAsync();
                foreach (var bid in buyerUserIds) availableUserIds.Add(bid);

                // Add transporters assigned to their contracts
                var transporterUserIds = await _db.TransportRequests
                    .Include(tr => tr.Contract).ThenInclude(c => c.BuyerOrder).ThenInclude(o => o.MarketListing)
                    .Include(tr => tr.Transporter)
                    .Where(tr => tr.Transporter != null && 
                                 tr.Contract.BuyerOrder.MarketListing.CooperativeId == cooperative.Id)
                    .Select(tr => tr.Transporter.UserId)
                    .Distinct()
                    .ToListAsync();
                foreach (var tid in transporterUserIds) availableUserIds.Add(tid);
            }
        }

        // BUYER: Can chat with cooperative managers they have orders with
        if (userRoles.Contains("Buyer"))
        {
            var buyerProfile = await _db.BuyerProfiles.FirstOrDefaultAsync(b => b.UserId == userId);
            if (buyerProfile != null)
            {
                var managerUserIds = await _db.BuyerOrders
                    .Include(o => o.MarketListing).ThenInclude(l => l.Cooperative)
                    .Where(o => o.BuyerProfileId == buyerProfile.Id && o.MarketListing != null && o.MarketListing.Cooperative != null)
                    .Select(o => o.MarketListing!.Cooperative!.ManagerId)
                    .Where(mid => mid != null)
                    .Distinct()
                    .ToListAsync();
                foreach (var mid in managerUserIds) if (mid.HasValue) availableUserIds.Add(mid.Value);
            }
        }

        // TRANSPORTER: Can chat with parties of contracts they're assigned to
        if (userRoles.Contains("Transporter"))
        {
            var transporterProfile = await _db.TransporterProfiles.FirstOrDefaultAsync(t => t.UserId == userId);
            if (transporterProfile != null)
            {
                // Get cooperative managers and buyers from assigned contracts
                var contractParties = await _db.TransportRequests
                    .Include(tr => tr.Contract).ThenInclude(c => c.BuyerOrder).ThenInclude(o => o.BuyerProfile)
                    .Include(tr => tr.Contract).ThenInclude(c => c.BuyerOrder).ThenInclude(o => o.MarketListing).ThenInclude(l => l.Cooperative)
                    .Where(tr => tr.TransporterId == transporterProfile.Id && tr.Contract != null && tr.Contract.BuyerOrder != null)
                    .Select(tr => new {
                        BuyerUserId = tr.Contract!.BuyerOrder!.BuyerProfile != null ? tr.Contract.BuyerOrder.BuyerProfile.UserId : Guid.Empty,
                        ManagerId = tr.Contract.BuyerOrder.MarketListing != null && tr.Contract.BuyerOrder.MarketListing.Cooperative != null ? tr.Contract.BuyerOrder.MarketListing.Cooperative.ManagerId : null
                    })
                    .Where(cp => cp.BuyerUserId != Guid.Empty)
                    .ToListAsync();

                foreach (var cp in contractParties)
                {
                    availableUserIds.Add(cp.BuyerUserId);
                    if (cp.ManagerId.HasValue) availableUserIds.Add(cp.ManagerId.Value);
                }
            }
        }

        // ADMIN: Can chat with everyone
        if (userRoles.Contains("Admin"))
        {
            var allUserIds = await _db.Users
                .Where(u => u.Id != userId)
                .Select(u => u.Id)
                .Take(100)
                .ToListAsync();
            foreach (var uid in allUserIds) availableUserIds.Add(uid);
        }

        return availableUserIds;
    }

    private static string BuildStoredContent(string content, Guid? replyToMessageId)
    {
        var trimmed = content.Trim();
        if (replyToMessageId.HasValue)
            return $"[reply:{replyToMessageId}] {trimmed}";
        return trimmed;
    }

    private static (string content, Guid? replyToMessageId, bool isDeleted) ParseStoredContent(string storedContent)
    {
        if (storedContent == "__deleted__")
            return ("This message was deleted", null, true);

        var match = Regex.Match(storedContent, @"^\[reply:(?<id>[0-9a-fA-F-]{36})\]\s*(?<content>.*)$");
        if (!match.Success) return (storedContent, null, false);

        var idText = match.Groups["id"].Value;
        var content = match.Groups["content"].Value;
        return (content, Guid.TryParse(idText, out var id) ? id : null, false);
    }

    private static string NormalizePhone(string? input)
    {
        if (string.IsNullOrWhiteSpace(input)) return string.Empty;
        var digits = new string(input.Where(char.IsDigit).ToArray());
        return digits.StartsWith("250") ? digits[3..] : digits;
    }

    private async Task<IActionResult> BuildLookupResult(Guid requesterId, Guid targetId, string fullName, string role)
    {
        var availableUserIds = await GetAvailableChatUserIds(requesterId);
        if (!availableUserIds.Contains(targetId)) return Forbid();
        return Ok(new
        {
            userId = targetId,
            fullName,
            role
        });
    }

    private Guid? GetUserId()
    {
        var claim = User.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier") ??
                   User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
        return Guid.TryParse(claim?.Value, out var guid) ? guid : null;
    }
}

public record SendMessageRequest(Guid ReceiverId, string Content, Guid? ReplyToMessageId);
