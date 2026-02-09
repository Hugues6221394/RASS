"""
RASS Price Prediction Model
Pure Python implementation for agricultural price forecasting
Optimized for Rwanda's agricultural markets with short-term forecasts (1-14 days)
"""

from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
from enum import Enum
import math
import logging

logger = logging.getLogger(__name__)


# ============================================================================
# DATA STRUCTURES
# ============================================================================

class Trend(Enum):
    UP = "UP"
    STABLE = "STABLE"
    DOWN = "DOWN"


class Volatility(Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class Recommendation(Enum):
    SELL_NOW = "Sell Now"
    HOLD = "Hold"
    MONITOR = "Monitor"


@dataclass
class PricePoint:
    """Single price observation"""
    date: datetime
    price: float
    market: str = ""
    crop: str = ""


@dataclass
class MarketFeatures:
    """Rwanda-specific market features"""
    market_name: str
    distance_to_kigali_km: float = 0.0
    is_urban: bool = False
    road_quality: str = "paved"  # paved, gravel, dirt
    latitude: float = 0.0
    longitude: float = 0.0


@dataclass
class ExternalFactors:
    """External factors affecting prices"""
    rainfall_mm: float = 0.0
    rainfall_anomaly: float = 0.0  # deviation from historical average
    fuel_price_index: float = 1.0  # normalized, 1.0 = baseline
    transport_cost_per_km: float = 50.0  # RWF per km per kg
    season: str = "normal"  # planting, harvesting, lean, normal
    expected_supply_kg: float = 0.0
    buyer_demand_index: float = 1.0  # normalized, 1.0 = baseline


@dataclass
class PredictionResult:
    """Single day prediction"""
    date: str
    median: float
    lower_bound: float
    upper_bound: float


@dataclass
class ForecastOutput:
    """Complete forecast output matching API contract"""
    forecast_date: str
    forecast_period_days: int
    predictions: List[Dict[str, Any]]
    trend: str
    volatility: str
    confidence: float
    recommendation: str
    explanation: str
    top_factors: List[str] = field(default_factory=list)


# ============================================================================
# UTILITY FUNCTIONS (Pure Python)
# ============================================================================

def mean(values: List[float]) -> float:
    """Calculate arithmetic mean"""
    if not values:
        return 0.0
    return sum(values) / len(values)


def std_dev(values: List[float]) -> float:
    """Calculate sample standard deviation"""
    if len(values) < 2:
        return 0.0
    m = mean(values)
    variance = sum((x - m) ** 2 for x in values) / (len(values) - 1)
    return math.sqrt(variance)


def percentile(values: List[float], p: float) -> float:
    """Calculate percentile (0-100)"""
    if not values:
        return 0.0
    sorted_vals = sorted(values)
    n = len(sorted_vals)
    k = (n - 1) * (p / 100.0)
    f = math.floor(k)
    c = math.ceil(k)
    if f == c:
        return sorted_vals[int(k)]
    return sorted_vals[int(f)] * (c - k) + sorted_vals[int(c)] * (k - f)


def linear_regression(x: List[float], y: List[float]) -> Tuple[float, float]:
    """Simple linear regression, returns (slope, intercept)"""
    if len(x) != len(y) or len(x) < 2:
        return 0.0, mean(y) if y else 0.0
    
    n = len(x)
    x_mean = mean(x)
    y_mean = mean(y)
    
    numerator = sum((x[i] - x_mean) * (y[i] - y_mean) for i in range(n))
    denominator = sum((x[i] - x_mean) ** 2 for i in range(n))
    
    if denominator == 0:
        return 0.0, y_mean
    
    slope = numerator / denominator
    intercept = y_mean - slope * x_mean
    return slope, intercept


def rolling_mean(values: List[float], window: int) -> List[float]:
    """Calculate rolling mean with specified window"""
    if not values or window <= 0:
        return []
    
    result = []
    for i in range(len(values)):
        start = max(0, i - window + 1)
        result.append(mean(values[start:i + 1]))
    return result


# ============================================================================
# FEATURE ENGINEERING
# ============================================================================

class FeatureEngineer:
    """Generates features from raw price data and external factors"""
    
    @staticmethod
    def create_lag_features(prices: List[float], lags: List[int] = [1, 3, 7]) -> Dict[str, float]:
        """Create lagged price features"""
        features = {}
        current_price = prices[-1] if prices else 0.0
        
        for lag in lags:
            if len(prices) > lag:
                features[f"price_lag_{lag}"] = prices[-lag - 1]
                features[f"price_change_{lag}d"] = current_price - prices[-lag - 1]
                features[f"price_pct_change_{lag}d"] = (
                    (current_price - prices[-lag - 1]) / prices[-lag - 1] * 100
                    if prices[-lag - 1] != 0 else 0.0
                )
            else:
                features[f"price_lag_{lag}"] = current_price
                features[f"price_change_{lag}d"] = 0.0
                features[f"price_pct_change_{lag}d"] = 0.0
        
        return features
    
    @staticmethod
    def create_rolling_features(prices: List[float]) -> Dict[str, float]:
        """Create rolling statistics features"""
        features = {}
        
        # Rolling means
        for window in [7, 14, 30]:
            if len(prices) >= window:
                features[f"rolling_mean_{window}d"] = mean(prices[-window:])
                features[f"rolling_std_{window}d"] = std_dev(prices[-window:])
            else:
                features[f"rolling_mean_{window}d"] = mean(prices) if prices else 0.0
                features[f"rolling_std_{window}d"] = std_dev(prices) if prices else 0.0
        
        # Momentum
        if len(prices) >= 7:
            short_ma = mean(prices[-7:])
            long_ma = mean(prices[-14:]) if len(prices) >= 14 else mean(prices)
            features["momentum"] = short_ma - long_ma
        else:
            features["momentum"] = 0.0
        
        # Volatility (coefficient of variation)
        if prices:
            m = mean(prices[-14:]) if len(prices) >= 14 else mean(prices)
            s = std_dev(prices[-14:]) if len(prices) >= 14 else std_dev(prices)
            features["volatility_cv"] = s / m if m != 0 else 0.0
        else:
            features["volatility_cv"] = 0.0
        
        return features
    
    @staticmethod
    def create_seasonal_features(date: datetime) -> Dict[str, float]:
        """Create seasonal features"""
        day_of_year = date.timetuple().tm_yday
        
        # Rwanda seasons: Season A (Sep-Jan), Season B (Feb-Jun), Dry (Jul-Aug)
        month = date.month
        if month in [9, 10, 11, 12, 1]:
            season_code = 0  # Season A (main harvest)
            season_name = "harvesting"
        elif month in [2, 3, 4, 5, 6]:
            season_code = 1  # Season B
            season_name = "planting"
        else:
            season_code = 2  # Dry season
            season_name = "lean"
        
        return {
            "day_of_year": day_of_year,
            "month": month,
            "season_code": season_code,
            "season_name": season_name,
            "seasonal_sin": math.sin(2 * math.pi * day_of_year / 365),
            "seasonal_cos": math.cos(2 * math.pi * day_of_year / 365)
        }
    
    @staticmethod
    def create_market_features(market: MarketFeatures) -> Dict[str, float]:
        """Create market-related features"""
        return {
            "distance_to_kigali": market.distance_to_kigali_km,
            "is_urban": 1.0 if market.is_urban else 0.0,
            "road_quality_score": {"paved": 1.0, "gravel": 0.6, "dirt": 0.3}.get(
                market.road_quality, 0.5
            )
        }
    
    @staticmethod
    def create_external_features(factors: ExternalFactors) -> Dict[str, float]:
        """Create external factor features"""
        return {
            "rainfall_anomaly": factors.rainfall_anomaly,
            "fuel_price_index": factors.fuel_price_index,
            "transport_cost": factors.transport_cost_per_km,
            "expected_supply": factors.expected_supply_kg,
            "demand_index": factors.buyer_demand_index,
            "supply_demand_ratio": (
                factors.expected_supply_kg / max(factors.buyer_demand_index * 1000, 1)
            )
        }


# ============================================================================
# STATISTICAL MODEL (Double Exponential Smoothing / Holt's Linear)
# ============================================================================

class HoltLinearModel:
    """Double Exponential Smoothing for trend-aware forecasting"""
    
    def __init__(self, alpha: float = 0.3, beta: float = 0.1):
        self.alpha = alpha  # Level smoothing
        self.beta = beta    # Trend smoothing
        self.level = 0.0
        self.trend = 0.0
        self.fitted = False
    
    def fit(self, prices: List[float]) -> None:
        """Fit the model to historical prices"""
        if len(prices) < 2:
            self.level = prices[0] if prices else 0.0
            self.trend = 0.0
            self.fitted = True
            return
        
        # Initialize
        self.level = prices[0]
        self.trend = prices[1] - prices[0]
        
        # Update through all observations
        for i in range(1, len(prices)):
            prev_level = self.level
            self.level = self.alpha * prices[i] + (1 - self.alpha) * (self.level + self.trend)
            self.trend = self.beta * (self.level - prev_level) + (1 - self.beta) * self.trend
        
        self.fitted = True
    
    def forecast(self, steps: int) -> List[float]:
        """Generate forecasts for n steps ahead"""
        if not self.fitted:
            return [0.0] * steps
        
        forecasts = []
        for i in range(1, steps + 1):
            forecasts.append(self.level + self.trend * i)
        return forecasts


# ============================================================================
# PURE PYTHON RIDGE REGRESSION (ML Layer)
# ============================================================================

class RidgeRegression:
    """Pure Python Ridge Regression for residual correction"""
    
    def __init__(self, alpha: float = 1.0, learning_rate: float = 0.001, iterations: int = 1000):
        self.alpha = alpha  # Regularization strength
        self.lr = learning_rate
        self.iterations = iterations
        self.weights: List[float] = []
        self.bias: float = 0.0
        self.feature_names: List[str] = []
        self.trained = False
    
    def fit(self, X: List[List[float]], y: List[float], feature_names: List[str] = None) -> None:
        """Train the model using gradient descent"""
        if not X or not y or len(X) != len(y):
            return
        
        n_samples = len(X)
        n_features = len(X[0]) if X else 0
        
        if n_features == 0:
            return
        
        self.feature_names = feature_names or [f"feature_{i}" for i in range(n_features)]
        
        # Initialize weights
        self.weights = [0.0] * n_features
        self.bias = 0.0
        
        # Gradient descent
        for _ in range(self.iterations):
            # Forward pass
            predictions = []
            for i in range(n_samples):
                pred = self.bias + sum(self.weights[j] * X[i][j] for j in range(n_features))
                predictions.append(pred)
            
            # Compute gradients
            dw = [0.0] * n_features
            db = 0.0
            
            for i in range(n_samples):
                error = predictions[i] - y[i]
                for j in range(n_features):
                    dw[j] += (error * X[i][j] + self.alpha * self.weights[j]) / n_samples
                db += error / n_samples
            
            # Update weights
            for j in range(n_features):
                self.weights[j] -= self.lr * dw[j]
            self.bias -= self.lr * db
        
        self.trained = True
    
    def predict(self, X: List[List[float]]) -> List[float]:
        """Make predictions"""
        if not self.trained or not X:
            return [0.0] * len(X)
        
        predictions = []
        for x in X:
            pred = self.bias + sum(self.weights[j] * x[j] for j in range(len(self.weights)))
            predictions.append(pred)
        return predictions
    
    def get_feature_importance(self) -> Dict[str, float]:
        """Get feature importance (absolute weights)"""
        if not self.trained:
            return {}
        return {name: abs(w) for name, w in zip(self.feature_names, self.weights)}
    
    def get_feature_contributions(self, x: List[float]) -> Dict[str, float]:
        """Get contribution of each feature to the prediction"""
        if not self.trained:
            return {}
        return {name: w * x[i] for i, (name, w) in enumerate(zip(self.feature_names, self.weights))}


# ============================================================================
# UNCERTAINTY ESTIMATION
# ============================================================================

class UncertaintyEstimator:
    """Estimates prediction intervals using residual analysis"""
    
    @staticmethod
    def bootstrap_intervals(
        predictions: List[float],
        historical_errors: List[float],
        confidence: float = 0.8
    ) -> List[Tuple[float, float]]:
        """Generate prediction intervals using historical errors"""
        if not historical_errors:
            # Default 10% uncertainty
            return [(p * 0.9, p * 1.1) for p in predictions]
        
        error_std = std_dev(historical_errors)
        alpha = 1 - confidence
        z_score = 1.28 if confidence == 0.8 else 1.645 if confidence == 0.9 else 1.96
        
        intervals = []
        for i, pred in enumerate(predictions):
            # Uncertainty grows with forecast horizon
            horizon_factor = 1 + 0.05 * i
            margin = z_score * error_std * horizon_factor
            intervals.append((max(0, pred - margin), pred + margin))
        
        return intervals
    
    @staticmethod
    def calculate_volatility_score(prices: List[float]) -> float:
        """Calculate volatility score (0-1)"""
        if len(prices) < 2:
            return 0.5
        
        cv = std_dev(prices) / mean(prices) if mean(prices) != 0 else 0
        # Normalize to 0-1 (assuming CV rarely exceeds 0.5)
        return min(1.0, cv * 2)


# ============================================================================
# EXPLAINABILITY ENGINE
# ============================================================================

class Explainer:
    """Generates human-readable explanations for predictions"""
    
    FACTOR_EXPLANATIONS = {
        "rainfall_anomaly": {
            "positive": "higher than normal rainfall improving crop yields",
            "negative": "below average rainfall affecting supply"
        },
        "fuel_price_index": {
            "positive": "rising fuel prices increasing transport costs",
            "negative": "lower fuel prices reducing transport costs"
        },
        "demand_index": {
            "positive": "increased buyer demand",
            "negative": "reduced buyer demand"
        },
        "expected_supply": {
            "positive": "higher expected harvest volumes",
            "negative": "lower than expected supply"
        },
        "momentum": {
            "positive": "recent upward price trend",
            "negative": "recent downward price trend"
        },
        "distance_to_kigali": {
            "positive": "distance from major markets increasing costs",
            "negative": "proximity to major markets"
        },
        "supply_demand_ratio": {
            "positive": "supply exceeding demand",
            "negative": "demand exceeding supply"
        },
        "seasonal_sin": {
            "positive": "seasonal harvest timing",
            "negative": "off-season period"
        }
    }
    
    @classmethod
    def generate_explanation(
        cls,
        trend: Trend,
        contributions: Dict[str, float],
        confidence: float,
        forecast_days: int
    ) -> Tuple[str, List[str]]:
        """Generate explanation and top factors"""
        
        # Sort contributions by absolute value
        sorted_factors = sorted(
            contributions.items(),
            key=lambda x: abs(x[1]),
            reverse=True
        )[:3]  # Top 3 factors
        
        top_factors = []
        explanations = []
        
        for factor_name, contribution in sorted_factors:
            direction = "positive" if contribution > 0 else "negative"
            if factor_name in cls.FACTOR_EXPLANATIONS:
                exp = cls.FACTOR_EXPLANATIONS[factor_name][direction]
                top_factors.append(f"{factor_name}: {exp}")
                explanations.append(exp)
        
        # Build main explanation
        trend_text = {
            Trend.UP: "expected to rise",
            Trend.DOWN: "expected to fall",
            Trend.STABLE: "expected to remain stable"
        }[trend]
        
        main_explanation = f"Prices are {trend_text} over the next {forecast_days} days"
        
        if explanations:
            main_explanation += f" due to {', '.join(explanations[:2])}"
            if len(explanations) > 2:
                main_explanation += f", and {explanations[2]}"
        
        main_explanation += "."
        
        return main_explanation, top_factors


# ============================================================================
# DECISION LOGIC
# ============================================================================

class DecisionEngine:
    """Translates forecasts into actionable recommendations"""
    
    @staticmethod
    def get_recommendation(
        current_price: float,
        forecast_median: float,
        volatility_score: float,
        confidence: float
    ) -> Recommendation:
        """Generate trading recommendation"""
        
        if current_price <= 0:
            return Recommendation.MONITOR
        
        price_change_pct = ((forecast_median - current_price) / current_price) * 100
        
        # High volatility = more cautious
        threshold_high = 5 if volatility_score < 0.5 else 8
        threshold_low = -5 if volatility_score < 0.5 else -8
        
        # Low confidence = default to Monitor
        if confidence < 0.6:
            return Recommendation.MONITOR
        
        if price_change_pct > threshold_high:
            return Recommendation.HOLD
        elif price_change_pct < threshold_low:
            return Recommendation.SELL_NOW
        else:
            return Recommendation.MONITOR
    
    @staticmethod
    def determine_trend(predictions: List[float]) -> Trend:
        """Determine overall trend from predictions"""
        if len(predictions) < 2:
            return Trend.STABLE
        
        slope, _ = linear_regression(
            list(range(len(predictions))),
            predictions
        )
        
        # Normalize slope by price level
        avg_price = mean(predictions)
        normalized_slope = (slope / avg_price * 100) if avg_price != 0 else 0
        
        if normalized_slope > 0.5:
            return Trend.UP
        elif normalized_slope < -0.5:
            return Trend.DOWN
        else:
            return Trend.STABLE
    
    @staticmethod
    def classify_volatility(score: float) -> Volatility:
        """Classify volatility level"""
        if score < 0.3:
            return Volatility.LOW
        elif score < 0.6:
            return Volatility.MEDIUM
        else:
            return Volatility.HIGH


# ============================================================================
# MAIN PRICE PREDICTION MODEL
# ============================================================================

class RASSPriceModel:
    """
    Main price prediction model combining:
    1. Statistical baseline (Holt's Linear)
    2. ML residual correction (Ridge Regression)
    3. Uncertainty estimation
    4. Explainability
    """
    
    def __init__(self):
        self.statistical_model = HoltLinearModel(alpha=0.3, beta=0.1)
        self.ml_model = RidgeRegression(alpha=1.0, learning_rate=0.001, iterations=500)
        self.feature_engineer = FeatureEngineer()
        self.trained = False
        self.historical_errors: List[float] = []
    
    def train(
        self,
        historical_prices: List[PricePoint],
        market_features: MarketFeatures = None,
        external_factors: ExternalFactors = None
    ) -> bool:
        """Train the model on historical data"""
        try:
            if len(historical_prices) < 7:
                logger.warning("Insufficient data for training, using defaults")
                return False
            
            # Sort by date
            sorted_prices = sorted(historical_prices, key=lambda x: x.date)
            prices = [p.price for p in sorted_prices]
            
            # Fit statistical model
            self.statistical_model.fit(prices)
            
            # Prepare features for ML model (if enough data)
            if len(prices) >= 14:
                X = []
                y = []  # Residuals from statistical model
                
                # Create training samples
                for i in range(14, len(prices)):
                    # Get statistical forecast for this point
                    temp_model = HoltLinearModel()
                    temp_model.fit(prices[:i-1])
                    stat_forecast = temp_model.forecast(1)[0]
                    
                    # Residual is actual - forecast
                    residual = prices[i] - stat_forecast
                    
                    # Generate features
                    features = []
                    lag_feats = self.feature_engineer.create_lag_features(prices[:i])
                    roll_feats = self.feature_engineer.create_rolling_features(prices[:i])
                    
                    features.extend([
                        lag_feats.get("price_pct_change_1d", 0),
                        lag_feats.get("price_pct_change_7d", 0),
                        roll_feats.get("momentum", 0),
                        roll_feats.get("volatility_cv", 0),
                    ])
                    
                    # Add external features if available
                    if external_factors:
                        ext_feats = self.feature_engineer.create_external_features(external_factors)
                        features.extend([
                            ext_feats.get("rainfall_anomaly", 0),
                            ext_feats.get("fuel_price_index", 1),
                            ext_feats.get("supply_demand_ratio", 1),
                        ])
                    else:
                        features.extend([0, 1, 1])  # Defaults
                    
                    X.append(features)
                    y.append(residual)
                
                # Train ML model
                feature_names = [
                    "price_pct_change_1d", "price_pct_change_7d", "momentum", "volatility_cv",
                    "rainfall_anomaly", "fuel_price_index", "supply_demand_ratio"
                ]
                self.ml_model.fit(X, y, feature_names)
                
                # Store historical errors for uncertainty estimation
                if self.ml_model.trained:
                    predictions = self.ml_model.predict(X)
                    self.historical_errors = [y[i] - predictions[i] for i in range(len(y))]
            
            self.trained = True
            return True
            
        except Exception as e:
            logger.error(f"Training error: {e}")
            return False
    
    def predict(
        self,
        historical_prices: List[PricePoint],
        forecast_days: int,
        market_features: MarketFeatures = None,
        external_factors: ExternalFactors = None
    ) -> ForecastOutput:
        """Generate price forecast"""
        
        # Ensure we have data
        if not historical_prices:
            # Return default forecast
            return self._default_forecast(forecast_days)
        
        # Sort and extract prices
        sorted_prices = sorted(historical_prices, key=lambda x: x.date)
        prices = [p.price for p in sorted_prices]
        current_price = prices[-1]
        current_date = sorted_prices[-1].date
        
        # Train if not already trained
        if not self.trained:
            self.train(historical_prices, market_features, external_factors)
            # If still not trained, use simple forecast
            if not self.trained:
                self.statistical_model.fit(prices)
        
        # Generate base forecast
        base_forecasts = self.statistical_model.forecast(forecast_days)
        
        # Apply ML correction if available
        if self.ml_model.trained:
            features = self._prepare_features(prices, external_factors)
            corrections = self.ml_model.predict([features] * forecast_days)
            forecasts = [base_forecasts[i] + corrections[i] for i in range(forecast_days)]
            contributions = self.ml_model.get_feature_contributions(features)
        else:
            forecasts = base_forecasts
            contributions = {}
        
        # Ensure no negative prices
        forecasts = [max(10, f) for f in forecasts]
        
        # Calculate uncertainty intervals
        intervals = UncertaintyEstimator.bootstrap_intervals(
            forecasts,
            self.historical_errors,
            confidence=0.8
        )
        
        # Calculate volatility
        volatility_score = UncertaintyEstimator.calculate_volatility_score(prices[-30:])
        
        # Determine trend
        trend = DecisionEngine.determine_trend(forecasts)
        volatility = DecisionEngine.classify_volatility(volatility_score)
        
        # Calculate confidence
        data_confidence = min(0.95, 0.5 + len(prices) / 100)
        model_confidence = 0.8 if self.ml_model.trained else 0.6
        confidence = (data_confidence + model_confidence) / 2
        
        # Get recommendation
        avg_forecast = mean(forecasts)
        recommendation = DecisionEngine.get_recommendation(
            current_price, avg_forecast, volatility_score, confidence
        )
        
        # Generate explanation
        explanation, top_factors = Explainer.generate_explanation(
            trend, contributions, confidence, forecast_days
        )
        
        # Build predictions list
        predictions = []
        for i in range(forecast_days):
            forecast_date = current_date + timedelta(days=i + 1)
            predictions.append({
                "date": forecast_date.strftime("%Y-%m-%d"),
                "median": round(forecasts[i], 2),
                "lower_bound": round(intervals[i][0], 2),
                "upper_bound": round(intervals[i][1], 2)
            })
        
        return ForecastOutput(
            forecast_date=datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
            forecast_period_days=forecast_days,
            predictions=predictions,
            trend=trend.value,
            volatility=volatility.value,
            confidence=round(confidence, 2),
            recommendation=recommendation.value,
            explanation=explanation,
            top_factors=top_factors
        )
    
    def _prepare_features(
        self,
        prices: List[float],
        external_factors: ExternalFactors = None
    ) -> List[float]:
        """Prepare feature vector for ML model"""
        lag_feats = self.feature_engineer.create_lag_features(prices)
        roll_feats = self.feature_engineer.create_rolling_features(prices)
        
        features = [
            lag_feats.get("price_pct_change_1d", 0),
            lag_feats.get("price_pct_change_7d", 0),
            roll_feats.get("momentum", 0),
            roll_feats.get("volatility_cv", 0),
        ]
        
        if external_factors:
            ext_feats = self.feature_engineer.create_external_features(external_factors)
            features.extend([
                ext_feats.get("rainfall_anomaly", 0),
                ext_feats.get("fuel_price_index", 1),
                ext_feats.get("supply_demand_ratio", 1),
            ])
        else:
            features.extend([0, 1, 1])
        
        return features
    
    def _default_forecast(self, days: int) -> ForecastOutput:
        """Return default forecast when no data available"""
        base_price = 300.0
        predictions = []
        for i in range(days):
            predictions.append({
                "date": (datetime.now() + timedelta(days=i + 1)).strftime("%Y-%m-%d"),
                "median": base_price,
                "lower_bound": base_price * 0.9,
                "upper_bound": base_price * 1.1
            })
        
        return ForecastOutput(
            forecast_date=datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
            forecast_period_days=days,
            predictions=predictions,
            trend=Trend.STABLE.value,
            volatility=Volatility.MEDIUM.value,
            confidence=0.3,
            recommendation=Recommendation.MONITOR.value,
            explanation="Insufficient data for accurate forecast. Please provide historical prices.",
            top_factors=[]
        )


# ============================================================================
# CONVENIENCE FUNCTIONS FOR API INTEGRATION
# ============================================================================

# Global model instance
_model_instance: Optional[RASSPriceModel] = None


def get_model() -> RASSPriceModel:
    """Get or create model instance"""
    global _model_instance
    if _model_instance is None:
        _model_instance = RASSPriceModel()
    return _model_instance


def train_model(
    historical_data: List[Dict[str, Any]],
    market_info: Dict[str, Any] = None,
    external_info: Dict[str, Any] = None
) -> bool:
    """Train the model with historical data"""
    model = get_model()
    
    # Convert dict to PricePoint
    price_points = []
    for item in historical_data:
        try:
            date_str = item.get("date", item.get("observedAt", ""))
            if isinstance(date_str, str):
                # Try multiple date formats
                for fmt in ["%Y-%m-%dT%H:%M:%S", "%Y-%m-%d", "%Y-%m-%dT%H:%M:%S.%f"]:
                    try:
                        date = datetime.strptime(date_str[:19], fmt[:len(date_str)])
                        break
                    except ValueError:
                        continue
                else:
                    date = datetime.now()
            else:
                date = date_str
            
            price = float(item.get("price", item.get("pricePerKg", 0)))
            price_points.append(PricePoint(date=date, price=price))
        except Exception as e:
            logger.warning(f"Skipping invalid price point: {e}")
    
    market_features = None
    if market_info:
        market_features = MarketFeatures(
            market_name=market_info.get("name", ""),
            distance_to_kigali_km=market_info.get("distanceToKigali", 0),
            is_urban=market_info.get("isUrban", False),
            road_quality=market_info.get("roadQuality", "paved")
        )
    
    external_factors = None
    if external_info:
        external_factors = ExternalFactors(
            rainfall_anomaly=external_info.get("rainfallAnomaly", 0),
            fuel_price_index=external_info.get("fuelPriceIndex", 1),
            expected_supply_kg=external_info.get("expectedSupply", 0),
            buyer_demand_index=external_info.get("demandIndex", 1),
            season=external_info.get("season", "normal")
        )
    
    return model.train(price_points, market_features, external_factors)


def predict_price(
    historical_data: List[Dict[str, Any]],
    forecast_days: int = 7,
    market_info: Dict[str, Any] = None,
    external_info: Dict[str, Any] = None
) -> Dict[str, Any]:
    """Generate price prediction"""
    model = get_model()
    
    # Convert dict to PricePoint
    price_points = []
    for item in historical_data:
        try:
            date_str = item.get("date", item.get("observedAt", ""))
            if isinstance(date_str, str):
                for fmt in ["%Y-%m-%dT%H:%M:%S", "%Y-%m-%d", "%Y-%m-%dT%H:%M:%S.%f"]:
                    try:
                        date = datetime.strptime(date_str[:19], fmt[:len(date_str)])
                        break
                    except ValueError:
                        continue
                else:
                    date = datetime.now()
            else:
                date = date_str
            
            price = float(item.get("price", item.get("pricePerKg", 0)))
            price_points.append(PricePoint(date=date, price=price))
        except Exception as e:
            logger.warning(f"Skipping invalid price point: {e}")
    
    market_features = None
    if market_info:
        market_features = MarketFeatures(
            market_name=market_info.get("name", ""),
            distance_to_kigali_km=market_info.get("distanceToKigali", 0),
            is_urban=market_info.get("isUrban", False),
            road_quality=market_info.get("roadQuality", "paved")
        )
    
    external_factors = None
    if external_info:
        external_factors = ExternalFactors(
            rainfall_anomaly=external_info.get("rainfallAnomaly", 0),
            fuel_price_index=external_info.get("fuelPriceIndex", 1),
            expected_supply_kg=external_info.get("expectedSupply", 0),
            buyer_demand_index=external_info.get("demandIndex", 1),
            season=external_info.get("season", "normal")
        )
    
    forecast = model.predict(price_points, forecast_days, market_features, external_factors)
    
    # Convert to dict
    return {
        "forecast_date": forecast.forecast_date,
        "forecast_period_days": forecast.forecast_period_days,
        "predictions": forecast.predictions,
        "trend": forecast.trend,
        "volatility": forecast.volatility,
        "confidence": forecast.confidence,
        "recommendation": forecast.recommendation,
        "explanation": forecast.explanation,
        "top_factors": forecast.top_factors
    }
