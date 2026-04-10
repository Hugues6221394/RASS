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
import pandas as pd

logger = logging.getLogger(__name__)

# Try to import advanced ML libraries safely
try:
    from prophet import Prophet
    PROPHET_AVAILABLE = True
except ImportError:
    PROPHET_AVAILABLE = False
    logger.warning("Prophet not available. Falling back to Holt-Linear model.")

try:
    from statsmodels.tsa.statespace.sarimax import SARIMAX
    SARIMA_AVAILABLE = True
except ImportError:
    SARIMA_AVAILABLE = False
    logger.warning("statsmodels not available. SARIMA model disabled.")

try:
    from sklearn.ensemble import GradientBoostingRegressor
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False
    logger.warning("scikit-learn not available. Gradient boosting disabled.")

try:
    import xgboost as xgb
    XGBOOST_AVAILABLE = True
except (ImportError, Exception) as e:
    XGBOOST_AVAILABLE = False
    logger.warning(f"XGBoost not available: {e}")
    xgb = None

try:
    import lightgbm as lgb
    LIGHTGBM_AVAILABLE = True
except (ImportError, Exception) as e:
    LIGHTGBM_AVAILABLE = False
    logger.warning(f"LightGBM not available: {e}")
    lgb = None

try:
    import numpy as np
    NUMPY_AVAILABLE = True
except ImportError:
    NUMPY_AVAILABLE = False
    logger.warning("NumPy not available. LSTMLiteModel will use Holt-Linear fallback.")


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
# LSTM-LITE MODEL (Pure NumPy — single-layer Elman RNN with input gating)
# ============================================================================

class LSTMLiteModel:
    """
    Lightweight LSTM-inspired recurrent model using pure NumPy.

    Architecture: single-layer Elman RNN with a sigmoid input gate and tanh
    hidden activation — sufficient to capture short-term temporal patterns in
    agricultural price series.

    Falls back to HoltLinearModel when NumPy is unavailable or training fails.

    Public API
    ----------
    fit(prices: List[float])
    forecast(steps: int) -> List[float]
    """

    def __init__(self, hidden_size: int = 8, learning_rate: float = 0.01, epochs: int = 100):
        self.hidden_size = hidden_size
        self.lr = learning_rate
        self.epochs = epochs
        self._fitted = False
        self._fallback = HoltLinearModel()
        # Weight matrices — initialised during fit()
        self.Wx = None
        self.Wh = None
        self.b  = None
        self.Wy = None
        self.by = None
        self._h_last = None
        self._last_val = 0.0
        self._mu: float = 0.0
        self._sigma: float = 1.0

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _sigmoid(self, x):
        """Numerically-stable sigmoid."""
        return np.where(x >= 0, 1.0 / (1.0 + np.exp(-x)), np.exp(x) / (1.0 + np.exp(x)))

    def _normalise(self, prices: List[float]):
        arr = np.array(prices, dtype=np.float64)
        self._mu = float(arr.mean())
        self._sigma = float(arr.std()) + 1e-8
        return (arr - self._mu) / self._sigma

    def _denormalise(self, arr):
        return arr * self._sigma + self._mu

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def fit(self, prices: List[float]) -> None:
        """Train the model on a price series."""
        if not NUMPY_AVAILABLE:
            self._fallback.fit(prices)
            self._fitted = True
            return
        try:
            if len(prices) < 6:
                self._fallback.fit(prices)
                self._fitted = True
                return

            seq = self._normalise(prices)
            n   = len(seq)
            H   = self.hidden_size
            rng = np.random.default_rng(42)

            # Initialise weights (Xavier-ish)
            scale = 0.1
            self.Wx = rng.normal(0, scale, (H, 1))
            self.Wh = rng.normal(0, scale, (H, H))
            self.b  = np.zeros((H, 1))
            self.Wy = rng.normal(0, scale, (1, H))
            self.by = np.zeros((1, 1))

            # Truncated BPTT — one step at a time
            for _ in range(self.epochs):
                h = np.zeros((H, 1))
                dWx = np.zeros_like(self.Wx)
                dWh = np.zeros_like(self.Wh)
                db  = np.zeros_like(self.b)
                dWy = np.zeros_like(self.Wy)
                dby = np.zeros_like(self.by)

                for t in range(n - 1):
                    x_t    = np.array([[seq[t]]])
                    y_true = np.array([[seq[t + 1]]])

                    # Forward pass
                    z       = self.Wx @ x_t + self.Wh @ h + self.b
                    h_raw   = np.tanh(z)
                    gate    = self._sigmoid(z)          # input gate
                    h_new   = gate * h_raw + (1.0 - gate) * h
                    y_hat_m = self.Wy @ h_new + self.by   # (1,1) matrix — used in backprop

                    # Backward pass (one-step)
                    dy   = 2.0 * (y_hat_m - y_true)
                    dWy += dy * h_new.T
                    dby += dy
                    dh   = self.Wy.T @ dy
                    dz   = dh * (1.0 - np.tanh(z) ** 2)
                    dWx += dz @ x_t.T
                    dWh += dz @ h.T
                    db  += dz
                    h    = h_new

                # Gradient clipping + SGD update
                for param, grad in [(self.Wx, dWx), (self.Wh, dWh),
                                    (self.b, db), (self.Wy, dWy), (self.by, dby)]:
                    np.clip(grad, -1.0, 1.0, out=grad)
                    param -= self.lr * grad / max(n - 1, 1)

            # Cache final hidden state for warm-start forecasting
            h = np.zeros((H, 1))
            for t in range(n - 1):
                x_t  = np.array([[seq[t]]])
                z    = self.Wx @ x_t + self.Wh @ h + self.b
                h_rw = np.tanh(z)
                gate = self._sigmoid(z)
                h    = gate * h_rw + (1.0 - gate) * h

            self._h_last  = h
            self._last_val = float(seq[-1])
            self._fitted   = True

        except Exception as e:
            logger.warning(f"LSTMLiteModel training failed ({e}). Using Holt fallback.")
            self._fallback.fit(prices)
            self._fitted = True

    def forecast(self, steps: int) -> List[float]:
        """Autoregressively forecast `steps` values ahead."""
        if not NUMPY_AVAILABLE or self.Wx is None:
            return self._fallback.forecast(steps)
        try:
            h   = self._h_last.copy()
            val = self._last_val
            raw_preds: List[float] = []

            for _ in range(steps):
                x_t  = np.array([[val]])
                z    = self.Wx @ x_t + self.Wh @ h + self.b
                h_rw = np.tanh(z)
                gate = self._sigmoid(z)
                h    = gate * h_rw + (1.0 - gate) * h
                y_hat = float((self.Wy @ h + self.by).item())
                raw_preds.append(y_hat)
                val = y_hat

            return [float(self._denormalise(np.array([p]))[0]) for p in raw_preds]

        except Exception as e:
            logger.warning(f"LSTMLiteModel forecast failed ({e}). Using Holt fallback.")
            return self._fallback.forecast(steps)


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
# ENSEMBLE FORECASTER
# ============================================================================

class EnsembleForecaster:
    """
    Combines Prophet + SARIMA + GBR + LSTMLite + Holt-Winters into a single
    ensemble whose per-model weights are determined by inverse-RMSE from a
    walk-forward validation split.

    Public API
    ----------
    fit_and_weight(prices, dates=None)
    forecast(steps, prices, dates=None) -> Dict
        {
          "ensemble"       : [{"date", "price", "lower", "upper"}, ...],
          "models"         : {"prophet": [...], "sarima": [...], ...},
          "modelWeights"   : {"prophet": 0.35, ...},
          "bestModel"      : "prophet",
          "ensembleAccuracy": 0.87,
        }
    """

    MODEL_KEYS = ("prophet", "sarima", "gbr", "lstm", "holt")

    def __init__(self):
        self.holt_model  = HoltLinearModel(alpha=0.3, beta=0.1)
        self.lstm_model  = LSTMLiteModel(hidden_size=8, epochs=80)
        self.weights: Dict[str, float] = {}
        self._trained_prices: List[float] = []

    # ------------------------------------------------------------------
    # RMSE helper
    # ------------------------------------------------------------------
    @staticmethod
    def _rmse(actual: List[float], predicted: List[float]) -> float:
        if not actual or not predicted:
            return 1e6
        n = min(len(actual), len(predicted))
        return math.sqrt(sum((actual[i] - predicted[i]) ** 2 for i in range(n)) / n)

    # ------------------------------------------------------------------
    # Per-model runners (train + predict in one call for validation)
    # ------------------------------------------------------------------
    def _run_holt(self, train: List[float], steps: int) -> List[float]:
        m = HoltLinearModel(alpha=0.3, beta=0.1)
        m.fit(train)
        return m.forecast(steps)

    def _run_lstm(self, train: List[float], steps: int) -> List[float]:
        m = LSTMLiteModel(hidden_size=8, epochs=60)
        m.fit(train)
        return m.forecast(steps)

    def _run_sarima(self, train: List[float], steps: int) -> List[float]:
        if not SARIMA_AVAILABLE or len(train) < 14:
            return self._run_holt(train, steps)
        try:
            res = SARIMAX(
                train, order=(1, 1, 1), seasonal_order=(0, 1, 1, 7),
                enforce_stationarity=False, enforce_invertibility=False
            ).fit(disp=False)
            return [max(1.0, float(v)) for v in res.forecast(steps=steps)]
        except Exception:
            return self._run_holt(train, steps)

    def _run_gbr(self, train: List[float], steps: int) -> List[float]:
        if not SKLEARN_AVAILABLE or len(train) < 14:
            return self._run_holt(train, steps)
        try:
            fe = FeatureEngineer()
            X: List[List[float]] = []
            y: List[float] = []
            for i in range(7, len(train)):
                lag  = fe.create_lag_features(train[:i])
                roll = fe.create_rolling_features(train[:i])
                X.append([
                    lag.get("price_pct_change_1d", 0),
                    lag.get("price_pct_change_7d", 0),
                    roll.get("momentum", 0),
                    roll.get("volatility_cv", 0),
                ])
                y.append(train[i])
            if len(X) < 5:
                return self._run_holt(train, steps)
            gbr = GradientBoostingRegressor(
                random_state=42, n_estimators=100, learning_rate=0.05, max_depth=3
            )
            gbr.fit(X, y)
            history = list(train)
            preds: List[float] = []
            for _ in range(steps):
                lag  = fe.create_lag_features(history)
                roll = fe.create_rolling_features(history)
                feat = [
                    lag.get("price_pct_change_1d", 0),
                    lag.get("price_pct_change_7d", 0),
                    roll.get("momentum", 0),
                    roll.get("volatility_cv", 0),
                ]
                p = float(gbr.predict([feat])[0])
                preds.append(p)
                history.append(p)
            return preds
        except Exception:
            return self._run_holt(train, steps)

    def _run_prophet(
        self, train: List[float], steps: int, train_dates: List[datetime] = None
    ) -> List[float]:
        if not PROPHET_AVAILABLE or len(train) < 14:
            return self._run_holt(train, steps)
        try:
            if train_dates is None:
                train_dates = [
                    datetime.now() - timedelta(days=len(train) - i)
                    for i in range(len(train))
                ]
            df = pd.DataFrame({"ds": train_dates, "y": train})
            m = Prophet(
                daily_seasonality=False,
                weekly_seasonality=len(train) > 30,
                yearly_seasonality=len(train) > 365,
                changepoint_prior_scale=0.05,
            )
            m.fit(df)
            future = m.make_future_dataframe(periods=steps)
            fc = m.predict(future)
            return [max(1.0, float(v)) for v in fc["yhat"].tail(steps).tolist()]
        except Exception:
            return self._run_holt(train, steps)

    # ------------------------------------------------------------------
    # Fit & weight
    # ------------------------------------------------------------------
    def fit_and_weight(
        self, prices: List[float], dates: List[datetime] = None
    ) -> None:
        """Compute RMSE-based model weights via a walk-forward validation split,
        then fit the fast per-model instances on the full series."""
        self._trained_prices = list(prices)
        n = len(prices)

        if n < 10:
            # Not enough data — assign equal weights
            self.weights = {k: 1.0 / len(self.MODEL_KEYS) for k in self.MODEL_KEYS}
            self.holt_model.fit(prices)
            self.lstm_model.fit(prices)
            return

        holdout = min(7, max(3, n // 5))
        train, test = prices[:-holdout], prices[-holdout:]
        train_dates = dates[:-holdout] if dates else None

        rmse_scores: Dict[str, float] = {}
        for key in self.MODEL_KEYS:
            try:
                if key == "holt":
                    preds = self._run_holt(train, holdout)
                elif key == "lstm":
                    preds = self._run_lstm(train, holdout)
                elif key == "sarima":
                    preds = self._run_sarima(train, holdout)
                elif key == "gbr":
                    preds = self._run_gbr(train, holdout)
                elif key == "prophet":
                    preds = self._run_prophet(train, holdout, train_dates)
                else:
                    preds = self._run_holt(train, holdout)
                rmse_scores[key] = self._rmse(test, preds)
            except Exception as e:
                logger.warning(f"EnsembleForecaster {key} validation error: {e}")
                rmse_scores[key] = 1e6

        # Inverse-RMSE weighting, normalised to sum=1
        inv   = {k: 1.0 / max(v, 1e-4) for k, v in rmse_scores.items()}
        total = sum(inv.values())
        self.weights = {k: v / total for k, v in inv.items()}

        # Fit fast models on full series for forecasting
        self.holt_model.fit(prices)
        self.lstm_model.fit(prices)

    # ------------------------------------------------------------------
    # Forecast
    # ------------------------------------------------------------------
    def forecast(
        self,
        steps: int,
        prices: List[float],
        dates: List[datetime] = None,
    ) -> Dict[str, Any]:
        """
        Generate multi-model ensemble forecast for `steps` days ahead.

        Returns a dict matching the /forecast/multi-model API contract.
        """
        base_date = datetime.now()

        # --- collect raw predictions from every model ---
        model_preds: Dict[str, List[float]] = {}
        for key in self.MODEL_KEYS:
            try:
                if key == "holt":
                    preds = self.holt_model.forecast(steps)
                elif key == "lstm":
                    preds = self.lstm_model.forecast(steps)
                elif key == "sarima":
                    preds = self._run_sarima(prices, steps)
                elif key == "gbr":
                    preds = self._run_gbr(prices, steps)
                elif key == "prophet":
                    preds = self._run_prophet(prices, steps, dates)
                else:
                    preds = self._run_holt(prices, steps)
                model_preds[key] = [max(1.0, p) for p in preds]
            except Exception as e:
                logger.warning(f"EnsembleForecaster {key} forecast failed: {e}")
                fallback_price = prices[-1] if prices else 300.0
                model_preds[key] = [fallback_price] * steps

        weights = self.weights or {k: 1.0 / len(self.MODEL_KEYS) for k in self.MODEL_KEYS}

        # --- weighted ensemble mean ---
        ensemble_vals: List[float] = []
        for i in range(steps):
            val = sum(weights.get(k, 0.0) * model_preds[k][i] for k in self.MODEL_KEYS)
            ensemble_vals.append(val)

        # --- confidence intervals: spread of constituent model predictions ---
        ensemble_out: List[Dict[str, Any]] = []
        for i in range(steps):
            day_preds = [model_preds[k][i] for k in self.MODEL_KEYS]
            spread    = (max(day_preds) - min(day_preds)) / 2.0
            mid       = ensemble_vals[i]
            ensemble_out.append({
                "date":  (base_date + timedelta(days=i + 1)).strftime("%Y-%m-%d"),
                "price": round(mid, 2),
                "lower": round(max(1.0, mid - spread * 1.15), 2),
                "upper": round(mid + spread * 1.15, 2),
            })

        # --- best model = highest weight ---
        best_model = max(weights, key=lambda k: weights[k]) if weights else "holt"

        # --- ensemble accuracy proxy: 1 − normalised coefficient of variation ---
        if ensemble_vals:
            mu     = sum(ensemble_vals) / len(ensemble_vals)
            sigma  = math.sqrt(
                sum((v - mu) ** 2 for v in ensemble_vals) / max(len(ensemble_vals) - 1, 1)
            )
            cv     = sigma / mu if mu > 0 else 0.0
            accuracy = round(max(0.0, min(1.0, 1.0 - cv * 2.0)), 4)
        else:
            accuracy = 0.5

        return {
            "ensemble":        ensemble_out,
            "models":          {k: [round(p, 2) for p in v] for k, v in model_preds.items()},
            "modelWeights":    {k: round(v, 4) for k, v in weights.items()},
            "bestModel":       best_model,
            "ensembleAccuracy": accuracy,
        }


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
        self.prophet_model = None
        self.sarima_model = None
        self.gbr_model = None
        self.gbr_trained = False
        self.xgb_model = None
        self.xgb_trained = False
        self.lgb_model = None
        self.lgb_trained = False
        self.ensemble_weights: Dict[str, float] = {"baseline": 1.0}
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
            dates = [p.date for p in sorted_prices]
            
            # --- Attempt Prophet Training First ---
            if PROPHET_AVAILABLE and len(prices) >= 14:
                try:
                    df = pd.DataFrame({
                        'ds': dates,
                        'y': prices
                    })
                    # Add regressors if external features exist (simplified for this scope)
                    self.prophet_model = Prophet(
                        daily_seasonality=False,
                        weekly_seasonality=len(prices) > 30,
                        yearly_seasonality=len(prices) > 365,
                        changepoint_prior_scale=0.05
                    )
                    self.prophet_model.fit(df)
                    logger.info("Successfully trained Prophet model.")
                except Exception as e:
                    logger.warning(f"Prophet training failed: {e}. Falling back to baseline.")
                    self.prophet_model = None
            
            # --- Fallback: Fit statistical model ---
            self.statistical_model.fit(prices)
            
            # Prepare features for ML residual correction model (if enough data)
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

            # Train additional ensemble components
            self._train_sarima(prices)
            self._train_gbr(prices, external_factors)
            self._train_xgb(prices, external_factors)
            self._train_lgb(prices, external_factors)
            self.ensemble_weights = self._compute_ensemble_weights(prices, external_factors)

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
        
        forecasts = []
        contributions = {}
        
        # --- Run Prophet if available and trained ---
        if self.prophet_model is not None:
            try:
                future = self.prophet_model.make_future_dataframe(periods=forecast_days)
                forecast_df = self.prophet_model.predict(future)
                # Extract only the future predictions
                forecasts = forecast_df['yhat'].tail(forecast_days).tolist()
                
                # Estimate basic contributions based on prophet components
                if 'trend' in forecast_df.columns:
                    trend_diff = forecast_df['trend'].iloc[-1] - forecast_df['trend'].iloc[-forecast_days-1]
                    contributions['momentum'] = trend_diff
                
                logger.info("Generated predictions using Prophet.")
            except Exception as e:
                logger.warning(f"Prophet prediction failed: {e}. Falling back to baseline.")
                forecasts = []
        
        # --- Fallback to baseline (+ ML correction) if Prophet failed or is missing ---
        if not forecasts:
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

        baseline_forecasts = list(forecasts)

        # Ensemble blend with SARIMA / Gradient Boosting if available
        ensemble_candidates: Dict[str, List[float]] = {"baseline": baseline_forecasts}

        if self.sarima_model is not None:
            try:
                sarima_preds = list(self.sarima_model.forecast(steps=forecast_days))
                if len(sarima_preds) == forecast_days:
                    ensemble_candidates["sarima"] = sarima_preds
            except Exception as e:
                logger.warning(f"SARIMA forecast failed: {e}")

        if self.gbr_trained:
            gbr_preds = self._gbr_forecast(prices, forecast_days, external_factors)
            if len(gbr_preds) == forecast_days:
                ensemble_candidates["gbr"] = gbr_preds

        if self.xgb_trained:
            xgb_preds = self._xgb_forecast(prices, forecast_days, external_factors)
            if len(xgb_preds) == forecast_days:
                ensemble_candidates["xgb"] = xgb_preds

        if self.lgb_trained:
            lgb_preds = self._lgb_forecast(prices, forecast_days, external_factors)
            if len(lgb_preds) == forecast_days:
                ensemble_candidates["lgb"] = lgb_preds

        if len(ensemble_candidates) > 1:
            forecasts = self._blend_forecasts(ensemble_candidates, self.ensemble_weights)

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

    def _train_sarima(self, prices: List[float]) -> None:
        if not SARIMA_AVAILABLE or len(prices) < 14:
            self.sarima_model = None
            return
        try:
            model = SARIMAX(
                prices,
                order=(1, 1, 1),
                seasonal_order=(0, 1, 1, 7),
                enforce_stationarity=False,
                enforce_invertibility=False
            )
            self.sarima_model = model.fit(disp=False)
        except Exception as e:
            logger.warning(f"SARIMA training failed: {e}")
            self.sarima_model = None

    def _train_gbr(self, prices: List[float], external_factors: ExternalFactors = None) -> None:
        if not SKLEARN_AVAILABLE or len(prices) < 14:
            self.gbr_model = None
            self.gbr_trained = False
            return
        try:
            X: List[List[float]] = []
            y: List[float] = []
            for i in range(7, len(prices)):
                X.append(self._prepare_features(prices[:i], external_factors))
                y.append(prices[i])
            if len(X) < 5:
                self.gbr_model = None
                self.gbr_trained = False
                return
            model = GradientBoostingRegressor(
                random_state=42,
                n_estimators=200,
                learning_rate=0.05,
                max_depth=3
            )
            model.fit(X, y)
            self.gbr_model = model
            self.gbr_trained = True
        except Exception as e:
            logger.warning(f"Gradient boosting training failed: {e}")
            self.gbr_model = None
            self.gbr_trained = False

    def _gbr_forecast(self, prices: List[float], forecast_days: int, external_factors: ExternalFactors = None) -> List[float]:
        if not self.gbr_trained or self.gbr_model is None:
            return []
        history = list(prices)
        preds: List[float] = []
        for _ in range(forecast_days):
            features = self._prepare_features(history, external_factors)
            pred = float(self.gbr_model.predict([features])[0])
            preds.append(pred)
            history.append(pred)
        return preds

    def _train_xgb(self, prices: List[float], external_factors: ExternalFactors = None) -> None:
        if not XGBOOST_AVAILABLE or xgb is None or len(prices) < 14:
            self.xgb_model = None
            self.xgb_trained = False
            return
        try:
            X: List[List[float]] = []
            y: List[float] = []
            for i in range(7, len(prices)):
                X.append(self._prepare_features(prices[:i], external_factors))
                y.append(prices[i])
            if len(X) < 5:
                self.xgb_model = None
                self.xgb_trained = False
                return
            model = xgb.XGBRegressor(
                random_state=42,
                n_estimators=200,
                learning_rate=0.05,
                max_depth=4,
                subsample=0.8,
                colsample_bytree=0.8,
                verbosity=0
            )
            model.fit(X, y)
            self.xgb_model = model
            self.xgb_trained = True
        except Exception as e:
            logger.warning(f"XGBoost training failed: {e}")
            self.xgb_model = None
            self.xgb_trained = False

    def _xgb_forecast(self, prices: List[float], forecast_days: int, external_factors: ExternalFactors = None) -> List[float]:
        if not self.xgb_trained or self.xgb_model is None:
            return []
        history = list(prices)
        preds: List[float] = []
        for _ in range(forecast_days):
            features = self._prepare_features(history, external_factors)
            pred = float(self.xgb_model.predict([features])[0])
            preds.append(pred)
            history.append(pred)
        return preds

    def _train_lgb(self, prices: List[float], external_factors: ExternalFactors = None) -> None:
        if not LIGHTGBM_AVAILABLE or lgb is None or len(prices) < 14:
            self.lgb_model = None
            self.lgb_trained = False
            return
        try:
            X: List[List[float]] = []
            y: List[float] = []
            for i in range(7, len(prices)):
                X.append(self._prepare_features(prices[:i], external_factors))
                y.append(prices[i])
            if len(X) < 5:
                self.lgb_model = None
                self.lgb_trained = False
                return
            model = lgb.LGBMRegressor(
                random_state=42,
                n_estimators=200,
                learning_rate=0.05,
                max_depth=4,
                subsample=0.8,
                colsample_bytree=0.8,
                verbose=-1
            )
            model.fit(X, y)
            self.lgb_model = model
            self.lgb_trained = True
        except Exception as e:
            logger.warning(f"LightGBM training failed: {e}")
            self.lgb_model = None
            self.lgb_trained = False

    def _lgb_forecast(self, prices: List[float], forecast_days: int, external_factors: ExternalFactors = None) -> List[float]:
        if not self.lgb_trained or self.lgb_model is None:
            return []
        history = list(prices)
        preds: List[float] = []
        for _ in range(forecast_days):
            features = self._prepare_features(history, external_factors)
            pred = float(self.lgb_model.predict([features])[0])
            preds.append(pred)
            history.append(pred)
        return preds

    def _mape(self, actual: List[float], predicted: List[float]) -> float:
        if not actual or not predicted:
            return 1.0
        errors = []
        for a, p in zip(actual, predicted):
            if a == 0:
                errors.append(abs(a - p))
            else:
                errors.append(abs((a - p) / a))
        return mean(errors) if errors else 1.0

    def _compute_ensemble_weights(self, prices: List[float], external_factors: ExternalFactors = None) -> Dict[str, float]:
        if len(prices) < 20:
            return {"baseline": 1.0}

        holdout = min(7, max(3, len(prices) // 4))
        train_prices = prices[:-holdout]
        test_prices = prices[-holdout:]

        errors: Dict[str, float] = {}

        # Baseline Holt-linear
        base_model = HoltLinearModel(alpha=0.3, beta=0.1)
        base_model.fit(train_prices)
        base_preds = base_model.forecast(holdout)
        errors["baseline"] = self._mape(test_prices, base_preds)

        # SARIMA
        if SARIMA_AVAILABLE and len(train_prices) >= 14:
            try:
                sarima = SARIMAX(
                    train_prices,
                    order=(1, 1, 1),
                    seasonal_order=(0, 1, 1, 7),
                    enforce_stationarity=False,
                    enforce_invertibility=False
                ).fit(disp=False)
                sarima_preds = list(sarima.forecast(steps=holdout))
                errors["sarima"] = self._mape(test_prices, sarima_preds)
            except Exception as e:
                logger.warning(f"SARIMA validation failed: {e}")

        # Gradient Boosting
        if SKLEARN_AVAILABLE and len(train_prices) >= 14:
            try:
                X: List[List[float]] = []
                y: List[float] = []
                for i in range(7, len(train_prices)):
                    X.append(self._prepare_features(train_prices[:i], external_factors))
                    y.append(train_prices[i])
                if len(X) >= 5:
                    gbr = GradientBoostingRegressor(
                        random_state=42,
                        n_estimators=200,
                        learning_rate=0.05,
                        max_depth=3
                    )
                    gbr.fit(X, y)
                    history = list(train_prices)
                    gbr_preds: List[float] = []
                    for _ in range(holdout):
                        feat = self._prepare_features(history, external_factors)
                        pred = float(gbr.predict([feat])[0])
                        gbr_preds.append(pred)
                        history.append(pred)
                    errors["gbr"] = self._mape(test_prices, gbr_preds)
            except Exception as e:
                logger.warning(f"Gradient boosting validation failed: {e}")

        # XGBoost
        if XGBOOST_AVAILABLE and xgb is not None and len(train_prices) >= 14:
            try:
                X_xgb: List[List[float]] = []
                y_xgb: List[float] = []
                for i in range(7, len(train_prices)):
                    X_xgb.append(self._prepare_features(train_prices[:i], external_factors))
                    y_xgb.append(train_prices[i])
                if len(X_xgb) >= 5:
                    xgb_model = xgb.XGBRegressor(
                        random_state=42, n_estimators=200, learning_rate=0.05,
                        max_depth=4, subsample=0.8, colsample_bytree=0.8, verbosity=0
                    )
                    xgb_model.fit(X_xgb, y_xgb)
                    history = list(train_prices)
                    xgb_preds: List[float] = []
                    for _ in range(holdout):
                        feat = self._prepare_features(history, external_factors)
                        pred = float(xgb_model.predict([feat])[0])
                        xgb_preds.append(pred)
                        history.append(pred)
                    errors["xgb"] = self._mape(test_prices, xgb_preds)
            except Exception as e:
                logger.warning(f"XGBoost validation failed: {e}")

        # LightGBM
        if LIGHTGBM_AVAILABLE and lgb is not None and len(train_prices) >= 14:
            try:
                X_lgb: List[List[float]] = []
                y_lgb: List[float] = []
                for i in range(7, len(train_prices)):
                    X_lgb.append(self._prepare_features(train_prices[:i], external_factors))
                    y_lgb.append(train_prices[i])
                if len(X_lgb) >= 5:
                    lgb_model = lgb.LGBMRegressor(
                        random_state=42, n_estimators=200, learning_rate=0.05,
                        max_depth=4, subsample=0.8, colsample_bytree=0.8, verbose=-1
                    )
                    lgb_model.fit(X_lgb, y_lgb)
                    history = list(train_prices)
                    lgb_preds: List[float] = []
                    for _ in range(holdout):
                        feat = self._prepare_features(history, external_factors)
                        pred = float(lgb_model.predict([feat])[0])
                        lgb_preds.append(pred)
                        history.append(pred)
                    errors["lgb"] = self._mape(test_prices, lgb_preds)
            except Exception as e:
                logger.warning(f"LightGBM validation failed: {e}")

        weights: Dict[str, float] = {}
        total = 0.0
        for key, err in errors.items():
            w = 1.0 / max(err, 1e-4)
            weights[key] = w
            total += w

        if total <= 0:
            return {"baseline": 1.0}

        return {k: v / total for k, v in weights.items()}

    def _blend_forecasts(self, candidates: Dict[str, List[float]], weights: Dict[str, float]) -> List[float]:
        if not candidates:
            return []
        length = len(next(iter(candidates.values())))
        weight_total = 0.0
        effective_weights: Dict[str, float] = {}
        for key in candidates.keys():
            w = weights.get(key, 0.0)
            if w <= 0:
                w = 1.0
            effective_weights[key] = w
            weight_total += w
        if weight_total == 0:
            weight_total = 1.0
        for key in effective_weights:
            effective_weights[key] /= weight_total

        blended: List[float] = []
        for i in range(length):
            blended.append(sum(candidates[k][i] * effective_weights[k] for k in candidates))
        return blended
    
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
