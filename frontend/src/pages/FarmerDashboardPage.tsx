import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Banknote, BrainCircuit, Download, FileText, Leaf, LayoutDashboard, Package, Sprout, TrendingUp, User } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { DashboardShell } from '../components/layout/DashboardShell';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Loader } from '../components/ui/Loader';
import { RoleAIAnalyticsPanel } from '../components/RoleAIAnalyticsPanel';
import { NationalMarketPulsePanel } from '../components/NationalMarketPulsePanel';
import { RoleAssistantCard } from '../components/RoleAssistantCard';
import { useTranslation } from 'react-i18next';
import { RwandaLocationFields } from '../components/location/RwandaLocationFields';
import { emptyRwandaLocation } from '../utils/rwandaLocation';
import { CropSelector } from '../components/forms/CropSelector';
import { KpiBanner } from '../components/ui/KpiBanner';
import { HorizontalBars } from '../components/charts/HorizontalBars';
import { MiniDonut } from '../components/charts/MiniDonut';
import { exportReportCsv } from '../utils/exportCsv';

type Tab = 'overview' | 'harvest' | 'contributions' | 'payments' | 'reports' | 'ai-assistant' | 'profile';

export const FarmerDashboardPage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [harvests, setHarvests] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [profileRequestsHistory, setProfileRequestsHistory] = useState<any[]>([]);
  const [cropRecommendations, setCropRecommendations] = useState<any[]>([]);
  const [profileForm, setProfileForm] = useState({ fullName: '', phone: '', district: '', sector: '', crops: '', farmSizeHectares: '' });
  const [profileLocationForm, setProfileLocationForm] = useState(emptyRwandaLocation());
  const [profileRequestMessage, setProfileRequestMessage] = useState('');
  const [harvestMessage, setHarvestMessage] = useState('');
  const [lotMessage, setLotMessage] = useState('');
  const [seasonalGuidance, setSeasonalGuidance] = useState<any[]>([]);
  const [harvestForm, setHarvestForm] = useState({ crop: '', expectedQuantityKg: '', expectedHarvestDate: '', qualityIndicators: '' });
  const [editingHarvestId, setEditingHarvestId] = useState<string | null>(null);
  const [submittingHarvest, setSubmittingHarvest] = useState(false);
  const [submittingLot, setSubmittingLot] = useState(false);
  const [submittingProfile, setSubmittingProfile] = useState(false);
  const [lotForm, setLotForm] = useState({
    crop: '',
    quantityKg: '',
    qualityGrade: 'A',
    expectedHarvestDate: '',
    moisturePercent: '',
    expectedPricePerKg: '',
    season: '',
    qualityNotes: '',
  });
  const [editingLotId, setEditingLotId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    const [pRes, hRes, payRes, invRes, recRes, profileReqRes, guidanceRes] = await Promise.all([
      api.get('/api/farmers/profile').catch(() => ({ data: null })),
      api.get('/api/farmers/harvest-declarations').catch(() => ({ data: [] })),
      api.get('/api/farmers/payments').catch(() => ({ data: [] })),
      api.get('/api/lots').catch(() => ({ data: [] })),
      api.get('/api/farmers/crop-recommendations').catch(() => ({ data: [] })),
      api.get('/api/farmers/profile-update-requests').catch(() => ({ data: [] })),
      api.get('/api/reference/seasonal-guidance').catch(() => ({ data: [] })),
    ]);
    setProfile(pRes.data);
    setHarvests(Array.isArray(hRes.data) ? hRes.data : []);
    setPayments(Array.isArray(payRes.data) ? payRes.data : []);
    const recData = recRes.data?.recommendations ?? recRes.data;
    setCropRecommendations(Array.isArray(recData) ? recData : []);
    setProfileRequestsHistory(Array.isArray(profileReqRes.data) ? profileReqRes.data : []);
    setSeasonalGuidance(Array.isArray(guidanceRes.data) ? guidanceRes.data : []);
    const farmerId = pRes.data?.id;
    const name = user?.fullName?.toLowerCase();
    setInventory(Array.isArray(invRes.data) ? invRes.data.filter((l: any) => (farmerId && l.farmerId === farmerId) || (l.farmer || '').toLowerCase() === name) : []);
    if (pRes.data) {
      setProfileForm({
        fullName: pRes.data.fullName || '',
        phone: pRes.data.phone || '',
        district: pRes.data.district || '',
        sector: pRes.data.sector || '',
        crops: pRes.data.crops || '',
        farmSizeHectares: pRes.data.farmSizeHectares ? String(pRes.data.farmSizeHectares) : '',
      });
      setProfileLocationForm((previous) => ({
        ...previous,
        district: pRes.data.district || '',
        sector: pRes.data.sector || '',
      }));
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalInventory = useMemo(() => inventory.reduce((s, l) => s + Number(l.quantityKg || 0), 0), [inventory]);
  const totalPayments = useMemo(() => payments.reduce((s, p) => s + Number(p.amount || 0), 0), [payments]);

  const submitHarvest = async () => {
    if (submittingHarvest) return;
    setSubmittingHarvest(true);
    setHarvestMessage('');
    const payload = {
      crop: harvestForm.crop,
      expectedQuantityKg: Number(harvestForm.expectedQuantityKg),
      expectedHarvestDate: new Date(harvestForm.expectedHarvestDate).toISOString(),
      qualityIndicators: harvestForm.qualityIndicators,
    };
    try {
      if (editingHarvestId) {
        await api.put(`/api/farmers/harvest-declaration/${editingHarvestId}`, payload);
        setHarvestMessage(t('farmer_dashboard.harvest_updated', 'Harvest declaration updated successfully.'));
      } else {
        const res = await api.post('/api/farmers/harvest-declaration', payload);
        setHarvestMessage(String(res.data?.message || 'Harvest declaration submitted successfully.'));
      }
      setEditingHarvestId(null);
      setHarvestForm({ crop: '', expectedQuantityKg: '', expectedHarvestDate: '', qualityIndicators: '' });
      await loadData();
    } catch (error: any) {
      setHarvestMessage(error?.response?.data || 'Failed to submit harvest declaration.');
    } finally {
      setSubmittingHarvest(false);
    }
  };

  const deleteHarvest = async (id: string) => {
    try {
      await api.delete(`/api/farmers/harvest-declaration/${id}`);
      setHarvests((prev) => prev.filter((h) => h.id !== id));
      setHarvestMessage(t('farmer_dashboard.harvest_deleted', 'Harvest declaration deleted successfully.'));
    } catch (error: any) {
      setHarvestMessage(error?.response?.data || 'Failed to delete harvest declaration.');
    }
  };

  const submitLot = async () => {
    if (submittingLot) return;
    setSubmittingLot(true);
    setLotMessage('');
    const payload = {
      crop: lotForm.crop,
      quantityKg: Number(lotForm.quantityKg),
      qualityGrade: lotForm.qualityGrade,
      expectedHarvestDate: new Date(lotForm.expectedHarvestDate).toISOString(),
      moisturePercent: lotForm.moisturePercent ? Number(lotForm.moisturePercent) : null,
      expectedPricePerKg: lotForm.expectedPricePerKg ? Number(lotForm.expectedPricePerKg) : null,
      season: lotForm.season || null,
      qualityNotes: lotForm.qualityNotes || null,
    };
    try {
      if (editingLotId) {
        await api.put(`/api/lots/${editingLotId}`, payload);
        setLotMessage(t('farmer_dashboard.inventory_updated', 'Inventory submission updated successfully.'));
      } else {
        const res = await api.post('/api/lots', payload);
        setLotMessage(String(res.data?.message || 'Inventory submission created successfully.'));
      }
      setEditingLotId(null);
      setLotForm({ crop: '', quantityKg: '', qualityGrade: 'A', expectedHarvestDate: '', moisturePercent: '', expectedPricePerKg: '', season: '', qualityNotes: '' });
      await loadData();
    } catch (error: any) {
      setLotMessage(error?.response?.data || 'Failed to submit inventory.');
    } finally {
      setSubmittingLot(false);
    }
  };

  const deleteLot = async (id: string) => {
    try {
      await api.delete(`/api/lots/${id}`);
      setLotMessage(t('farmer_dashboard.inventory_deleted', 'Inventory submission deleted successfully.'));
      await loadData();
    } catch (error: any) {
      setLotMessage(error?.response?.data || 'Failed to delete inventory submission.');
    }
  };

  const submitProfileUpdateRequest = async () => {
    if (submittingProfile) return;
    setSubmittingProfile(true);
    setProfileRequestMessage('');
    try {
      const res = await api.put('/api/farmers/profile', {
        fullName: profileForm.fullName,
        phone: profileForm.phone,
        district: profileLocationForm.district,
        sector: profileLocationForm.sector,
        crops: profileForm.crops,
        farmSizeHectares: profileForm.farmSizeHectares ? Number(profileForm.farmSizeHectares) : null,
      });
      setProfileRequestMessage(String(res.data?.message || t('farmer_dashboard.profile_request_sent', 'Profile update request sent to your cooperative manager.')));
      await loadData();
    } catch (error: any) {
      setProfileRequestMessage(error?.response?.data || 'Failed to submit profile update request.');
    } finally {
      setSubmittingProfile(false);
    }
  };

  const deleteProfileHistory = async (id: string) => {
    try {
      const res = await api.delete(`/api/farmers/profile-update-requests/${id}`);
      setProfileRequestMessage(String(res.data?.message || t('farmer_dashboard.profile_history_deleted', 'Profile update history deleted.')));
      await loadData();
    } catch (error: any) {
      setProfileRequestMessage(error?.response?.data || 'Failed to delete profile request history.');
    }
  };

  if (loading) return <Loader label={t('farmer_dashboard.loading', 'Loading farmer dashboard...')} />;

  return (
    <DashboardShell
      brand="RASS Farmer"
      subtitle={t('farmer_dashboard.subtitle', 'Producer workspace')}
      title={t('farmer_dashboard.title', 'Farmer dashboard')}
      activeKey={activeTab}
      navItems={[
        { key: 'overview', label: t('farmer_dashboard.tabs.overview', 'Overview'), icon: <LayoutDashboard className="h-4 w-4" /> },
        { key: 'harvest', label: t('farmer_dashboard.tabs.harvest', 'Harvest declarations'), icon: <Sprout className="h-4 w-4" /> },
        { key: 'contributions', label: t('farmer_dashboard.tabs.inventory', 'Inventory submission'), icon: <Package className="h-4 w-4" /> },
        { key: 'payments', label: t('farmer_dashboard.tabs.payments', 'Payments'), icon: <Banknote className="h-4 w-4" /> },
        { key: 'reports', label: 'Reports & Export', icon: <FileText className="h-4 w-4" /> },
        { key: 'ai-assistant', label: t('farmer_dashboard.tabs.ai_assistant', 'AI Assistant'), icon: <BrainCircuit className="h-4 w-4" /> },
        { key: 'profile', label: t('farmer_dashboard.tabs.profile', 'Profile'), icon: <User className="h-4 w-4" /> },
      ]}
      onNavChange={(k) => setActiveTab(k as Tab)}
      onLogout={logout}
      rightStatus={profile?.cooperative?.name || t('farmer_dashboard.authorized', 'Authorized farmer')}
    >
      <div className="space-y-6">
        {activeTab === 'overview' && (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <KpiBanner icon={<Leaf className="h-5 w-5 text-white" />} label={t('farmer_dashboard.kpi.declarations', 'Declarations')} value={harvests.length} sub={`${harvests.filter((h: any) => h.status === 'Approved').length} approved`} color="emerald" onClick={() => setActiveTab('harvest')} />
              <KpiBanner icon={<Package className="h-5 w-5 text-white" />} label={t('farmer_dashboard.kpi.inventory', 'Inventory')} value={`${totalInventory.toLocaleString()} kg`} sub={`${inventory.length} lot contributions`} color="blue" onClick={() => setActiveTab('contributions')} />
              <KpiBanner icon={<Banknote className="h-5 w-5 text-white" />} label={t('farmer_dashboard.kpi.payments', 'Payments')} value={`${totalPayments.toLocaleString()} RWF`} sub={`${payments.length} transactions`} color="teal" onClick={() => setActiveTab('payments')} />
              <KpiBanner icon={<TrendingUp className="h-5 w-5 text-white" />} label={t('farmer_dashboard.kpi.activity', 'Activity')} value={t('farmer_dashboard.kpi.live', 'Live')} sub="Prices, notifications, guidance" color="violet" onClick={() => navigate('/prices')} />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Card className="p-5">
                <MiniDonut
                  title="Harvest declaration status"
                  slices={[
                    { label: 'Approved', value: harvests.filter((h: any) => h.status === 'Approved').length, color: '#059669' },
                    { label: 'Pending', value: harvests.filter((h: any) => h.status === 'Pending' || !h.status).length, color: '#f59e0b' },
                    { label: 'Rejected', value: harvests.filter((h: any) => h.status === 'Rejected').length, color: '#ef4444' },
                  ].filter(s => s.value > 0)}
                />
              </Card>
              <Card className="p-5 lg:col-span-2">
                <HorizontalBars
                  title="Inventory by crop"
                  unit="kg"
                  bars={(() => {
                    const grouped: Record<string, number> = {};
                    inventory.forEach((item: any) => { grouped[item.crop || 'Other'] = (grouped[item.crop || 'Other'] || 0) + Number(item.quantityKg || 0); });
                    return Object.entries(grouped)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 5)
                      .map(([label, value], i) => ({ label, value, color: ['#059669', '#0891b2', '#7c3aed', '#ea580c', '#64748b'][i] }));
                  })()}
                />
              </Card>
            </div>
            <RoleAIAnalyticsPanel contextData={{ harvests, inventory, payments }} />
            <Card className="p-5">
              <h3 className="text-lg font-black text-slate-900">{t('farmer_dashboard.ai_crop_recommendations', 'AI crop recommendations')}</h3>
              <p className="mt-1 text-xs text-slate-500">{t('farmer_dashboard.ai_crop_recommendations_hint', 'Trending crops with high demand and current supply deficits.')}</p>
              <div className="mt-4 space-y-2">
                {cropRecommendations.length === 0 ? (
                  <p className="text-sm text-slate-500">{t('farmer_dashboard.no_recommendations', 'No recommendation data available yet.')}</p>
                ) : cropRecommendations.map((r: any, idx: number) => (
                  <div key={`${r.crop}-${idx}`} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5">
                    <div>
                      <p className="text-sm font-semibold">{r.crop}</p>
                      <p className="text-xs text-slate-500">Demand {Number(r.demandKg || 0).toLocaleString()}kg • Supply {Number(r.supplyKg || 0).toLocaleString()}kg</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-rose-600">Deficit {Number(r.deficitKg || 0).toLocaleString()}kg</p>
                      <p className="text-xs font-semibold text-emerald-700">{Number(r.avgPricePerKg || 0).toLocaleString()} RWF/kg</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
            {seasonalGuidance.length > 0 && (
              <Card className="p-5">
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Sprout className="h-5 w-5 text-emerald-600" />
                  Government Seasonal Guidance
                </h3>
                <p className="mt-1 text-xs text-slate-500">Official guidance from government on expected price trends and planting recommendations.</p>
                <div className="mt-3 space-y-2">
                  {seasonalGuidance.map((g: any, i: number) => (
                    <div key={i} className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-emerald-800">{g.crop}</span>
                        <span className="text-xs text-emerald-600">{g.region} • Season {g.season}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${g.expectedTrend === 'Rise' ? 'bg-red-100 text-red-700' : g.expectedTrend === 'Fall' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                          {g.expectedTrend === 'Rise' ? '↑ Prices Rising' : g.expectedTrend === 'Fall' ? '↓ Prices Falling' : '→ Stable'}
                        </span>
                      </div>
                      <p className="mt-1.5 text-sm text-emerald-800">{g.recommendationForFarmers}</p>
                      {g.expectedMinPrice != null && g.expectedMaxPrice != null && (
                        <p className="mt-0.5 text-xs text-emerald-600">Expected price: {Number(g.expectedMinPrice).toLocaleString()}–{Number(g.expectedMaxPrice).toLocaleString()} RWF/kg</p>
                      )}
                      {g.stabilityStart && g.stabilityEnd && (
                        <p className="text-xs text-emerald-500">Stability period: {new Date(g.stabilityStart).toLocaleDateString()} – {new Date(g.stabilityEnd).toLocaleDateString()}</p>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}
            <NationalMarketPulsePanel title={t('farmer_dashboard.market_pulse', 'Farmer market pulse')} />
          </>
        )}

        {activeTab === 'harvest' && (
          <Card className="p-5">
            <h3 className="text-lg font-black text-slate-900">{t('farmer_dashboard.harvest_form_title', 'Create / edit harvest declaration')}</h3>
            <p className="mt-1 text-xs text-slate-500">Choose a government-registered crop or create a new local crop. New crops are sent to government for optional regulation review.</p>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <CropSelector value={harvestForm.crop} onChange={(value) => setHarvestForm((p) => ({ ...p, crop: value }))} label={t('common.crop', 'Crop')} allowCustom />
              <Input label={t('farmer_dashboard.expected_quantity', 'Expected quantity (kg)')} type="number" value={harvestForm.expectedQuantityKg} onChange={(e) => setHarvestForm((p) => ({ ...p, expectedQuantityKg: e.target.value }))} />
              <Input label={t('farmer_dashboard.expected_harvest_date', 'Expected harvest date')} type="date" value={harvestForm.expectedHarvestDate} onChange={(e) => setHarvestForm((p) => ({ ...p, expectedHarvestDate: e.target.value }))} />
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-600">{t('farmer_dashboard.quality_indicators', 'Quality indicators')}</span>
                <select className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" value={harvestForm.qualityIndicators} onChange={(e) => setHarvestForm((p) => ({ ...p, qualityIndicators: e.target.value }))}>
                  <option value="">{t('farmer_dashboard.select_grade', 'Select grade')}</option>
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                </select>
              </label>
            </div>
            <div className="mt-4 flex gap-2">
              <Button onClick={submitHarvest} disabled={submittingHarvest}>{editingHarvestId ? t('farmer_dashboard.update_declaration', 'Update declaration') : t('farmer_dashboard.create_declaration', 'Create declaration')}</Button>
              {editingHarvestId && <Button variant="outline" onClick={() => setEditingHarvestId(null)}>{t('common.cancel', 'Cancel')}</Button>}
            </div>
            {harvestMessage && <p className="mt-2 text-xs font-semibold text-emerald-700">{harvestMessage}</p>}
            <h4 className="mt-6 text-sm font-black text-slate-900 uppercase tracking-wider">Your declarations ({harvests.length})</h4>
            {harvests.length === 0 && (
              <div className="mt-3 rounded-xl border-2 border-dashed border-slate-200 p-8 text-center">
                <Sprout className="mx-auto h-10 w-10 text-slate-300" />
                <p className="mt-2 text-sm font-semibold text-slate-500">No harvest declarations yet</p>
                <p className="mt-1 text-xs text-slate-400">Use the form above to declare your expected harvest so your cooperative can plan ahead.</p>
              </div>
            )}
            <div className="mt-3 space-y-2">
              {harvests.map((h: any) => (
                <div key={h.id} className="rounded-xl border border-slate-200 px-4 py-3 hover:border-emerald-300 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-slate-900">{h.crop}</p>
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${h.status === 'Approved' ? 'bg-emerald-50 text-emerald-700' : h.status === 'Rejected' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'}`}>{h.status || 'Pending'}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {Number(h.expectedQuantityKg || 0).toLocaleString()} kg
                        {h.qualityIndicators && ` • Grade ${h.qualityIndicators}`}
                        {h.expectedHarvestDate && ` • Harvest: ${new Date(h.expectedHarvestDate).toLocaleDateString()}`}
                      </p>
                      {h.createdAt && <p className="text-[10px] text-slate-400">Submitted {new Date(h.createdAt).toLocaleDateString()}</p>}
                    </div>
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="outline" onClick={() => {
                        setEditingHarvestId(h.id);
                        setHarvestForm({
                          crop: h.crop || '',
                          expectedQuantityKg: String(h.expectedQuantityKg || ''),
                          expectedHarvestDate: h.expectedHarvestDate ? new Date(h.expectedHarvestDate).toISOString().slice(0, 10) : '',
                          qualityIndicators: h.qualityIndicators || '',
                        });
                      }}>Edit</Button>
                      <Button size="sm" variant="danger" onClick={() => deleteHarvest(h.id)}>Delete</Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {activeTab === 'contributions' && (
          <Card className="p-5">
            <h3 className="text-lg font-black text-slate-900">{t('farmer_dashboard.inventory_form_title', 'Create / edit inventory submission')}</h3>
            <p className="mt-1 text-xs text-slate-500">Inventory follows the same crop catalog: select a registered crop or create a new crop that government can later review.</p>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <CropSelector value={lotForm.crop} onChange={(value) => setLotForm((p) => ({ ...p, crop: value }))} label={t('common.crop', 'Crop')} allowCustom />
              <Input label={t('common.quantity', 'Quantity (kg)')} type="number" value={lotForm.quantityKg} onChange={(e) => setLotForm((p) => ({ ...p, quantityKg: e.target.value }))} />
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-600">{t('farmer_dashboard.quality_grade', 'Quality grade')}</span>
                <select className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" value={lotForm.qualityGrade} onChange={(e) => setLotForm((p) => ({ ...p, qualityGrade: e.target.value }))}>
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                </select>
              </label>
              <Input label={t('farmer_dashboard.expected_harvest_date', 'Expected harvest date')} type="date" value={lotForm.expectedHarvestDate} onChange={(e) => setLotForm((p) => ({ ...p, expectedHarvestDate: e.target.value }))} />
              <Input label={t('farmer_dashboard.moisture', 'Moisture (%)')} type="number" value={lotForm.moisturePercent} onChange={(e) => setLotForm((p) => ({ ...p, moisturePercent: e.target.value }))} />
              <Input label={t('farmer_dashboard.price_expectation', 'Price expectation (RWF/kg)')} type="number" value={lotForm.expectedPricePerKg} onChange={(e) => setLotForm((p) => ({ ...p, expectedPricePerKg: e.target.value }))} />
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-600">{t('farmer_dashboard.season', 'Season')}</span>
                <select className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" value={lotForm.season} onChange={(e) => setLotForm((p) => ({ ...p, season: e.target.value }))}>
                  <option value="">{t('farmer_dashboard.select_season', 'Select season')}</option>
                  <option value="Season A">Season A</option>
                  <option value="Season B">Season B</option>
                  <option value="Season C">Season C</option>
                </select>
              </label>
              <Input label={t('farmer_dashboard.quality_notes', 'Quality notes')} value={lotForm.qualityNotes} onChange={(e) => setLotForm((p) => ({ ...p, qualityNotes: e.target.value }))} />
            </div>
            <div className="mt-4 flex gap-2">
              <Button onClick={submitLot} disabled={submittingLot}>{editingLotId ? t('farmer_dashboard.update_inventory', 'Update inventory') : t('farmer_dashboard.create_inventory', 'Create inventory')}</Button>
              {editingLotId && <Button variant="outline" onClick={() => setEditingLotId(null)}>{t('common.cancel', 'Cancel')}</Button>}
            </div>
            {lotMessage && <p className="mt-2 text-xs font-semibold text-emerald-700">{lotMessage}</p>}
            <h4 className="mt-6 text-sm font-black text-slate-900 uppercase tracking-wider">Your inventory ({inventory.length})</h4>
            {inventory.length === 0 && (
              <div className="mt-3 rounded-xl border-2 border-dashed border-slate-200 p-8 text-center">
                <Package className="mx-auto h-10 w-10 text-slate-300" />
                <p className="mt-2 text-sm font-semibold text-slate-500">No inventory submitted yet</p>
                <p className="mt-1 text-xs text-slate-400">Submit your crop lots above. Your cooperative will aggregate them for market listings.</p>
              </div>
            )}
            <div className="mt-3 space-y-2">
              {inventory.map((lot: any) => (
                <div key={lot.id} className="rounded-xl border border-slate-200 px-4 py-3 hover:border-emerald-300 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-slate-900">{lot.crop}</p>
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${lot.status === 'Verified' ? 'bg-emerald-50 text-emerald-700' : lot.status === 'Rejected' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'}`}>{lot.status || 'Pending'}</span>
                        {lot.qualityGrade && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">Grade {lot.qualityGrade}</span>}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {Number(lot.quantityKg || 0).toLocaleString()} kg
                        {lot.season && ` • ${lot.season}`}
                        {lot.expectedHarvestDate && ` • Harvest: ${new Date(lot.expectedHarvestDate).toLocaleDateString()}`}
                      </p>
                      {lot.expectedPricePerKg && <p className="text-[10px] text-emerald-600">Expected: {Number(lot.expectedPricePerKg).toLocaleString()} RWF/kg</p>}
                    </div>
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="outline" onClick={() => {
                        setEditingLotId(lot.id);
                        setLotForm({
                          crop: lot.crop || '',
                          quantityKg: String(lot.quantityKg || ''),
                          qualityGrade: lot.qualityGrade || 'A',
                          expectedHarvestDate: lot.expectedHarvestDate ? new Date(lot.expectedHarvestDate).toISOString().slice(0, 10) : '',
                          moisturePercent: String(lot.moisturePercent || ''),
                          expectedPricePerKg: String(lot.expectedPricePerKg || ''),
                          season: lot.season || '',
                          qualityNotes: lot.qualityNotes || '',
                        });
                      }}>Edit</Button>
                      <Button size="sm" variant="danger" onClick={() => deleteLot(lot.id)}>Delete</Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {activeTab === 'payments' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Card className="p-4 text-center">
                <p className="text-xs font-semibold text-slate-500 uppercase">Total earned</p>
                <p className="mt-1 text-2xl font-black text-emerald-700">{totalPayments.toLocaleString()} <span className="text-sm">RWF</span></p>
              </Card>
              <Card className="p-4 text-center">
                <p className="text-xs font-semibold text-slate-500 uppercase">Transactions</p>
                <p className="mt-1 text-2xl font-black text-slate-900">{payments.length}</p>
              </Card>
              <Card className="p-4 text-center">
                <p className="text-xs font-semibold text-slate-500 uppercase">Avg per transaction</p>
                <p className="mt-1 text-2xl font-black text-blue-700">{payments.length > 0 ? Math.round(totalPayments / payments.length).toLocaleString() : 0} <span className="text-sm">RWF</span></p>
              </Card>
            </div>
            <Card className="p-5">
              <h3 className="text-lg font-black text-slate-900">{t('farmer_dashboard.payment_history', 'Payment history')}</h3>
              {payments.length === 0 && (
                <div className="mt-4 rounded-xl border-2 border-dashed border-slate-200 p-8 text-center">
                  <Banknote className="mx-auto h-10 w-10 text-slate-300" />
                  <p className="mt-2 text-sm font-semibold text-slate-500">No payments received yet</p>
                  <p className="mt-1 text-xs text-slate-400">Payments appear here once your cooperative processes orders from buyers and distributes revenue to contributing farmers.</p>
                </div>
              )}
              <div className="mt-4 space-y-2">
                {payments.map((p: any, idx: number) => (
                  <div key={p.id || idx} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 hover:border-emerald-300 transition-colors">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{p.reference || `Payment #${idx + 1}`}</p>
                      <p className="text-xs text-slate-500">
                        {p.crop && `${p.crop} • `}
                        {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : 'Date N/A'}
                        {p.method && ` • via ${p.method}`}
                      </p>
                    </div>
                    <p className="text-sm font-black text-emerald-700">+{Number(p.amount || 0).toLocaleString()} RWF</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="space-y-5">
            <div className="rounded-2xl bg-gradient-to-r from-[#002D15] via-[#003D20] to-[#00793E] p-6 text-white">
              <h2 className="text-xl font-black">Farmer Reports & Export</h2>
              <p className="mt-1 text-sm text-emerald-200">Download your farming data as CSV/Excel files for record-keeping and analysis.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { type: 'my-harvests', label: 'My Harvests', desc: 'All your harvest declarations with crop, expected quantity, and status', icon: <Sprout className="h-5 w-5 text-emerald-600" />, bg: 'bg-emerald-50' },
                { type: 'my-contributions', label: 'My Contributions', desc: 'Lot contributions to your cooperative with quantities and quality grades', icon: <Package className="h-5 w-5 text-blue-600" />, bg: 'bg-blue-50' },
                { type: 'my-payments', label: 'My Payments', desc: 'Payment records for your produce sales and contract settlements', icon: <Banknote className="h-5 w-5 text-violet-600" />, bg: 'bg-violet-50' },
                { type: 'prices', label: 'Market Prices', desc: 'Current and historical market prices to inform your selling decisions', icon: <TrendingUp className="h-5 w-5 text-amber-600" />, bg: 'bg-amber-50' },
              ].map((r) => (
                <Card key={r.type} className="p-5 hover:shadow-lg transition-shadow">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${r.bg}`}>{r.icon}</div>
                    <div className="flex-1">
                      <h4 className="text-sm font-black text-slate-900">{r.label}</h4>
                      <p className="text-[10px] text-slate-500 leading-relaxed">{r.desc}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => exportReportCsv(r.type)}
                    className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition"
                  >
                    <Download className="h-3.5 w-3.5" /> Export CSV
                  </button>
                </Card>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'ai-assistant' && (
          <RoleAssistantCard
            title={t('farmer_dashboard.ai_assistant_title', 'Farmer AI Assistant')}
            intro={t('farmer_dashboard.ai_assistant_intro', 'I can analyze your harvest declarations, inventory quality, and payment flow to recommend the best next action.')}
            placeholder={t('farmer_dashboard.ai_assistant_placeholder', 'Ask about best time to sell, risk alerts, or pricing strategy...')}
          />
        )}

        {activeTab === 'profile' && (
          <Card className="p-5">
            <h3 className="text-lg font-black text-slate-900">{t('farmer_dashboard.profile_update_title', 'Profile update request')}</h3>
            <p className="mt-1 text-xs text-slate-500">{t('farmer_dashboard.profile_update_hint', 'Submit your requested changes for cooperative manager approval.')}</p>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <Input label={t('common.full_name', 'Full name')} value={profileForm.fullName} onChange={(e) => setProfileForm((p) => ({ ...p, fullName: e.target.value }))} />
              <Input label={t('common.phone', 'Phone')} value={profileForm.phone} onChange={(e) => setProfileForm((p) => ({ ...p, phone: e.target.value }))} />
              <div className="md:col-span-2">
                <RwandaLocationFields
                  value={profileLocationForm}
                  onChange={setProfileLocationForm}
                  showCell={false}
                  showDetail={false}
                />
              </div>
              <Input label={t('common.crops', 'Crops')} value={profileForm.crops} onChange={(e) => setProfileForm((p) => ({ ...p, crops: e.target.value }))} />
              <Input label={t('farmer_dashboard.farm_size', 'Farm size (ha)')} type="number" value={profileForm.farmSizeHectares} onChange={(e) => setProfileForm((p) => ({ ...p, farmSizeHectares: e.target.value }))} />
            </div>
            <div className="mt-4 flex items-center gap-3">
              <Button onClick={submitProfileUpdateRequest} disabled={submittingProfile}>{t('farmer_dashboard.submit_request', 'Submit request')}</Button>
              {profileRequestMessage && <p className="text-xs font-semibold text-emerald-700">{profileRequestMessage}</p>}
            </div>
            <p className="mt-3 text-sm text-slate-600">{t('farmer_dashboard.current_cooperative', 'Current cooperative')}: {profile?.cooperative?.name || t('farmer_dashboard.no_cooperative_set', 'No cooperative set')}</p>
            <div className="mt-5 space-y-2">
              <h4 className="text-sm font-black text-slate-900">{t('farmer_dashboard.request_history', 'Request history')}</h4>
              {profileRequestsHistory.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-semibold">{r.status}</p>
                    <p className="text-xs text-slate-500">{new Date(r.timestamp).toLocaleString()}</p>
                  </div>
                  {r.status === 'Approved' && (
                    <Button size="sm" variant="danger" onClick={() => deleteProfileHistory(r.id)}>Delete</Button>
                  )}
                </div>
              ))}
              {profileRequestsHistory.length === 0 && <p className="text-xs text-slate-500">{t('farmer_dashboard.no_profile_request_history', 'No profile request history yet.')}</p>}
            </div>
          </Card>
        )}
      </div>
    </DashboardShell>
  );
};
