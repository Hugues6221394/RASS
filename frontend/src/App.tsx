import { Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import { NavBar } from './components/NavBar';
import { Footer } from './components/Footer';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ChatWidget } from './components/ChatWidget';
import { CartProvider } from './context/CartContext';
import { SignalRProvider } from './context/SignalRContext';
import { DashboardPage } from './pages/DashboardPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { FarmerActivationPage } from './pages/FarmerActivationPage';
import { RegisterPage } from './pages/RegisterPage';
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
import { ChatPage } from './pages/ChatPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { SettingsPage } from './pages/SettingsPage';
import { StorageDashboardPage } from './pages/StorageDashboardPage';
import { MarketAgentDashboardPage } from './pages/MarketAgentDashboardPage';
import { ContractsPage } from './pages/ContractsPage';
import { ProductDetailsPage } from './pages/ProductDetailsPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { ApplyRolePage } from './pages/ApplyRolePage';
import { ApplicantDashboardPage } from './pages/ApplicantDashboardPage';
import { CooperativeProfileSettingsPage } from './pages/CooperativeProfileSettingsPage';
import { LicensingPage } from './pages/LicensingPage';
import { AgricultureInRwandaPage } from './pages/AgricultureInRwandaPage';
import GlobalToast from './components/ui/GlobalToast';
import RuntimeKinyarwandaTranslator from './components/i18n/RuntimeKinyarwandaTranslator';

function App() {
  return (
    <SignalRProvider>
      <CartProvider>
        <div className="app-shell">
          <div className="app-bg-grid" />
          <div className="app-bg-orb app-bg-orb-1" />
          <div className="app-bg-orb app-bg-orb-2" />
          <NavBar />
          <main className="relative z-[1]">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/farmer-activation" element={<FarmerActivationPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/apply-role" element={<ApplyRolePage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/cart" element={<CartPage />} />
              <Route path="/marketplace" element={<MarketplacePage />} />
              <Route path="/marketplace/:id" element={<ProductDetailsPage />} />
              <Route path="/prices" element={<PricesPage />} />
              <Route path="/tracking" element={<TrackingPage />} />
              <Route path="/ai-forecast" element={<AIForecastingPage />} />
              <Route path="/agriculture-in-rwanda" element={<AgricultureInRwandaPage />} />
              <Route element={<ProtectedRoute />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route element={<ProtectedRoute roles={['Farmer']} />}>
                  <Route path="/farmer-dashboard" element={<FarmerDashboardPage />} />
                </Route>
                <Route element={<ProtectedRoute roles={['CooperativeManager']} />}>
                  <Route path="/cooperative-dashboard" element={<CooperativeDashboardPage />} />
                  <Route path="/cooperative-profile-settings" element={<CooperativeProfileSettingsPage />} />
                </Route>
                <Route element={<ProtectedRoute roles={['Buyer']} />}>
                  <Route path="/buyer-dashboard" element={<BuyerDashboardPage />} />
                  <Route path="/buyer" element={<BuyerDashboardPage />} />
                </Route>
                <Route element={<ProtectedRoute roles={['Transporter']} />}>
                  <Route path="/transporter-dashboard" element={<TransporterDashboardPage />} />
                </Route>
                {/* Government & Admin only — national analytics */}
                <Route element={<ProtectedRoute roles={['Government', 'Admin']} />}>
                  <Route path="/government-dashboard" element={<GovernmentDashboardPage />} />
                </Route>
                <Route element={<ProtectedRoute roles={['StorageOperator', 'StorageManager']} />}>
                  <Route path="/storage-dashboard" element={<StorageDashboardPage />} />
                </Route>
                <Route element={<ProtectedRoute roles={['MarketAgent']} />}>
                  <Route path="/agent-dashboard" element={<MarketAgentDashboardPage />} />
                  <Route path="/market-agent-dashboard" element={<MarketAgentDashboardPage />} />
                </Route>
                <Route element={<ProtectedRoute roles={['Applicant']} />}>
                  <Route path="/applicant-dashboard" element={<ApplicantDashboardPage />} />
                </Route>
                <Route path="/logistics" element={<LogisticsPage />} />
                <Route path="/messages" element={<ChatPage />} />
                <Route path="/contracts" element={<ContractsPage />} />
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/licensing" element={<LicensingPage />} />
              </Route>
              <Route element={<ProtectedRoute roles={['Admin']} />}>
                <Route path="/admin" element={<AdminPage />} />
                <Route path="/admin-dashboard" element={<AdminPage />} />
                <Route path="/admin/cooperatives/create" element={<CooperativeManagementPage />} />
                <Route path="/admin/cooperatives/:id/edit" element={<CooperativeManagementPage />} />
                <Route path="/admin/farmers/create" element={<FarmerManagementPage />} />
                <Route path="/admin/farmers/:id/edit" element={<FarmerManagementPage />} />
                <Route path="/admin/buyers/create" element={<BuyerManagementPage />} />
                <Route path="/admin/buyers/:id/edit" element={<BuyerManagementPage />} />
                <Route path="/admin/transporters/create" element={<TransporterManagementPage />} />
                <Route path="/admin/transporters/:id/edit" element={<TransporterManagementPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>

          {/* Premium Footer */}
          <Footer />

          {/* Floating Chat Widget - visible when authenticated */}
          <ChatWidget />
          <GlobalToast />
          <RuntimeKinyarwandaTranslator />
        </div>
      </CartProvider>
    </SignalRProvider>
  );
}

export default App;
