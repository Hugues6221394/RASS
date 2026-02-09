import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { Modal } from '../components/Modal';
import { DataTable } from '../components/DataTable';
import type { Cooperative, Lot, MarketListing, BuyerOrder, FarmerProfile } from '../types';

export const CooperativeDashboardPage = () => {
  const { user } = useAuth();
  const [cooperative, setCooperative] = useState<Cooperative | null>(null);
  const [farmers, setFarmers] = useState<FarmerProfile[]>([]);
  const [inventory, setInventory] = useState<Lot[]>([]);
  const [listings, setListings] = useState<MarketListing[]>([]);
  const [orders, setOrders] = useState<BuyerOrder[]>([]);
  const [transporters, setTransporters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'farmers' | 'inventory' | 'listings' | 'orders' | 'logistics' | 'payments'>('overview');

  // Modals
  const [showFarmerForm, setShowFarmerForm] = useState(false);
  const [showInventoryForm, setShowInventoryForm] = useState(false);
  const [showListingForm, setShowListingForm] = useState(false);
  const [showStorageModal, setShowStorageModal] = useState(false);
  const [showTransporterModal, setShowTransporterModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  // Forms
  const [farmerForm, setFarmerForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    nationalId: '',
    district: '',
    sector: '',
    crops: '',
    farmSizeHectares: ''
  });

  const [inventoryForm, setInventoryForm] = useState({
    farmerId: '',
    crop: '',
    quantityKg: '',
    qualityGrade: 'A',
    storageLocation: ''
  });

  const [listingForm, setListingForm] = useState({
    crop: '',
    quantityKg: '',
    minimumPrice: '',
    availabilityWindowStart: '',
    availabilityWindowEnd: '',
    description: '',
    qualityGrade: 'A'
  });

  useEffect(() => {
    loadCooperativeData();
  }, []);

  const loadCooperativeData = async () => {
    try {
      const [coopRes, farmersRes, inventoryRes, listingsRes, ordersRes, transportersRes] = await Promise.all([
        api.get('/api/cooperative/my-cooperative'),
        api.get('/api/farmers'),
        api.get('/api/lots'),
        api.get('/api/cooperative/market-listings'),
        api.get('/api/cooperative/orders'),
        api.get('/api/cooperative/available-transporters')
      ]);

      setCooperative(coopRes.data);
      setFarmers(farmersRes.data.filter((f: any) => f.cooperative === coopRes.data.name));
      setInventory(inventoryRes.data.filter((lot: Lot) => lot.cooperative === coopRes.data.name));
      setListings(listingsRes.data);
      setOrders(ordersRes.data);
      setTransporters(transportersRes.data);
    } catch (error) {
      console.error('Failed to load cooperative data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Farmer CRUD
  const handleRegisterFarmer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/api/farmers/register', {
        ...farmerForm,
        farmSizeHectares: parseFloat(farmerForm.farmSizeHectares),
        cooperativeId: cooperative?.id
      });
      alert('Farmer registered successfully!');
      setShowFarmerForm(false);
      setFarmerForm({ fullName: '', email: '', phone: '', nationalId: '', district: '', sector: '', crops: '', farmSizeHectares: '' });
      loadCooperativeData();
    } catch (error: any) {
      alert(error.response?.data || 'Failed to register farmer');
    }
  };

  const handleEditFarmer = (farmer: FarmerProfile) => {
    setEditingItem(farmer);
    setFarmerForm({
      fullName: farmer.fullName,
      email: farmer.email,
      phone: farmer.phone,
      nationalId: farmer.nationalId,
      district: farmer.district,
      sector: farmer.sector,
      crops: farmer.crops,
      farmSizeHectares: farmer.farmSizeHectares.toString()
    });
    setShowFarmerForm(true);
  };

  const handleDeactivateFarmer = async (farmer: FarmerProfile) => {
    if (confirm(`Deactivate farmer ${farmer.fullName}?`)) {
      // In real implementation, call deactivate endpoint
      alert('Farmer deactivated');
      loadCooperativeData();
    }
  };

  // Inventory CRUD
  const handleAddInventory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/api/cooperative/inventory', {
        crop: inventoryForm.crop,
        quantityKg: parseFloat(inventoryForm.quantityKg),
        qualityGrade: inventoryForm.qualityGrade
      });
      alert('Inventory added successfully!');
      setShowInventoryForm(false);
      setInventoryForm({ farmerId: '', crop: '', quantityKg: '', qualityGrade: 'A', storageLocation: '' });
      loadCooperativeData();
    } catch (error: any) {
      alert(error.response?.data || 'Failed to add inventory');
    }
  };

  const handleEditInventory = (lot: Lot) => {
    setEditingItem(lot);
    setInventoryForm({
      farmerId: '',
      crop: lot.crop,
      quantityKg: lot.quantityKg.toString(),
      qualityGrade: lot.qualityGrade,
      storageLocation: ''
    });
    setShowInventoryForm(true);
  };

  const handleDeleteInventory = async (lot: Lot) => {
    if (confirm(`Remove ${lot.quantityKg}kg of ${lot.crop} from inventory?`)) {
      // In real implementation, call delete endpoint
      alert('Inventory removed');
      loadCooperativeData();
    }
  };

  // Market Listing CRUD
  const handleCreateListing = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/api/cooperative/market-listing', {
        crop: listingForm.crop,
        quantityKg: parseFloat(listingForm.quantityKg),
        minimumPrice: parseFloat(listingForm.minimumPrice),
        availabilityWindowStart: listingForm.availabilityWindowStart,
        availabilityWindowEnd: listingForm.availabilityWindowEnd,
        description: listingForm.description,
        qualityGrade: listingForm.qualityGrade
      });
      alert('Market listing created successfully!');
      setShowListingForm(false);
      setListingForm({ crop: '', quantityKg: '', minimumPrice: '', availabilityWindowStart: '', availabilityWindowEnd: '', description: '', qualityGrade: 'A' });
      loadCooperativeData();
    } catch (error: any) {
      alert(error.response?.data || 'Failed to create listing');
    }
  };

  const handleEditListing = (listing: MarketListing) => {
    setEditingItem(listing);
    setListingForm({
      crop: listing.crop,
      quantityKg: listing.quantityKg.toString(),
      minimumPrice: listing.minimumPrice.toString(),
      availabilityWindowStart: listing.availabilityWindowStart.split('T')[0],
      availabilityWindowEnd: listing.availabilityWindowEnd.split('T')[0],
      description: listing.description,
      qualityGrade: listing.qualityGrade
    });
    setShowListingForm(true);
  };

  const handleCancelListing = async (listing: MarketListing) => {
    if (confirm('Cancel this market listing?')) {
      // In real implementation, call cancel endpoint
      alert('Listing cancelled');
      loadCooperativeData();
    }
  };

  // Order Management
  const handleRespondToOrder = async (orderId: string, accepted: boolean) => {
    try {
      await api.post(`/api/cooperative/order/${orderId}/respond`, { accepted });
      alert(`Order ${accepted ? 'accepted' : 'rejected'} successfully`);
      loadCooperativeData();
    } catch (error: any) {
      alert(error.response?.data || 'Failed to respond to order');
    }
  };

  // Logistics
  const handleAssignStorage = async (orderId: string, facilityId: string, startDate: string, endDate: string) => {
    try {
      await api.post(`/api/cooperative/order/${orderId}/assign-storage`, {
        storageFacilityId: facilityId,
        startDate,
        endDate
      });
      alert('Storage assigned successfully');
      setShowStorageModal(false);
      loadCooperativeData();
    } catch (error: any) {
      alert(error.response?.data || 'Failed to assign storage');
    }
  };

  const handleAssignTransporter = async (transportId: string, transporterId: string) => {
    try {
      await api.post(`/api/cooperative/transport/${transportId}/assign-transporter`, {
        transporterId
      });
      alert('Transporter assigned successfully');
      setShowTransporterModal(false);
      loadCooperativeData();
    } catch (error: any) {
      alert(error.response?.data || 'Failed to assign transporter');
    }
  };

  // Payment Distribution
  const handleSettlePayments = async (contractId: string, paymentMethod: string) => {
    try {
      await api.post('/api/payments/settle-farmer-payments', {
        contractId,
        paymentMethod
      });
      alert('Farmer payments settled successfully');
      setShowPaymentModal(false);
      loadCooperativeData();
    } catch (error: any) {
      alert(error.response?.data || 'Failed to settle payments');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading cooperative dashboard...</p>
        </div>
      </div>
    );
  }

  const stats = {
    totalFarmers: farmers.length,
    totalInventory: inventory.reduce((sum, i) => sum + i.quantityKg, 0),
    activeListings: listings.filter(l => l.status === 'Active').length,
    pendingOrders: orders.filter(o => o.status === 'Open').length
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold mb-2">Cooperative Dashboard</h1>
              <p className="text-blue-100">{cooperative?.name} • {user?.fullName}</p>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-lg px-6 py-4">
              <p className="text-sm text-blue-100">Region</p>
              <p className="text-xl font-semibold">{cooperative?.region}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Registered Farmers</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalFarmers}</p>
              </div>
              <div className="bg-blue-100 rounded-full p-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Total Inventory</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalInventory.toLocaleString()} kg</p>
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
                <p className="text-gray-600 text-sm font-medium">Active Listings</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.activeListings}</p>
              </div>
              <div className="bg-yellow-100 rounded-full p-4">
                <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-purple-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Pending Orders</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.pendingOrders}</p>
              </div>
              <div className="bg-purple-100 rounded-full p-4">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white rounded-xl shadow-lg mb-6">
          <div className="flex space-x-1 p-2 border-b border-gray-200 overflow-x-auto">
            {[
              { id: 'overview', label: 'Overview', icon: '📊' },
              { id: 'farmers', label: 'Farmers', icon: '👥' },
              { id: 'inventory', label: 'Inventory', icon: '📦' },
              { id: 'listings', label: 'Market Listings', icon: '🏪' },
              { id: 'orders', label: 'Orders', icon: '🛒' },
              { id: 'logistics', label: 'Logistics', icon: '🚛' },
              { id: 'payments', label: 'Payments', icon: '💰' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-md'
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
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Recent Orders</h2>
              <div className="space-y-3">
                {orders.slice(0, 5).map((order) => (
                  <div key={order.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-gray-900">{order.crop} • {order.quantityKg}kg</h3>
                        <p className="text-sm text-gray-600">{order.buyer}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        order.status === 'Accepted' ? 'bg-green-100 text-green-800' :
                        order.status === 'Open' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {order.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Inventory Summary</h2>
              <div className="space-y-3">
                {inventory.slice(0, 5).map((lot) => (
                  <div key={lot.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-semibold text-gray-900">{lot.crop}</h3>
                        <p className="text-sm text-gray-600">{lot.quantityKg}kg • Grade {lot.qualityGrade}</p>
                      </div>
                      <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                        {lot.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Farmers Tab */}
        {activeTab === 'farmers' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Farmers Management</h2>
              <button
                onClick={() => {
                  setEditingItem(null);
                  setFarmerForm({ fullName: '', email: '', phone: '', nationalId: '', district: '', sector: '', crops: '', farmSizeHectares: '' });
                  setShowFarmerForm(true);
                }}
                className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white px-6 py-2 rounded-lg hover:shadow-lg transition-all font-medium"
              >
                + Register Farmer
              </button>
            </div>
            <DataTable
              data={farmers}
              columns={[
                { header: 'Name', accessor: 'fullName' },
                { header: 'Email', accessor: 'email' },
                { header: 'Phone', accessor: 'phone' },
                { header: 'District', accessor: 'district' },
                { header: 'Crops', accessor: 'crops' },
                { header: 'Status', accessor: (row) => (
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    row.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {row.isActive ? 'Active' : 'Inactive'}
                  </span>
                )}
              ]}
              onEdit={handleEditFarmer}
              onDelete={handleDeactivateFarmer}
              emptyMessage="No farmers registered yet"
            />
          </div>
        )}

        {/* Inventory Tab */}
        {activeTab === 'inventory' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Inventory Management</h2>
                <button
                  onClick={() => {
                    setEditingItem(null);
                    setInventoryForm({ farmerId: '', crop: '', quantityKg: '', qualityGrade: 'A', storageLocation: '' });
                    setShowInventoryForm(true);
                  }}
                  className="bg-gradient-to-r from-green-600 to-blue-600 text-white px-6 py-2 rounded-lg hover:shadow-lg transition-all font-medium"
                >
                  + Add Inventory
                </button>
              </div>
              <DataTable
                data={inventory}
                columns={[
                  { header: 'Crop', accessor: 'crop' },
                  { header: 'Quantity', accessor: (row) => `${row.quantityKg} kg` },
                  { header: 'Quality', accessor: (row) => (
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                      Grade {row.qualityGrade}
                    </span>
                  )},
                  { header: 'Status', accessor: 'status' },
                  { header: 'Date', accessor: (row) => row.expectedHarvestDate ? new Date(row.expectedHarvestDate).toLocaleDateString() : 'N/A' }
                ]}
                onEdit={handleEditInventory}
                onDelete={handleDeleteInventory}
                emptyMessage="No inventory recorded yet"
              />
            </div>
          </div>
        )}

        {/* Market Listings Tab */}
        {activeTab === 'listings' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Market Listings</h2>
              <button
                onClick={() => {
                  setEditingItem(null);
                  setListingForm({ crop: '', quantityKg: '', minimumPrice: '', availabilityWindowStart: '', availabilityWindowEnd: '', description: '', qualityGrade: 'A' });
                  setShowListingForm(true);
                }}
                className="bg-gradient-to-r from-yellow-600 to-orange-600 text-white px-6 py-2 rounded-lg hover:shadow-lg transition-all font-medium"
              >
                + Create Listing
              </button>
            </div>
            <DataTable
              data={listings}
              columns={[
                { header: 'Crop', accessor: 'crop' },
                { header: 'Quantity', accessor: (row) => `${row.quantityKg} kg` },
                { header: 'Min Price', accessor: (row) => `${row.minimumPrice} RWF/kg` },
                { header: 'Quality', accessor: (row) => `Grade ${row.qualityGrade}` },
                { header: 'Status', accessor: (row) => (
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    row.status === 'Active' ? 'bg-green-100 text-green-800' :
                    row.status === 'Sold' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {row.status}
                  </span>
                )}
              ]}
              onEdit={handleEditListing}
              onDelete={handleCancelListing}
              emptyMessage="No market listings yet"
            />
          </div>
        )}

        {/* Orders Tab */}
        {activeTab === 'orders' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Buyer Orders</h2>
            <div className="space-y-4">
              {orders.map((order) => (
                <div key={order.id} className="border-2 rounded-xl p-6 hover:shadow-lg transition-shadow">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900 mb-2">{order.crop} • {order.quantityKg}kg</h3>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-600">Buyer:</p>
                          <p className="font-medium">{order.buyer}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Delivery Location:</p>
                          <p className="font-medium">{order.deliveryLocation}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Price Offer:</p>
                          <p className="font-medium text-green-600">{order.priceOffer} RWF/kg</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Delivery Window:</p>
                          <p className="font-medium">{new Date(order.deliveryWindowStart).toLocaleDateString()} - {new Date(order.deliveryWindowEnd).toLocaleDateString()}</p>
                        </div>
                      </div>
                      {order.notes && (
                        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-600"><strong>Notes:</strong> {order.notes}</p>
                        </div>
                      )}
                    </div>
                    <span className={`px-4 py-2 rounded-lg text-sm font-medium ml-4 ${
                      order.status === 'Accepted' ? 'bg-green-100 text-green-800' :
                      order.status === 'Rejected' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {order.status}
                    </span>
                  </div>

                  {order.status === 'Open' && (
                    <div className="flex space-x-3 mt-4">
                      <button
                        onClick={() => handleRespondToOrder(order.id, true)}
                        className="flex-1 bg-gradient-to-r from-green-600 to-green-700 text-white px-6 py-3 rounded-lg hover:shadow-lg transition-all font-medium"
                      >
                        ✓ Accept Order
                      </button>
                      <button
                        onClick={() => handleRespondToOrder(order.id, false)}
                        className="flex-1 bg-gradient-to-r from-red-600 to-red-700 text-white px-6 py-3 rounded-lg hover:shadow-lg transition-all font-medium"
                      >
                        ✗ Reject Order
                      </button>
                    </div>
                  )}

                  {order.status === 'Accepted' && (
                    <div className="mt-4 flex space-x-3">
                      <button
                        onClick={() => setShowStorageModal(true)}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Assign Storage
                      </button>
                      <button
                        onClick={() => setShowTransporterModal(true)}
                        className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
                      >
                        Assign Transporter
                      </button>
                      <button
                        onClick={() => setShowPaymentModal(true)}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                      >
                        Settle Payments
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Logistics Tab */}
        {activeTab === 'logistics' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Logistics Management</h2>
            <p className="text-gray-600">Transport requests and assignments will appear here</p>
          </div>
        )}

        {/* Payments Tab */}
        {activeTab === 'payments' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Payment Distribution</h2>
            <p className="text-gray-600">Payment settlement and distribution management</p>
          </div>
        )}
      </div>

      {/* Farmer Registration Modal */}
      <Modal
        isOpen={showFarmerForm}
        onClose={() => setShowFarmerForm(false)}
        title={editingItem ? "Edit Farmer" : "Register New Farmer"}
        size="lg"
      >
        <form onSubmit={handleRegisterFarmer} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
              <input
                type="text"
                value={farmerForm.fullName}
                onChange={(e) => setFarmerForm({...farmerForm, fullName: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <input
                type="email"
                value={farmerForm.email}
                onChange={(e) => setFarmerForm({...farmerForm, email: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
              <input
                type="tel"
                value={farmerForm.phone}
                onChange={(e) => setFarmerForm({...farmerForm, phone: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">National ID *</label>
              <input
                type="text"
                value={farmerForm.nationalId}
                onChange={(e) => setFarmerForm({...farmerForm, nationalId: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">District *</label>
              <input
                type="text"
                value={farmerForm.district}
                onChange={(e) => setFarmerForm({...farmerForm, district: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sector *</label>
              <input
                type="text"
                value={farmerForm.sector}
                onChange={(e) => setFarmerForm({...farmerForm, sector: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Crops *</label>
              <input
                type="text"
                value={farmerForm.crops}
                onChange={(e) => setFarmerForm({...farmerForm, crops: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Tomatoes, Potatoes"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Farm Size (hectares) *</label>
              <input
                type="number"
                step="0.1"
                value={farmerForm.farmSizeHectares}
                onChange={(e) => setFarmerForm({...farmerForm, farmSizeHectares: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>
          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-700 text-white px-6 py-3 rounded-lg hover:shadow-lg transition-all font-medium"
            >
              {editingItem ? 'Update Farmer' : 'Register Farmer'}
            </button>
            <button
              type="button"
              onClick={() => setShowFarmerForm(false)}
              className="flex-1 bg-gray-200 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      {/* Inventory Form Modal */}
      <Modal
        isOpen={showInventoryForm}
        onClose={() => setShowInventoryForm(false)}
        title={editingItem ? "Edit Inventory" : "Add to Inventory"}
        size="md"
      >
        <form onSubmit={handleAddInventory} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Crop *</label>
            <select
              value={inventoryForm.crop}
              onChange={(e) => setInventoryForm({...inventoryForm, crop: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Select crop</option>
              <option value="Tomatoes">Tomatoes</option>
              <option value="Potatoes">Potatoes</option>
              <option value="Maize">Maize</option>
              <option value="Beans">Beans</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quantity (kg) *</label>
            <input
              type="number"
              value={inventoryForm.quantityKg}
              onChange={(e) => setInventoryForm({...inventoryForm, quantityKg: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quality Grade *</label>
            <select
              value={inventoryForm.qualityGrade}
              onChange={(e) => setInventoryForm({...inventoryForm, qualityGrade: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="A">Grade A (Premium)</option>
              <option value="B">Grade B (Standard)</option>
              <option value="C">Grade C (Basic)</option>
            </select>
          </div>
          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-gradient-to-r from-green-600 to-blue-600 text-white px-6 py-3 rounded-lg hover:shadow-lg transition-all font-medium"
            >
              {editingItem ? 'Update' : 'Add to Inventory'}
            </button>
            <button
              type="button"
              onClick={() => setShowInventoryForm(false)}
              className="flex-1 bg-gray-200 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      {/* Market Listing Form Modal */}
      <Modal
        isOpen={showListingForm}
        onClose={() => setShowListingForm(false)}
        title={editingItem ? "Edit Market Listing" : "Create Market Listing"}
        size="lg"
      >
        <form onSubmit={handleCreateListing} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Crop *</label>
              <select
                value={listingForm.crop}
                onChange={(e) => setListingForm({...listingForm, crop: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select crop</option>
                <option value="Tomatoes">Tomatoes</option>
                <option value="Potatoes">Potatoes</option>
                <option value="Maize">Maize</option>
                <option value="Beans">Beans</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantity (kg) *</label>
              <input
                type="number"
                value={listingForm.quantityKg}
                onChange={(e) => setListingForm({...listingForm, quantityKg: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Price (RWF/kg) *</label>
              <input
                type="number"
                value={listingForm.minimumPrice}
                onChange={(e) => setListingForm({...listingForm, minimumPrice: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quality Grade *</label>
              <select
                value={listingForm.qualityGrade}
                onChange={(e) => setListingForm({...listingForm, qualityGrade: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="A">Grade A</option>
                <option value="B">Grade B</option>
                <option value="C">Grade C</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Available From *</label>
              <input
                type="date"
                value={listingForm.availabilityWindowStart}
                onChange={(e) => setListingForm({...listingForm, availabilityWindowStart: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Available Until *</label>
              <input
                type="date"
                value={listingForm.availabilityWindowEnd}
                onChange={(e) => setListingForm({...listingForm, availabilityWindowEnd: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={listingForm.description}
              onChange={(e) => setListingForm({...listingForm, description: e.target.value})}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Describe your produce..."
            />
          </div>
          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-gradient-to-r from-yellow-600 to-orange-600 text-white px-6 py-3 rounded-lg hover:shadow-lg transition-all font-medium"
            >
              {editingItem ? 'Update Listing' : 'Create Listing'}
            </button>
            <button
              type="button"
              onClick={() => setShowListingForm(false)}
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
