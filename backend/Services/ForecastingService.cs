using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Rass.Api.Services;

public class ForecastingService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<ForecastingService> _logger;
    private readonly string _forecastingServiceUrl;
    private readonly string _forecastingApiKey;

    public ForecastingService(HttpClient httpClient, IConfiguration configuration, ILogger<ForecastingService> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
        _forecastingServiceUrl = configuration["ForecastingService:Url"] ?? "http://localhost:8001";
        _forecastingApiKey = configuration["ForecastingService:ApiKey"] ?? "dev-forecast-key-change-me";

        if (!_httpClient.DefaultRequestHeaders.Contains("X-FORECAST-KEY"))
        {
            _httpClient.DefaultRequestHeaders.TryAddWithoutValidation("X-FORECAST-KEY", _forecastingApiKey);
        }
    }

    public async Task<PriceForecastResponse?> GetPriceForecastAsync(string crop, string market, int days = 7, List<HistoricalPrice>? historicalPrices = null)
    {
        try
        {
            var request = new
            {
                crop,
                market,
                days,
                historical_prices = historicalPrices?.Select(p => new
                {
                    date = p.Date.ToString("yyyy-MM-dd"),
                    price = p.Price,
                    observedAt = p.Date.ToString("yyyy-MM-ddTHH:mm:ssZ"),
                    pricePerKg = p.Price
                })
            };

            var response = await _httpClient.PostAsJsonAsync($"{_forecastingServiceUrl}/forecast/price", request);
            response.EnsureSuccessStatusCode();

            var result = await response.Content.ReadFromJsonAsync<PriceForecastResponse>();
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error calling forecasting service for price forecast");
            return null;
        }
    }

    public async Task<EnhancedPriceForecastResponse?> GetEnhancedPriceForecastAsync(
        string crop,
        string market,
        int days = 7,
        List<HistoricalPrice>? historicalPrices = null,
        object? marketInfo = null,
        object? externalFactors = null,
        string? userRole = null)
    {
        try
        {
            var request = new
            {
                crop,
                market,
                days,
                historical_prices = historicalPrices?.Select(p => new
                {
                    date = p.Date.ToString("yyyy-MM-dd"),
                    price = p.Price,
                    observedAt = p.Date.ToString("yyyy-MM-ddTHH:mm:ssZ"),
                    pricePerKg = p.Price
                }),
                market_info = marketInfo,
                external_factors = externalFactors
            };

            var httpRequest = new HttpRequestMessage(HttpMethod.Post, $"{_forecastingServiceUrl}/forecast/price/enhanced")
            {
                Content = JsonContent.Create(request)
            };
            httpRequest.Headers.TryAddWithoutValidation("X-FORECAST-KEY", _forecastingApiKey);
            if (!string.IsNullOrEmpty(userRole))
            {
                httpRequest.Headers.TryAddWithoutValidation("X-User-Role", userRole);
            }

            var response = await _httpClient.SendAsync(httpRequest);
            response.EnsureSuccessStatusCode();

            var result = await response.Content.ReadFromJsonAsync<EnhancedPriceForecastResponse>();
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error calling forecasting service for enhanced price forecast");
            return null;
        }
    }

    public async Task<SupplyForecastResponse?> GetSupplyForecastAsync(string crop, string district, List<ExpectedHarvest>? expectedHarvests = null, List<HistoricalYield>? historicalYields = null)
    {
        try
        {
            var request = new
            {
                crop,
                district,
                expected_harvests = expectedHarvests?.Select(h => new
                {
                    quantity = h.QuantityKg,
                    expectedQuantityKg = h.QuantityKg,
                    date = h.ExpectedDate.ToString("yyyy-MM-dd")
                }),
                historical_yields = historicalYields?.Select(y => new
                {
                    yield = y.QuantityKg,
                    quantityKg = y.QuantityKg,
                    date = y.Date.ToString("yyyy-MM-dd")
                })
            };

            var response = await _httpClient.PostAsJsonAsync($"{_forecastingServiceUrl}/forecast/supply", request);
            response.EnsureSuccessStatusCode();

            var result = await response.Content.ReadFromJsonAsync<SupplyForecastResponse>();
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error calling forecasting service for supply forecast");
            return null;
        }
    }

    public async Task<AnomalyDetectionResponse?> DetectAnomalyAsync(string crop, string market, decimal currentPrice, List<HistoricalPrice> historicalPrices)
    {
        try
        {
            var request = new
            {
                crop,
                market,
                current_price = (double)currentPrice,
                historical_prices = historicalPrices.Select(p => new
                {
                    price = (double)p.Price,
                    pricePerKg = (double)p.Price,
                    date = p.Date.ToString("yyyy-MM-dd"),
                    observedAt = p.Date.ToString("yyyy-MM-ddTHH:mm:ssZ")
                })
            };

            var response = await _httpClient.PostAsJsonAsync($"{_forecastingServiceUrl}/detect/anomaly", request);
            response.EnsureSuccessStatusCode();

            var result = await response.Content.ReadFromJsonAsync<AnomalyDetectionResponse>();
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error calling forecasting service for anomaly detection");
            return null;
        }
    }

    public async Task<bool> IsHealthyAsync()
    {
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, $"{_forecastingServiceUrl}/health");
            var response = await _httpClient.SendAsync(request);
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Forecasting service health probe failed");
            return false;
        }
    }
}

// Response models
public class PriceForecastResponse
{
    [JsonPropertyName("forecast_date")]
    public string ForecastDate { get; set; } = string.Empty;
    [JsonPropertyName("forecast_period_days")]
    public int ForecastPeriodDays { get; set; }
    [JsonPropertyName("predictions")]
    public List<PricePrediction> Predictions { get; set; } = new();
    [JsonPropertyName("quantiles")]
    public Dictionary<string, List<double>> Quantiles { get; set; } = new();
    [JsonPropertyName("recommendation")]
    public string Recommendation { get; set; } = string.Empty;
    [JsonPropertyName("explanation")]
    public string Explanation { get; set; } = string.Empty;
    [JsonPropertyName("confidence")]
    public double Confidence { get; set; }
}

public class PricePrediction
{
    [JsonPropertyName("date")]
    public string Date { get; set; } = string.Empty;
    [JsonPropertyName("median")]
    public double Median { get; set; }
    [JsonPropertyName("lower_bound")]
    public double LowerBound { get; set; }
    [JsonPropertyName("upper_bound")]
    public double UpperBound { get; set; }
}

public class EnhancedPriceForecastResponse
{
    [JsonPropertyName("forecast_date")]
    public string ForecastDate { get; set; } = string.Empty;
    [JsonPropertyName("forecast_period_days")]
    public int ForecastPeriodDays { get; set; }
    [JsonPropertyName("predictions")]
    public List<PricePrediction> Predictions { get; set; } = new();
    [JsonPropertyName("trend")]
    public string Trend { get; set; } = string.Empty;
    [JsonPropertyName("volatility")]
    public string Volatility { get; set; } = string.Empty;
    [JsonPropertyName("confidence")]
    public double Confidence { get; set; }
    [JsonPropertyName("recommendation")]
    public string Recommendation { get; set; } = string.Empty;
    [JsonPropertyName("explanation")]
    public string Explanation { get; set; } = string.Empty;
    [JsonPropertyName("top_factors")]
    public List<string> TopFactors { get; set; } = new();
    [JsonPropertyName("role_specific_advice")]
    public string RoleSpecificAdvice { get; set; } = string.Empty;
    [JsonPropertyName("role")]
    public string Role { get; set; } = string.Empty;
    [JsonPropertyName("district_forecasts")]
    public List<DistrictForecastInsight> DistrictForecasts { get; set; } = new();
}

public class DistrictForecastInsight
{
    [JsonPropertyName("district")]
    public string District { get; set; } = string.Empty;
    [JsonPropertyName("region")]
    public string Region { get; set; } = string.Empty;
    [JsonPropertyName("current_price")]
    public double CurrentPrice { get; set; }
    [JsonPropertyName("forecasted_price")]
    public double ForecastedPrice { get; set; }
    [JsonPropertyName("trend")]
    public string Trend { get; set; } = "STABLE";
    [JsonPropertyName("confidence")]
    public double Confidence { get; set; }
    [JsonPropertyName("reason")]
    public string Reason { get; set; } = string.Empty;
    [JsonPropertyName("role_advice")]
    public string RoleAdvice { get; set; } = string.Empty;
}

public class SupplyForecastResponse
{
    [JsonPropertyName("forecast_date")]
    public string ForecastDate { get; set; } = string.Empty;
    [JsonPropertyName("crop")]
    public string Crop { get; set; } = string.Empty;
    [JsonPropertyName("district")]
    public string District { get; set; } = string.Empty;
    [JsonPropertyName("forecasted_supply_kg")]
    public double ForecastedSupplyKg { get; set; }
    [JsonPropertyName("quantiles")]
    public Dictionary<string, double> Quantiles { get; set; } = new();
    [JsonPropertyName("expected_harvests_count")]
    public int ExpectedHarvestsCount { get; set; }
    [JsonPropertyName("confidence")]
    public double Confidence { get; set; }
}

public class AnomalyDetectionResponse
{
    [JsonPropertyName("is_anomaly")]
    public bool IsAnomaly { get; set; }
    [JsonPropertyName("z_score")]
    public double ZScore { get; set; }
    [JsonPropertyName("current_price")]
    public double CurrentPrice { get; set; }
    [JsonPropertyName("mean_price")]
    public double MeanPrice { get; set; }
    [JsonPropertyName("std_price")]
    public double StdPrice { get; set; }
    [JsonPropertyName("reason")]
    public string Reason { get; set; } = string.Empty;
    [JsonPropertyName("severity")]
    public string Severity { get; set; } = string.Empty;
}

// Request models
public class HistoricalPrice
{
    public DateTime Date { get; set; }
    public decimal Price { get; set; }
}

public class ExpectedHarvest
{
    public double QuantityKg { get; set; }
    public DateTime ExpectedDate { get; set; }
}

public class HistoricalYield
{
    public double QuantityKg { get; set; }
    public DateTime Date { get; set; }
}
