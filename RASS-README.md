# Rwanda Agri Stability System (RASS)

## Overview

RASS is a comprehensive digital agricultural marketplace and supply chain management platform designed for Rwanda's agricultural sector. The system connects farmers, cooperatives, buyers, transporters, and government stakeholders to create a transparent, efficient, and stable agricultural ecosystem.

**Current Status:** Fully functional MVP with complete user flows, API backend, and responsive frontend. Ready for testing and production deployment.

---

## System Architecture

### Backend (ASP.NET Core 8.0)
- **Framework:** ASP.NET Core Web API
- **Database:** PostgreSQL with Entity Framework Core
- **Authentication:** JWT Bearer tokens with role-based authorization
- **Architecture:** Clean Architecture with separated concerns

### Frontend (React/TypeScript)
- **Framework:** React 18 with TypeScript
- **UI Library:** Material-UI (MUI) components
- **State Management:** React Context for authentication
- **Routing:** React Router v6
- **HTTP Client:** Axios with interceptors

### Infrastructure
- **Containerization:** Docker support for both frontend and backend
- **Database:** PostgreSQL with migrations
- **Development:** Hot reload, Swagger documentation

---

## User Types & Capabilities

### 1. Farmer 👨‍🌾

#### What Farmers CAN Do:
- **Onboarding & Registration:** Register through cooperative with national ID, location, and crop information
- **Profile Management:** View and update personal information, farm details, and crop types
- **Harvest Declaration:** Submit harvest forecasts with expected quantities, dates, and quality indicators
- **Price Information:** Access real-time market prices for informed decision-making
- **Notifications:** Receive SMS confirmations for registrations and updates

#### What Farmers CANNOT Do:
- Directly sell produce (must go through cooperatives)
- Create market listings
- Accept buyer orders
- Manage transport logistics
- Access admin or government-only features

#### Key Dashboard Features:
- Personal profile with farm details
- Harvest declaration form with validation
- Market price display with trends
- Notification history

---

### 2. Cooperative Manager 🏢

#### What Cooperative Managers CAN Do:
- **Inventory Management:** Add harvested produce, assign quality grades, track storage
- **Market Listing Creation:** Create sell listings with pricing, quantities, and availability windows
- **Order Processing:** Review buyer orders, negotiate terms, accept/reject purchases
- **Farmer Management:** Oversee registered farmers, review harvest declarations
- **Transport Coordination:** Trigger transport requests for accepted orders
- **Quality Control:** Verify produce quality and manage grading standards

#### What Cooperative Managers CANNOT Do:
- Register new farmers (admin/cooperative manager shared)
- Verify buyers or transporters
- Access government reporting features
- Modify system configurations
- Manage other cooperatives

#### Key Dashboard Features:
- Inventory management with quality grading
- Market listing creation and management
- Buyer order queue with accept/reject actions
- Farmer harvest declaration reviews
- Real-time inventory tracking

---

### 3. Buyer 🛒

#### What Buyers CAN Do:
- **Registration:** Create business accounts with organization details and verification
- **Marketplace Browsing:** Search and filter produce listings by crop, price, location, quantity
- **Order Placement:** Submit purchase requests with custom pricing and delivery terms
- **Payment Processing:** Initiate escrow payments for accepted orders
- **Delivery Confirmation:** Verify receipt and quality of delivered produce
- **Order Tracking:** Monitor order status from placement to delivery

#### What Buyers CANNOT Do:
- Create market listings or sell produce
- Accept/reject orders (wait for cooperative approval)
- Manage transport logistics
- Access farmer or cooperative data
- Verify other buyers or transporters

#### Key Dashboard Features:
- Advanced marketplace search and filtering
- Order placement with negotiation tools
- Payment processing with escrow security
- Delivery tracking and confirmation
- Order history and analytics

---

### 4. Transporter 🚛

#### What Transporters CAN Do:
- **Registration:** Register vehicles with capacity, operating regions, and licensing
- **Job Discovery:** Browse available transport jobs with details and pricing
- **Job Acceptance:** Accept suitable transport assignments based on capacity and schedule
- **Pickup Confirmation:** Mark produce pickup with timestamps
- **Delivery Execution:** Complete deliveries with proof and notes
- **Earnings Tracking:** Monitor completed jobs and earnings

#### What Transporters CANNOT Do:
- Create transport requests (only cooperatives can)
- Modify job terms or pricing
- Access buyer or farmer information
- Manage produce inventory
- Verify other transporters

#### Key Dashboard Features:
- Available jobs board with filtering
- Job acceptance with capacity validation
- Pickup and delivery confirmation workflow
- Earnings and job history tracking
- Real-time job status updates

---

### 5. System Administrator 👑

#### What Administrators CAN Do:
- **User Management:** Approve/reject/suspend all user accounts across the system
- **Entity Verification:** Verify cooperatives, buyers, and transporters for legitimacy
- **System Monitoring:** Access comprehensive dashboards with system metrics
- **Audit Logging:** Review all system activities and changes
- **Market Oversight:** Monitor price fluctuations and market anomalies
- **Configuration Management:** Update system settings and business rules

#### What Administrators CANNOT Do:
- Place orders or participate in marketplace
- Manage produce inventory or transport
- Access individual user financial data
- Modify completed transactions

#### Key Dashboard Features:
- User management with verification workflows
- System metrics and KPIs dashboard
- Audit logs with filtering and search
- Market monitoring tools
- Configuration management interface

---

### 6. Government / Policy Viewer 👔 (Read-Only)

#### What Government Users CAN Do:
- **Data Access:** View aggregated market data, supply chain metrics
- **Price Monitoring:** Access price trends and market intelligence
- **Supply Chain Visibility:** Track produce flow from farm to consumer
- **Report Generation:** Export data for policy analysis and decision-making
- **Anomaly Detection:** Identify market irregularities and potential issues

#### What Government Users CANNOT Do:
- Modify any data or transactions
- Access individual user information
- Place orders or participate in marketplace
- Manage users or system configurations
- Execute operational actions

#### Key Features:
- Read-only access to aggregated data
- Price trend analysis and reporting
- Supply/demand forecasting tools
- Policy intelligence dashboards

---

## Shared Features Across All Users

### 🔐 Authentication & Security
- JWT-based authentication with secure token management
- Role-based access control (RBAC) throughout the system
- Password hashing with BCrypt
- Session management with automatic logout

### 📱 Responsive Design
- Mobile-first design approach
- Responsive layouts for all screen sizes
- Touch-friendly interfaces for mobile users
- Progressive Web App (PWA) ready

### 🔔 Notifications
- Real-time status updates
- SMS notifications for critical actions
- In-app notification system
- Email notifications for important events

### 📊 Dashboard Analytics
- User-specific KPIs and metrics
- Real-time data updates
- Visual progress indicators
- Performance tracking

### 🔍 Search & Filtering
- Advanced search capabilities
- Multiple filter options
- Real-time results
- Saved search preferences

---

## Current Working Features

### ✅ Fully Implemented

#### User Management
- Complete registration flows for all user types
- Profile management with validation
- User verification workflows
- Role-based permissions

#### Marketplace
- Dynamic listing creation and management
- Advanced search and filtering
- Real-time inventory tracking
- Price discovery and trends

#### Order Management
- End-to-end order lifecycle
- Negotiation and approval workflows
- Contract generation and tracking
- Payment processing with escrow

#### Logistics & Transport
- Automated transport request generation
- Transporter assignment and tracking
- Pickup and delivery confirmation
- Real-time status updates

#### Administrative Functions
- User verification and management
- System monitoring and analytics
- Audit logging and compliance
- Configuration management

#### Data & Analytics
- Market price monitoring
- Supply chain visibility
- Performance metrics
- Reporting capabilities

### 🚧 Partially Implemented

#### Mobile Money Integration
- Framework ready for mobile money APIs
- Payment simulation implemented
- Ready for MTN/Airtel integration

#### SMS Notifications
- SMS framework implemented
- Mock SMS service in place
- Ready for real SMS provider integration

#### Advanced Analytics
- Basic reporting implemented
- Framework ready for advanced analytics
- Dashboard widgets prepared for expansion

### 📋 Planned for Future Development

#### Advanced Features
- GPS tracking for transport
- Quality inspection with photo uploads
- Weather integration for harvest planning
- Insurance integration
- Multi-language support

#### Integration Capabilities
- Banking system integration
- Government database linkage
- Weather API integration
- SMS gateway integration
- Payment processor integration

---

## API Endpoints Overview

### Authentication
```
POST /api/auth/login
```

### Farmers
```
GET  /api/farmers/profile
POST /api/farmers/register
POST /api/farmers/harvest-declaration
GET  /api/farmers/harvest-declarations
POST /api/farmers/harvest-declaration/{id}/review
```

### Cooperatives
```
POST /api/cooperative/register
GET  /api/cooperative/my-cooperative
POST /api/cooperative/inventory
POST /api/cooperative/market-listing
GET  /api/cooperative/market-listings
GET  /api/cooperative/orders
POST /api/cooperative/order/{id}/respond
```

### Buyers
```
POST /api/buyers/register
GET  /api/buyers/profile
GET  /api/buyers/marketplace
POST /api/buyers/order
GET  /api/buyers/orders
POST /api/buyers/order/{id}/payment
POST /api/buyers/order/{id}/confirm-delivery
```

### Transporters
```
POST /api/transporters/register
GET  /api/transporters/profile
GET  /api/transporters/available-jobs
POST /api/transporters/job/{id}/accept
GET  /api/transporters/my-jobs
POST /api/transporters/job/{id}/pickup
POST /api/transporters/job/{id}/deliver
```

### Administration
```
GET  /api/admin/users
GET  /api/admin/roles
POST /api/admin/user/{id}/suspend
POST /api/admin/user/{id}/activate
GET  /api/admin/cooperatives/pending
POST /api/admin/cooperative/{id}/verify
GET  /api/admin/buyers/pending
POST /api/admin/buyer/{id}/verify
GET  /api/admin/transporters/pending
POST /api/admin/transporter/{id}/verify
GET  /api/admin/dashboard
GET  /api/admin/market-prices
GET  /api/admin/audit-logs
POST /api/admin/system-config
```

### Shared Endpoints
```
GET /api/lots
GET /api/contracts
GET /api/marketprices
GET /api/tracking/{id}
```

---

## Database Schema

### Core Entities
- **Users** - Base user accounts with roles
- **Farmers** - Farmer profiles linked to cooperatives
- **Cooperatives** - Cooperative organizations
- **BuyerProfiles** - Buyer business accounts
- **BuyerOrders** - Purchase requests
- **MarketListings** - Cooperative sell listings
- **Contracts** - Digital agreements
- **TransporterProfiles** - Transport provider accounts
- **TransportRequests** - Logistics assignments
- **Lots** - Produce inventory batches
- **HarvestDeclarations** - Farmer harvest forecasts
- **MarketPrices** - Price data from markets
- **PaymentLedgers** - Financial transactions
- **AuditLogs** - System activity logs

### Key Relationships
- Farmers belong to Cooperatives
- Lots belong to Farmers or Cooperatives
- BuyerOrders reference MarketListings
- Contracts link BuyerOrders to Lots
- TransportRequests are triggered by Contracts
- All entities link back to Users for authentication

---

## Development & Deployment

### Local Development
```bash
# Backend
cd backend
dotnet run

# Frontend
cd frontend
npm install
npm run dev
```

### Docker Deployment
```bash
docker-compose up -d
```

### Environment Variables
```
# Backend
ConnectionStrings__Default=postgresql://...
Jwt__SigningKey=your-secret-key
Jwt__Issuer=your-issuer
Jwt__Audience=your-audience

# Frontend
VITE_API_URL=http://localhost:5172
```

---

## Testing Strategy

### Unit Tests
- Backend: xUnit for business logic
- Frontend: Jest for component testing

### Integration Tests
- API endpoint testing
- Database integration tests
- Authentication flow tests

### User Acceptance Testing
- End-to-end user flow testing
- Cross-browser compatibility
- Mobile responsiveness testing

---

## Security Considerations

### Data Protection
- Input validation and sanitization
- SQL injection prevention
- XSS protection
- CSRF protection

### Access Control
- Role-based authorization
- API endpoint protection
- Sensitive data masking
- Audit trail logging

### Compliance
- GDPR-ready data handling
- Agricultural data privacy
- Financial transaction security
- Government reporting compliance

---

## Future Roadmap

### Phase 1 (Current): MVP Launch
- ✅ Complete user flows implementation
- ✅ Basic marketplace functionality
- ✅ Core logistics coordination
- ✅ Administrative oversight

### Phase 2: Enhanced Features
- 📋 Mobile money integration
- 📋 SMS gateway integration
- 📋 Advanced analytics dashboard
- 📋 Quality inspection workflows
- 📋 GPS tracking for logistics

### Phase 3: Scaling & Integration
- 📋 Multi-region expansion
- 📋 Government database integration
- 📋 Weather forecasting integration
- 📋 Insurance product integration
- 📋 International market access

### Phase 4: Advanced Analytics
- 📋 AI-powered price prediction
- 📋 Supply chain optimization
- 📋 Risk assessment models
- 📋 Sustainability tracking
- 📋 Impact measurement tools

---

## Support & Documentation

### Technical Documentation
- API documentation via Swagger UI
- Database schema documentation
- User flow diagrams
- Architecture decision records

### User Documentation
- User guides for each role
- Video tutorials
- FAQ sections
- Help desk system

### Training Materials
- Administrator training guides
- Cooperative onboarding materials
- Farmer digital literacy resources
- Buyer marketplace tutorials

---

## Contributing

### Code Standards
- C# coding standards for backend
- TypeScript/React best practices for frontend
- Comprehensive test coverage
- Documentation requirements

### Development Workflow
- Git flow branching strategy
- Pull request reviews
- Continuous integration
- Automated testing

---

## Contact & Support

For technical support, feature requests, or partnership inquiries:
- **Technical Support:** [support@rass.rw]
- **Business Development:** [partnerships@rass.rw]
- **Government Relations:** [gov@rass.rw]

---

*This document is maintained alongside the codebase and updated with each major release. Last updated: January 2026*
