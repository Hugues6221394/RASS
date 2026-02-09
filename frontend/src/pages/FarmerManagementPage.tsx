import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';

export const FarmerManagementPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;
  
  const [loading, setLoading] = useState(false);
  const [cooperatives, setCooperatives] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    district: '',
    sector: '',
    nationalId: '',
    crops: '',
    farmSizeHectares: 0,
    cooperativeId: ''
  });

  useEffect(() => {
    loadCooperatives();
    if (isEdit) {
      loadFarmer();
    }
  }, [id]);

  const loadCooperatives = async () => {
    try {
      const res = await api.get('/api/cooperative');
      setCooperatives(res.data || []);
    } catch (error) {
      console.error('Failed to load cooperatives:', error);
    }
  };

  const loadFarmer = async () => {
    try {
      const res = await api.get(`/api/admin/farmers`);
      const farmer = res.data.find((f: any) => (f.id || f.Id) === id);
      if (farmer) {
        setFormData({
          fullName: farmer.fullName || farmer.FullName || '',
          email: farmer.email || farmer.Email || '',
          phone: farmer.phone || farmer.Phone || '',
          district: farmer.district || farmer.District || '',
          sector: farmer.sector || farmer.Sector || '',
          nationalId: farmer.nationalId || farmer.NationalId || '',
          crops: farmer.crops || farmer.Crops || '',
          farmSizeHectares: farmer.farmSizeHectares || farmer.FarmSizeHectares || 0,
          cooperativeId: farmer.cooperativeId || farmer.CooperativeId || ''
        });
      }
    } catch (error) {
      console.error('Failed to load farmer:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isEdit) {
        await api.put(`/api/admin/farmers/${id}`, formData);
        alert('Farmer updated successfully!');
      } else {
        await api.post('/api/farmers/register', formData);
        alert('Farmer created successfully!');
      }
      navigate('/admin');
    } catch (error: any) {
      alert(error.response?.data?.message || error.response?.data || 'Failed to save farmer');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-green-50 to-blue-50 py-8">
      <div className="max-w-4xl mx-auto px-6">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            {isEdit ? 'Edit Farmer' : 'Create New Farmer'}
          </h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  National ID *
                </label>
                <input
                  type="text"
                  value={formData.nationalId}
                  onChange={(e) => setFormData({...formData, nationalId: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sector *
                </label>
                <input
                  type="text"
                  value={formData.sector}
                  onChange={(e) => setFormData({...formData, sector: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Crops Grown
                </label>
                <input
                  type="text"
                  value={formData.crops}
                  onChange={(e) => setFormData({...formData, crops: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Maize, Beans, Potatoes"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Farm Size (Hectares)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.farmSizeHectares}
                  onChange={(e) => setFormData({...formData, farmSizeHectares: parseFloat(e.target.value) || 0})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cooperative (Optional)
                </label>
                <select
                  value={formData.cooperativeId}
                  onChange={(e) => setFormData({...formData, cooperativeId: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a cooperative...</option>
                  {cooperatives.map((coop) => (
                    <option key={coop.id || coop.Id} value={coop.id || coop.Id}>
                      {coop.name || coop.Name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex space-x-4 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-gradient-to-r from-blue-600 to-green-600 text-white px-6 py-3 rounded-lg hover:shadow-lg transition-all font-medium disabled:opacity-50"
              >
                {loading ? 'Saving...' : (isEdit ? 'Update Farmer' : 'Create Farmer')}
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

