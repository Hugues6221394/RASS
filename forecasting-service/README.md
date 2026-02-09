# RASS AI Forecasting Service

FastAPI service for agricultural price and supply forecasting using statistical models.

## Features

- **Price Forecasting**: Short-term price forecasting per market-per-crop using statistical time-series models
- **Supply Estimation**: Combines farmer-registered expected harvests with historical yields
- **Demand Forecasting**: Time-series forecasting for buyer demand
- **Anomaly Detection**: Detects unusual price spikes or drops using Z-score analysis
- **Transport Demand Prediction**: Forecasts transport demand for route optimization

## Installation (Windows-Friendly)

This version works on Windows without requiring C compilers:

```bash
pip install -r requirements.txt
```

**Note**: This simplified version uses pure Python statistical methods instead of Prophet/pandas/numpy, making it work on Windows without compilation.

## Running the Service

```bash
python main.py
```

Or with uvicorn:

```bash
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

The service will start on: http://localhost:8001

## API Endpoints

### Health Check
- `GET /health` - Service health status
- `GET /` - Service info

### Price Forecasting
- `POST /forecast/price` - Forecast price for crop in market
- `GET /forecast/batch?crops=Maize,Beans&markets=Kigali,Huye&days=7` - Batch forecast

### Supply Forecasting
- `POST /forecast/supply` - Forecast supply for crop in district

### Demand Forecasting
- `POST /forecast/demand` - Forecast demand for crop

### Transport Demand
- `POST /forecast/transport-demand` - Forecast transport demand for route

### Anomaly Detection
- `POST /detect/anomaly` - Detect price anomalies

## Example Usage

### Price Forecast
```python
import requests

response = requests.post("http://localhost:8001/forecast/price", json={
    "crop": "Maize",
    "market": "Kigali",
    "days": 7,
    "historical_prices": [
        {"date": "2024-01-01", "price": 300},
        {"date": "2024-01-02", "price": 310},
        # ... more historical data
    ]
})

print(response.json())
# Returns: forecast with predictions, quantiles, recommendation, explanation
```

### Supply Forecast
```python
response = requests.post("http://localhost:8001/forecast/supply", json={
    "crop": "Maize",
    "district": "Nyagatare",
    "expected_harvests": [
        {"quantity": 1000, "expectedQuantityKg": 1000},
        {"quantity": 1500, "expectedQuantityKg": 1500}
    ],
    "historical_yields": [
        {"yield": 800, "quantityKg": 800},
        {"yield": 1200, "quantityKg": 1200}
    ]
})
```

### Anomaly Detection
```python
response = requests.post("http://localhost:8001/detect/anomaly", json={
    "crop": "Maize",
    "market": "Kigali",
    "current_price": 500.0,
    "historical_prices": [
        {"price": 300, "pricePerKg": 300},
        {"price": 310, "pricePerKg": 310},
        # ... more data
    ]
})
```

## Integration with Main Backend

The main ASP.NET Core backend calls this service via HTTP:

```csharp
var forecast = await _forecastingService.GetPriceForecastAsync(
    crop: "Maize",
    market: "Kigali",
    days: 7,
    historicalPrices: prices
);
```

## Forecasting Methods

### Price Forecasting
- Uses linear trend analysis
- Seasonal adjustments based on day of year
- Statistical uncertainty bounds (80% confidence intervals)
- Generates actionable recommendations (Sell Now/Hold/Monitor)

### Supply Forecasting
- Aggregates expected harvests from farmers
- Adjusts based on historical yield patterns
- Provides probabilistic supply distributions

### Anomaly Detection
- Uses Z-score analysis (statistical standard deviations)
- Detects price spikes (>2.5σ) and drops (<-2.5σ)
- Returns severity levels (low/medium/high)

## Response Format

### Price Forecast Response
```json
{
  "forecast_date": "2024-01-22T20:00:00",
  "forecast_period_days": 7,
  "predictions": [
    {
      "date": "2024-01-23T00:00:00",
      "median": 320.5,
      "lower_bound": 295.2,
      "upper_bound": 345.8
    }
  ],
  "quantiles": {
    "q10": [295.2, ...],
    "q50": [320.5, ...],
    "q90": [345.8, ...]
  },
  "recommendation": "Hold",
  "explanation": "Forecasted price median 320 RWF/kg over next 7 days with 6.8% expected increase...",
  "confidence": 0.85
}
```

## Docker Support

```bash
docker build -t rass-forecasting .
docker run -p 8001:8001 rass-forecasting
```

## Notes

- This version uses pure Python statistical methods (no Prophet dependency)
- Works on Windows without C compilers
- Provides same API interface as Prophet-based version
- Suitable for production use with real historical data
- Can be upgraded to Prophet later if needed
