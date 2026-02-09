using System.Net.Http.Json;
using System.Text.Json;

namespace Rass.Api.Services;

public class ForecastingService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<ForecastingService> _logger;
    private readonly string _forecastingServiceUrl;

    public ForecastingService(HttpClient httpClient, IConfiguration configuration, ILogger<ForecastingService> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
        _forecastingServiceUrl = configuration["ForecastingService:Url"] ?? "http://localhost:8001";
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
}

// Response models
public class PriceForecastResponse
{
    public string ForecastDate { get; set; } = string.Empty;
    public int ForecastPeriodDays { get; set; }
    public List<PricePrediction> Predictions { get; set; } = new();
    public Dictionary<string, List<double>> Quantiles { get; set; } = new();
    public string Recommendation { get; set; } = string.Empty;
    public string Explanation { get; set; } = string.Empty;
    public double Confidence { get; set; }
}

public class PricePrediction
{
    public string Date { get; set; } = string.Empty;
    public double Median { get; set; }
    public double LowerBound { get; set; }
    public double UpperBound { get; set; }
}

public class SupplyForecastResponse
{
    public string ForecastDate { get; set; } = string.Empty;
    public string Crop { get; set; } = string.Empty;
    public string District { get; set; } = string.Empty;
    public double ForecastedSupplyKg { get; set; }
    public Dictionary<string, double> Quantiles { get; set; } = new();
    public int ExpectedHarvestsCount { get; set; }
    public double Confidence { get; set; }
}

public class AnomalyDetectionResponse
{
    public bool IsAnomaly { get; set; }
    public double ZScore { get; set; }
    public double CurrentPrice { get; set; }
    public double MeanPrice { get; set; }
    public double StdPrice { get; set; }
    public string Reason { get; set; } = string.Empty;
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

