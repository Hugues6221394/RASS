import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useTranslation } from 'react-i18next';
import { RwandaLocationFields } from '../components/location/RwandaLocationFields';
import { buildLocationText, emptyRwandaLocation, parseLocationText } from '../utils/rwandaLocation';

export const BuyerManagementPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const isEdit = !!id;
  
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    organization: '',
    businessType: '',
    location: '',
    phone: '',
    taxId: ''
  });
  const [locationForm, setLocationForm] = useState(emptyRwandaLocation());

  useEffect(() => {
    if (isEdit) {
      loadBuyer();
    }
  }, [id]);

  const loadBuyer = async () => {
    try {
      const res = await api.get(`/api/admin/buyers`);
      const buyer = res.data.find((b: any) => (b.id || b.Id) === id);
      if (buyer) {
        setFormData({
          fullName: buyer.fullName || buyer.FullName || '',
          email: buyer.email || buyer.Email || '',
          password: '',
          organization: buyer.organization || buyer.Organization || '',
          businessType: buyer.businessType || buyer.BusinessType || '',
          location: buyer.location || buyer.Location || '',
          phone: buyer.phone || buyer.Phone || '',
          taxId: buyer.taxId || buyer.TaxId || ''
        });
        setLocationForm(parseLocationText(buyer.location || buyer.Location || ''));
      }
    } catch (error) {
      console.error('Failed to load buyer:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...formData,
        location: buildLocationText(locationForm),
      };
      if (isEdit) {
        await api.put(`/api/admin/buyers/${id}`, payload);
        alert(t('admin.buyer_updated'));
      } else {
        await api.post('/api/buyers/register', payload);
        alert(t('admin.buyer_created'));
      }
      navigate('/admin');
    } catch (error: any) {
      alert(error.response?.data?.message || error.response?.data || t('admin.buyer_save_failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-orange-50 to-yellow-50 py-8">
      <div className="max-w-4xl mx-auto px-6">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            {isEdit ? t('admin.edit_buyer') : t('admin.create_buyer')}
          </h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('common.full_name')} *
                </label>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
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
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                  required
                />
              </div>

              {!isEdit && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('auth.password')} *
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                    required={!isEdit}
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('common.organization')} *
                </label>
                <input
                  type="text"
                  value={formData.organization}
                  onChange={(e) => setFormData({...formData, organization: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('common.business_type')} *
                </label>
                <select
                  value={formData.businessType}
                  onChange={(e) => setFormData({...formData, businessType: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                  required
                >
                  <option value="">{t('admin.select_business_type')}</option>
                  <option value="Hotel">{t('admin.business_hotel')}</option>
                  <option value="Restaurant">{t('admin.business_restaurant')}</option>
                  <option value="Supermarket">{t('admin.business_supermarket')}</option>
                  <option value="Processor">{t('admin.business_processor')}</option>
                  <option value="Wholesaler">{t('admin.business_wholesaler')}</option>
                  <option value="Institution">{t('admin.business_institution')}</option>
                  <option value="Other">{t('admin.business_other')}</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <RwandaLocationFields
                  value={locationForm}
                  onChange={setLocationForm}
                  showDetail
                  detailRequired
                  detailLabel={t('common.location')}
                  detailPlaceholder="Business premises, landmark, or delivery point"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('common.phone')} *
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('admin.tax_id')}
                </label>
                <input
                  type="text"
                  value={formData.taxId}
                  onChange={(e) => setFormData({...formData, taxId: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                />
              </div>
            </div>

            <div className="flex space-x-4 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-gradient-to-r from-yellow-600 to-orange-600 text-white px-6 py-3 rounded-lg hover:shadow-lg transition-all font-medium disabled:opacity-50"
              >
                {loading ? t('common.saving') : (isEdit ? t('admin.update_buyer') : t('admin.create_buyer_action'))}
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

