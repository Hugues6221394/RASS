using System.Text.Json;
using System.Text;

namespace Rass.Api.Services;

/// <summary>
/// A real-world template for integration with MTN MoMo API in Rwanda.
/// MTN MoMo integration service for production payment processing.
/// </summary>
public class MtnMomoService
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly ILogger<MtnMomoService> _logger;

    public MtnMomoService(HttpClient httpClient, IConfiguration configuration, ILogger<MtnMomoService> logger)
    {
        _httpClient = httpClient;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<bool> ProcessPaymentAsync(string phoneNumber, decimal amount, string reference)
    {
        _logger.LogInformation("Initiating MTN MoMo payment for {PhoneNumber} - Amount: {Amount}, Ref: {Reference}", phoneNumber, amount, reference);

        var subscriptionKey = _configuration["MtnMomo:SubscriptionKey"];
        var apiUser = _configuration["MtnMomo:ApiUser"];
        var apiKey = _configuration["MtnMomo:ApiKey"];
        var baseUrl = _configuration["MtnMomo:BaseUrl"] ?? "https://proxy.momoapi.mtn.com";

        if (string.IsNullOrEmpty(subscriptionKey) || string.IsNullOrEmpty(apiUser) || string.IsNullOrEmpty(apiKey))
        {
            _logger.LogError("MTN MoMo API credentials are missing. Payment request rejected.");
            return false;
        }

        try
        {
            // 1. Get Access Token (simplified for template)
            // 2. Request to Pay
            var payload = new
            {
                amount = amount.ToString(),
                currency = "RWF",
                externalId = reference,
                payer = new { partyIdType = "MSISDN", partyId = phoneNumber },
                payerMessage = "RASS Produce Payment",
                payeeNote = "Payment for produce via RASS"
            };

            var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
            _httpClient.DefaultRequestHeaders.Add("Ocp-Apim-Subscription-Key", subscriptionKey);
            _httpClient.DefaultRequestHeaders.Add("X-Reference-Id", Guid.NewGuid().ToString());
            _httpClient.DefaultRequestHeaders.Add("X-Target-Environment", _configuration["MtnMomo:Environment"] ?? "sandbox");

            var response = await _httpClient.PostAsync($"{baseUrl}/collection/v1_0/requesttopay", content);
            
            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation("MTN MoMo payment requested successfully for {Reference}", reference);
                return true;
            }

            var error = await response.Content.ReadAsStringAsync();
            _logger.LogError("MTN MoMo payment failed: {StatusCode} - {Error}", response.StatusCode, error);
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Exception during MTN MoMo payment processing for {Reference}", reference);
            return false;
        }
    }
}
