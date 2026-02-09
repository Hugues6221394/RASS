"""
RASS AI Forecasting Service
FastAPI service for agricultural price and supply forecasting
Enhanced with ML-powered price prediction model
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import logging
import math
import random

# Import the new price prediction model
from model import predict_price, train_model

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="RASS Forecasting Service",
    description="AI-powered forecasting for agricultural prices, supply, and demand with ML-enhanced predictions",
    version="2.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models
class PriceForecastRequest(BaseModel):
    crop: str
    market: str
    days: int = Field(default=7, ge=1, le=14, description="Forecast horizon in days (1-14)")
    historical_prices: Optional[List[Dict[str, Any]]] = None

class EnhancedPriceForecastRequest(BaseModel):
    """Enhanced request with Rwanda-specific factors"""
    crop: str = Field(..., description="Crop type (e.g., maize, beans, rice)")
    market: str = Field(..., description="Market name")
    days: int = Field(default=7, ge=1, le=14, description="Forecast horizon in days")
    historical_prices: Optional[List[Dict[str, Any]]] = Field(
        default=None,
        description="List of historical prices with 'date' and 'price' or 'pricePerKg'"
    )
    market_info: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Market features: distanceToKigali, isUrban, roadQuality"
    )
    external_factors: Optional[Dict[str, Any]] = Field(
        default=None,
        description="External factors: rainfallAnomaly, fuelPriceIndex, expectedSupply, demandIndex, season"
    )

class EnhancedForecastResponse(BaseModel):
    """Enhanced response with trend, volatility, and recommendations"""
    forecast_date: str
    forecast_period_days: int
    predictions: List[Dict[str, Any]]
    trend: str = Field(..., description="UP, STABLE, or DOWN")
    volatility: str = Field(..., description="LOW, MEDIUM, or HIGH")
    confidence: float = Field(..., ge=0, le=1, description="Confidence score (0-1)")
    recommendation: str = Field(..., description="Sell Now, Hold, or Monitor")
    explanation: str = Field(..., description="Human-readable explanation")
    top_factors: List[str] = Field(default=[], description="Top contributing factors")

class SupplyForecastRequest(BaseModel):
    crop: str
    district: str
    expected_harvests: Optional[List[Dict[str, Any]]] = None
    historical_yields: Optional[List[Dict[str, Any]]] = None

class DemandForecastRequest(BaseModel):
    crop: str
    buyer_type: Optional[str] = None
    days: int = 30

class TransportDemandRequest(BaseModel):
    origin: str
    destination: str
    days: int = 7

class ForecastResponse(BaseModel):
    forecast_date: datetime
    forecast_period_days: int
    predictions: List[Dict[str, Any]]
    quantiles: Dict[str, List[float]]
    recommendation: str
    explanation: str
    confidence: float

class AnomalyDetectionRequest(BaseModel):
    crop: str
    market: str
    current_price: float
    historical_prices: List[Dict[str, Any]]

# Forecasting models using statistical methods (no Prophet dependency)
class ForecastingEngine:
    """Main forecasting engine using statistical models (works without Prophet)"""
    
    @staticmethod
    def _calculate_mean(values: List[float]) -> float:
        """Calculate mean"""
        return sum(values) / len(values) if values else 0.0
    
    @staticmethod
    def _calculate_std(values: List[float]) -> float:
        """Calculate standard deviation"""
        if not values or len(values) < 2:
            return 0.0
        mean = ForecastingEngine._calculate_mean(values)
        variance = sum((x - mean) ** 2 for x in values) / (len(values) - 1)
        return math.sqrt(variance)
    
    @staticmethod
    def _calculate_trend(prices: List[float]) -> float:
        """Calculate linear trend"""
        if len(prices) < 2:
            return 0.0
        n = len(prices)
        x_mean = (n - 1) / 2
        y_mean = ForecastingEngine._calculate_mean(prices)
        
        numerator = sum((i - x_mean) * (prices[i] - y_mean) for i in range(n))
        denominator = sum((i - x_mean) ** 2 for i in range(n))
        
        return numerator / denominator if denominator != 0 else 0.0
    
    @staticmethod
    def _seasonal_factor(day_of_year: int) -> float:
        """Simple seasonal adjustment"""
        # Simulate seasonal patterns (harvest seasons, etc.)
        return 1.0 + 0.1 * math.sin(2 * math.pi * day_of_year / 365)
    
    @staticmethod
    def forecast_price(
        crop: str,
        market: str,
        days: int,
        historical_data: Optional[List[Dict]] = None
    ) -> Dict[str, Any]:
        """
        Forecast price using statistical time-series methods
        Returns probabilistic forecast with quantiles
        """
        try:
            # If no historical data provided, generate synthetic for demo
            if not historical_data:
                historical_data = ForecastingEngine._generate_synthetic_prices(days * 2)
            
            # Extract prices and dates
            prices = []
            dates = []
            for item in historical_data:
                price = item.get('price', item.get('pricePerKg', 300.0))
                if isinstance(price, (int, float)):
                    prices.append(float(price))
                date_str = item.get('date', item.get('observedAt', datetime.now().isoformat()))
                dates.append(date_str)
            
            if not prices:
                prices = [300.0] * 30  # Default fallback
            
            # Calculate statistics
            mean_price = ForecastingEngine._calculate_mean(prices)
            std_price = ForecastingEngine._calculate_std(prices)
            trend = ForecastingEngine._calculate_trend(prices[-min(30, len(prices)):])
            current_price = prices[-1] if prices else mean_price
            
            # Generate forecasts
            predictions = []
            base_date = datetime.now()
            
            for i in range(1, days + 1):
                forecast_date = base_date + timedelta(days=i)
                day_of_year = forecast_date.timetuple().tm_yday
                
                # Forecast value: current + trend + seasonal + noise
                forecast_value = current_price + (trend * i) + (ForecastingEngine._seasonal_factor(day_of_year) - 1.0) * mean_price
                
                # Add uncertainty bounds
                uncertainty = std_price * (1.0 + 0.1 * i)  # Uncertainty grows with time
                lower_bound = max(0, forecast_value - 1.28 * uncertainty)  # ~80% confidence
                upper_bound = forecast_value + 1.28 * uncertainty
                
                predictions.append({
                    'date': forecast_date.isoformat(),
                    'median': round(forecast_value, 2),
                    'lower_bound': round(lower_bound, 2),
                    'upper_bound': round(upper_bound, 2)
                })
            
            # Calculate quantiles
            medians = [p['median'] for p in predictions]
            quantiles = {
                'q10': [p['lower_bound'] for p in predictions],
                'q50': medians,
                'q90': [p['upper_bound'] for p in predictions]
            }
            
            # Generate recommendation
            avg_forecast = ForecastingEngine._calculate_mean(medians)
            price_change_pct = ((avg_forecast - current_price) / current_price) * 100 if current_price > 0 else 0
            
            if price_change_pct > 5:
                recommendation = "Hold"
                explanation = f"Forecasted price median {avg_forecast:.0f} RWF/kg over next {days} days with {abs(price_change_pct):.1f}% expected increase. Consider holding for better price."
            elif price_change_pct < -5:
                recommendation = "Sell Now"
                explanation = f"Forecasted price median {avg_forecast:.0f} RWF/kg over next {days} days with {abs(price_change_pct):.1f}% expected decrease. Recommend selling now to avoid price drop."
            else:
                recommendation = "Monitor"
                explanation = f"Forecasted price median {avg_forecast:.0f} RWF/kg over next {days} days with stable trend. Monitor market conditions."
            
            confidence = min(0.95, 0.7 + (len(historical_data) / 100) * 0.25)
            
            return {
                'forecast_date': datetime.now().isoformat(),
                'forecast_period_days': days,
                'predictions': predictions,
                'quantiles': quantiles,
                'recommendation': recommendation,
                'explanation': explanation,
                'confidence': round(confidence, 2)
            }
            
        except Exception as e:
            logger.error(f"Error in price forecasting: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Forecasting error: {str(e)}")
    
    @staticmethod
    def forecast_supply(
        crop: str,
        district: str,
        expected_harvests: Optional[List[Dict]] = None,
        historical_yields: Optional[List[Dict]] = None
    ) -> Dict[str, Any]:
        """
        Forecast supply using expected harvests and historical yields
        """
        try:
            # Aggregate expected harvests
            total_expected = 0.0
            if expected_harvests:
                total_expected = sum(float(h.get('quantity', h.get('expectedQuantityKg', 0))) for h in expected_harvests)
            
            # Use historical yields to adjust forecast
            adjustment_factor = 1.0
            if historical_yields and len(historical_yields) > 0:
                historical_values = [float(h.get('yield', h.get('quantityKg', 0))) for h in historical_yields]
                avg_historical = ForecastingEngine._calculate_mean(historical_values)
                if avg_historical > 0 and total_expected > 0:
                    # Simple adjustment based on historical average
                    adjustment_factor = min(1.2, max(0.8, total_expected / avg_historical))
            
            forecasted_supply = total_expected * adjustment_factor
            
            # Generate distribution
            std_dev = forecasted_supply * 0.15  # 15% standard deviation
            quantiles = {
                'q10': max(0, forecasted_supply - 1.28 * std_dev),
                'q50': forecasted_supply,
                'q90': forecasted_supply + 1.28 * std_dev
            }
            
            return {
                'forecast_date': datetime.now().isoformat(),
                'crop': crop,
                'district': district,
                'forecasted_supply_kg': round(forecasted_supply, 2),
                'quantiles': {k: round(v, 2) for k, v in quantiles.items()},
                'expected_harvests_count': len(expected_harvests) if expected_harvests else 0,
                'confidence': 0.75
            }
            
        except Exception as e:
            logger.error(f"Error in supply forecasting: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Supply forecasting error: {str(e)}")
    
    @staticmethod
    def detect_anomaly(
        crop: str,
        market: str,
        current_price: float,
        historical_prices: List[Dict]
    ) -> Dict[str, Any]:
        """
        Detect price anomalies using statistical methods
        """
        try:
            if not historical_prices or len(historical_prices) < 10:
                return {
                    'is_anomaly': False,
                    'reason': 'Insufficient historical data',
                    'severity': 'low'
                }
            
            prices = [float(p.get('price', p.get('pricePerKg', 0))) for p in historical_prices]
            if len(prices) < 10:
                return {
                    'is_anomaly': False,
                    'reason': 'Insufficient historical data',
                    'severity': 'low'
                }
            
            mean_price = ForecastingEngine._calculate_mean(prices)
            std_price = ForecastingEngine._calculate_std(prices)
            z_score = (current_price - mean_price) / std_price if std_price > 0 else 0.0
            
            is_anomaly = abs(z_score) > 2.5
            severity = 'high' if abs(z_score) > 3.5 else 'medium' if abs(z_score) > 2.5 else 'low'
            
            reason = ""
            if z_score > 2.5:
                reason = f"Price spike detected: {current_price:.0f} RWF/kg is {z_score:.2f} standard deviations above mean ({mean_price:.0f} RWF/kg)"
            elif z_score < -2.5:
                reason = f"Price drop detected: {current_price:.0f} RWF/kg is {abs(z_score):.2f} standard deviations below mean ({mean_price:.0f} RWF/kg)"
            else:
                reason = "Price within normal range"
            
            return {
                'is_anomaly': is_anomaly,
                'z_score': round(z_score, 2),
                'current_price': round(current_price, 2),
                'mean_price': round(mean_price, 2),
                'std_price': round(std_price, 2),
                'reason': reason,
                'severity': severity
            }
            
        except Exception as e:
            logger.error(f"Error in anomaly detection: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Anomaly detection error: {str(e)}")
    
    @staticmethod
    def _generate_synthetic_prices(n: int) -> List[Dict]:
        """Generate synthetic price data for demonstration"""
        base_price = 300.0
        trend = 0.5
        dates = []
        prices = []
        
        for i in range(n):
            date = datetime.now() - timedelta(days=n - i)
            dates.append(date.isoformat())
            # Generate price with trend and noise
            price = base_price + (trend * i) + random.gauss(0, 15)
            prices.append(max(100, price))  # Ensure positive prices
        
        return [
            {
                'date': date,
                'price': price,
                'observedAt': date,
                'pricePerKg': price
            }
            for date, price in zip(dates, prices)
        ]

# API Endpoints
@app.get("/")
async def root():
    return {
        "service": "RASS Forecasting Service",
        "version": "2.0.0",
        "status": "operational",
        "capabilities": [
            "price_forecast",
            "enhanced_price_forecast",
            "supply_forecast",
            "demand_forecast",
            "anomaly_detection"
        ],
        "note": "ML-enhanced price prediction with trend, volatility, and recommendations"
    }

@app.get("/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

@app.post("/forecast/price", response_model=ForecastResponse)
async def forecast_price_legacy(request: PriceForecastRequest):
    """Legacy price forecast endpoint (for backward compatibility)"""
    logger.info(f"Legacy price forecast request: {request.crop} in {request.market} for {request.days} days")
    result = ForecastingEngine.forecast_price(
        crop=request.crop,
        market=request.market,
        days=request.days,
        historical_data=request.historical_prices
    )
    return ForecastResponse(**result)


@app.post("/forecast/price/enhanced", response_model=EnhancedForecastResponse)
async def forecast_price_enhanced(request: EnhancedPriceForecastRequest):
    """
    Enhanced ML-powered price forecast with Rwanda-specific factors.
    
    Returns:
    - Price predictions with confidence intervals (10th-90th percentile)
    - Trend direction: UP, STABLE, DOWN
    - Volatility level: LOW, MEDIUM, HIGH
    - Actionable recommendation: Sell Now, Hold, Monitor
    - Human-readable explanation with top contributing factors
    """
    logger.info(f"Enhanced price forecast: {request.crop} in {request.market} for {request.days} days")
    
    try:
        # Generate synthetic data if no historical data provided
        historical_data = request.historical_prices
        if not historical_data:
            historical_data = ForecastingEngine._generate_synthetic_prices(30)
        
        # Call the ML model
        result = predict_price(
            historical_data=historical_data,
            forecast_days=request.days,
            market_info=request.market_info,
            external_info=request.external_factors
        )
        
        return EnhancedForecastResponse(**result)
        
    except Exception as e:
        logger.error(f"Enhanced forecast error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Forecast error: {str(e)}")

@app.post("/forecast/supply")
async def forecast_supply(request: SupplyForecastRequest):
    """Forecast supply for a crop in a district"""
    logger.info(f"Supply forecast request: {request.crop} in {request.district}")
    result = ForecastingEngine.forecast_supply(
        crop=request.crop,
        district=request.district,
        expected_harvests=request.expected_harvests,
        historical_yields=request.historical_yields
    )
    return result

@app.post("/forecast/demand")
async def forecast_demand(request: DemandForecastRequest):
    """Forecast demand for a crop"""
    logger.info(f"Demand forecast request: {request.crop} for {request.days} days")
    # Simplified demand forecasting
    base_demand = 1000.0  # kg
    day_of_year = datetime.now().timetuple().tm_yday
    seasonal_factor = 1.0 + 0.2 * math.sin(2 * math.pi * day_of_year / 365)
    
    return {
        'forecast_date': datetime.now().isoformat(),
        'crop': request.crop,
        'forecast_period_days': request.days,
        'forecasted_demand_kg': round(base_demand * seasonal_factor * request.days, 2),
        'confidence': 0.70
    }

@app.post("/forecast/transport-demand")
async def forecast_transport_demand(request: TransportDemandRequest):
    """Forecast transport demand for a route"""
    logger.info(f"Transport demand forecast: {request.origin} to {request.destination}")
    # Simplified transport demand forecasting
    base_demand = 5.0  # trips per day
    
    daily_demands = []
    for i in range(request.days):
        # Add some variance
        variance = random.gauss(0, 1)
        daily_demands.append(max(0, base_demand + variance))
    
    return {
        'forecast_date': datetime.now().isoformat(),
        'origin': request.origin,
        'destination': request.destination,
        'forecast_period_days': request.days,
        'daily_demand_trips': [round(d, 2) for d in daily_demands],
        'total_demand_trips': round(sum(daily_demands), 2),
        'confidence': 0.65
    }

@app.post("/detect/anomaly")
async def detect_anomaly(request: AnomalyDetectionRequest):
    """Detect price anomalies"""
    logger.info(f"Anomaly detection request: {request.crop} in {request.market}")
    result = ForecastingEngine.detect_anomaly(
        crop=request.crop,
        market=request.market,
        current_price=request.current_price,
        historical_prices=request.historical_prices
    )
    return result

@app.get("/forecast/batch")
async def batch_forecast(
    crops: str = Query(..., description="Comma-separated list of crops"),
    markets: str = Query(..., description="Comma-separated list of markets"),
    days: int = Query(7, description="Forecast period in days")
):
    """Batch forecast for multiple crops and markets"""
    crop_list = [c.strip() for c in crops.split(',')]
    market_list = [m.strip() for m in markets.split(',')]
    
    results = []
    for crop in crop_list:
        for market in market_list:
            try:
                forecast = ForecastingEngine.forecast_price(crop, market, days)
                results.append({
                    'crop': crop,
                    'market': market,
                    **forecast
                })
            except Exception as e:
                logger.error(f"Error forecasting {crop} in {market}: {str(e)}")
                results.append({
                    'crop': crop,
                    'market': market,
                    'error': str(e)
                })
    
    return {
        'forecast_date': datetime.now().isoformat(),
        'forecasts': results
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
