import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import type { MarketPrice } from '../types';

export const GovernmentDashboardPage = () => {
  const { user } = useAuth();
  const [marketTrends, setMarketTrends] = useState<any>(null);
  const [supplyDemand, setSupplyDemand] = useState<any>(null);
  const [regionalDistribution, setRegionalDistribution] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'trends' | 'supply' | 'regional'>('overview');

  useEffect(() => {
    loadGovernmentData();
  }, []);

  const loadGovernmentData = async () => {
    try {
      const [trendsRes, supplyRes, regionalRes] = await Promise.all([
        api.get('/api/government/market-trends'),
        api.get('/api/government/supply-demand'),
        api.get('/api/government/regional-distribution')
      ]);

      setMarketTrends(trendsRes.data);
      setSupplyDemand(supplyRes.data);
      setRegionalDistribution(regionalRes.data);
    } catch (error) {
      console.error('Failed to load government data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading government dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold mb-2">Government & Policy Dashboard</h1>
              <p className="text-indigo-100">Welcome, {user?.fullName}</p>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-lg px-6 py-4">
              <p className="text-sm text-indigo-100">Access Level</p>
              <p className="text-xl font-semibold">Read-Only</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-indigo-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Total Farmers</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{marketTrends?.totalFarmers || 0}</p>
              </div>
              <div className="bg-indigo-100 rounded-full p-4">
                <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Total Production</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{(supplyDemand?.totalProduction || 0).toLocaleString()} kg</p>
              </div>
              <div className="bg-green-100 rounded-full p-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Active Cooperatives</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{marketTrends?.activeCooperatives || 0}</p>
              </div>
              <div className="bg-blue-100 rounded-full p-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-yellow-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Market Value</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{(marketTrends?.totalMarketValue || 0).toLocaleString()} RWF</p>
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
              { id: 'trends', label: 'Market Trends', icon: '📈' },
              { id: 'supply', label: 'Supply & Demand', icon: '⚖️' },
              { id: 'regional', label: 'Regional Distribution', icon: '🗺️' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md'
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
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Key Metrics</h2>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-4 bg-indigo-50 rounded-lg">
                  <span className="font-medium text-gray-700">Total Contracts</span>
                  <span className="text-2xl font-bold text-indigo-600">{marketTrends?.totalContracts || 0}</span>
                </div>
                <div className="flex justify-between items-center p-4 bg-green-50 rounded-lg">
                  <span className="font-medium text-gray-700">Total Transactions</span>
                  <span className="text-2xl font-bold text-green-600">{marketTrends?.totalTransactions || 0}</span>
                </div>
                <div className="flex justify-between items-center p-4 bg-blue-50 rounded-lg">
                  <span className="font-medium text-gray-700">Average Price</span>
                  <span className="text-2xl font-bold text-blue-600">{marketTrends?.averagePrice || 0} RWF/kg</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Top Producing Crops</h2>
              <div className="space-y-3">
                {marketTrends?.topCrops?.map((crop: any, index: number) => (
                  <div key={index} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-semibold text-gray-900">{crop.name}</h3>
                        <p className="text-sm text-gray-600">{crop.quantity}kg produced</p>
                      </div>
                      <span className="text-lg font-bold text-indigo-600">{crop.price} RWF/kg</span>
                    </div>
                  </div>
                )) || <p className="text-gray-500">No data available</p>}
              </div>
            </div>
          </div>
        )}

        {/* Market Trends Tab */}
        {activeTab === 'trends' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Market Trends & Price Analytics</h2>
            <div className="space-y-6">
              <div className="border rounded-lg p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Price Trends (Last 30 Days)</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {marketTrends?.priceTrends?.map((trend: any, index: number) => (
                    <div key={index} className="bg-gray-50 p-4 rounded-lg">
                      <p className="font-medium text-gray-900">{trend.crop}</p>
                      <p className="text-2xl font-bold text-indigo-600 mt-2">{trend.currentPrice} RWF/kg</p>
                      <p className={`text-sm mt-1 ${trend.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {trend.change >= 0 ? '↑' : '↓'} {Math.abs(trend.change)}% from last month
                      </p>
                    </div>
                  )) || <p className="text-gray-500 col-span-3">No trend data available</p>}
                </div>
              </div>

              <div className="border rounded-lg p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Market Activity</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <p className="text-3xl font-bold text-blue-600">{marketTrends?.activeListings || 0}</p>
                    <p className="text-sm text-gray-600 mt-1">Active Listings</p>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <p className="text-3xl font-bold text-green-600">{marketTrends?.completedOrders || 0}</p>
                    <p className="text-sm text-gray-600 mt-1">Completed Orders</p>
                  </div>
                  <div className="text-center p-4 bg-yellow-50 rounded-lg">
                    <p className="text-3xl font-bold text-yellow-600">{marketTrends?.pendingOrders || 0}</p>
                    <p className="text-sm text-gray-600 mt-1">Pending Orders</p>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <p className="text-3xl font-bold text-purple-600">{marketTrends?.totalBuyers || 0}</p>
                    <p className="text-sm text-gray-600 mt-1">Active Buyers</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Supply & Demand Tab */}
        {activeTab === 'supply' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Supply & Demand Analysis</h2>
            <div className="space-y-6">
              <div className="border rounded-lg p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Supply Overview</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-green-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600">Total Supply</p>
                    <p className="text-2xl font-bold text-green-600 mt-2">{(supplyDemand?.totalSupply || 0).toLocaleString()} kg</p>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600">Available Inventory</p>
                    <p className="text-2xl font-bold text-blue-600 mt-2">{(supplyDemand?.availableInventory || 0).toLocaleString()} kg</p>
                  </div>
                </div>
              </div>

              <div className="border rounded-lg p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Demand Overview</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600">Total Demand</p>
                    <p className="text-2xl font-bold text-purple-600 mt-2">{(supplyDemand?.totalDemand || 0).toLocaleString()} kg</p>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600">Pending Orders</p>
                    <p className="text-2xl font-bold text-orange-600 mt-2">{(supplyDemand?.pendingOrders || 0).toLocaleString()} kg</p>
                  </div>
                </div>
              </div>

              <div className="border rounded-lg p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Supply-Demand Balance</h3>
                <div className="space-y-3">
                  {supplyDemand?.cropBalance?.map((balance: any, index: number) => (
                    <div key={index} className="bg-gray-50 p-4 rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium text-gray-900">{balance.crop}</span>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          balance.supply >= balance.demand ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {balance.supply >= balance.demand ? 'Surplus' : 'Shortage'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-600">Supply: {balance.supply.toLocaleString()} kg</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Demand: {balance.demand.toLocaleString()} kg</p>
                        </div>
                      </div>
                    </div>
                  )) || <p className="text-gray-500">No balance data available</p>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Regional Distribution Tab */}
        {activeTab === 'regional' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Regional Distribution</h2>
            <div className="space-y-6">
              {regionalDistribution?.regions?.map((region: any, index: number) => (
                <div key={index} className="border rounded-lg p-6 hover:shadow-md transition-shadow">
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">{region.name} Province</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600">Farmers</p>
                      <p className="text-2xl font-bold text-blue-600 mt-2">{region.farmers}</p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600">Production</p>
                      <p className="text-2xl font-bold text-green-600 mt-2">{region.production.toLocaleString()} kg</p>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600">Cooperatives</p>
                      <p className="text-2xl font-bold text-purple-600 mt-2">{region.cooperatives}</p>
                    </div>
                  </div>
                </div>
              )) || <p className="text-gray-500">No regional data available</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
