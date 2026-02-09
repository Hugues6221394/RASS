import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { Modal } from '../components/Modal';

export const CooperativeManagementPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;
  
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    region: '',
    district: '',
    location: '',
    phone: '',
    email: '',
    managerId: ''
  });

  useEffect(() => {
    loadUsers();
    if (isEdit) {
      loadCooperative();
    }
  }, [id]);

  const loadUsers = async () => {
    try {
      const res = await api.get('/api/admin/users');
      // Filter for users who can be managers (CooperativeManager role or Admin)
      const managers = res.data.filter((u: any) => {
        const role = u.role || u.Role || (u.roles && u.roles[0]);
        return role === 'CooperativeManager' || role === 'Admin';
      });
      setUsers(managers);
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  };

  const loadCooperative = async () => {
    try {
      const res = await api.get(`/api/admin/cooperatives`);
      const cooperative = res.data.find((c: any) => c.id === id);
      if (cooperative) {
        setFormData({
          name: cooperative.name || '',
          region: cooperative.region || '',
          district: cooperative.district || '',
          location: cooperative.location || '',
          phone: cooperative.phone || '',
          email: cooperative.email || '',
          managerId: cooperative.manager?.id || ''
        });
      }
    } catch (error) {
      console.error('Failed to load cooperative:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isEdit) {
        await api.put(`/api/admin/cooperatives/${id}`, formData);
        alert('Cooperative updated successfully!');
      } else {
        await api.post('/api/cooperative/register', formData);
        alert('Cooperative created successfully!');
        
        // If manager is selected, assign them
        if (formData.managerId) {
          const coopRes = await api.get('/api/cooperative');
          const newCoop = coopRes.data.find((c: any) => c.name === formData.name);
          if (newCoop) {
            await api.post(`/api/admin/cooperatives/${newCoop.id}/assign-manager`, {
              managerId: formData.managerId
            });
          }
        }
      }
      navigate('/admin');
    } catch (error: any) {
      alert(error.response?.data?.message || error.response?.data || 'Failed to save cooperative');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-purple-50 py-8">
      <div className="max-w-4xl mx-auto px-6">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            {isEdit ? 'Edit Cooperative' : 'Create New Cooperative'}
          </h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cooperative Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Region *
                </label>
                <input
                  type="text"
                  value={formData.region}
                  onChange={(e) => setFormData({...formData, region: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  District *
                </label>
                <input
                  type="text"
                  value={formData.district}
                  onChange={(e) => setFormData({...formData, district: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Location *
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({...formData, location: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone *
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Manager (Optional)
                </label>
                <select
                  value={formData.managerId}
                  onChange={(e) => setFormData({...formData, managerId: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Select a manager...</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.fullName} ({user.email})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Select a user with CooperativeManager role to assign as manager
                </p>
              </div>
            </div>

            <div className="flex space-x-4 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-lg hover:shadow-lg transition-all font-medium disabled:opacity-50"
              >
                {loading ? 'Saving...' : (isEdit ? 'Update Cooperative' : 'Create Cooperative')}
              </button>
              <button
                type="button"
                onClick={() => navigate('/admin')}
                className="flex-1 bg-gray-200 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

