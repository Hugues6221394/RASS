import { Routes, Route } from 'react-router-dom';
import './App.css';
import { NavBar } from './components/NavBar';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ChatWidget } from './components/ChatWidget';
import { CartProvider } from './context/CartContext';
import { SignalRProvider } from './context/SignalRContext';
import { DashboardPage } from './pages/DashboardPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { MarketplacePage } from './pages/MarketplacePage';
import { LogisticsPage } from './pages/LogisticsPage';
import { PricesPage } from './pages/PricesPage';
import { TrackingPage } from './pages/TrackingPage';
import { AdminPage } from './pages/AdminPage';
import { FarmerDashboardPage } from './pages/FarmerDashboardPage';
import { CooperativeDashboardPage } from './pages/CooperativeDashboardPage';
import { BuyerDashboardPage } from './pages/BuyerDashboardPage';
import { TransporterDashboardPage } from './pages/TransporterDashboardPage';
import { GovernmentDashboardPage } from './pages/GovernmentDashboardPage';
import { AIForecastingPage } from './pages/AIForecastingPage';
import { CooperativeManagementPage } from './pages/CooperativeManagementPage';
import { FarmerManagementPage } from './pages/FarmerManagementPage';
import { BuyerManagementPage } from './pages/BuyerManagementPage';
import { TransporterManagementPage } from './pages/TransporterManagementPage';
import { CartPage } from './pages/CartPage';

function App() {
  return (
    <SignalRProvider>
      <CartProvider>
        <div>
          <NavBar />
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/farmer-dashboard" element={<FarmerDashboardPage />} />
              <Route path="/cooperative-dashboard" element={<CooperativeDashboardPage />} />
              <Route path="/buyer-dashboard" element={<BuyerDashboardPage />} />
              <Route path="/buyer" element={<BuyerDashboardPage />} />
              <Route path="/transporter-dashboard" element={<TransporterDashboardPage />} />
              <Route element={<ProtectedRoute roles={['Government', 'Admin']} />}>
                <Route path="/government-dashboard" element={<GovernmentDashboardPage />} />
              </Route>
              <Route path="/marketplace" element={<MarketplacePage />} />
              <Route path="/logistics" element={<LogisticsPage />} />
              <Route path="/prices" element={<PricesPage />} />
              <Route path="/ai-forecast" element={<AIForecastingPage />} />
            </Route>
            <Route path="/tracking" element={<TrackingPage />} />
            <Route element={<ProtectedRoute roles={['Admin']} />}>
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/admin/cooperatives/create" element={<CooperativeManagementPage />} />
              <Route path="/admin/cooperatives/:id/edit" element={<CooperativeManagementPage />} />
              <Route path="/admin/farmers/create" element={<FarmerManagementPage />} />
              <Route path="/admin/farmers/:id/edit" element={<FarmerManagementPage />} />
              <Route path="/admin/buyers/create" element={<BuyerManagementPage />} />
              <Route path="/admin/buyers/:id/edit" element={<BuyerManagementPage />} />
              <Route path="/admin/transporters/create" element={<TransporterManagementPage />} />
              <Route path="/admin/transporters/:id/edit" element={<TransporterManagementPage />} />
            </Route>
          </Routes>

          {/* Floating Chat Widget - visible when authenticated */}
          <ChatWidget />
        </div>
      </CartProvider>
    </SignalRProvider>
  );
}

export default App;
