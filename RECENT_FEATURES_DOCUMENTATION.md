# RASS Recent Feature Documentation (Submission Draft)

This document explains the recently implemented modules in RASS, focusing on:

1. Government Price Regulations  
2. Seasonal Guidance  
3. Price Moderation  
4. Inter-Cooperative Crop Sharing  
5. Government Reports and Access Center

---

## 1. Government Price Regulations

### Purpose
Enable Government/Admin to define enforceable crop pricing ranges by region/district/market, then automatically propagate compliance signals across the marketplace.

### Core behavior
- Government creates a regulation with:
  - `crop`
  - `region` (and optional `district`, optional `market`)
  - `minPricePerKg` (optional)
  - `maxPricePerKg` (required)
  - `effectiveFrom`, `effectiveTo`
  - notes
- System prevents overlapping active regulations for the same crop + geography + time window.
- Cooperative listings are validated against applicable regulations.
- If a regulation impacts active listings, cooperative managers receive notifications (DB + real-time SignalR).

### API (backend)
- `GET /api/price-regulations`
- `POST /api/price-regulations`
- `PUT /api/price-regulations/{id}`
- `DELETE /api/price-regulations/{id}` (deactivates/expires)
- `GET /api/price-regulations/validate` (listing price compliance check)

### Reliability notes
- Region/district/market are normalized against Rwanda admin and market catalogs.
- Applicable regulation resolution follows specificity (market/district/region).
- Notifications include action URL to guide user correction on pricing pages.

---

## 2. Seasonal Guidance

### Purpose
Provide government-issued planning guidance by crop and region for seasonal stability and expected trends.

### Core behavior
- Government can publish guidance with:
  - crop, region, season (A/B/C)
  - stability period (`stabilityStart`, `stabilityEnd`)
  - expected trend (`Rise`, `Fall`, `Stable`)
  - expected min/max price (optional)
  - recommendations for farmers
- Guidance is visible to downstream role pages and used as planning intelligence.

### API (backend)
- `GET /api/price-regulations/seasonal-guidance`
- `POST /api/price-regulations/seasonal-guidance`
- `DELETE /api/price-regulations/seasonal-guidance/{id}`
- Reference consumption endpoint in UI flows:
  - `GET /api/reference/seasonal-guidance`

---

## 3. Price Moderation (Government + Cooperative Action Layer)

### Purpose
Turn regulation policy into actionable operational moderation across submitted market prices and cooperative listings.

### Government moderation flow
- Government receives market price submissions (from market agents) and moderates status:
  - Approved
  - Rejected
  - Flagged
- Moderation captures notes and moderator metadata.

### Cooperative moderation flow
- Cooperative manager sees **Price Moderations** data for own listings:
  - regulation found / not found
  - compliance status
  - gap analysis
  - recommended compliant price
- Cooperative can act directly from dashboard to align listing prices.

### API (backend)
- Government:
  - `GET /api/government/price-submissions`
  - `POST /api/government/price-submissions/{id}/moderate`
- Cooperative:
  - `GET /api/cooperative/price-moderations`

### UI behavior
- Government Dashboard has dedicated moderation controls.
- Cooperative Dashboard includes a **Price Moderations** tab with activity indicators and direct corrective actions.
- Badge counters/notification signals are wired for dynamic updates.

---

## 4. Inter-Cooperative Crop Sharing

### Purpose
Balance national/regional supply by enabling cooperatives to request scarce crops from cooperatives with surplus under a structured, auditable workflow.

### Functional model
- Supply status detection:
  - System computes supply-demand balance by crop and region.
- Requesting cooperative can:
  - target one cooperative, or
  - broadcast request to all eligible cooperatives.
- Suppliers can:
  - respond directly, or
  - submit competitive bids (price/quantity/delivery terms).
- Requester can:
  - review incoming bids,
  - select a winning bid,
  - track lifecycle through fulfillment/cancellation.

### Lifecycle and statuses
- Request statuses include: `Open`, `Matched`, `Negotiating`, `Contracted`, `Fulfilled`, `Cancelled`.
- Bid statuses include: `Pending`, `Selected`, and non-selected states.
- Notifications are created for key events (new request, bid submitted, bid selected, etc.).

### API (backend)
- `GET /api/crop-sharing/supply-balance`
- `GET /api/crop-sharing/potential-suppliers`
- `POST /api/crop-sharing/requests`
- `GET /api/crop-sharing/requests`
- `GET /api/crop-sharing/my-requests`
- `POST /api/crop-sharing/requests/{id}/respond`
- `POST /api/crop-sharing/requests/{id}/bids`
- `GET /api/crop-sharing/requests/{id}/bids`
- `POST /api/crop-sharing/requests/{id}/select-bid`
- `POST /api/crop-sharing/requests/{id}/fulfill`
- `POST /api/crop-sharing/requests/{id}/cancel`

### Economic and governance intent
- Encourages fair pricing via bidding and agreed terms.
- Keeps transaction terms explicit (price, quantity, delivery terms).
- Provides end-to-end traceability for cooperative collaboration.

---

## 5. Role-Based Reporting System and Government Access Center

### Purpose
Enable **all user roles** to provide/export reports relevant to their operations, while giving Government/Admin national oversight and policy intelligence.

### Access Center capability
Government now has read visibility previews and reporting paths for:
- cooperatives
- farmers
- transporters
- market agents
- storage keepers
- listings, inventory, harvests, contracts, orders, payments, etc.

### Reporting capabilities
- Universal, role-aware export engine:
  - `GET /api/reports/available` returns report types for the logged-in role.
  - `GET /api/reports/export-csv` exports CSV for allowed types.
- Optional filters supported for exports: crop, region, district, status, startDate, endDate.
- Government also has policy/intelligence reporting endpoints (separate from universal export).

### Role-by-role report matrix

| Role | What this user can provide / export |
|---|---|
| **Farmer** | My Harvest Declarations (`my-harvests`), My Lot Contributions (`my-contributions`), My Payments (`my-payments`), Market Prices (`prices`) |
| **Cooperative Manager** | Market Listings, Harvest Declarations, Inventory/Lots, Transport Jobs, Contracts, Buyer Orders, Payments, Market Prices |
| **Buyer** | My Orders (`my-orders`), My Contracts (`my-contracts`), Payments, Market Prices |
| **Transporter** | My Transport Jobs (`my-jobs`), My Completed Deliveries (`my-deliveries`), Market Prices |
| **Storage Operator / Store Keeper** | Storage & Capacity (`storage`), Inventory (`inventory`), Market Prices |
| **Market Agent** | Price Trend Analysis (`prices`) export; plus can submit operational market reports (`POST /api/market-agent/reports`) and view own submitted reports (`GET /api/market-agent/reports`) |
| **Government** | All major cross-role exports (comprehensive, farmers, cooperatives, regulations, supply-demand, transporters, listings, harvests, inventory, contracts, orders, payments, prices, storage) + policy reports/annotations + national intelligence report |
| **Admin** | Same broad cross-role visibility/export coverage as Government, plus administrative oversight |

### Notes on "provide report" vs "export report"
- **Export report**: downloading structured CSV datasets from `api/reports/export-csv`.
- **Provide/submit report**: creating narrative or incident/policy records:
  - Market Agent submits market incident reports.
  - Government submits policy reports/annotations.

### API (backend)
- Universal (all authenticated roles):
  - `GET /api/reports/available`
  - `GET /api/reports/export-csv`
- `POST /api/government/generate-report`
- `GET /api/government/export-csv`
- `GET /api/government/listing-moderation`
- `POST /api/government/reports`
- `GET /api/government/reports`
- `POST /api/market-agent/reports`
- `GET /api/market-agent/reports`
- Additional national intelligence endpoint:
  - `GET /api/government/national-intelligence-report`

---

## Cross-Module Dynamic Behavior (Important for Reliability)

- Notifications are persisted in DB and pushed via SignalR for near real-time badge/activity updates.
- Listing/regulation interactions are dynamic: when a regulation changes, affected listing compliance surfaces update.
- Dashboard badges now consume unread/activity counters from shared real-time state.
- Tracking enhancements (recently added) support delivery-owner start-tracking flows and coordinate-based live lookup.

---

## Suggested Documentation Placement for Final Submission

Use this file as a base section under:
- **System Features**
- **Government Governance Layer**
- **Cooperative Operations**
- **Reporting and Intelligence**
