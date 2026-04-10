import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useTranslation } from 'react-i18next';
import { RwandaLocationFields } from '../components/location/RwandaLocationFields';
import { buildLocationText, emptyRwandaLocation, parseLocationText } from '../utils/rwandaLocation';


export const CooperativeManagementPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const isEdit = !!id;

  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    region: '',
    district: '',
    sector: '',
    cell: '',
    location: '',
    phone: '',
    email: '',
    managerId: ''
  });
  const [locationForm, setLocationForm] = useState(emptyRwandaLocation());

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
          sector: cooperative.sector || '',
          cell: cooperative.cell || '',
          location: cooperative.location || '',
          phone: cooperative.phone || '',
          email: cooperative.email || '',
          managerId: cooperative.manager?.id || ''
        });
        setLocationForm({
          ...parseLocationText(cooperative.location),
          province: cooperative.region || parseLocationText(cooperative.location).province,
          district: cooperative.district || parseLocationText(cooperative.location).district,
          sector: cooperative.sector || parseLocationText(cooperative.location).sector,
          cell: cooperative.cell || parseLocationText(cooperative.location).cell,
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
      const payload = {
        ...formData,
        region: locationForm.province,
        district: locationForm.district,
        sector: locationForm.sector,
        cell: locationForm.cell || null,
        location: buildLocationText(locationForm),
      };
      if (isEdit) {
        await api.put(`/api/admin/cooperatives/${id}`, payload);
        alert(t('admin.cooperative_updated'));
      } else {
        await api.post('/api/cooperative/register', payload);
        alert(t('admin.cooperative_created'));

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
      alert(error.response?.data?.message || error.response?.data || t('admin.cooperative_save_failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-purple-50 py-8">
      <div className="max-w-4xl mx-auto px-6">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            {isEdit ? t('admin.edit_cooperative') : t('admin.create_cooperative')}
          </h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('admin.cooperative_name')} *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <RwandaLocationFields
                  value={locationForm}
                  onChange={setLocationForm}
                  showDetail
                  detailRequired
                  detailLabel={t('common.location')}
                  detailPlaceholder="Village, office, or cooperative compound"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('common.phone')} *
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('common.email')} *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('admin.manager_optional')}
                </label>
                <select
                  value={formData.managerId}
                  onChange={(e) => setFormData({ ...formData, managerId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">{t('admin.select_manager')}</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.fullName} ({user.email})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {t('admin.manager_hint')}
                </p>
              </div>
            </div>

            <div className="flex space-x-4 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-lg hover:shadow-lg transition-all font-medium disabled:opacity-50"
              >
                {loading ? t('common.saving') : (isEdit ? t('admin.update_cooperative') : t('admin.create_cooperative_action'))}
              </button>
              <button
                type="button"
                onClick={() => navigate('/admin')}
                className="flex-1 bg-gray-200 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                {t('common.cancel')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

