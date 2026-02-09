import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { Modal } from '../components/Modal';
import { DataTable } from '../components/DataTable';
import type { BuyerProfile, MarketListing, BuyerOrder } from '../types';

export const BuyerDashboardPage = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<BuyerProfile | null>(null);
  const [listings, setListings] = useState<MarketListing[]>([]);
  const [myOrders, setMyOrders] = useState<BuyerOrder[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'marketplace' | 'orders' | 'profile' | 'payments'>('overview');

  // Modals
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedListing, setSelectedListing] = useState<MarketListing | null>(null);

  // Filters
  const [filters, setFilters] = useState({
    crop: '',
    minQuantity: '',
    maxPrice: '',
    region: ''
  });

  // Forms
  const [profileForm, setProfileForm] = useState({
    organization: '',
    businessType: '',
    location: '',
    phone: ''
  });

  const [orderForm, setOrderForm] = useState({
    quantityKg: '',
    priceOffer: '',
    deliveryLocation: '',
    notes: ''
  });

  useEffect(() => {
    loadBuyerData();
  }, []);

  const loadBuyerData = async () => {
    try {
      const [profileRes, listingsRes, ordersRes] = await Promise.all([
        api.get('/api/buyers/profile'),
        api.get('/api/buyers/marketplace'),
        api.get('/api/buyers/orders')
      ]);

      setProfile(profileRes.data);
      setListings(listingsRes.data);
      setMyOrders(ordersRes.data);
    } catch (error) {
      console.error('Failed to load buyer data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Profile CRUD
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // In real implementation, call update endpoint
      alert('Profile updated successfully');
      setShowProfileEdit(false);
      loadBuyerData();
    } catch (error) {
      alert('Failed to update profile');
    }
  };

  const handleDeactivateAccount = async () => {
    if (confirm('Deactivate your buyer account?')) {
      // In real implementation, call deactivate endpoint
      alert('Account deactivation requested');
    }
  };

  // Order CRUD
  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedListing) return;

    try {
      await api.post('/api/buyers/order', {
        marketListingId: selectedListing.id,
        crop: selectedListing.crop,
        quantityKg: parseFloat(orderForm.quantityKg),
        priceOffer: parseFloat(orderForm.priceOffer),
        deliveryLocation: orderForm.deliveryLocation,
        deliveryWindowStart: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        deliveryWindowEnd: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        notes: orderForm.notes
      });
      alert('Order placed successfully!');
      setShowOrderForm(false);
      setOrderForm({ quantityKg: '', priceOffer: '', deliveryLocation: '', notes: '' });
      setSelectedListing(null);
      loadBuyerData();
    } catch (error: any) {
      alert(error.response?.data || 'Failed to place order');
    }
  };

  const handleCancelOrder = async (order: BuyerOrder) => {
    if (order.status === 'Open') {
      if (confirm('Cancel this order?')) {
        // In real implementation, call cancel endpoint
        alert('Order cancelled');
        loadBuyerData();
      }
    } else {
      alert('Only open orders can be cancelled');
    }
  };

  // Payment CRUD
  const handleInitiatePayment = async (orderId: string, paymentMethod: string) => {
    try {
      await api.post(`/api/buyers/order/${orderId}/payment`, { paymentMethod });
      alert('Payment initiated successfully!');
      setShowPaymentModal(false);
      loadBuyerData();
    } catch (error: any) {
      alert(error.response?.data || 'Failed to initiate payment');
    }
  };

  const handleConfirmDelivery = async (orderId: string) => {
    const qualitySatisfactory = confirm('Was the quality of the produce satisfactory?');
    const notes = prompt('Any additional notes about the delivery?') || '';

    try {
      await api.post(`/api/buyers/order/${orderId}/confirm-delivery`, {
        qualitySatisfactory,
        notes
      });
      alert('Delivery confirmed! Payment released to cooperative.');
      loadBuyerData();
    } catch (error: any) {
      alert(error.response?.data || 'Failed to confirm delivery');
    }
  };

  const filteredListings = listings.filter(listing => {
    if (filters.crop && !listing.crop.toLowerCase().includes(filters.crop.toLowerCase())) return false;
    if (filters.minQuantity && listing.quantityKg < parseFloat(filters.minQuantity)) return false;
    if (filters.maxPrice && listing.minimumPrice > parseFloat(filters.maxPrice)) return false;
    if (filters.region && !listing.cooperative.region.toLowerCase().includes(filters.region.toLowerCase())) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading buyer dashboard...</p>
        </div>
      </div>
    );
  }

  const stats = {
    totalOrders: myOrders.length,
    activeOrders: myOrders.filter(o => o.status === 'Open' || o.status === 'Accepted').length,
    completedOrders: myOrders.filter(o => o.status === 'Completed').length,
    totalSpent: myOrders.filter(o => o.status === 'Completed').reduce((sum, o) => sum + (o.priceOffer * o.quantityKg), 0)
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-purple-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold mb-2">Buyer Dashboard</h1>
              <p className="text-purple-100">Welcome back, {user?.fullName}</p>
            </div>
            {profile && (
              <div className="bg-white/20 backdrop-blur-sm rounded-lg px-6 py-4">
                <p className="text-sm text-purple-100">Organization</p>
                <p className="text-xl font-semibold">{profile.organization}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-purple-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Total Orders</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalOrders}</p>
              </div>
              <div className="bg-purple-100 rounded-full p-4">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Active Orders</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.activeOrders}</p>
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
                <p className="text-gray-600 text-sm font-medium">Completed</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.completedOrders}</p>
              </div>
              <div className="bg-green-100 rounded-full p-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-yellow-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Total Spent</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalSpent.toLocaleString()} RWF</p>
              </div>
              <div className="bg-yellow-100 rounded-full p-4">
                <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
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
              { id: 'marketplace', label: 'Marketplace', icon: '🛒' },
              { id: 'orders', label: 'My Orders', icon: '📦' },
              { id: 'profile', label: 'Profile', icon: '👤' },
              { id: 'payments', label: 'Payments', icon: '💰' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
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
                {myOrders.slice(0, 5).map((order) => (
                  <div key={order.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-gray-900">{order.crop} • {order.quantityKg}kg</h3>
                        <p className="text-sm text-gray-600">{order.deliveryLocation}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        order.status === 'Accepted' ? 'bg-green-100 text-green-800' :
                        order.status === 'Open' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {order.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Available Listings</h2>
              <div className="space-y-3">
                {listings.slice(0, 5).map((listing) => (
                  <div key={listing.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-gray-900">{listing.crop}</h3>
                        <p className="text-sm text-gray-600">{listing.quantityKg}kg • {listing.minimumPrice} RWF/kg</p>
                      </div>
                      <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                        Available
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Marketplace Tab */}
        {activeTab === 'marketplace' && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Search Marketplace</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Crop</label>
                  <input
                    type="text"
                    value={filters.crop}
                    onChange={(e) => setFilters({...filters, crop: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="e.g., Tomatoes"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min Quantity (kg)</label>
                  <input
                    type="number"
                    value={filters.minQuantity}
                    onChange={(e) => setFilters({...filters, minQuantity: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Price (RWF/kg)</label>
                  <input
                    type="number"
                    value={filters.maxPrice}
                    onChange={(e) => setFilters({...filters, maxPrice: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Region</label>
                  <input
                    type="text"
                    value={filters.region}
                    onChange={(e) => setFilters({...filters, region: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="e.g., Northern"
                  />
                </div>
              </div>
            </div>

            {/* Listings Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredListings.map((listing) => (
                <div key={listing.id} className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-all border-2 border-transparent hover:border-purple-500">
                  <div className="mb-4">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-xl font-bold text-gray-900">{listing.crop}</h3>
                      <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                        Grade {listing.qualityGrade}
                      </span>
                    </div>
                    <p className="text-3xl font-bold text-green-600 mb-2">{listing.minimumPrice} RWF/kg</p>
                    <p className="text-gray-600 mb-2">{listing.quantityKg.toLocaleString()} kg available</p>
                    <p className="text-sm text-gray-500 mb-3">{listing.description}</p>
                    <div className="text-xs text-gray-500 space-y-1">
                      <p>Available: {new Date(listing.availabilityWindowStart).toLocaleDateString()} - {new Date(listing.availabilityWindowEnd).toLocaleDateString()}</p>
                    </div>
                  </div>

                  <div className="border-t pt-4 mb-4">
                    <h4 className="font-semibold text-gray-900 mb-1">{listing.cooperative.name}</h4>
                    <p className="text-sm text-gray-600">{listing.cooperative.location}</p>
                    <p className="text-sm text-gray-600">{listing.cooperative.region} Province</p>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedListing(listing);
                      setOrderForm({
                        quantityKg: '',
                        priceOffer: listing.minimumPrice.toString(),
                        deliveryLocation: '',
                        notes: ''
                      });
                      setShowOrderForm(true);
                    }}
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 px-4 rounded-lg hover:shadow-lg transition-all font-medium"
                  >
                    Place Order
                  </button>
                </div>
              ))}
            </div>

            {filteredListings.length === 0 && (
              <div className="text-center py-12 bg-white rounded-xl shadow-lg">
                <p className="text-gray-500 text-lg">No listings match your criteria.</p>
                <button
                  onClick={() => setFilters({ crop: '', minQuantity: '', maxPrice: '', region: '' })}
                  className="mt-4 text-purple-600 hover:text-purple-700 font-medium"
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>
        )}

        {/* Orders Tab */}
        {activeTab === 'orders' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">My Orders</h2>
            <div className="space-y-4">
              {myOrders.map((order) => (
                <div key={order.id} className="border-2 rounded-xl p-6 hover:shadow-lg transition-shadow">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900 mb-2">{order.crop} • {order.quantityKg}kg</h3>
                      <div className="grid grid-cols-2 gap-4 text-sm">
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
                        <div>
                          <p className="text-gray-600">Total Value:</p>
                          <p className="font-medium text-purple-600">{(order.priceOffer * order.quantityKg).toLocaleString()} RWF</p>
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
                      order.status === 'Open' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {order.status}
                    </span>
                  </div>

                  {order.status === 'Open' && (
                    <button
                      onClick={() => handleCancelOrder(order)}
                      className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
                    >
                      Cancel Order
                    </button>
                  )}

                  {order.status === 'Accepted' && !order.contract && (
                    <button
                      onClick={() => {
                        setSelectedListing(null);
                        setShowPaymentModal(true);
                      }}
                      className="bg-gradient-to-r from-green-600 to-green-700 text-white px-6 py-3 rounded-lg hover:shadow-lg transition-all font-medium"
                    >
                      Initiate Payment
                    </button>
                  )}

                  {order.contract && (
                    <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
                      <p className="font-semibold text-gray-900 mb-2">Contract: {order.contract.trackingId}</p>
                      <p className="text-sm text-gray-600 mb-3">Agreed Price: {order.contract.agreedPrice} RWF/kg</p>
                      <button
                        onClick={() => handleConfirmDelivery(order.id)}
                        className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded-lg hover:shadow-lg transition-all font-medium"
                      >
                        Confirm Delivery
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Profile Tab */}
        {activeTab === 'profile' && profile && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">My Profile</h2>
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setProfileForm({
                      organization: profile.organization,
                      businessType: profile.businessType,
                      location: profile.location,
                      phone: profile.phone
                    });
                    setShowProfileEdit(true);
                  }}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors font-medium"
                >
                  Edit Profile
                </button>
                <button
                  onClick={handleDeactivateAccount}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors font-medium"
                >
                  Deactivate Account
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Organization</label>
                  <p className="text-gray-900 bg-gray-50 p-3 rounded-lg">{profile.organization}</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Business Type</label>
                  <p className="text-gray-900 bg-gray-50 p-3 rounded-lg">{profile.businessType}</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Location</label>
                  <p className="text-gray-900 bg-gray-50 p-3 rounded-lg">{profile.location}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
                  <p className="text-gray-900 bg-gray-50 p-3 rounded-lg">{profile.email}</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Phone</label>
                  <p className="text-gray-900 bg-gray-50 p-3 rounded-lg">{profile.phone}</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Tax ID</label>
                  <p className="text-gray-900 bg-gray-50 p-3 rounded-lg">{profile.taxId}</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Verification Status</label>
                  <span className={`inline-block px-4 py-2 rounded-lg ${
                    profile.isVerified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {profile.isVerified ? 'Verified' : 'Pending Verification'}
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-4">
              <div className="bg-purple-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Total Orders</p>
                <p className="text-2xl font-bold text-purple-600">{profile.orderCount}</p>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Active Orders</p>
                <p className="text-2xl font-bold text-blue-600">{profile.activeOrders}</p>
              </div>
            </div>
          </div>
        )}

        {/* Payments Tab */}
        {activeTab === 'payments' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Payment History</h2>
            <p className="text-gray-600">Payment records and transaction history will appear here</p>
          </div>
        )}
      </div>

      {/* Profile Edit Modal */}
      <Modal
        isOpen={showProfileEdit}
        onClose={() => setShowProfileEdit(false)}
        title="Edit Profile"
        size="md"
      >
        <form onSubmit={handleUpdateProfile} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Organization</label>
            <input
              type="text"
              value={profileForm.organization}
              onChange={(e) => setProfileForm({...profileForm, organization: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Business Type</label>
            <input
              type="text"
              value={profileForm.businessType}
              onChange={(e) => setProfileForm({...profileForm, businessType: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <input
              type="text"
              value={profileForm.location}
              onChange={(e) => setProfileForm({...profileForm, location: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              type="tel"
              value={profileForm.phone}
              onChange={(e) => setProfileForm({...profileForm, phone: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              required
            />
          </div>
          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-lg hover:shadow-lg transition-all font-medium"
            >
              Update Profile
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

      {/* Order Form Modal */}
      <Modal
        isOpen={showOrderForm}
        onClose={() => {
          setShowOrderForm(false);
          setSelectedListing(null);
        }}
        title={`Place Order - ${selectedListing?.crop}`}
        size="md"
      >
        {selectedListing && (
          <form onSubmit={handlePlaceOrder} className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg mb-4">
              <p className="text-sm text-gray-600">Available: {selectedListing.quantityKg}kg</p>
              <p className="text-sm text-gray-600">Minimum Price: {selectedListing.minimumPrice} RWF/kg</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantity (kg) *</label>
              <input
                type="number"
                value={orderForm.quantityKg}
                onChange={(e) => setOrderForm({...orderForm, quantityKg: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                max={selectedListing.quantityKg}
                min="1"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price Offer (RWF/kg) *</label>
              <input
                type="number"
                value={orderForm.priceOffer}
                onChange={(e) => setOrderForm({...orderForm, priceOffer: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                min={selectedListing.minimumPrice}
                required
              />
              <p className="text-xs text-gray-500 mt-1">Minimum: {selectedListing.minimumPrice} RWF/kg</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Location *</label>
              <input
                type="text"
                value={orderForm.deliveryLocation}
                onChange={(e) => setOrderForm({...orderForm, deliveryLocation: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                placeholder="Enter delivery address"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={orderForm.notes}
                onChange={(e) => setOrderForm({...orderForm, notes: e.target.value})}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                placeholder="Any special requirements or notes..."
              />
            </div>
            <div className="flex space-x-3 pt-4">
              <button
                type="submit"
                className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-lg hover:shadow-lg transition-all font-medium"
              >
                Place Order
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowOrderForm(false);
                  setSelectedListing(null);
                }}
                className="flex-1 bg-gray-200 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Payment Modal */}
      <Modal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        title="Initiate Payment"
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method *</label>
            <select
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              onChange={(e) => {
                if (myOrders.length > 0) {
                  handleInitiatePayment(myOrders[0].id, e.target.value);
                }
              }}
            >
              <option value="">Select method</option>
              <option value="MobileMoney">Mobile Money</option>
              <option value="BankTransfer">Bank Transfer</option>
            </select>
          </div>
          <p className="text-sm text-gray-600">Payment will be held in escrow until delivery confirmation.</p>
        </div>
      </Modal>
    </div>
  );
};
