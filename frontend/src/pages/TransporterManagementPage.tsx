import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useTranslation } from 'react-i18next';
import { useRwandaAdministrativeData } from '../hooks/useRwandaAdministrativeData';

export const TransporterManagementPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { provinces } = useRwandaAdministrativeData();
  const isEdit = !!id;
  
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    companyName: '',
    contactPerson: '',
    email: '',
    password: '',
    licenseNumber: '',
    phone: '',
    capacityKg: 0,
    vehicleType: '',
    licensePlate: '',
    operatingRegions: ''
  });
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);

  useEffect(() => {
    if (isEdit) {
      loadTransporter();
    }
  }, [id]);

  const loadTransporter = async () => {
    try {
      const res = await api.get(`/api/admin/transporters`);
      const transporter = res.data.find((t: any) => (t.id || t.Id) === id);
      if (transporter) {
        setFormData({
          companyName: transporter.companyName || transporter.CompanyName || '',
          contactPerson: transporter.fullName || transporter.FullName || '',
          email: transporter.email || transporter.Email || '',
          password: '',
          licenseNumber: transporter.licenseNumber || transporter.LicenseNumber || '',
          phone: transporter.phone || transporter.Phone || '',
          capacityKg: transporter.capacityKg || transporter.CapacityKg || 0,
          vehicleType: transporter.vehicleType || transporter.VehicleType || '',
          licensePlate: transporter.licensePlate || transporter.LicensePlate || '',
          operatingRegions: Array.isArray(transporter.operatingRegions) 
            ? transporter.operatingRegions.join(', ')
            : (transporter.operatingRegions || transporter.OperatingRegions || '')
        });
        const normalizedRegions = Array.isArray(transporter.operatingRegions)
          ? transporter.operatingRegions
          : String(transporter.operatingRegions || transporter.OperatingRegions || '').split(',').map((value) => value.trim()).filter(Boolean);
        setSelectedRegions(normalizedRegions);
      }
    } catch (error) {
      console.error('Failed to load transporter:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const submitData = {
        ...formData,
        operatingRegions: selectedRegions
      };

      if (isEdit) {
        await api.put(`/api/admin/transporters/${id}`, submitData);
        alert(t('admin.transporter_updated'));
      } else {
        await api.post('/api/transporters/register', submitData);
        alert(t('admin.transporter_created'));
      }
      navigate('/admin');
    } catch (error: any) {
      alert(error.response?.data?.message || error.response?.data || t('admin.transporter_save_failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-orange-50 py-8">
      <div className="max-w-4xl mx-auto px-6">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            {isEdit ? t('admin.edit_transporter') : t('admin.create_transporter')}
          </h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('common.company_name')} *
                </label>
                <input
                  type="text"
                  value={formData.companyName}
                  onChange={(e) => setFormData({...formData, companyName: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('common.contact_person')} *
                </label>
                <input
                  type="text"
                  value={formData.contactPerson}
                  onChange={(e) => setFormData({...formData, contactPerson: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    required={!isEdit}
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('admin.license_number')} *
                </label>
                <input
                  type="text"
                  value={formData.licenseNumber}
                  onChange={(e) => setFormData({...formData, licenseNumber: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  required
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('common.vehicle_type')} *
                </label>
                <select
                  value={formData.vehicleType}
                  onChange={(e) => setFormData({...formData, vehicleType: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  required
                >
                  <option value="">{t('admin.select_vehicle_type')}</option>
                  <option value="Truck">{t('admin.vehicle_truck')}</option>
                  <option value="Pickup">{t('admin.vehicle_pickup')}</option>
                  <option value="Van">{t('admin.vehicle_van')}</option>
                  <option value="Motorcycle">{t('admin.vehicle_motorcycle')}</option>
                  <option value="Other">{t('admin.vehicle_other')}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('common.license_plate')} *
                </label>
                <input
                  type="text"
                  value={formData.licensePlate}
                  onChange={(e) => setFormData({...formData, licensePlate: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('transporter.capacity_kg')} *
                </label>
                <input
                  type="number"
                  value={formData.capacityKg}
                  onChange={(e) => setFormData({...formData, capacityKg: parseFloat(e.target.value) || 0})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('admin.operating_regions')} *
                </label>
                <div className="grid grid-cols-2 gap-2 rounded-lg border border-gray-300 p-3 md:grid-cols-3">
                  {provinces.map((province) => {
                    const checked = selectedRegions.includes(province);
                    return (
                      <label key={province} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${checked ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-gray-200 bg-white text-gray-700'}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => setSelectedRegions((current) => event.target.checked ? [...current, province] : current.filter((value) => value !== province))}
                        />
                        <span>{province}</span>
                      </label>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {t('admin.operating_regions_help')}
                </p>
              </div>
            </div>

            <div className="flex space-x-4 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-gradient-to-r from-orange-600 to-red-600 text-white px-6 py-3 rounded-lg hover:shadow-lg transition-all font-medium disabled:opacity-50"
              >
                {loading ? t('common.saving') : (isEdit ? t('admin.update_transporter') : t('admin.create_transporter_action'))}
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

