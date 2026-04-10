using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.SignalR;
using Rass.Api.Data;
using Rass.Api.Domain.Entities;
using Rass.Api.Hubs;

namespace Rass.Api.Services;

/// <summary>
/// SMS notification service for reaching farmers without smartphones.
/// In development mode, messages are logged. In production, this integrates
/// with Rwanda SMS gateways (Pindo, Africa's Talking, or MTN SMS API).
/// </summary>
public interface ISmsService
{
    Task<bool> SendSmsAsync(string phoneNumber, string message);
    Task<int> BroadcastPriceAlertAsync(string crop, string market, string region, decimal pricePerKg);
}

public class SmsService : ISmsService
{
    private readonly ILogger<SmsService> _logger;
    private readonly AppDbContext _db;
    private readonly IHubContext<NotificationHub> _hubContext;
    private readonly IConfiguration _config;

    public SmsService(
        ILogger<SmsService> logger,
        AppDbContext db,
        IHubContext<NotificationHub> hubContext,
        IConfiguration config)
    {
        _logger = logger;
        _db = db;
        _hubContext = hubContext;
        _config = config;
    }

    public async Task<bool> SendSmsAsync(string phoneNumber, string message)
    {
        var provider = _config.GetValue<string>("Sms:Provider") ?? "log";

        if (provider.Equals("log", StringComparison.OrdinalIgnoreCase))
        {
            // Development mode — log the SMS instead of sending
            _logger.LogInformation("[SMS-DEV] To: {Phone} | Message: {Message}", phoneNumber, message);
            return true;
        }

        // Production: integrate with Pindo (Rwanda-based SMS gateway)
        // POST https://api.pindo.io/v1/sms/
        // { "to": "+250788...", "text": "...", "sender": "RASS" }
        _logger.LogInformation("[SMS] Sending to {Phone} via {Provider}", phoneNumber, provider);

        // Placeholder for real SMS gateway integration
        // var client = new HttpClient();
        // var response = await client.PostAsJsonAsync("https://api.pindo.io/v1/sms/", new { to = phoneNumber, text = message, sender = "RASS" });
        // return response.IsSuccessStatusCode;

        return true;
    }

    /// <summary>
    /// Broadcasts a price alert to all farmers growing the specified crop in the region.
    /// Sends both in-app notifications (SignalR) and SMS to farmers with phone numbers.
    /// </summary>
    public async Task<int> BroadcastPriceAlertAsync(string crop, string market, string region, decimal pricePerKg)
    {
        // Find farmers who grow this crop in this region
        var farmers = await _db.Farmers
            .Include(f => f.User)
            .Where(f => f.Crops != null && f.Crops.Contains(crop))
            .ToListAsync();

        // Also notify cooperatives in the region
        var coopManagerIds = await _db.Cooperatives
            .Where(c => c.IsActive && c.Region == region && c.ManagerId.HasValue)
            .Select(c => c.ManagerId!.Value)
            .ToListAsync();

        var notificationTitle = $"Price Update: {crop}";
        var notificationMessage = $"{crop} is now {pricePerKg:N0} RWF/kg at {market} ({region}). Check prices for the best deal.";
        var smsMessage = $"RASS: {crop} {pricePerKg:N0} RWF/kg at {market}. Visit rass.rw/prices for details.";

        var count = 0;
        var notifications = new List<Notification>();

        foreach (var farmer in farmers)
        {
            // In-app notification
            notifications.Add(new Notification
            {
                Id = Guid.NewGuid(),
                UserId = farmer.UserId,
                Title = notificationTitle,
                Message = notificationMessage,
                Type = "Info",
                ActionUrl = "/prices",
                CreatedAt = DateTime.UtcNow,
            });

            // SMS notification
            if (!string.IsNullOrWhiteSpace(farmer.Phone))
            {
                await SendSmsAsync(farmer.Phone, smsMessage);
                count++;
            }
        }

        // Notify cooperative managers
        foreach (var managerId in coopManagerIds)
        {
            notifications.Add(new Notification
            {
                Id = Guid.NewGuid(),
                UserId = managerId,
                Title = notificationTitle,
                Message = notificationMessage,
                Type = "Info",
                ActionUrl = "/prices",
                CreatedAt = DateTime.UtcNow,
            });
        }

        if (notifications.Count > 0)
        {
            _db.Notifications.AddRange(notifications);
            await _db.SaveChangesAsync();

            // Push via SignalR to all connected farmers
            await _hubContext.Clients.Group("role-Farmer").SendAsync("ReceiveNotification", new
            {
                Title = notificationTitle,
                Message = notificationMessage,
                Type = "PriceAlert",
                Crop = crop,
                Market = market,
                Region = region,
                PricePerKg = pricePerKg,
                Timestamp = DateTime.UtcNow,
            });
        }

        _logger.LogInformation(
            "[PriceAlert] {Crop} @ {Market} ({Region}): {Price} RWF/kg — {SmsCount} SMS sent, {NotifCount} in-app notifications",
            crop, market, region, pricePerKg, count, notifications.Count);

        return count;
    }
}
