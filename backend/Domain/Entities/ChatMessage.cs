namespace Rass.Api.Domain.Entities;

/// <summary>
/// Represents a chat message between users
/// </summary>
public class ChatMessage
{
    public Guid Id { get; set; }
    public Guid SenderId { get; set; }
    public Guid ReceiverId { get; set; }
    public string Content { get; set; } = string.Empty;
    public DateTime SentAt { get; set; } = DateTime.UtcNow;
    public bool IsRead { get; set; } = false;
    
    // Navigation
    public User? Sender { get; set; }
    public User? Receiver { get; set; }
}
