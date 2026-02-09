import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { Modal } from '../components/Modal';
import { DataTable } from '../components/DataTable';
import type { User } from '../types';

export const AdminPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [farmers, setFarmers] = useState<any[]>([]);
  const [cooperatives, setCooperatives] = useState<any[]>([]);
  const [buyers, setBuyers] = useState<any[]>([]);
  const [transporters, setTransporters] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [systemStats, setSystemStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'farmers' | 'cooperatives' | 'buyers' | 'transporters' | 'audit' | 'config' | 'reports'>('overview');

  // Modals
  const [showUserForm, setShowUserForm] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Forms
  const [userForm, setUserForm] = useState({
    fullName: '',
    email: '',
    password: '',
    role: 'Farmer'
  });

  const [configForm, setConfigForm] = useState({
    pricingRule: '',
    notificationRule: '',
    marketRule: ''
  });

  useEffect(() => {
    loadAdminData();
  }, []);

  const loadAdminData = async () => {
    try {
      setLoading(true);
      const [usersRes, farmersRes, cooperativesRes, buyersRes, transportersRes, auditRes, statsRes] = await Promise.all([
        api.get('/api/admin/users').catch((err) => {
          console.error('Failed to fetch users:', err);
          return { data: [] };
        }),
        api.get('/api/admin/farmers').catch((err) => {
          console.error('Failed to fetch farmers:', err);
          return { data: [] };
        }),
        api.get('/api/admin/cooperatives').catch((err) => {
          console.error('Failed to fetch cooperatives:', err);
          return { data: [] };
        }),
        api.get('/api/admin/buyers').catch((err) => {
          console.error('Failed to fetch buyers:', err);
          return { data: [] };
        }),
        api.get('/api/admin/transporters').catch((err) => {
          console.error('Failed to fetch transporters:', err);
          return { data: [] };
        }),
        api.get('/api/admin/audit-logs').catch((err) => {
          console.error('Failed to fetch audit logs:', err);
          return { data: [] };
        }),
        api.get('/api/admin/system-stats').catch((err) => {
          console.error('Failed to fetch stats:', err);
          return { data: {} };
        })
      ]);

      // Normalize user data - handle both Role and role properties
      const normalizedUsers = (usersRes.data || []).map((u: any) => ({
        ...u,
        id: u.id || u.Id || u.userId || u.UserId,
        fullName: u.fullName || u.FullName,
        email: u.email || u.Email,
        isActive: u.isActive !== undefined ? u.isActive : (u.IsActive !== undefined ? u.IsActive : true),
        role: u.role || u.Role || (u.roles && u.roles[0]) || (u.Roles && u.Roles[0]) || 'NoRole'
      }));

      // Normalize other entities to ensure they have 'id' field
      const normalizeEntity = (item: any) => ({
        ...item,
        id: item.id || item.Id || item.userId || item.UserId
      });

      setUsers(normalizedUsers);
      setFarmers((farmersRes.data || []).map(normalizeEntity));
      setCooperatives((cooperativesRes.data || []).map(normalizeEntity));
      setBuyers((buyersRes.data || []).map(normalizeEntity));
      setTransporters((transportersRes.data || []).map(normalizeEntity));

      setAuditLogs((auditRes.data || []).map(normalizeEntity));
      setSystemStats(statsRes.data || {});
      
      console.log('Loaded data:', {
        users: normalizedUsers.length,
        farmers: farmersRes.data?.length || 0,
        cooperatives: cooperativesRes.data?.length || 0,
        buyers: buyersRes.data?.length || 0,
        transporters: transportersRes.data?.length || 0
      });
    } catch (error) {
      console.error('Failed to load admin data:', error);
      alert('Failed to load admin data. Please check console for details.');
    } finally {
      setLoading(false);
    }
  };

  // User CRUD
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/api/admin/users', userForm);
      alert('User created successfully!');
      setShowUserForm(false);
      setUserForm({ fullName: '', email: '', password: '', role: 'Farmer' });
      loadAdminData();
    } catch (error: any) {
      alert(error.response?.data || 'Failed to create user');
    }
  };

  const handleEditUser = (user: any) => {
    setEditingUser(user);
    setUserForm({
      fullName: user.fullName || user.FullName,
      email: user.email || user.Email,
      password: '',
      role: user.role || user.Role || (user.roles && user.roles[0]) || (user.Roles && user.Roles[0]) || 'Farmer'
    });
    setShowUserForm(true);
  };

  const handleDeleteUser = async (user: User) => {
    if (confirm(`Permanently delete user ${user.fullName}?`)) {
      try {
        await api.delete(`/api/admin/users/${user.id}`);
        alert('User deleted successfully');
        loadAdminData();
      } catch (error: any) {
        alert(error.response?.data || 'Failed to delete user');
      }
    }
  };

  const handleSuspendUser = async (user: User) => {
    if (confirm(`Suspend user ${user.fullName}?`)) {
      try {
        await api.post(`/api/admin/users/${user.id}/suspend`);
        alert('User suspended');
        loadAdminData();
      } catch (error: any) {
        alert(error.response?.data || 'Failed to suspend user');
      }
    }
  };

  // System Configuration
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // In real implementation, call config endpoint
      alert('Configuration saved successfully');
      setShowConfigModal(false);
      loadAdminData();
    } catch (error) {
      alert('Failed to save configuration');
    }
  };

  // Reports
  const handleGenerateReport = async (reportType: string) => {
    try {
      // In real implementation, generate and download report
      alert(`Generating ${reportType} report...`);
    } catch (error) {
      alert('Failed to generate report');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-red-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  const stats = {
    totalUsers: users.length,
    activeUsers: users.filter(u => u.isActive).length,
    farmers: farmers.length,
    cooperatives: cooperatives.length,
    buyers: buyers.length,
    transporters: transporters.length
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-pink-50 to-red-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-600 to-pink-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold mb-2">System Administration</h1>
              <p className="text-red-100">Welcome, {user?.fullName}</p>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-lg px-6 py-4">
              <p className="text-sm text-red-100">System Status</p>
              <p className="text-xl font-semibold">Operational</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Cards - Clickable */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-6 mb-8">
          <button
            onClick={() => setActiveTab('users')}
            className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-red-500 hover:shadow-xl transition-all cursor-pointer text-left"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Total Users</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalUsers}</p>
              </div>
              <div className="bg-red-100 rounded-full p-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500 hover:shadow-xl transition-all cursor-pointer text-left"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Active</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.activeUsers}</p>
              </div>
              <div className="bg-green-100 rounded-full p-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('farmers')}
            className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500 hover:shadow-xl transition-all cursor-pointer text-left"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Farmers</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.farmers}</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('cooperatives')}
            className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-purple-500 hover:shadow-xl transition-all cursor-pointer text-left"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Cooperatives</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.cooperatives}</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('buyers')}
            className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-yellow-500 hover:shadow-xl transition-all cursor-pointer text-left"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Buyers</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.buyers}</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('transporters')}
            className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-orange-500 hover:shadow-xl transition-all cursor-pointer text-left"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Transporters</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.transporters}</p>
              </div>
            </div>
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white rounded-xl shadow-lg mb-6">
          <div className="flex space-x-1 p-2 border-b border-gray-200 overflow-x-auto">
            {[
              { id: 'overview', label: 'Overview', icon: '📊' },
              { id: 'users', label: 'Users', icon: '👥' },
              { id: 'farmers', label: 'Farmers', icon: '🌾' },
              { id: 'cooperatives', label: 'Cooperatives', icon: '🏢' },
              { id: 'buyers', label: 'Buyers', icon: '🛒' },
              { id: 'transporters', label: 'Transporters', icon: '🚚' },
              { id: 'audit', label: 'Audit Logs', icon: '📋' },
              { id: 'config', label: 'Configuration', icon: '⚙️' },
              { id: 'reports', label: 'Reports', icon: '📈' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-red-600 to-pink-600 text-white shadow-md'
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
        {activeTab === 'overview' && systemStats && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">System Statistics</h2>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                  <span className="font-medium text-gray-700">Total Contracts</span>
                  <span className="text-2xl font-bold text-gray-900">{systemStats.totalContracts || 0}</span>
                </div>
                <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                  <span className="font-medium text-gray-700">Total Transactions</span>
                  <span className="text-2xl font-bold text-gray-900">{systemStats.totalTransactions || 0}</span>
                </div>
                <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                  <span className="font-medium text-gray-700">Total Revenue</span>
                  <span className="text-2xl font-bold text-green-600">{systemStats.totalRevenue?.toLocaleString() || 0} RWF</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Recent Audit Logs</h2>
              <div className="space-y-3">
                {auditLogs.slice(0, 5).map((log) => (
                  <div key={log.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-gray-900">{log.action}</p>
                        <p className="text-sm text-gray-600">{log.user}</p>
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(log.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
              <button
                onClick={() => {
                  setEditingUser(null);
                  setUserForm({ fullName: '', email: '', password: '', role: 'Farmer' });
                  setShowUserForm(true);
                }}
                className="bg-gradient-to-r from-red-600 to-pink-600 text-white px-6 py-2 rounded-lg hover:shadow-lg transition-all font-medium"
              >
                + Create User
              </button>
            </div>
            <DataTable
              data={users}
              columns={[
                { header: 'Name', accessor: (row) => row.fullName || row.FullName || 'N/A' },
                { header: 'Email', accessor: (row) => row.email || row.Email || 'N/A' },
                { header: 'Role', accessor: (row) => (
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                    {row.role || row.Role || (row.roles && row.roles[0]) || (row.Roles && row.Roles[0]) || 'N/A'}
                  </span>
                )},
                { header: 'Status', accessor: (row) => {
                  const isActive = row.isActive !== undefined ? row.isActive : row.IsActive;
                  return (
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {isActive ? 'Active' : 'Inactive'}
                    </span>
                  );
                }},
                { header: 'Actions', accessor: (row) => (
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEditUser(row)}
                      className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-xs"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteUser(row)}
                      className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-xs"
                    >
                      Delete
                    </button>
                  </div>
                )}
              ]}
              onEdit={handleEditUser}
              onDelete={handleDeleteUser}
              emptyMessage={users.length === 0 ? "No users found. Click 'Create User' to add one." : "No users found"}
            />
          </div>
        )}

        {/* Farmers Tab */}
        {activeTab === 'farmers' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Farmers Management</h2>
              <button
                onClick={() => navigate('/admin/farmers/create')}
                className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-2 rounded-lg hover:shadow-lg transition-all font-medium"
              >
                + Add Farmer
              </button>
            </div>
            <DataTable
              data={farmers}
              columns={[
                { header: 'Name', accessor: (row) => row.fullName || row.FullName || 'N/A' },
                { header: 'Email', accessor: (row) => row.email || row.Email || 'N/A' },
                { header: 'Phone', accessor: (row) => row.phone || row.Phone || 'N/A' },
                { header: 'District', accessor: (row) => row.district || row.District || 'N/A' },
                { header: 'Crops', accessor: (row) => row.crops || row.Crops || 'N/A' },
                { header: 'Status', accessor: (row) => {
                  const isActive = row.isActive !== undefined ? row.isActive : row.IsActive;
                  return (
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {isActive ? 'Active' : 'Inactive'}
                    </span>
                  );
                }}
              ]}
              onEdit={(farmer) => navigate(`/admin/farmers/${farmer.id || farmer.Id}/edit`)}
              onDelete={async (farmer) => {
                if (confirm(`Delete farmer ${farmer.fullName || farmer.FullName}?`)) {
                  try {
                    await api.delete(`/api/admin/farmers/${farmer.id || farmer.Id}`);
                    alert('Farmer deleted');
                    loadAdminData();
                  } catch (error: any) {
                    alert(error.response?.data || 'Failed to delete farmer');
                  }
                }
              }}
              emptyMessage="No farmers found"
            />
          </div>
        )}

        {/* Cooperatives Tab */}
        {activeTab === 'cooperatives' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Cooperatives Management</h2>
              <button
                onClick={() => navigate('/admin/cooperatives/create')}
                className="bg-gradient-to-r from-purple-600 to-purple-700 text-white px-6 py-2 rounded-lg hover:shadow-lg transition-all font-medium"
              >
                + Add Cooperative
              </button>
            </div>
            <DataTable
              data={cooperatives}
              columns={[
                { header: 'Name', accessor: (row) => row.name || row.Name || 'N/A' },
                { header: 'Region', accessor: (row) => row.region || row.Region || 'N/A' },
                { header: 'District', accessor: (row) => row.district || row.District || 'N/A' },
                { header: 'Email', accessor: (row) => row.email || row.Email || 'N/A' },
                { header: 'Phone', accessor: (row) => row.phone || row.Phone || 'N/A' },
                { header: 'Farmers', accessor: (row) => row.farmerCount || row.FarmerCount || 0 },
                { header: 'Status', accessor: (row) => (
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    row.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {row.isActive ? 'Active' : 'Inactive'}
                  </span>
                )}
              ]}
              onEdit={(coop) => navigate(`/admin/cooperatives/${coop.id || coop.Id}/edit`)}
              onDelete={async (coop) => {
                if (confirm(`Delete cooperative ${coop.name || coop.Name}?`)) {
                  try {
                    await api.delete(`/api/admin/cooperatives/${coop.id || coop.Id}`);
                    alert('Cooperative deleted');
                    loadAdminData();
                  } catch (error: any) {
                    alert(error.response?.data || 'Failed to delete cooperative');
                  }
                }
              }}
              emptyMessage="No cooperatives found"
            />
          </div>
        )}

        {/* Buyers Tab */}
        {activeTab === 'buyers' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Buyers Management</h2>
              <button
                onClick={() => navigate('/admin/buyers/create')}
                className="bg-gradient-to-r from-yellow-600 to-yellow-700 text-white px-6 py-2 rounded-lg hover:shadow-lg transition-all font-medium"
              >
                + Add Buyer
              </button>
            </div>
            <DataTable
              data={buyers}
              columns={[
                { header: 'Name', accessor: (row) => row.fullName || row.FullName || 'N/A' },
                { header: 'Email', accessor: (row) => row.email || row.Email || 'N/A' },
                { header: 'Organization', accessor: (row) => row.organization || row.Organization || 'N/A' },
                { header: 'Business Type', accessor: (row) => row.businessType || row.BusinessType || 'N/A' },
                { header: 'Location', accessor: (row) => row.location || row.Location || 'N/A' },
                { header: 'Status', accessor: (row) => (
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    row.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {row.isActive ? 'Active' : 'Inactive'}
                  </span>
                )}
              ]}
              onEdit={(buyer) => navigate(`/admin/buyers/${buyer.id || buyer.Id}/edit`)}
              onDelete={async (buyer) => {
                if (confirm(`Delete buyer ${buyer.fullName || buyer.FullName}?`)) {
                  try {
                    await api.delete(`/api/admin/buyers/${buyer.id || buyer.Id}`);
                    alert('Buyer deleted');
                    loadAdminData();
                  } catch (error: any) {
                    alert(error.response?.data || 'Failed to delete buyer');
                  }
                }
              }}
              emptyMessage="No buyers found"
            />
          </div>
        )}

        {/* Transporters Tab */}
        {activeTab === 'transporters' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Transporters Management</h2>
              <button
                onClick={() => navigate('/admin/transporters/create')}
                className="bg-gradient-to-r from-orange-600 to-orange-700 text-white px-6 py-2 rounded-lg hover:shadow-lg transition-all font-medium"
              >
                + Add Transporter
              </button>
            </div>
            <DataTable
              data={transporters}
              columns={[
                { header: 'Company', accessor: (row) => row.companyName || row.CompanyName || 'N/A' },
                { header: 'Email', accessor: (row) => row.email || row.Email || 'N/A' },
                { header: 'Phone', accessor: (row) => row.phone || row.Phone || 'N/A' },
                { header: 'Vehicle Type', accessor: (row) => row.vehicleType || row.VehicleType || 'N/A' },
                { header: 'Capacity (kg)', accessor: (row) => row.capacityKg || row.CapacityKg || 0 },
                { header: 'Status', accessor: (row) => (
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    row.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {row.isActive ? 'Active' : 'Inactive'}
                  </span>
                )}
              ]}
              onEdit={(transporter) => navigate(`/admin/transporters/${transporter.id || transporter.Id}/edit`)}
              onDelete={async (transporter) => {
                if (confirm(`Delete transporter ${transporter.companyName || transporter.CompanyName}?`)) {
                  try {
                    await api.delete(`/api/admin/transporters/${transporter.id || transporter.Id}`);
                    alert('Transporter deleted');
                    loadAdminData();
                  } catch (error: any) {
                    alert(error.response?.data || 'Failed to delete transporter');
                  }
                }
              }}
              emptyMessage="No transporters found"
            />
          </div>
        )}

        {/* Audit Logs Tab */}
        {activeTab === 'audit' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Audit Logs</h2>
            <DataTable
              data={auditLogs}
              columns={[
                { header: 'Action', accessor: 'action' },
                { header: 'User', accessor: 'user' },
                { header: 'Entity Type', accessor: 'entityType' },
                { header: 'Entity ID', accessor: 'entityId' },
                { header: 'Timestamp', accessor: (row) => new Date(row.createdAt).toLocaleString() }
              ]}
              emptyMessage="No audit logs found"
            />
          </div>
        )}

        {/* Configuration Tab */}
        {activeTab === 'config' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">System Configuration</h2>
              <button
                onClick={() => setShowConfigModal(true)}
                className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors font-medium"
              >
                Edit Configuration
              </button>
            </div>
            <div className="space-y-4">
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-2">Pricing Rules</h3>
                <p className="text-gray-600">Configure pricing rules and minimum price thresholds</p>
              </div>
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-2">Notification Rules</h3>
                <p className="text-gray-600">Configure system notifications and alerts</p>
              </div>
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-2">Market Rules</h3>
                <p className="text-gray-600">Configure market listing and order rules</p>
              </div>
            </div>
          </div>
        )}

        {/* Reports Tab */}
        {activeTab === 'reports' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Reports & Analytics</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <button
                onClick={() => handleGenerateReport('User Activity')}
                className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-xl hover:shadow-lg transition-all text-left"
              >
                <h3 className="text-xl font-bold mb-2">User Activity Report</h3>
                <p className="text-blue-100">Generate comprehensive user activity report</p>
              </button>
              <button
                onClick={() => handleGenerateReport('Financial')}
                className="bg-gradient-to-r from-green-600 to-green-700 text-white p-6 rounded-xl hover:shadow-lg transition-all text-left"
              >
                <h3 className="text-xl font-bold mb-2">Financial Report</h3>
                <p className="text-green-100">Generate financial transactions report</p>
              </button>
              <button
                onClick={() => handleGenerateReport('Market Trends')}
                className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-6 rounded-xl hover:shadow-lg transition-all text-left"
              >
                <h3 className="text-xl font-bold mb-2">Market Trends</h3>
                <p className="text-purple-100">Generate market trends and analytics</p>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* User Form Modal */}
      <Modal
        isOpen={showUserForm}
        onClose={() => setShowUserForm(false)}
        title={editingUser ? "Edit User" : "Create New User"}
        size="md"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
            <input
              type="text"
              value={userForm.fullName}
              onChange={(e) => setUserForm({...userForm, fullName: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
            <input
              type="email"
              value={userForm.email}
              onChange={(e) => setUserForm({...userForm, email: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{editingUser ? 'New Password (leave blank to keep current)' : 'Password *'}</label>
            <input
              type="password"
              value={userForm.password}
              onChange={(e) => setUserForm({...userForm, password: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
              required={!editingUser}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
            <select
              value={userForm.role}
              onChange={(e) => setUserForm({...userForm, role: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
              required
            >
              <option value="Farmer">Farmer</option>
              <option value="CooperativeManager">Cooperative Manager</option>
              <option value="Buyer">Buyer</option>
              <option value="Transporter">Transporter</option>
              <option value="Admin">Admin</option>
              <option value="Government">Government</option>
            </select>
          </div>
          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-gradient-to-r from-red-600 to-pink-600 text-white px-6 py-3 rounded-lg hover:shadow-lg transition-all font-medium"
            >
              {editingUser ? 'Update User' : 'Create User'}
            </button>
            <button
              type="button"
              onClick={() => setShowUserForm(false)}
              className="flex-1 bg-gray-200 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      {/* Configuration Modal */}
      <Modal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        title="System Configuration"
        size="lg"
      >
        <form onSubmit={handleSaveConfig} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pricing Rules</label>
            <textarea
              value={configForm.pricingRule}
              onChange={(e) => setConfigForm({...configForm, pricingRule: e.target.value})}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
              placeholder="Define pricing rules..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notification Rules</label>
            <textarea
              value={configForm.notificationRule}
              onChange={(e) => setConfigForm({...configForm, notificationRule: e.target.value})}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
              placeholder="Define notification rules..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Market Rules</label>
            <textarea
              value={configForm.marketRule}
              onChange={(e) => setConfigForm({...configForm, marketRule: e.target.value})}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
              placeholder="Define market rules..."
            />
          </div>
          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-gradient-to-r from-red-600 to-pink-600 text-white px-6 py-3 rounded-lg hover:shadow-lg transition-all font-medium"
            >
              Save Configuration
            </button>
            <button
              type="button"
              onClick={() => setShowConfigModal(false)}
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
