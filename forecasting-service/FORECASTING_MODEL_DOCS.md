# RASS AI Forecasting Model: Technical Documentation

## Executive Summary
This document details the architecture, methodology, and implementation of the **RASS (Rwanda Agri Stability System) AI Forecasting Engine**. The model is designed to predict agricultural commodity prices in Rwandan markets with a high degree of interpretability and operational stability. 

Unlike generic "black box" deep learning models, RASS uses a **Hybrid Statistical-ML Approach** optimized for:
1.  **Short-term accuracy (1-14 days)** critical for perishable crops.
2.  **Explainability** (telling farmers *why* prices are moving).
3.  **Rwanda-specific context** (seasonality, terrain, market connectivity).
4.  **Hardware Independence** (runs on any server/laptop without heavy dependencies).

---

## 1. How the Model Works (Architecture)

The model follows a "Residual Correction" architecture. It combines a robust statistical baseline with a machine learning layer that adapts to complex external factors.

### Phase 1: Statistical Baseline (The "Trend Follower")
**Algorithm:** Double Exponential Smoothing (Holt's Linear Method)
*   **What it does:** Captures the underlying direction of the market (Up, Down, Stable) and the current price level.
*   **Why used:** Agricultural prices have strong momentum. If maize prices rose yesterday and today, they are likely to rise tomorrow unless a major event occurs.
*   **Math:** 
    *   *Level(t) = α * Price(t) + (1-α) * (Level(t-1) + Trend(t-1))*
    *   *Trend(t) = β * (Level(t) - Level(t-1)) + (1-β) * Trend(t-1)*

### Phase 2: ML Correction Layer (The "Smart Adjuster")
**Algorithm:** Ridge Regression (L2 Regularized Linear Regression) - *Implemented from scratch in pure Python*.
*   **What it does:** Predicts the *error* (residual) of the statistical model based on external factors.
*   **Example:** If the statistical model predicts "Stable", but the ML layer sees "Heavy Rainfall causing transport blocks", it will correct the forecast downward or upward depending on supply impact.

### Phase 3: Uncertainty & Decision Engine
*   **Confidence Intervals:** Uses "Bootstrap Residuals" to generate an 80% confidence range (e.g., "Price will be between 300 and 340 RWF").
*   **Volatility Analysis:** Measures coefficient of variation to warn users if the market is unstable ("High Risk").
*   **Recommendation:** Logic-based engine that suggests "Sell Now", "Hold", or "Monitor" based on predicted profit vs. risk.

---

## 2. Input Features: What the Model "Sees"

The model uses a combination of historical patterns and Rwanda-specific external drivers.

### A. Historical Signals (derived from price data)
*   **Lagged Prices:** Price 1 day ago, 3 days ago, 7 days ago.
*   **Rolling Means:** 7-day and 14-day averages (smooths out daily noise).
*   **Momentum:** The speed of price change (Acceleration/Deceleration).
*   **Volatility:** How much the price is jumping around (Standard Deviation).

### B. Rwanda-Specific Drivers (External Factors)
*   **Seasonality:** Encodes Rwanda's specific seasons:
    *   *Season A (Harvesting):* Sep-Jan → High supply, lower prices.
    *   *Season B (Planting):* Feb-Jun → Low supply, higher prices.
    *   *Lean Season:* Jul-Aug → Scarcity, peak prices.
*   **Market Connectivity:**
    *   *Distance to Kigali:* Markets further from Kigali often have lower farm-gate prices due to transport costs.
    *   *Road Quality:* Paved vs. Dirt roads affect transport reliability.
*   **Weather Impact:** Rainfall anomaly (deviation from normal) affects both harvest (long-term) and transport (short-term).
*   **Economic Indicators:** Fuel Price Index (controls transport costs).

---

## 3. Technology Stack: Why Pure Python?

You might be asked: *"Why didn't you use TensorFlow or PyTorch?"*

**Answer:** 
*   **Operational Stability:** We used **Pure Python** (standard library `math`, `statistics`, `collections`). This means the model has **ZERO external dependencies** (no `numpy`, no `pandas`, no C-compilers).
*   **Benefits:**
    *   **Runs Anywhere:** Can be deployed on a cheap flexible server, a Windows laptop, or even a Raspberry Pi without complex environment setup.
    *   **Transparency:** Every line of math is visible in the code, not hidden inside a compiled library.
    *   **Speed:** Inference is microseconds, allowing real-time forecasting for thousands of requests.

---

## 4. Q&A: Handling Common Tough Questions

### Q1: How does the model know the "Current Price"?
**A:** The model does **not** scrape prices from the internet blindly. It relies on the **RASS Transaction System**.
*   When Cooperatives record harvest data.
*   When Buyers post offers.
*   When Transporters log deliveries.
*   *This internal transactional data forms the "Ground Truth" for the model.*

### Q2: How can we trust the accuracy?
**A:** We use a three-layer validation strategy:
1.  **Confidence Intervals:** We never predict a single number (e.g., "300 RWF"). We predict a range ("280-320 RWF"). If the real price falls in this range, the model is successful.
2.  **Trend Accuracy:** We prioritize getting the *direction* right (Up vs. Down) over the exact franc. For a farmer, knowing "Prices will rise" is more valuable than knowing "Prices will rise by exactly 12 RWF".
3.  **Explainability:** The model prints *why* it made a prediction (e.g., "Prices rising due to Price Momentum and Season B Scarcity"). If the reason makes sense to a human expert, the model is trustworthy.

### Q3: What happens if data is missing?
**A:** The model is robust to data gaps:
*   If recent data is missing, it falls back to **Seasonal Averages**.
*   If external factors (rainfall) are missing, it assumes "Normal Conditions" (0 anomaly).
*   It flags these predictions with **Low Confidence** scores so the user knows to be cautious.

---

## 5. Future Improvements

*   **SMS Integration:** Push "Sell Now" alerts via SMS for feature phones.
*   **Satellite Data:** Ingest real-time vegetation health (NDVI) from satellite APIs for better harvest yield estimation.
*   **Cross-Border Trade:** Factor in prices from Uganda/Tanzania borders.

---
*Documentation generated for RASS Final Year Project Defense - Feb 2026*
