# RASS Functional Requirements Report

This document outlines the functional capabilities available to each user role in the Rwanda Agri Stability System (RASS) based on the current implementation.

## 1. Public Users (Unauthenticated)
**Overview:** Access to general market information and transparency data without logging in.
- **View Homepage:** See high-level system statistics (volatility reduction, truck utilization, etc.).
- **View Featured Listings:** Browse a curated list of active produce listings from verified cooperatives.
- **View Live Market Prices:** See real-time price updates from various markets.
- **View AI Forecasts:** Access public price prediction charts and market trends.
- **Filter Listings:** Search listings by crop, region, or cooperative on the marketplace page.

## 2. Farmers
**Overview:** Producers who submit harvest data and track their produce.
- **Dashboard Access:** View personalized summary of activities.
- **View Market Prices:** Access detailed price information to make informed selling decisions.
- **AI Forecasting:** View price predictions to plan harvest timing.
- **Real-time Chat:** Communicate with Cooperative Managers.
- **Notifications:** Receive system alerts about market changes or updates.

## 3. Cooperative Managers
**Overview:** Aggregators who manage farmer produce and create market listings.
- **Dashboard Access:** specific cooperative management dashboard.
- **Manage Inventory:** (Implied) Track aggregated produce from member farmers.
- **Create Market Listings:** Post produce for sale on the marketplace.
- **AI Forecasting:** Use advanced forecasting to set competitive prices.
- **Real-time Chat:** Communicate with Farmers, Buyers, Transporters, and Admins.
- **Notifications:** Receive alerts about orders, logistics, and system updates.

## 4. Buyers
**Overview:** Wholesalers and retailers purchasing produce in bulk.
- **Dashboard Access:** View order history and status.
- **Browse Marketplace:** Full access to search and filter all market listings.
- **Shopping Cart:**
    - Add multiple listings to a shopping cart.
    - Adjust quantities.
    - View subtotal and total costs.
    - Remove items.
- **Checkout:** Place orders with delivery location and preferred delivery window.
- **Contact Sellers:** Initiate chats with Cooperative Managers directly from listings.
- **Track Shipments:** (Planned) Monitor the status of purchased goods.
- **Real-time Chat:** Communicate with Cooperative Managers and Buyers.
- **Notifications:** Receive alerts on order acceptance, shipping, and delivery.

## 5. Transporters
**Overview:** Logistics providers moving goods between cooperatives and buyers.
- **Dashboard Access:** View assigned shipments and logistics tasks.
- **Logistics Management:** (Implied) Update status of shipments (e.g., Picked Up, In Transit, Delivered).
- **Real-time Chat:** Communicate with Cooperative Managers and Buyers.
- **Notifications:** Receive alerts about new shipment assignments and route updates.

## 6. Government / Policy Makers
**Overview:** Oversight and regulation users.
- **Dashboard Access:** High-level policy dashboard (monitoring view).
- **View Analytics:** Access system-wide data on food security, price stability, and regional performance.
- **AI Forecasting:** View long-term trends for policy planning.
- **Notifications:** Receive critical system alerts.

## 7. Administrators (Super Admin)
**Overview:** System managers with full control.
- **User Management:** Create, edit, and manage accounts for all other roles (Cooperatives, Farmers, Buyers, Transporters).
- **System Configuration:** Manage system settings (implied).
- **Broadcast Notifications:** Send system-wide or role-specific notifications.
- **Real-time Chat:** Communicate with any user in the system.
- **Full Access:** Access all dashboards and features for troubleshooting and oversight.

## Key Cross-Cutting Features
- **Real-time Messaging:** SignalR-based chat allows instant communication between relevant parties (e.g., Buyer <-> Cooperative).
- **Notification System:** Push notifications for critical events (Orders, Messages, System Alerts).
- **Authentication & Security:** Role-Based Access Control (RBAC) ensures users only see authorized data. JWT tokens secure all API endpoints.
