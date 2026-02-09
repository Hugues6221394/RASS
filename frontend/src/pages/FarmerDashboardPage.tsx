import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { Modal } from '../components/Modal';
import { DataTable } from '../components/DataTable';
import type { FarmerProfile, HarvestDeclaration, MarketPrice, Lot } from '../types';

export const FarmerDashboardPage = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<FarmerProfile | null>(null);
  const [harvestDeclarations, setHarvestDeclarations] = useState<HarvestDeclaration[]>([]);
  const [marketPrices, setMarketPrices] = useState<MarketPrice[]>([]);
  const [contributions, setContributions] = useState<Lot[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'profile' | 'harvest' | 'contributions' | 'payments' | 'prices'>('overview');

  // Modals
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [showHarvestForm, setShowHarvestForm] = useState(false);
  const [editingHarvest, setEditingHarvest] = useState<HarvestDeclaration | null>(null);

  // Forms
  const [profileUpdateForm, setProfileUpdateForm] = useState({
    phone: '',
    district: '',
    sector: '',
    crops: ''
  });

  const [harvestForm, setHarvestForm] = useState({
    crop: '',
    expectedQuantityKg: '',
    expectedHarvestDate: '',
    qualityIndicators: ''
  });

  useEffect(() => {
    loadFarmerData();
  }, []);

  const loadFarmerData = async () => {
    try {
      const [profileRes, declarationsRes, pricesRes, paymentsRes] = await Promise.all([
        api.get('/api/farmers/profile'),
        api.get('/api/farmers/harvest-declarations'),
        api.get('/api/marketprices/latest'),
        api.get('/api/payments/farmer-balances')
      ]);

      setProfile(profileRes.data);
      setHarvestDeclarations(declarationsRes.data);
      setMarketPrices(pricesRes.data);
      setPayments(paymentsRes.data?.transactions || []);
      
      // Load contributions (lots from this farmer)
      const lotsRes = await api.get('/api/lots');
      const farmerLots = lotsRes.data.filter((lot: Lot) => lot.farmer === user?.fullName);
      setContributions(farmerLots);
    } catch (error) {
      console.error('Failed to load farmer data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProfileUpdateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // In real implementation, this would send a request to cooperative
      alert('Update request submitted to cooperative for approval');
      setShowProfileEdit(false);
      loadFarmerData();
    } catch (error) {
      console.error('Failed to submit update request:', error);
    }
  };

  const handleHarvestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingHarvest) {
        // Update existing - in real implementation
        alert('Harvest forecast updated successfully');
      } else {
        await api.post('/api/farmers/harvest-declaration', {
          crop: harvestForm.crop,
          expectedQuantityKg: parseFloat(harvestForm.expectedQuantityKg),
          expectedHarvestDate: harvestForm.expectedHarvestDate,
          qualityIndicators: harvestForm.qualityIndicators
        });
        alert('Harvest declaration submitted successfully');
      }
      setHarvestForm({ crop: '', expectedQuantityKg: '', expectedHarvestDate: '', qualityIndicators: '' });
      setEditingHarvest(null);
      setShowHarvestForm(false);
      loadFarmerData();
    } catch (error: any) {
      alert(error.response?.data || 'Failed to submit harvest declaration');
    }
  };

  const handleEditHarvest = (declaration: HarvestDeclaration) => {
    if (declaration.status === 'Pending') {
      setEditingHarvest(declaration);
      setHarvestForm({
        crop: declaration.crop,
        expectedQuantityKg: declaration.expectedQuantityKg.toString(),
        expectedHarvestDate: declaration.expectedHarvestDate.split('T')[0],
        qualityIndicators: declaration.qualityIndicators
      });
      setShowHarvestForm(true);
    } else {
      alert('Only pending forecasts can be edited');
    }
  };

  const handleDeleteHarvest = async (declaration: HarvestDeclaration) => {
    if (declaration.status === 'Pending') {
      if (confirm('Are you sure you want to cancel this harvest forecast?')) {
        // In real implementation, call DELETE endpoint
        alert('Harvest forecast cancelled');
        loadFarmerData();
      }
    } else {
      alert('Only pending forecasts can be cancelled');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  const stats = {
    totalHarvests: harvestDeclarations.length,
    pendingHarvests: harvestDeclarations.filter(h => h.status === 'Pending').length,
    totalContributions: contributions.reduce((sum, c) => sum + c.quantityKg, 0),
    totalPayments: payments.filter(p => p.status === 'Paid').reduce((sum, p) => sum + p.amount, 0)
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-green-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-blue-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold mb-2">Farmer Dashboard</h1>
              <p className="text-green-100">Welcome back, {user?.fullName}</p>
            </div>
            {profile?.cooperative && (
              <div className="bg-white/20 backdrop-blur-sm rounded-lg px-6 py-4">
                <p className="text-sm text-green-100">Cooperative</p>
                <p className="text-xl font-semibold">{profile.cooperative.name}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Harvest Forecasts</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalHarvests}</p>
                <p className="text-xs text-gray-500 mt-1">{stats.pendingHarvests} pending</p>
              </div>
              <div className="bg-blue-100 rounded-full p-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Total Contributions</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalContributions.toLocaleString()} kg</p>
                <p className="text-xs text-gray-500 mt-1">Produce delivered</p>
              </div>
              <div className="bg-green-100 rounded-full p-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-yellow-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Total Payments</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalPayments.toLocaleString()} RWF</p>
                <p className="text-xs text-gray-500 mt-1">Received</p>
              </div>
              <div className="bg-yellow-100 rounded-full p-4">
                <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-purple-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Market Prices</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{marketPrices.length}</p>
                <p className="text-xs text-gray-500 mt-1">Available markets</p>
              </div>
              <div className="bg-purple-100 rounded-full p-4">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white rounded-xl shadow-lg mb-6">
          <div className="flex space-x-1 p-2 border-b border-gray-200">
            {[
              { id: 'overview', label: 'Overview', icon: '📊' },
              { id: 'profile', label: 'My Profile', icon: '👤' },
              { id: 'harvest', label: 'Harvest Forecasts', icon: '🌾' },
              { id: 'contributions', label: 'Contributions', icon: '📦' },
              { id: 'payments', label: 'Payments', icon: '💰' },
              { id: 'prices', label: 'Market Prices', icon: '📈' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Recent Harvest Forecasts</h2>
              <div className="space-y-3">
                {harvestDeclarations.slice(0, 5).map((declaration) => (
                  <div key={declaration.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-gray-900">{declaration.crop}</h3>
                        <p className="text-sm text-gray-600">
                          {declaration.expectedQuantityKg}kg • {new Date(declaration.expectedHarvestDate).toLocaleDateString()}
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        declaration.status === 'Approved' ? 'bg-green-100 text-green-800' :
                        declaration.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {declaration.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Recent Payments</h2>
              <div className="space-y-3">
                {payments.slice(0, 5).map((payment) => (
                  <div key={payment.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-semibold text-gray-900">{payment.amount?.toLocaleString()} RWF</p>
                        <p className="text-sm text-gray-600">{payment.transactionReference}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        payment.status === 'Paid' ? 'bg-green-100 text-green-800' :
                        payment.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {payment.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Profile Tab */}
        {activeTab === 'profile' && profile && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">My Profile</h2>
              <button
                onClick={() => {
                  setProfileUpdateForm({
                    phone: profile.phone,
                    district: profile.district,
                    sector: profile.sector,
                    crops: profile.crops
                  });
                  setShowProfileEdit(true);
                }}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Request Update
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Full Name</label>
                  <p className="text-gray-900 bg-gray-50 p-3 rounded-lg">{profile.fullName}</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
                  <p className="text-gray-900 bg-gray-50 p-3 rounded-lg">{profile.email}</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Phone</label>
                  <p className="text-gray-900 bg-gray-50 p-3 rounded-lg">{profile.phone}</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">National ID</label>
                  <p className="text-gray-900 bg-gray-50 p-3 rounded-lg">{profile.nationalId}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">District</label>
                  <p className="text-gray-900 bg-gray-50 p-3 rounded-lg">{profile.district}</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Sector</label>
                  <p className="text-gray-900 bg-gray-50 p-3 rounded-lg">{profile.sector}</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Crops Grown</label>
                  <p className="text-gray-900 bg-gray-50 p-3 rounded-lg">{profile.crops}</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Farm Size</label>
                  <p className="text-gray-900 bg-gray-50 p-3 rounded-lg">{profile.farmSizeHectares} hectares</p>
                </div>
              </div>
            </div>
            {profile.cooperative && (
              <div className="mt-6 p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-green-200">
                <h3 className="font-semibold text-gray-900 mb-2">Cooperative Affiliation</h3>
                <p className="text-lg font-medium text-gray-900">{profile.cooperative.name}</p>
                <p className="text-sm text-gray-600">{profile.cooperative.location}</p>
              </div>
            )}
          </div>
        )}

        {/* Harvest Forecasts Tab */}
        {activeTab === 'harvest' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-900">Harvest Forecasts</h2>
                <button
                  onClick={() => {
                    setEditingHarvest(null);
                    setHarvestForm({ crop: '', expectedQuantityKg: '', expectedHarvestDate: '', qualityIndicators: '' });
                    setShowHarvestForm(true);
                  }}
                  className="bg-gradient-to-r from-green-600 to-blue-600 text-white px-6 py-2 rounded-lg hover:shadow-lg transition-all font-medium"
                >
                  + New Forecast
                </button>
              </div>
              <DataTable
                data={harvestDeclarations}
                columns={[
                  { header: 'Crop', accessor: 'crop' },
                  { header: 'Expected Quantity', accessor: (row) => `${row.expectedQuantityKg} kg` },
                  { header: 'Harvest Date', accessor: (row) => new Date(row.expectedHarvestDate).toLocaleDateString() },
                  { header: 'Status', accessor: (row) => (
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      row.status === 'Approved' ? 'bg-green-100 text-green-800' :
                      row.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {row.status}
                    </span>
                  )}
                ]}
                onEdit={handleEditHarvest}
                onDelete={handleDeleteHarvest}
                emptyMessage="No harvest forecasts yet. Create your first forecast!"
              />
            </div>
          </div>
        )}

        {/* Contributions Tab */}
        {activeTab === 'contributions' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">My Produce Contributions</h2>
            <DataTable
              data={contributions}
              columns={[
                { header: 'Crop', accessor: 'crop' },
                { header: 'Quantity', accessor: (row) => `${row.quantityKg} kg` },
                { header: 'Quality Grade', accessor: (row) => (
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                    Grade {row.qualityGrade}
                  </span>
                )},
                { header: 'Status', accessor: 'status' },
                { header: 'Date', accessor: (row) => row.expectedHarvestDate ? new Date(row.expectedHarvestDate).toLocaleDateString() : 'N/A' }
              ]}
              emptyMessage="No contributions recorded yet"
            />
          </div>
        )}

        {/* Payments Tab */}
        {activeTab === 'payments' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Payment History</h2>
            <div className="mb-6 grid grid-cols-3 gap-4">
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Total Paid</p>
                <p className="text-2xl font-bold text-green-600">
                  {payments.filter(p => p.status === 'Paid').reduce((sum, p) => sum + (p.amount || 0), 0).toLocaleString()} RWF
                </p>
              </div>
              <div className="bg-yellow-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {payments.filter(p => p.status === 'Pending').reduce((sum, p) => sum + (p.amount || 0), 0).toLocaleString()} RWF
                </p>
              </div>
              <div className="bg-red-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Failed</p>
                <p className="text-2xl font-bold text-red-600">
                  {payments.filter(p => p.status === 'Failed').reduce((sum, p) => sum + (p.amount || 0), 0).toLocaleString()} RWF
                </p>
              </div>
            </div>
            <DataTable
              data={payments}
              columns={[
                { header: 'Amount', accessor: (row) => `${row.amount?.toLocaleString()} RWF` },
                { header: 'Reference', accessor: 'transactionReference' },
                { header: 'Method', accessor: 'paymentMethod' },
                { header: 'Status', accessor: (row) => (
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    row.status === 'Paid' ? 'bg-green-100 text-green-800' :
                    row.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {row.status}
                  </span>
                )},
                { header: 'Date', accessor: (row) => row.createdAt ? new Date(row.createdAt).toLocaleDateString() : 'N/A' }
              ]}
              emptyMessage="No payment records yet"
            />
          </div>
        )}

        {/* Market Prices Tab */}
        {activeTab === 'prices' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Current Market Prices</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {marketPrices.map((price) => (
                <div key={price.id} className="border-2 border-gray-200 rounded-xl p-5 hover:border-blue-500 hover:shadow-lg transition-all">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{price.crop}</h3>
                      <p className="text-sm text-gray-600">{price.market}</p>
                    </div>
                    <span className="text-2xl font-bold text-green-600">{price.pricePerKg} RWF</span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Updated: {new Date(price.observedAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Profile Edit Modal */}
      <Modal
        isOpen={showProfileEdit}
        onClose={() => setShowProfileEdit(false)}
        title="Request Profile Update"
        size="md"
      >
        <form onSubmit={handleProfileUpdateRequest} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
            <input
              type="tel"
              value={profileUpdateForm.phone}
              onChange={(e) => setProfileUpdateForm({...profileUpdateForm, phone: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">District</label>
            <input
              type="text"
              value={profileUpdateForm.district}
              onChange={(e) => setProfileUpdateForm({...profileUpdateForm, district: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sector</label>
            <input
              type="text"
              value={profileUpdateForm.sector}
              onChange={(e) => setProfileUpdateForm({...profileUpdateForm, sector: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Crops Grown</label>
            <input
              type="text"
              value={profileUpdateForm.crops}
              onChange={(e) => setProfileUpdateForm({...profileUpdateForm, crops: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Tomatoes, Potatoes"
              required
            />
          </div>
          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-lg hover:shadow-lg transition-all font-medium"
            >
              Submit Request
            </button>
            <button
              type="button"
              onClick={() => setShowProfileEdit(false)}
              className="flex-1 bg-gray-200 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      {/* Harvest Form Modal */}
      <Modal
        isOpen={showHarvestForm}
        onClose={() => {
          setShowHarvestForm(false);
          setEditingHarvest(null);
        }}
        title={editingHarvest ? "Edit Harvest Forecast" : "New Harvest Forecast"}
        size="md"
      >
        <form onSubmit={handleHarvestSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Crop Type</label>
            <select
              value={harvestForm.crop}
              onChange={(e) => setHarvestForm({...harvestForm, crop: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="">Select crop</option>
              <option value="Tomatoes">Tomatoes</option>
              <option value="Potatoes">Potatoes</option>
              <option value="Maize">Maize</option>
              <option value="Beans">Beans</option>
              <option value="Rice">Rice</option>
              <option value="Wheat">Wheat</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Expected Quantity (kg)</label>
            <input
              type="number"
              value={harvestForm.expectedQuantityKg}
              onChange={(e) => setHarvestForm({...harvestForm, expectedQuantityKg: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              min="1"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Expected Harvest Date</label>
            <input
              type="date"
              value={harvestForm.expectedHarvestDate}
              onChange={(e) => setHarvestForm({...harvestForm, expectedHarvestDate: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quality Indicators</label>
            <textarea
              value={harvestForm.qualityIndicators}
              onChange={(e) => setHarvestForm({...harvestForm, qualityIndicators: e.target.value})}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Describe expected quality (size, color, texture, etc.)"
            />
          </div>
          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-gradient-to-r from-green-600 to-blue-600 text-white px-6 py-3 rounded-lg hover:shadow-lg transition-all font-medium"
            >
              {editingHarvest ? 'Update Forecast' : 'Submit Forecast'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowHarvestForm(false);
                setEditingHarvest(null);
              }}
              className="flex-1 bg-gray-200 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
