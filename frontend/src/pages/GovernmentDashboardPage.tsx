import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, BrainCircuit, BookOpen, Download, FileText, Gavel, LayoutDashboard, MessageSquare, Plus, Scale, ShieldCheck, Sprout, TrendingUp, Trash2, Edit3, Check, Users, X } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useSignalR } from '../context/SignalRContext';
import { DashboardShell } from '../components/layout/DashboardShell';
import { Card } from '../components/ui/Card';
import { Loader } from '../components/ui/Loader';
import { RoleAIAnalyticsPanel } from '../components/RoleAIAnalyticsPanel';
import { PriceChart } from '../components/charts/PriceChart';
import { NationalMarketPulsePanel } from '../components/NationalMarketPulsePanel';
import { RoleAssistantCard } from '../components/RoleAssistantCard';
import { useRwandaAdministrativeData } from '../hooks/useRwandaAdministrativeData';
import { useCropCatalog } from '../hooks/useCropCatalog';
import { useRegisteredMarkets } from '../hooks/useRegisteredMarkets';
import { CropSelector } from '../components/forms/CropSelector';
import { MarketSelector } from '../components/forms/MarketSelector';
import { RwandaLocationFields } from '../components/location/RwandaLocationFields';
import { emptyRwandaLocation } from '../utils/rwandaLocation';

type Tab = 'overview' | 'trends' | 'supply' | 'security' | 'contracts' | 'warnings' | 'regulations' | 'guidance' | 'access-center' | 'reports' | 'price-moderation' | 'ai-assistant';

const DEFAULT_REGIONS = ['Kigali City', 'Northern', 'Southern', 'Eastern', 'Western'];
const SEASONS = ['A', 'B', 'C'];
const REPORT_TYPES = [
  { value: 'comprehensive', label: 'Comprehensive National Report' },
  { value: 'farmers', label: 'Farmers Registry' },
  { value: 'cooperatives', label: 'Cooperatives Performance' },
  { value: 'listings', label: 'Market Listings' },
  { value: 'harvests', label: 'Harvest Declarations' },
  { value: 'inventory', label: 'Inventory (Lots)' },
  { value: 'market-agents', label: 'Market Agents Oversight' },
  { value: 'storage-keepers', label: 'Storage Keepers & Capacity' },
  { value: 'transporters', label: 'Transporters Fleet' },
  { value: 'transport-jobs', label: 'Transport Jobs' },
  { value: 'contracts', label: 'Contracts' },
  { value: 'orders', label: 'Buyer Orders' },
  { value: 'payments', label: 'Payments & Transactions' },
  { value: 'price-trend', label: 'Price Trend Analysis' },
  { value: 'crop-growth', label: 'Crop Growth & Volume' },
  { value: 'supply-demand', label: 'Supply & Demand Balance' },
  { value: 'regional-performance', label: 'Regional Performance' },
  { value: 'regulation-compliance', label: 'Regulation Compliance' },
];

const normalizeSupplyDemandRows = (rows: any[]) =>
  rows.map((r: any) => ({
    region: r.region || r.crop || r.Crop || 'Region',
    supplyKg: Number(r.supplyKg ?? r.supply ?? r.Supply ?? 0),
    demandKg: Number(r.demandKg ?? r.demand ?? r.Demand ?? 0),
  }));

export const GovernmentDashboardPage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { unreadNotificationCount } = useSignalR();
  const { provinces, getDistricts } = useRwandaAdministrativeData();
  const { crops, refresh: refreshCrops } = useCropCatalog(true);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<any>(null);
  const [policyTitle, setPolicyTitle] = useState('');
  const [policyCategory, setPolicyCategory] = useState('MarketStability');
  const [policyContent, setPolicyContent] = useState('');
  const [annotationContent, setAnnotationContent] = useState('');
  const [reports, setReports] = useState<any[]>([]);
  const [warnings, setWarnings] = useState<any[]>([]);
  const [securityRows, setSecurityRows] = useState<any[]>([]);
  const [policyStatus, setPolicyStatus] = useState('');
  const [annotations, setAnnotations] = useState<any[]>([]);
  const [editingAnnotationId, setEditingAnnotationId] = useState<string>('');
  const [editingAnnotationContent, setEditingAnnotationContent] = useState('');
  const [ongoingContracts, setOngoingContracts] = useState<any[]>([]);
  const [nationalReport, setNationalReport] = useState<any>(null);

  // Price Regulations state
  const [regulations, setRegulations] = useState<any[]>([]);
  const [regForm, setRegForm] = useState({ crop: 'Maize', region: 'Kigali City', district: '', market: '', minPricePerKg: '', maxPricePerKg: '', effectiveFrom: '', effectiveTo: '', notes: '' });
  const [regStatus, setRegStatus] = useState('');
  const [editingRegId, setEditingRegId] = useState<string | null>(null);
  const [marketForm, setMarketForm] = useState({ name: '', location: '' });
  const [marketLocationForm, setMarketLocationForm] = useState(emptyRwandaLocation());
  const [marketStatus, setMarketStatus] = useState('');
  const { markets } = useRegisteredMarkets({ province: regForm.region, district: regForm.district });

  // Seasonal Guidance state
  const [guidanceList, setGuidanceList] = useState<any[]>([]);
  const [guidanceForm, setGuidanceForm] = useState({ crop: 'Maize', region: 'Kigali City', season: 'A', stabilityStart: '', stabilityEnd: '', expectedTrend: 'Stable', expectedMinPrice: '', expectedMaxPrice: '', recommendationForFarmers: '', notes: '' });
  const [guidanceStatus, setGuidanceStatus] = useState('');

  // Report Builder state
  const [reportType, setReportType] = useState('comprehensive');
  const [reportFilters, setReportFilters] = useState({ crop: '', region: '', district: '', startDate: '', endDate: '', year: new Date().getFullYear().toString() });
  const [generatedReport, setGeneratedReport] = useState<any>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [accessCenterData, setAccessCenterData] = useState<any>(null);
  const [accessCenterLoading, setAccessCenterLoading] = useState(false);

  // Price Moderation state
  const [priceSubmissions, setPriceSubmissions] = useState<any[]>([]);
  const [modFilter, setModFilter] = useState({ status: '', crop: '', days: '30' });
  const [modLoading, setModLoading] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
  const [moderationNote, setModerationNote] = useState('');
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null);

  const loadPriceSubmissions = async (status?: string, crop?: string, days?: string) => {
    setModLoading(true);
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (crop) params.set('crop', crop);
    params.set('days', days || '30');
    const res = await api.get(`/api/government/price-submissions?${params.toString()}`).catch(() => ({ data: [] }));
    setPriceSubmissions(Array.isArray(res.data) ? res.data : []);
    setModLoading(false);
  };

  const moderatePrice = async (id: string, status: string, note?: string) => {
    await api.post(`/api/government/price-submissions/${id}/moderate`, { status, note: note || null });
    await loadPriceSubmissions(modFilter.status, modFilter.crop, modFilter.days);
  };

  const loadData = async () => {
    setLoading(true);
    const [res, reportsRes, warningsRes, securityRes, annotationsRes, contractsRes, intelligenceRes, supplyDemandRes, regsRes, guidanceRes] = await Promise.all([
      api.get('/api/government/dashboard').catch(() => ({ data: null })),
      api.get('/api/government/reports?days=30').catch(() => ({ data: [] })),
      api.get('/api/government/early-warnings').catch(() => ({ data: [] })),
      api.get('/api/government/food-security').catch(() => ({ data: [] })),
      api.get('/api/government/annotations?days=180').catch(() => ({ data: [] })),
      api.get('/api/government/ongoing-contracts').catch(() => ({ data: [] })),
      api.get('/api/government/national-intelligence-report').catch(() => ({ data: null })),
      api.get('/api/government/supply-demand').catch(() => ({ data: [] })),
      api.get('/api/price-regulations').catch(() => ({ data: [] })),
      api.get('/api/reference/seasonal-guidance').catch(() => ({ data: [] })),
    ]);
    setDashboard((prev: any) => ({ ...(res.data || prev || {}), regionalSupplyDemand: normalizeSupplyDemandRows(Array.isArray(supplyDemandRes.data) ? supplyDemandRes.data : []) }));
    setReports(Array.isArray(reportsRes.data) ? reportsRes.data : []);
    setWarnings(Array.isArray(warningsRes.data) ? warningsRes.data : []);
    setSecurityRows(Array.isArray(securityRes.data) ? securityRes.data : []);
    setAnnotations(Array.isArray(annotationsRes.data) ? annotationsRes.data : []);
    setOngoingContracts(Array.isArray(contractsRes.data) ? contractsRes.data : []);
    setNationalReport(intelligenceRes.data);
    setRegulations(Array.isArray(regsRes.data) ? regsRes.data : []);
    setGuidanceList(Array.isArray(guidanceRes.data) ? guidanceRes.data : []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const regionOptions = provinces.length > 0 ? provinces : DEFAULT_REGIONS;
  const regulationDistrictOptions = getDistricts(regForm.region);
  const reportDistrictOptions = getDistricts(reportFilters.region);
  const pendingCrops = crops.filter((crop) => crop.requiresGovernmentReview);
  const reportCropOptions = crops.filter((crop) => crop.status === 'Active').map((crop) => crop.name);
  const createMarket = async () => {
    setMarketStatus('');
    try {
      await api.post('/api/catalog/markets', {
        name: marketForm.name,
        province: marketLocationForm.province,
        district: marketLocationForm.district,
        sector: marketLocationForm.sector,
        cell: marketLocationForm.cell || null,
        location: marketLocationForm.detail || marketForm.location || null,
      });
      setMarketStatus('Market registered successfully.');
      setMarketForm({ name: '', location: '' });
      setMarketLocationForm(emptyRwandaLocation());
      await loadData();
    } catch (e: any) {
      setMarketStatus(e?.response?.data?.message || e?.response?.data || 'Failed to register market.');
    }
  };

  const [expandedCropId, setExpandedCropId] = useState<string | null>(null);
  const [cropDetail, setCropDetail] = useState<any>(null);
  const [cropFilter, setCropFilter] = useState<'pending' | 'rejected' | 'all'>('pending');
  const [cropRejectTargetId, setCropRejectTargetId] = useState<string | null>(null);
  const [cropRejectReason, setCropRejectReason] = useState('');
  const [cropActionStatus, setCropActionStatus] = useState('');
  const [trendCropFilter, setTrendCropFilter] = useState('');
  const [supplyCropFilter, setSupplyCropFilter] = useState('');

  const approveCrop = async (cropId: string) => {
    setCropActionStatus('');
    await api.post(`/api/catalog/crops/${cropId}/approve`);
    await refreshCrops();
    setCropActionStatus('Crop approved successfully.');
  };

  const rejectCrop = async (cropId: string, reason: string) => {
    setCropActionStatus('');
    await api.post(`/api/catalog/crops/${cropId}/reject`, { reason: reason || null });
    await refreshCrops();
    setCropActionStatus('Crop rejected and submitter notified.');
  };

  const deleteCrop = async (cropId: string) => {
    if (!window.confirm('Permanently delete this rejected crop from the catalog?')) return;
    await api.delete(`/api/catalog/crops/${cropId}`);
    await refreshCrops();
  };

  const loadCropDetail = async (cropId: string) => {
    if (expandedCropId === cropId) { setExpandedCropId(null); setCropDetail(null); return; }
    setExpandedCropId(cropId);
    try {
      const res = await api.get(`/api/catalog/crops/${cropId}`);
      setCropDetail(res.data);
    } catch { setCropDetail(null); }
  };

  const messageCropSubmitter = (submitterUserId?: string | null) => {
    if (!submitterUserId) return;
    navigate(`/messages?userId=${encodeURIComponent(submitterUserId)}`);
  };

  const trendData = useMemo(() => {
    const series = dashboard?.nationalPriceTrends || dashboard?.priceTrends || [];
    if (!Array.isArray(series) || series.length === 0) return [];
    return series.slice(0, 12).map((x: any) => ({ name: x.month || x.date || x.label || 'N/A', value: Number(x.value || x.avgPrice || 0) }));
  }, [dashboard]);

  const supplyDemandRows = useMemo(() => {
    const regional = Array.isArray(dashboard?.regionalSupplyDemand) ? dashboard.regionalSupplyDemand : [];
    if (regional.length > 0) return regional;
    const fallback = Array.isArray(dashboard?.RegionalDistribution) ? dashboard.RegionalDistribution : [];
    return fallback.map((r: any) => ({
      region: r.region || r.Region || 'Region',
      supplyKg: Number(r.totalVolume ?? r.TotalVolume ?? 0),
      demandKg: Math.max(0, Math.round(Number(r.totalVolume ?? r.TotalVolume ?? 0) * 0.82)),
    }));
  }, [dashboard]);

  const securityIndicators = useMemo(() => {
    const indicators = Array.isArray(dashboard?.foodSecurityIndicators) ? dashboard.foodSecurityIndicators : [];
    if (indicators.length > 0) return indicators;
    const totalFarmers = Number(dashboard?.totalFarmers ?? dashboard?.SupplyChain?.TotalFarmers ?? 0);
    const activeCoops = Number(dashboard?.activeCooperatives ?? dashboard?.SupplyChain?.ActiveCooperatives ?? 0);
    const totalSupply = Number(dashboard?.nationalSupplyKg ?? dashboard?.MarketOverview?.TotalVolume ?? 0);
    return [
      { metric: 'Farmer Coverage', value: totalFarmers.toLocaleString() },
      { metric: 'Cooperative Capacity', value: activeCoops.toLocaleString() },
      { metric: 'National Supply Buffer', value: `${Math.round(totalSupply / 1000).toLocaleString()} tons` },
    ];
  }, [dashboard]);

  const alertRows = useMemo(() => {
    const alerts = warnings.length > 0 ? warnings : (Array.isArray(dashboard?.alerts) ? dashboard.alerts : []);
    if (alerts.length > 0) return alerts;
    return supplyDemandRows
      .map((r: any) => {
        const supply = Number(r.supplyKg || 0);
        const demand = Number(r.demandKg || 0);
        const gap = demand - supply;
        if (gap <= 0) return null;
        return {
          title: `${r.region || 'Region'} supply pressure`,
          description: `Demand exceeds supply by ${gap.toLocaleString()} kg. Prioritize redistribution and listing refresh.`,
        };
      })
      .filter(Boolean);
  }, [dashboard, supplyDemandRows, warnings]);

  const overviewStats = useMemo(() => {
    const totalFarmers = Number(
      dashboard?.totalFarmers ??
      dashboard?.supplyChain?.totalFarmers ??
      dashboard?.SupplyChain?.TotalFarmers ??
      0
    );

    const nationalSupplyFromRows = supplyDemandRows.reduce((sum: number, row: any) => sum + Number(row?.supplyKg ?? 0), 0);
    const nationalSupplyKg = Number(
      dashboard?.nationalSupplyKg ??
      dashboard?.marketOverview?.totalVolume ??
      dashboard?.MarketOverview?.TotalVolume ??
      nationalSupplyFromRows
    );

    const activeCooperatives = Number(
      dashboard?.activeCooperatives ??
      dashboard?.supplyChain?.activeCooperatives ??
      dashboard?.SupplyChain?.ActiveCooperatives ??
      0
    );

    const riskAlerts = Number(
      dashboard?.riskAlerts ??
      dashboard?.riskAlertCount ??
      (Array.isArray(warnings) && warnings.length > 0 ? warnings.length : alertRows.length)
    );

    return { totalFarmers, nationalSupplyKg, activeCooperatives, riskAlerts };
  }, [dashboard, supplyDemandRows, warnings, alertRows]);

  // --- Regulation handlers ---
  const submitRegulation = async () => {
    setRegStatus('');
    try {
      const payload = {
        crop: regForm.crop,
        region: regForm.region,
        district: regForm.district || null,
        market: regForm.market || null,
        minPricePerKg: regForm.minPricePerKg ? Number(regForm.minPricePerKg) : null,
        maxPricePerKg: regForm.maxPricePerKg ? Number(regForm.maxPricePerKg) : null,
        effectiveFrom: regForm.effectiveFrom || new Date().toISOString(),
        effectiveTo: regForm.effectiveTo || null,
        notes: regForm.notes || null,
      };
      if (editingRegId) {
        await api.put(`/api/price-regulations/${editingRegId}`, payload);
        setRegStatus('Regulation updated successfully.');
        setEditingRegId(null);
      } else {
        await api.post('/api/price-regulations', payload);
        setRegStatus('Regulation created successfully.');
      }
      setRegForm({ crop: 'Maize', region: 'Kigali City', district: '', market: '', minPricePerKg: '', maxPricePerKg: '', effectiveFrom: '', effectiveTo: '', notes: '' });
      await loadData();
    } catch (e: any) {
      setRegStatus(e?.response?.data?.message || e?.response?.data || 'Failed to save regulation.');
    }
  };

  const deleteRegulation = async (id: string) => {
    await api.delete(`/api/price-regulations/${id}`);
    setRegStatus('Regulation deactivated.');
    await loadData();
  };

  const startEditRegulation = (r: any) => {
    setEditingRegId(r.id);
    setRegForm({
      crop: r.crop || 'Maize',
      region: r.region || 'Kigali City',
      district: r.district || '',
      market: r.market || '',
      minPricePerKg: r.minPricePerKg?.toString() || '',
      maxPricePerKg: r.maxPricePerKg?.toString() || '',
      effectiveFrom: r.effectiveFrom ? r.effectiveFrom.substring(0, 10) : '',
      effectiveTo: r.effectiveTo ? r.effectiveTo.substring(0, 10) : '',
      notes: r.notes || '',
    });
  };

  // --- Guidance handlers ---
  const submitGuidance = async () => {
    setGuidanceStatus('');
    try {
      await api.post('/api/price-regulations/seasonal-guidance', {
        crop: guidanceForm.crop,
        region: guidanceForm.region,
        season: guidanceForm.season,
        stabilityStart: guidanceForm.stabilityStart || null,
        stabilityEnd: guidanceForm.stabilityEnd || null,
        expectedTrend: guidanceForm.expectedTrend,
        expectedMinPrice: guidanceForm.expectedMinPrice ? Number(guidanceForm.expectedMinPrice) : null,
        expectedMaxPrice: guidanceForm.expectedMaxPrice ? Number(guidanceForm.expectedMaxPrice) : null,
        recommendationForFarmers: guidanceForm.recommendationForFarmers,
        notes: guidanceForm.notes || null,
      });
      setGuidanceStatus('Seasonal guidance published successfully.');
      setGuidanceForm({ crop: 'Maize', region: 'Kigali City', season: 'A', stabilityStart: '', stabilityEnd: '', expectedTrend: 'Stable', expectedMinPrice: '', expectedMaxPrice: '', recommendationForFarmers: '', notes: '' });
      await loadData();
    } catch (e: any) {
      setGuidanceStatus(e?.response?.data?.message || e?.response?.data || 'Failed to publish guidance.');
    }
  };

  // --- Report Builder handlers ---
  const generateReport = async () => {
    setReportLoading(true);
    setGeneratedReport(null);
    try {
      const res = await api.post('/api/government/generate-report', {
        reportType,
        crop: reportFilters.crop || null,
        region: reportFilters.region || null,
        district: reportFilters.district || null,
        startDate: reportFilters.startDate || null,
        endDate: reportFilters.endDate || null,
        year: reportFilters.year ? Number(reportFilters.year) : null,
      });
      setGeneratedReport(res.data);
    } catch (e: any) {
      setGeneratedReport({ error: e?.response?.data?.message || 'Report generation failed.' });
    }
    setReportLoading(false);
  };

  const exportCSV = async () => {
    try {
      const params = new URLSearchParams({ reportType });
      if (reportFilters.crop) params.set('crop', reportFilters.crop);
      if (reportFilters.region) params.set('region', reportFilters.region);
      if (reportFilters.district) params.set('district', reportFilters.district);
      if (reportFilters.startDate) params.set('startDate', reportFilters.startDate);
      if (reportFilters.endDate) params.set('endDate', reportFilters.endDate);
      const res = await api.get(`/api/government/export-csv?${params.toString()}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `rass-report-${reportType}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      // toast handled by interceptor
    }
  };

  const loadAccessCenter = async () => {
    setAccessCenterLoading(true);
    try {
      const [farmersRes, cooperativesRes, transportersRes, marketAgentsRes, storageKeepersRes] = await Promise.all([
        api.post('/api/government/generate-report', { reportType: 'farmers', region: reportFilters.region || null, district: reportFilters.district || null }).catch(() => ({ data: null })),
        api.post('/api/government/generate-report', { reportType: 'cooperatives', region: reportFilters.region || null }).catch(() => ({ data: null })),
        api.post('/api/government/generate-report', { reportType: 'transporters', region: reportFilters.region || null }).catch(() => ({ data: null })),
        api.post('/api/government/generate-report', { reportType: 'market-agents', region: reportFilters.region || null, district: reportFilters.district || null }).catch(() => ({ data: null })),
        api.post('/api/government/generate-report', { reportType: 'storage-keepers', region: reportFilters.region || null, district: reportFilters.district || null }).catch(() => ({ data: null })),
      ]);
      setAccessCenterData({
        farmers: farmersRes.data,
        cooperatives: cooperativesRes.data,
        transporters: transportersRes.data,
        marketAgents: marketAgentsRes.data,
        storageKeepers: storageKeepersRes.data,
      });
    } finally {
      setAccessCenterLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'access-center') {
      void loadAccessCenter();
    }
  }, [activeTab, reportFilters.region, reportFilters.district]);

  const submitPolicyReport = async () => {
    setPolicyStatus('');
    await api.post('/api/government/reports', {
      title: policyTitle.trim(),
      category: policyCategory,
      content: policyContent.trim(),
    });
    setPolicyStatus('Policy report submitted.');
    setPolicyTitle('');
    setPolicyContent('');
    await loadData();
  };

  const submitAnnotation = async () => {
    setPolicyStatus('');
    await api.post('/api/government/annotations', {
      content: annotationContent.trim(),
      referenceEntityType: 'NationalDashboard',
      referenceEntityId: 'government-overview',
    });
    setPolicyStatus('Policy annotation recorded.');
    setAnnotationContent('');
    await loadData();
  };

  const startEditAnnotation = (row: any) => {
    setEditingAnnotationId(String(row.id));
    setEditingAnnotationContent(String(row.content || ''));
  };

  const saveAnnotationEdit = async () => {
    if (!editingAnnotationId || !editingAnnotationContent.trim()) return;
    await api.put(`/api/government/annotations/${editingAnnotationId}`, { content: editingAnnotationContent.trim() });
    setEditingAnnotationId('');
    setEditingAnnotationContent('');
    setPolicyStatus('Policy annotation updated.');
    await loadData();
  };

  const deleteAnnotation = async (id: string) => {
    await api.delete(`/api/government/annotations/${id}`);
    setPolicyStatus('Policy annotation deleted.');
    await loadData();
  };

  if (loading) return <Loader label="Loading government dashboard..." />;

  return (
    <DashboardShell
      brand="RASS Government"
      subtitle="Policy intelligence"
      title="Government dashboard"
      activeKey={activeTab}
      navItems={[
        { key: 'overview', label: 'Overview', icon: <LayoutDashboard className="h-4 w-4" /> },
        { key: 'trends', label: 'Trends', icon: <TrendingUp className="h-4 w-4" /> },
        { key: 'supply', label: 'Supply & demand', icon: <Scale className="h-4 w-4" /> },
        { key: 'security', label: 'Food security', icon: <ShieldCheck className="h-4 w-4" /> },
        { key: 'regulations', label: <span className="inline-flex items-center gap-1">Price Regulations {!!pendingCrops.length && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-black text-amber-700">{pendingCrops.length}</span>}</span>, icon: <Gavel className="h-4 w-4" /> },
        { key: 'guidance', label: 'Seasonal Guidance', icon: <Sprout className="h-4 w-4" /> },
        { key: 'access-center', label: 'Access Center', icon: <Users className="h-4 w-4" /> },
        { key: 'reports', label: <span className="inline-flex items-center gap-1">Reports {!!unreadNotificationCount && <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-black text-red-700">{unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}</span>}</span>, icon: <BookOpen className="h-4 w-4" /> },
        { key: 'price-moderation', label: 'Price Moderation', icon: <Scale className="h-4 w-4" /> },
        { key: 'contracts', label: 'Contracts', icon: <FileText className="h-4 w-4" /> },
        { key: 'warnings', label: 'Warnings', icon: <AlertTriangle className="h-4 w-4" /> },
        { key: 'ai-assistant', label: 'AI Assistant', icon: <BrainCircuit className="h-4 w-4" /> },
      ]}
      onNavChange={(k) => setActiveTab(k as Tab)}
      onLogout={logout}
      rightStatus={user?.fullName || 'Government access'}
    >
      <div className="space-y-6">
        {activeTab === 'overview' && (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 p-5 shadow-lg ring-1 ring-emerald-400/30">
                <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/[0.06]" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-100">Total farmers</p>
                <p className="mt-1.5 text-3xl font-black tracking-tight text-white">{overviewStats.totalFarmers.toLocaleString()}</p>
                <p className="mt-1 text-xs text-emerald-100">Registered on RASS platform</p>
                <div className="mt-2 flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 absolute right-4 top-4"><Users className="h-5 w-5 text-white" /></div>
              </div>
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 p-5 shadow-lg ring-1 ring-blue-400/30">
                <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/[0.06]" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-100">National supply</p>
                <p className="mt-1.5 text-3xl font-black tracking-tight text-white">{overviewStats.nationalSupplyKg.toLocaleString()} kg</p>
                <p className="mt-1 text-xs text-blue-100">Total agricultural inventory</p>
                <div className="mt-2 flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 absolute right-4 top-4"><TrendingUp className="h-5 w-5 text-white" /></div>
              </div>
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500 to-violet-700 p-5 shadow-lg ring-1 ring-violet-400/30">
                <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/[0.06]" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-100">Active cooperatives</p>
                <p className="mt-1.5 text-3xl font-black tracking-tight text-white">{overviewStats.activeCooperatives.toLocaleString()}</p>
                <p className="mt-1 text-xs text-violet-100">Cooperative organizations</p>
                <div className="mt-2 flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 absolute right-4 top-4"><Scale className="h-5 w-5 text-white" /></div>
              </div>
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 p-5 shadow-lg ring-1 ring-amber-300/30 cursor-pointer hover:scale-[1.02] transition-all" onClick={() => setActiveTab('warnings')}>
                <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/[0.06]" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-50">Risk alerts</p>
                <p className="mt-1.5 text-3xl font-black tracking-tight text-white">{overviewStats.riskAlerts.toLocaleString()}</p>
                <p className="mt-1 text-xs text-amber-50">Warnings requiring attention</p>
                <div className="mt-2 flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 absolute right-4 top-4"><AlertTriangle className="h-5 w-5 text-white" /></div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card className="p-5">
                <h3 className="text-sm font-bold text-slate-800 mb-3">Active regulations ({regulations.length})</h3>
                {regulations.length === 0 && <p className="py-6 text-center text-xs text-slate-500">No active price regulations. Set one in the Regulations tab.</p>}
                <div className="space-y-2">
                  {regulations.slice(0, 5).map((r: any) => (
                    <div key={r.id} className="flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50/50 px-3 py-2.5">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{r.crop}</p>
                        <p className="text-[10px] text-slate-500">{r.region}{r.district ? ` • ${r.district}` : ''}{r.market ? ` • ${r.market}` : ''}</p>
                      </div>
                      <p className="text-xs font-bold text-emerald-700">
                        {r.minPricePerKg ? `${Number(r.minPricePerKg).toLocaleString()}–` : ''}{Number(r.maxPricePerKg || 0).toLocaleString()} RWF/kg
                      </p>
                    </div>
                  ))}
                </div>
                {regulations.length > 5 && <button className="mt-2 text-xs font-semibold text-emerald-700 hover:underline" onClick={() => setActiveTab('regulations')}>View all regulations →</button>}
              </Card>

              <Card className="p-5">
                <h3 className="text-sm font-bold text-slate-800 mb-3">Pending crop approvals ({pendingCrops.length})</h3>
                {pendingCrops.length === 0 && <p className="py-6 text-center text-xs text-slate-500">All crops are approved. No pending reviews.</p>}
                {!!cropActionStatus && <p className="mb-2 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700">{cropActionStatus}</p>}
                <div className="space-y-2">
                  {pendingCrops.slice(0, 5).map((crop: any) => (
                    <div key={crop.id} className="flex items-center justify-between rounded-xl border border-amber-100 bg-amber-50/50 px-3 py-2.5">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{crop.name}</p>
                        <p className="text-[10px] text-slate-500">Source: {crop.sourceRole} • {new Date(crop.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button className="rounded-lg border border-slate-200 px-2 py-1.5 text-[10px] font-bold text-slate-700 hover:bg-slate-50" onClick={() => loadCropDetail(crop.id)}>Details</button>
                        <button className="rounded-lg border border-blue-200 px-2 py-1.5 text-[10px] font-bold text-blue-700 hover:bg-blue-50" onClick={() => messageCropSubmitter(crop.createdBy?.id || crop.submitterUserId || null)}>Message</button>
                        <button className="rounded-lg bg-red-500 px-2 py-1.5 text-[10px] font-bold text-white hover:bg-red-600" onClick={() => { setCropRejectTargetId(crop.id); setCropRejectReason(''); }}>Reject</button>
                        <button className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-emerald-700" onClick={() => approveCrop(crop.id)}>Approve</button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <RoleAIAnalyticsPanel contextData={{ dashboard }} />
            <NationalMarketPulsePanel title="Government national market pulse" />
          </>
        )}

        {activeTab === 'trends' && (() => {
          // Compute crop-level price analytics from available data
          const cropPriceMap: Record<string, { prices: number[]; regions: Set<string> }> = {};
          const allPrices = Array.isArray(dashboard?.priceTrends) ? dashboard.priceTrends :
                           Array.isArray(dashboard?.nationalPriceTrends) ? dashboard.nationalPriceTrends : [];
          // Build from regulations & supply-demand as proxy
          regulations.forEach((r: any) => {
            if (r.status === 'Active') {
              if (!cropPriceMap[r.crop]) cropPriceMap[r.crop] = { prices: [], regions: new Set() };
              if (r.maxPricePerKg) cropPriceMap[r.crop].prices.push(Number(r.maxPricePerKg));
              if (r.minPricePerKg) cropPriceMap[r.crop].prices.push(Number(r.minPricePerKg));
              cropPriceMap[r.crop].regions.add(r.region);
            }
          });

          const cropAnalyticsAll = Object.entries(cropPriceMap).map(([crop, data]) => {
            const avg = data.prices.length ? Math.round(data.prices.reduce((a, b) => a + b, 0) / data.prices.length) : 0;
            const min = data.prices.length ? Math.min(...data.prices) : 0;
            const max = data.prices.length ? Math.max(...data.prices) : 0;
            const volatility = max > 0 ? Math.round(((max - min) / max) * 100) : 0;
            return { crop, avg, min, max, volatility, regionCount: data.regions.size };
          }).sort((a, b) => b.avg - a.avg);
          const cropAnalytics = trendCropFilter ? cropAnalyticsAll.filter(c => c.crop === trendCropFilter) : cropAnalyticsAll;
          const allCropNames = cropAnalyticsAll.map(c => c.crop);

          // National price index from trend data
          const latestPrice = trendData.length > 0 ? trendData[trendData.length - 1]?.value || 0 : 0;
          const previousPrice = trendData.length > 1 ? trendData[trendData.length - 2]?.value || 0 : 0;
          const priceChange = previousPrice > 0 ? Math.round(((latestPrice - previousPrice) / previousPrice) * 100) : 0;

          // Regional price ranking from supply-demand
          const regionalPriceRanking = supplyDemandRows.map((r: any) => {
            const supplyKg = Number(r.supplyKg || 0);
            const demandKg = Number(r.demandKg || 0);
            const pressureIndex = demandKg > 0 ? Math.round((demandKg / Math.max(supplyKg, 1)) * 100) : 0;
            return { region: r.region, supplyKg, demandKg, pressureIndex };
          }).sort((a: any, b: any) => b.pressureIndex - a.pressureIndex);

          return (
          <div className="space-y-5">
            {/* Crop Filter */}
            <Card className="flex items-center gap-3 p-3">
              <span className="text-xs font-semibold text-slate-500">Filter by crop:</span>
              <select
                value={trendCropFilter}
                onChange={e => setTrendCropFilter(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
              >
                <option value="">All crops</option>
                {(allCropNames.length > 0 ? allCropNames : crops.filter(c => c.status === 'Active').map(c => c.name)).map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              {trendCropFilter && <button className="text-xs text-red-600 hover:underline" onClick={() => setTrendCropFilter('')}>Clear</button>}
            </Card>

            {/* National Price Index Header */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 p-5 shadow-lg md:col-span-2">
                <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/[0.04]" />
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">National Price Index</p>
                <p className="mt-2 text-4xl font-black text-white">{latestPrice > 0 ? `${latestPrice.toLocaleString()} RWF` : 'Pending'}</p>
                <div className="mt-2 flex items-center gap-2">
                  {priceChange !== 0 && (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${priceChange > 0 ? 'bg-red-500/20 text-red-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                      {priceChange > 0 ? '↑' : '↓'} {Math.abs(priceChange)}% vs previous period
                    </span>
                  )}
                  <span className="text-xs text-slate-400">{trendData.length} data points</span>
                </div>
                <p className="mt-1 text-[10px] text-slate-500">Weighted average across all monitored crops and markets</p>
              </div>
              <Card className="p-5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Regulated Crops</p>
                <p className="mt-1 text-3xl font-black text-emerald-700">{new Set(regulations.filter(r => r.status === 'Active').map(r => r.crop)).size}</p>
                <p className="mt-1 text-xs text-slate-500">Under active price regulation</p>
                <p className="text-[10px] text-slate-400">{regulations.filter(r => r.status === 'Active').length} regulation rules total</p>
              </Card>
              <Card className="p-5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Avg Volatility</p>
                <p className="mt-1 text-3xl font-black text-amber-600">{cropAnalytics.length > 0 ? Math.round(cropAnalytics.reduce((s, c) => s + c.volatility, 0) / cropAnalytics.length) : 0}%</p>
                <p className="mt-1 text-xs text-slate-500">Price spread across regulated crops</p>
                <p className="text-[10px] text-slate-400">Lower is more stable</p>
              </Card>
            </div>

            {/* Price Trend Chart */}
            <PriceChart title="National price trend (monthly average)" data={trendData.length ? trendData : [{ name: 'No data', value: 0 }]} />

            {/* Crop-level Price Intelligence */}
            <Card className="p-5">
              <h3 className="text-base font-black text-slate-900">Crop price intelligence</h3>
              <p className="mt-1 text-xs text-slate-500">Government-regulated price ranges, volatility analysis, and regional coverage for each crop under surveillance.</p>
              {cropAnalytics.length === 0 && (
                <div className="mt-4 rounded-xl border-2 border-dashed border-slate-200 p-8 text-center">
                  <TrendingUp className="mx-auto h-10 w-10 text-slate-300" />
                  <p className="mt-2 text-sm font-semibold text-slate-500">No crop price data yet</p>
                  <p className="mt-1 text-xs text-slate-400">Create price regulations in the Regulations tab to populate this analysis.</p>
                </div>
              )}
              <div className="mt-4 space-y-3">
                {cropAnalytics.map((c) => (
                  <div key={c.crop} className="rounded-xl border border-slate-200 p-4 hover:border-emerald-300 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-slate-900">{c.crop}</p>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${c.volatility < 20 ? 'bg-emerald-50 text-emerald-700' : c.volatility < 40 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
                            {c.volatility < 20 ? 'Stable' : c.volatility < 40 ? 'Moderate' : 'Volatile'} ({c.volatility}%)
                          </span>
                        </div>
                        <div className="mt-2 grid grid-cols-4 gap-4 text-xs">
                          <div><span className="text-slate-400">Min price</span><p className="font-bold text-slate-700">{c.min.toLocaleString()} RWF</p></div>
                          <div><span className="text-slate-400">Max price</span><p className="font-bold text-slate-700">{c.max.toLocaleString()} RWF</p></div>
                          <div><span className="text-slate-400">Avg regulated</span><p className="font-bold text-emerald-700">{c.avg.toLocaleString()} RWF</p></div>
                          <div><span className="text-slate-400">Regions covered</span><p className="font-bold text-blue-700">{c.regionCount} / 5</p></div>
                        </div>
                        {/* Visual price range bar */}
                        <div className="mt-2">
                          <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300" style={{ width: `${Math.min(100, (c.avg / Math.max(...cropAnalytics.map(x => x.max), 1)) * 100)}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Regional Price Pressure */}
            <Card className="p-5">
              <h3 className="text-base font-black text-slate-900">Regional price pressure index</h3>
              <p className="mt-1 text-xs text-slate-500">Higher pressure = demand significantly exceeds supply, likely driving prices up. Regions above 120% need intervention.</p>
              <div className="mt-4 space-y-3">
                {regionalPriceRanking.map((r: any) => (
                  <div key={r.region} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl font-bold text-white text-sm ${r.pressureIndex > 120 ? 'bg-red-500' : r.pressureIndex > 100 ? 'bg-amber-500' : 'bg-emerald-500'}`}>
                          {r.pressureIndex}%
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{r.region}</p>
                          <p className="text-xs text-slate-500">Supply: {r.supplyKg.toLocaleString()} kg | Demand: {r.demandKg.toLocaleString()} kg</p>
                        </div>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${r.pressureIndex > 120 ? 'bg-red-50 text-red-700' : r.pressureIndex > 100 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                        {r.pressureIndex > 120 ? 'HIGH RISK — Intervene' : r.pressureIndex > 100 ? 'WATCH — Monitor' : 'STABLE'}
                      </span>
                    </div>
                    {/* Visual bar */}
                    <div className="mt-2 flex gap-1">
                      <div className="flex-1">
                        <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5"><span>Supply</span><span>{r.supplyKg.toLocaleString()} kg</span></div>
                        <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, (r.supplyKg / Math.max(r.supplyKg, r.demandKg, 1)) * 100)}%` }} /></div>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5"><span>Demand</span><span>{r.demandKg.toLocaleString()} kg</span></div>
                        <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(100, (r.demandKg / Math.max(r.supplyKg, r.demandKg, 1)) * 100)}%` }} /></div>
                      </div>
                    </div>
                  </div>
                ))}
                {regionalPriceRanking.length === 0 && <p className="py-6 text-center text-xs text-slate-500">No regional data available. Supply-demand data loads from the system automatically.</p>}
              </div>
            </Card>

            {/* Trend Analysis Insights */}
            <Card className="p-5">
              <h3 className="text-base font-black text-slate-900">Trend analysis & policy implications</h3>
              <div className="mt-3 space-y-3">
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                  <p className="text-xs font-bold uppercase text-blue-700">AI-Generated Explanation</p>
                  <p className="mt-1 text-sm text-blue-900">{dashboard?.trendExplanation || nationalReport?.trendExplanation || 'Generate a comprehensive report from the Reports tab to receive AI-powered trend analysis and policy recommendations.'}</p>
                </div>
                {nationalReport?.recommendations && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-xs font-bold uppercase text-emerald-700">Policy Recommendations</p>
                    <ul className="mt-1.5 space-y-1 text-sm text-emerald-800">
                      {nationalReport.recommendations.map((r: string, idx: number) => <li key={idx} className="flex items-start gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />{r}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            </Card>
          </div>
          );
        })()}

        {activeTab === 'supply' && (() => {
          const sdRowsAll = supplyDemandRows.length ? supplyDemandRows : (nationalReport?.supplyDemand || []);
          const sdRows = supplyCropFilter ? sdRowsAll.filter((r: any) => (r.crop || r.region || '').toLowerCase().includes(supplyCropFilter.toLowerCase())) : sdRowsAll;
          const allSupplyCrops: string[] = [...new Set(sdRowsAll.map((r: any) => r.crop || r.region).filter(Boolean))] as string[];
          const totalSupply = sdRows.reduce((s: number, r: any) => s + Number(r.supplyKg || 0), 0);
          const totalDemand = sdRows.reduce((s: number, r: any) => s + Number(r.demandKg || 0), 0);
          const nationalRatio = totalDemand > 0 ? (totalSupply / totalDemand) : 0;
          const nationalGap = totalDemand - totalSupply;
          const surplusRegions = sdRows.filter((r: any) => Number(r.supplyKg || 0) >= Number(r.demandKg || 0));
          const deficitRegions = sdRows.filter((r: any) => Number(r.supplyKg || 0) < Number(r.demandKg || 0));

          // Compute self-sufficiency score (0-100)
          const selfSufficiencyScore = Math.min(100, Math.round(nationalRatio * 100));

          return (
          <div className="space-y-5">
            {/* Crop / Region Filter */}
            <Card className="flex items-center gap-3 p-3">
              <span className="text-xs font-semibold text-slate-500">Filter by crop/region:</span>
              <select
                value={supplyCropFilter}
                onChange={e => setSupplyCropFilter(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
              >
                <option value="">All crops / regions</option>
                  {allSupplyCrops.map((name: string) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
              </select>
              {supplyCropFilter && <button className="text-xs text-red-600 hover:underline" onClick={() => setSupplyCropFilter('')}>Clear</button>}
            </Card>

            {/* National Summary */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 p-5 shadow-lg md:col-span-2">
                <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/[0.04]" />
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Self-Sufficiency Score</p>
                <div className="mt-2 flex items-end gap-3">
                  <p className="text-5xl font-black text-white">{selfSufficiencyScore}<span className="text-lg">%</span></p>
                  <span className={`mb-2 rounded-full px-2.5 py-0.5 text-xs font-bold ${selfSufficiencyScore >= 100 ? 'bg-emerald-500/20 text-emerald-300' : selfSufficiencyScore >= 80 ? 'bg-amber-500/20 text-amber-300' : 'bg-red-500/20 text-red-300'}`}>
                    {selfSufficiencyScore >= 100 ? 'SURPLUS' : selfSufficiencyScore >= 80 ? 'ADEQUATE' : selfSufficiencyScore >= 50 ? 'DEFICIT' : 'CRITICAL'}
                  </span>
                </div>
                <p className="mt-1 text-[10px] text-slate-500">National supply covers {selfSufficiencyScore}% of estimated demand</p>
              </div>
              <Card className="p-5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Total National Supply</p>
                <p className="mt-1 text-2xl font-black text-emerald-700">{(totalSupply / 1000).toFixed(1)}<span className="text-sm ml-1">tons</span></p>
                <p className="mt-1 text-xs text-slate-500">{totalSupply.toLocaleString()} kg aggregated</p>
              </Card>
              <Card className="p-5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Total National Demand</p>
                <p className="mt-1 text-2xl font-black text-blue-700">{(totalDemand / 1000).toFixed(1)}<span className="text-sm ml-1">tons</span></p>
                <p className="mt-1 text-xs text-slate-500">{totalDemand.toLocaleString()} kg estimated</p>
              </Card>
              <Card className={`p-5 ${nationalGap > 0 ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50'}`}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{nationalGap > 0 ? 'National Gap' : 'National Surplus'}</p>
                <p className={`mt-1 text-2xl font-black ${nationalGap > 0 ? 'text-red-700' : 'text-emerald-700'}`}>{(Math.abs(nationalGap) / 1000).toFixed(1)}<span className="text-sm ml-1">tons</span></p>
                <p className="mt-1 text-xs text-slate-500">{surplusRegions.length} surplus, {deficitRegions.length} deficit regions</p>
              </Card>
            </div>

            {/* Regional Breakdown with Visual Bars */}
            <Card className="p-5">
              <h3 className="text-base font-black text-slate-900">Regional supply vs demand balance</h3>
              <p className="mt-1 text-xs text-slate-500">Each region shows its supply-demand ratio. Red indicates deficit requiring government intervention (imports, redistribution, or emergency stocks).</p>
              {sdRows.length === 0 && (
                <div className="mt-4 rounded-xl border-2 border-dashed border-slate-200 p-8 text-center">
                  <Scale className="mx-auto h-10 w-10 text-slate-300" />
                  <p className="mt-2 text-sm font-semibold text-slate-500">No supply-demand data available</p>
                  <p className="mt-1 text-xs text-slate-400">Data is automatically computed from harvest declarations and buyer orders across all regions.</p>
                </div>
              )}
              <div className="mt-4 space-y-4">
                {sdRows.map((r: any, idx: number) => {
                  const supply = Number(r.supplyKg || 0);
                  const demand = Number(r.demandKg || 0);
                  const ratio = demand > 0 ? supply / demand : supply > 0 ? 2 : 0;
                  const maxVal = Math.max(supply, demand, 1);
                  const gap = demand - supply;
                  const isDeficit = gap > 0;
                  return (
                    <div key={idx} className={`rounded-xl border p-4 ${isDeficit ? 'border-red-200 bg-red-50/30' : 'border-emerald-200 bg-emerald-50/30'}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-12 w-12 items-center justify-center rounded-xl font-black text-white text-sm ${isDeficit ? (ratio < 0.5 ? 'bg-red-600' : 'bg-amber-500') : 'bg-emerald-500'}`}>
                            {Math.round(ratio * 100)}%
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">{r.region}</p>
                            <span className={`text-[10px] font-bold uppercase ${isDeficit ? 'text-red-600' : 'text-emerald-600'}`}>
                              {isDeficit ? `DEFICIT: ${gap.toLocaleString()} kg shortfall` : `SURPLUS: ${Math.abs(gap).toLocaleString()} kg excess`}
                            </span>
                          </div>
                        </div>
                        {isDeficit && (
                          <span className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-bold text-red-700">
                            {ratio < 0.5 ? 'CRITICAL — Emergency redistribution needed' : ratio < 0.8 ? 'ACTION — Increase supply channels' : 'MONITOR — Marginal deficit'}
                          </span>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <div>
                          <div className="flex items-center justify-between text-[10px] text-slate-500 mb-0.5">
                            <span className="font-semibold text-emerald-700">Supply</span>
                            <span>{supply.toLocaleString()} kg ({(supply / 1000).toFixed(1)} tons)</span>
                          </div>
                          <div className="h-4 w-full rounded-full bg-slate-200 overflow-hidden">
                            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(supply / maxVal) * 100}%` }} />
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between text-[10px] text-slate-500 mb-0.5">
                            <span className="font-semibold text-blue-700">Demand</span>
                            <span>{demand.toLocaleString()} kg ({(demand / 1000).toFixed(1)} tons)</span>
                          </div>
                          <div className="h-4 w-full rounded-full bg-slate-200 overflow-hidden">
                            <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${(demand / maxVal) * 100}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Policy Recommendations */}
            <Card className="p-5">
              <h3 className="text-base font-black text-slate-900">AI-generated policy recommendations</h3>
              <div className="mt-3 space-y-3">
                {nationalReport?.recommendations ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <ul className="space-y-2 text-sm text-emerald-800">
                      {nationalReport.recommendations.map((r: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />{r}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                    {deficitRegions.length > 0 && (
                      <div className="flex items-start gap-2 text-sm text-red-800">
                        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-red-500" />
                        <span><strong>{deficitRegions.length} region(s)</strong> report supply deficits. Consider inter-regional redistribution programs and emergency stock releases.</span>
                      </div>
                    )}
                    {selfSufficiencyScore < 80 && (
                      <div className="flex items-start gap-2 text-sm text-amber-800">
                        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" />
                        <span>National self-sufficiency at <strong>{selfSufficiencyScore}%</strong>. Policy action: increase subsidized input programs, fast-track harvest declarations, and prioritize cooperative aggregation.</span>
                      </div>
                    )}
                    {selfSufficiencyScore >= 100 && (
                      <div className="flex items-start gap-2 text-sm text-emerald-800">
                        <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0 text-emerald-500" />
                        <span>National supply exceeds demand. Consider <strong>export facilitation programs</strong> and strategic reserve building.</span>
                      </div>
                    )}
                    <p className="text-xs text-slate-500 mt-2">Generate a full Supply & Demand report from the Reports tab for detailed AI-powered recommendations.</p>
                  </div>
                )}
              </div>
            </Card>
          </div>
          );
        })()}

        {activeTab === 'security' && (() => {
          const sdRows = supplyDemandRows.length ? supplyDemandRows : [];
          const totalSupply = sdRows.reduce((s: number, r: any) => s + Number(r.supplyKg || 0), 0);
          const totalDemand = sdRows.reduce((s: number, r: any) => s + Number(r.demandKg || 0), 0);
          const selfSufficiency = totalDemand > 0 ? Math.min(100, Math.round((totalSupply / totalDemand) * 100)) : 0;
          const secRows = securityRows.length ? securityRows : securityIndicators;

          // Compute crop-level food security from security rows
          const cropSecurity = secRows.filter((r: any) => r.crop || r.metric).map((r: any) => {
            const supply = Number(r.supply || r.supplyKg || 0);
            const demand = Number(r.demand || r.demandKg || 0);
            const ratio = demand > 0 ? Math.round((supply / demand) * 100) : (supply > 0 ? 100 : 0);
            const status = r.status || (ratio >= 100 ? 'Secure' : ratio >= 70 ? 'Watch' : 'Critical');
            return { name: r.crop || r.metric || 'Item', supply, demand, ratio, status, value: r.value };
          });

          // Risk matrix
          const criticalCount = cropSecurity.filter((c: any) => c.status === 'Critical' || c.ratio < 50).length;
          const watchCount = cropSecurity.filter((c: any) => c.status === 'Watch' || (c.ratio >= 50 && c.ratio < 100)).length;
          const secureCount = cropSecurity.filter((c: any) => c.status === 'Secure' || c.ratio >= 100).length;
          const securityScore = cropSecurity.length > 0
            ? Math.round((secureCount * 100 + watchCount * 60 + criticalCount * 20) / cropSecurity.length)
            : selfSufficiency;

          // Population coverage estimate
          const populationCoverage = Math.min(100, Math.round((overviewStats.totalFarmers / Math.max(1, overviewStats.totalFarmers * 1.2)) * 100));

          return (
          <div className="space-y-5">
            {/* Food Security Score Header */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div className={`relative overflow-hidden rounded-2xl p-6 shadow-lg md:col-span-2 ${securityScore >= 80 ? 'bg-gradient-to-br from-emerald-600 to-emerald-800' : securityScore >= 50 ? 'bg-gradient-to-br from-amber-500 to-amber-700' : 'bg-gradient-to-br from-red-600 to-red-800'}`}>
                <div className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 rounded-full bg-white/[0.06]" />
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70">National Food Security Index</p>
                <div className="mt-2 flex items-end gap-3">
                  <p className="text-6xl font-black text-white">{securityScore}</p>
                  <div className="mb-2">
                    <span className="rounded-full bg-white/20 px-3 py-1 text-sm font-bold text-white">
                      {securityScore >= 80 ? 'SECURE' : securityScore >= 50 ? 'AT RISK' : 'CRITICAL'}
                    </span>
                    <p className="mt-1 text-[10px] text-white/60">out of 100</p>
                  </div>
                </div>
                <p className="mt-2 text-xs text-white/70">Composite score based on supply coverage, crop diversity, cooperative capacity, and regional balance.</p>
              </div>

              <Card className="p-5 border-emerald-200">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Self-Sufficiency</p>
                <p className={`mt-1 text-3xl font-black ${selfSufficiency >= 80 ? 'text-emerald-700' : selfSufficiency >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{selfSufficiency}%</p>
                <div className="mt-2 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div className={`h-full rounded-full ${selfSufficiency >= 80 ? 'bg-emerald-500' : selfSufficiency >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${selfSufficiency}%` }} />
                </div>
                <p className="mt-1 text-[10px] text-slate-500">National supply / demand ratio</p>
              </Card>

              <Card className="p-5 border-blue-200">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Farmer Coverage</p>
                <p className="mt-1 text-3xl font-black text-blue-700">{overviewStats.totalFarmers.toLocaleString()}</p>
                <div className="mt-2 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full bg-blue-500" style={{ width: `${populationCoverage}%` }} />
                </div>
                <p className="mt-1 text-[10px] text-slate-500">{overviewStats.activeCooperatives} cooperatives supporting</p>
              </Card>
            </div>

            {/* Risk Matrix */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Card className={`p-5 ${criticalCount > 0 ? 'border-red-200 bg-red-50' : 'border-slate-200'}`}>
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-100">
                    <AlertTriangle className="h-6 w-6 text-red-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-black text-red-700">{criticalCount}</p>
                    <p className="text-xs font-semibold text-red-600">CRITICAL items</p>
                  </div>
                </div>
                <p className="mt-2 text-[10px] text-slate-500">Supply below 50% of demand. Immediate intervention required.</p>
              </Card>
              <Card className={`p-5 ${watchCount > 0 ? 'border-amber-200 bg-amber-50' : 'border-slate-200'}`}>
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100">
                    <AlertTriangle className="h-6 w-6 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-black text-amber-700">{watchCount}</p>
                    <p className="text-xs font-semibold text-amber-600">WATCH items</p>
                  </div>
                </div>
                <p className="mt-2 text-[10px] text-slate-500">Supply 50-100% of demand. Monitor and prepare contingency.</p>
              </Card>
              <Card className="p-5 border-emerald-200 bg-emerald-50">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100">
                    <ShieldCheck className="h-6 w-6 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-black text-emerald-700">{secureCount || cropSecurity.length}</p>
                    <p className="text-xs font-semibold text-emerald-600">SECURE items</p>
                  </div>
                </div>
                <p className="mt-2 text-[10px] text-slate-500">Supply meets or exceeds demand. No action needed.</p>
              </Card>
            </div>

            {/* Detailed Crop/Indicator Security Table */}
            <Card className="p-5">
              <h3 className="text-base font-black text-slate-900">Crop & indicator security matrix</h3>
              <p className="mt-1 text-xs text-slate-500">Per-crop food security assessment with supply-demand ratios and action status.</p>
              <div className="mt-4 space-y-2">
                {cropSecurity.map((c: any, idx: number) => (
                  <div key={idx} className={`rounded-xl border p-4 ${c.status === 'Critical' || c.ratio < 50 ? 'border-red-200 bg-red-50/30' : c.status === 'Watch' || c.ratio < 100 ? 'border-amber-200 bg-amber-50/30' : 'border-emerald-200 bg-emerald-50/30'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl font-bold text-white text-xs ${c.ratio >= 100 ? 'bg-emerald-500' : c.ratio >= 70 ? 'bg-amber-500' : 'bg-red-500'}`}>
                          {c.ratio}%
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{c.name}</p>
                          {c.value ? (
                            <p className="text-xs text-slate-500">{c.value}</p>
                          ) : (
                            <p className="text-xs text-slate-500">
                              Supply: {c.supply.toLocaleString()} kg | Demand: {c.demand.toLocaleString()} kg
                            </p>
                          )}
                        </div>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${c.status === 'Critical' || c.ratio < 50 ? 'bg-red-100 text-red-700' : c.status === 'Watch' || c.ratio < 100 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {c.status === 'Critical' || c.ratio < 50 ? 'CRITICAL' : c.status === 'Watch' || c.ratio < 100 ? 'WATCH' : 'SECURE'}
                      </span>
                    </div>
                    {c.supply > 0 || c.demand > 0 ? (
                      <div className="mt-2 h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                        <div className={`h-full rounded-full ${c.ratio >= 100 ? 'bg-emerald-500' : c.ratio >= 70 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${Math.min(100, c.ratio)}%` }} />
                      </div>
                    ) : null}
                  </div>
                ))}
                {cropSecurity.length === 0 && (
                  <div className="rounded-xl border-2 border-dashed border-slate-200 p-8 text-center">
                    <ShieldCheck className="mx-auto h-10 w-10 text-slate-300" />
                    <p className="mt-2 text-sm font-semibold text-slate-500">Food security data loads from system metrics</p>
                    <p className="mt-1 text-xs text-slate-400">Harvest declarations, inventory submissions, and buyer orders contribute to the food security computation.</p>
                  </div>
                )}
              </div>
            </Card>

            {/* Policy Action Center */}
            <Card className="p-5">
              <h3 className="text-base font-black text-slate-900">Government policy action center</h3>
              <p className="mt-1 text-xs text-slate-500">Submit policy reports and record annotations on national food security conditions for institutional memory.</p>
              <p className="mt-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                Submissions are persisted in the government report/audit stream and are visible to <strong>Government</strong> and <strong>Admin</strong> users in this dashboard reports feed and exports.
              </p>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                <input className="h-11 rounded-xl border border-slate-300 px-3 text-sm" placeholder="Policy report title" value={policyTitle} onChange={(e) => setPolicyTitle(e.target.value)} />
                <select className="h-11 rounded-xl border border-slate-300 px-3 text-sm" value={policyCategory} onChange={(e) => setPolicyCategory(e.target.value)}>
                  {['MarketStability', 'FoodSecurity', 'Logistics', 'SupplyChain', 'Emergency'].map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <textarea className="md:col-span-2 rounded-xl border border-slate-300 px-3 py-2 text-sm" rows={4} placeholder="Policy report details..." value={policyContent} onChange={(e) => setPolicyContent(e.target.value)} />
              </div>
              <div className="mt-3 flex gap-2">
                <button type="button" className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white" onClick={submitPolicyReport} disabled={!policyTitle.trim() || !policyContent.trim()}>Submit report</button>
              </div>
              <div className="mt-4 border-t border-slate-200 pt-4">
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Quick annotation</p>
                <textarea className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" rows={2} placeholder="Add policy annotation for current national conditions..." value={annotationContent} onChange={(e) => setAnnotationContent(e.target.value)} />
                <button type="button" className="mt-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700" onClick={submitAnnotation} disabled={!annotationContent.trim()}>Save annotation</button>
              </div>
              {policyStatus && <p className="mt-2 text-xs font-semibold text-emerald-700">{policyStatus}</p>}
            </Card>

            {/* Annotations History */}
            {annotations.length > 0 && (
              <Card className="p-5">
                <h3 className="text-base font-black text-slate-900">Policy annotations ({annotations.length})</h3>
                <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
                  {annotations.map((a: any) => (
                    <div key={a.id} className="rounded-xl border border-slate-200 px-4 py-3">
                      <p className="text-[10px] text-slate-400">{a.actor} • {new Date(a.timestamp || Date.now()).toLocaleString()}</p>
                      {editingAnnotationId === String(a.id) ? (
                        <>
                          <textarea className="mt-2 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm" rows={3} value={editingAnnotationContent} onChange={(e) => setEditingAnnotationContent(e.target.value)} />
                          <div className="mt-2 flex gap-2">
                            <button type="button" className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white" onClick={saveAnnotationEdit}>Save</button>
                            <button type="button" className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700" onClick={() => { setEditingAnnotationId(''); setEditingAnnotationContent(''); }}>Cancel</button>
                          </div>
                        </>
                      ) : (
                        <>
                          <p className="mt-1 text-sm text-slate-700">{a.content}</p>
                          <div className="mt-2 flex gap-2">
                            <button type="button" className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700" onClick={() => startEditAnnotation(a)}>Edit</button>
                            <button type="button" className="rounded-lg border border-red-300 px-3 py-1 text-xs font-semibold text-red-700" onClick={() => deleteAnnotation(String(a.id))}>Delete</button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
          );
        })()}

        {/* ===== PRICE REGULATIONS TAB ===== */}
        {activeTab === 'regulations' && (
          <div className="space-y-5">
            <Card className="p-5">
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Gavel className="h-5 w-5 text-emerald-600" />
                {editingRegId ? 'Edit Price Regulation' : 'Set Price Regulation (RURA Compliance)'}
              </h3>
              <p className="mt-1 text-xs text-slate-500">Define minimum and maximum allowed prices per crop per region. Listings exceeding these bounds will be blocked.</p>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                <CropSelector value={regForm.crop} onChange={(value) => setRegForm((f) => ({ ...f, crop: value }))} label="Crop *" allowCustom helperText="Choose an approved crop or enter a new crop to add it to the national catalog." />
                <div>
                  <label className="text-xs font-semibold text-slate-600">Region *</label>
                  <select className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" value={regForm.region} onChange={e => setRegForm(f => ({ ...f, region: e.target.value, district: '' }))}>
                    {regionOptions.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">District (optional)</label>
                  <select className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" value={regForm.district} onChange={e => setRegForm(f => ({ ...f, district: e.target.value }))} disabled={!regForm.region}>
                    <option value="">All districts in province</option>
                    {regulationDistrictOptions.map((district) => <option key={district} value={district}>{district}</option>)}
                  </select>
                </div>
                <MarketSelector value={regForm.market} onChange={(value) => setRegForm((f) => ({ ...f, market: value }))} province={regForm.region} district={regForm.district} label="Market (optional)" helperText="Select a registered market when the regulation is market-specific." />
                <div>
                  <label className="text-xs font-semibold text-slate-600">Min Price (RWF/kg)</label>
                  <input type="number" className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" placeholder="e.g. 200" value={regForm.minPricePerKg} onChange={e => setRegForm(f => ({ ...f, minPricePerKg: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Max Price (RWF/kg)</label>
                  <input type="number" className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" placeholder="e.g. 800" value={regForm.maxPricePerKg} onChange={e => setRegForm(f => ({ ...f, maxPricePerKg: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Effective From</label>
                  <input type="date" className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" value={regForm.effectiveFrom} onChange={e => setRegForm(f => ({ ...f, effectiveFrom: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Effective To</label>
                  <input type="date" className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" value={regForm.effectiveTo} onChange={e => setRegForm(f => ({ ...f, effectiveTo: e.target.value }))} />
                </div>
                <div className="md:col-span-3">
                  <label className="text-xs font-semibold text-slate-600">Notes</label>
                  <textarea className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" rows={2} placeholder="Regulation justification or policy reference..." value={regForm.notes} onChange={e => setRegForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700" onClick={submitRegulation}>
                  {editingRegId ? <><Check className="h-4 w-4" /> Update Regulation</> : <><Plus className="h-4 w-4" /> Create Regulation</>}
                </button>
                {editingRegId && (
                  <button className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700" onClick={() => { setEditingRegId(null); setRegForm({ crop: 'Maize', region: 'Kigali City', district: '', market: '', minPricePerKg: '', maxPricePerKg: '', effectiveFrom: '', effectiveTo: '', notes: '' }); }}>
                    <X className="h-4 w-4" /> Cancel
                  </button>
                )}
              </div>
              {regStatus && <p className="mt-2 text-xs font-semibold text-emerald-700">{regStatus}</p>}
            </Card>

            <Card className="p-5">
              <h3 className="text-base font-bold text-slate-900">Market Registry</h3>
              <p className="mt-1 text-xs text-slate-500">Government registers markets once, then all market-agent and price-regulation forms use the same national market list.</p>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-slate-600">Market name</label>
                  <input className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" value={marketForm.name} onChange={(e) => setMarketForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Nyamata Fresh Produce Market" />
                </div>
                <div className="md:col-span-2">
                  <RwandaLocationFields
                    value={marketLocationForm}
                    onChange={setMarketLocationForm}
                    showCell
                    showDetail
                    detailLabel="Market location detail"
                    detailPlaceholder="Road, plot, or nearby landmark"
                  />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <button className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700" onClick={createMarket}>
                  <Plus className="h-4 w-4" /> Register Market
                </button>
                {marketStatus && <p className="text-xs font-semibold text-emerald-700">{marketStatus}</p>}
              </div>
              <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
                {markets.slice(0, 8).map((market) => (
                  <div key={market.id} className="rounded-xl border border-slate-200 px-3 py-2">
                    <p className="text-sm font-semibold text-slate-900">{market.name}</p>
                    <p className="text-xs text-slate-500">{[market.district, market.sector, market.cell, market.province].filter(Boolean).join(' • ')}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Crop catalog review</h3>
                  <p className="mt-1 text-xs text-slate-500">Review crops submitted by farmers, cooperatives, and market agents. Approve, reject, or delete.</p>
                </div>
                <div className="flex gap-1">
                  {(['pending', 'rejected', 'all'] as const).map(f => (
                    <button key={f} onClick={() => setCropFilter(f)} className={`rounded-full px-3 py-1 text-xs font-semibold ${cropFilter === f ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                      {f === 'pending' ? `Pending (${pendingCrops.length})` : f === 'rejected' ? `Rejected (${crops.filter(c => c.status === 'Rejected').length})` : `All (${crops.length})`}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {(cropFilter === 'pending' ? pendingCrops : cropFilter === 'rejected' ? crops.filter(c => c.status === 'Rejected') : crops).length === 0 && (
                  <div className="rounded-xl border-2 border-dashed border-slate-200 p-6 text-center">
                    <Sprout className="mx-auto h-8 w-8 text-slate-300" />
                    <p className="mt-2 text-sm text-slate-500">{cropFilter === 'pending' ? 'No pending crop reviews' : cropFilter === 'rejected' ? 'No rejected crops' : 'No crops in catalog'}</p>
                  </div>
                )}
                {(cropFilter === 'pending' ? pendingCrops : cropFilter === 'rejected' ? crops.filter(c => c.status === 'Rejected') : crops).map((crop) => (
                  <div key={crop.id} className="rounded-xl border border-slate-200 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-3 cursor-pointer flex-1" onClick={() => loadCropDetail(crop.id)}>
                        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${crop.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : crop.status === 'Rejected' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'}`}>
                          <Sprout className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-slate-900">{crop.name}</p>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${crop.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : crop.status === 'Rejected' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'}`}>{crop.status}</span>
                            {crop.isGovernmentRegistered && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">Gov Registered</span>}
                          </div>
                          <p className="text-xs text-slate-500">Submitted by <strong>{crop.sourceRole}</strong> • {crop.createdAt ? new Date(crop.createdAt).toLocaleDateString() : 'N/A'}</p>
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        {crop.requiresGovernmentReview && (
                          <>
                            <button className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700" onClick={() => approveCrop(crop.id)}>Approve</button>
                            <button className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600" onClick={() => { setCropRejectTargetId(crop.id); setCropRejectReason(''); }}>Reject</button>
                          </>
                        )}
                        {crop.status === 'Rejected' && (
                          <button className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50" onClick={() => deleteCrop(crop.id)}>Delete</button>
                        )}
                        <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50" onClick={() => loadCropDetail(crop.id)}>
                          {expandedCropId === crop.id ? 'Hide' : 'Details'}
                        </button>
                      </div>
                    </div>
                    {expandedCropId === crop.id && cropDetail && (
                      <div className="border-t border-slate-100 bg-slate-50 px-4 py-3">
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 text-xs">
                          <div><p className="text-slate-400 uppercase text-[10px]">Crop Name</p><p className="font-bold text-slate-800">{cropDetail.name}</p></div>
                          <div><p className="text-slate-400 uppercase text-[10px]">Status</p><p className="font-bold text-slate-800">{cropDetail.status}</p></div>
                          <div><p className="text-slate-400 uppercase text-[10px]">Source Role</p><p className="font-bold text-slate-800">{cropDetail.sourceRole}</p></div>
                          <div><p className="text-slate-400 uppercase text-[10px]">Gov Registered</p><p className="font-bold text-slate-800">{cropDetail.isGovernmentRegistered ? 'Yes' : 'No'}</p></div>
                          <div><p className="text-slate-400 uppercase text-[10px]">Created At</p><p className="font-bold text-slate-800">{cropDetail.createdAt ? new Date(cropDetail.createdAt).toLocaleString() : 'N/A'}</p></div>
                          <div><p className="text-slate-400 uppercase text-[10px]">Updated At</p><p className="font-bold text-slate-800">{cropDetail.updatedAt ? new Date(cropDetail.updatedAt).toLocaleString() : 'Never'}</p></div>
                          {cropDetail.createdBy && (
                            <>
                              <div><p className="text-slate-400 uppercase text-[10px]">Submitted By</p><p className="font-bold text-slate-800">{cropDetail.createdBy.fullName}</p></div>
                              <div><p className="text-slate-400 uppercase text-[10px]">Submitter Email</p><p className="font-bold text-blue-700">{cropDetail.createdBy.email}</p></div>
                            </>
                          )}
                          {cropDetail.rejectionReason && (
                            <div className="col-span-2 md:col-span-4">
                              <p className="text-slate-400 uppercase text-[10px]">Last rejection reason</p>
                              <p className="font-semibold text-red-700">{cropDetail.rejectionReason}</p>
                            </div>
                          )}
                        </div>
                        <div className="mt-3 flex gap-2">
                          {(cropDetail.submitterUserId || cropDetail.createdBy?.id) && (
                            <button
                              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                              onClick={() => messageCropSubmitter(cropDetail.submitterUserId || cropDetail.createdBy?.id)}
                            >
                              <MessageSquare className="h-4 w-4" /> Message submitter
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="text-base font-bold text-slate-900">Active Price Regulations</h3>
              <div className="mt-3 space-y-2">
                {regulations.length === 0 && <p className="text-sm text-slate-500">No price regulations set yet. Create one above.</p>}
                {regulations.map((r: any) => (
                  <div key={r.id} className="flex items-start justify-between rounded-xl border border-slate-200 px-4 py-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">{r.crop}</span>
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">{r.region}</span>
                        {r.district && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">{r.district}</span>}
                        {r.market && <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-700">{r.market}</span>}
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${r.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{r.status}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-600">
                        {r.minPricePerKg != null && `Min: ${Number(r.minPricePerKg).toLocaleString()} RWF/kg`}
                        {r.minPricePerKg != null && r.maxPricePerKg != null && ' • '}
                        {r.maxPricePerKg != null && `Max: ${Number(r.maxPricePerKg).toLocaleString()} RWF/kg`}
                        {r.effectiveFrom && ` • From ${new Date(r.effectiveFrom).toLocaleDateString()}`}
                        {r.effectiveTo && ` to ${new Date(r.effectiveTo).toLocaleDateString()}`}
                      </p>
                      {r.notes && <p className="mt-0.5 text-xs text-slate-500 italic">{r.notes}</p>}
                    </div>
                    <div className="flex gap-1.5">
                      <button className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:text-emerald-600" onClick={() => startEditRegulation(r)} title="Edit">
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button className="rounded-lg border border-red-200 p-1.5 text-red-400 hover:text-red-600" onClick={() => deleteRegulation(r.id)} title="Deactivate">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* ===== SEASONAL GUIDANCE TAB ===== */}
        {activeTab === 'guidance' && (
          <div className="space-y-5">
            <Card className="p-5">
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Sprout className="h-5 w-5 text-emerald-600" />
                Publish Seasonal Guidance
              </h3>
              <p className="mt-1 text-xs text-slate-500">Indicate expected price stability periods and provide crop recommendations for farmers in each region and season.</p>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                <CropSelector value={guidanceForm.crop} onChange={(value) => setGuidanceForm((f) => ({ ...f, crop: value }))} label="Crop *" allowCustom helperText="Guidance can also introduce a new crop into the national catalog." />
                <div>
                  <label className="text-xs font-semibold text-slate-600">Region *</label>
                  <select className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" value={guidanceForm.region} onChange={e => setGuidanceForm(f => ({ ...f, region: e.target.value }))}>
                    {regionOptions.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Season *</label>
                  <select className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" value={guidanceForm.season} onChange={e => setGuidanceForm(f => ({ ...f, season: e.target.value }))}>
                    {SEASONS.map(s => <option key={s} value={s}>Season {s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Stability Period Start</label>
                  <input type="date" className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" value={guidanceForm.stabilityStart} onChange={e => setGuidanceForm(f => ({ ...f, stabilityStart: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Stability Period End</label>
                  <input type="date" className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" value={guidanceForm.stabilityEnd} onChange={e => setGuidanceForm(f => ({ ...f, stabilityEnd: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Expected Trend *</label>
                  <select className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" value={guidanceForm.expectedTrend} onChange={e => setGuidanceForm(f => ({ ...f, expectedTrend: e.target.value }))}>
                    <option value="Rise">Rise</option>
                    <option value="Fall">Fall</option>
                    <option value="Stable">Stable</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Expected Min Price (RWF/kg)</label>
                  <input type="number" className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" placeholder="e.g. 300" value={guidanceForm.expectedMinPrice} onChange={e => setGuidanceForm(f => ({ ...f, expectedMinPrice: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Expected Max Price (RWF/kg)</label>
                  <input type="number" className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" placeholder="e.g. 500" value={guidanceForm.expectedMaxPrice} onChange={e => setGuidanceForm(f => ({ ...f, expectedMaxPrice: e.target.value }))} />
                </div>
                <div className="md:col-span-3">
                  <label className="text-xs font-semibold text-slate-600">Recommendation for Farmers *</label>
                  <textarea className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" rows={3} placeholder="e.g. Plant early in Season A for best yields. Consider intercropping with beans for soil health..." value={guidanceForm.recommendationForFarmers} onChange={e => setGuidanceForm(f => ({ ...f, recommendationForFarmers: e.target.value }))} />
                </div>
                <div className="md:col-span-3">
                  <label className="text-xs font-semibold text-slate-600">Internal Notes</label>
                  <textarea className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" rows={2} placeholder="Internal policy notes (not shown to farmers)..." value={guidanceForm.notes} onChange={e => setGuidanceForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>
              <div className="mt-4">
                <button className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700" onClick={submitGuidance} disabled={!guidanceForm.recommendationForFarmers.trim()}>
                  <Plus className="h-4 w-4" /> Publish Guidance
                </button>
              </div>
              {guidanceStatus && <p className="mt-2 text-xs font-semibold text-emerald-700">{guidanceStatus}</p>}
            </Card>

            <Card className="p-5">
              <h3 className="text-base font-bold text-slate-900">Published Seasonal Guidance</h3>
              <div className="mt-3 space-y-2">
                {guidanceList.length === 0 && <p className="text-sm text-slate-500">No seasonal guidance published yet.</p>}
                {guidanceList.map((g: any, idx: number) => (
                  <div key={g.id || idx} className="rounded-xl border border-slate-200 px-4 py-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-900">{g.crop}</span>
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">{g.region}</span>
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">Season {g.season}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${g.expectedTrend === 'Rise' ? 'bg-red-100 text-red-700' : g.expectedTrend === 'Fall' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                        {g.expectedTrend === 'Rise' ? '↑' : g.expectedTrend === 'Fall' ? '↓' : '→'} {g.expectedTrend}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm text-slate-700">{g.recommendationForFarmers}</p>
                    <div className="mt-1 text-xs text-slate-500">
                      {g.expectedMinPrice != null && g.expectedMaxPrice != null && `Expected range: ${Number(g.expectedMinPrice).toLocaleString()}–${Number(g.expectedMaxPrice).toLocaleString()} RWF/kg`}
                      {g.stabilityStart && g.stabilityEnd && ` • Stability: ${new Date(g.stabilityStart).toLocaleDateString()} – ${new Date(g.stabilityEnd).toLocaleDateString()}`}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'access-center' && (
          <div className="space-y-5">
            <Card className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black text-slate-900">Government Access Center</h3>
                  <p className="mt-1 text-xs text-slate-500">Read access for cooperatives, farmers, transporters, market agents, and storage keepers with live report-backed data.</p>
                </div>
                <button className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700" onClick={loadAccessCenter}>
                  Refresh data
                </button>
              </div>
            </Card>

            {accessCenterLoading && (
              <Card className="p-8 text-center">
                <Loader label="Loading access center..." />
              </Card>
            )}

            {!accessCenterLoading && accessCenterData && (
              <>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
                  <Card className="p-4"><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Farmers</p><p className="mt-1 text-2xl font-black text-slate-900">{Number(accessCenterData.farmers?.summary?.totalFarmers || 0).toLocaleString()}</p></Card>
                  <Card className="p-4"><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Cooperatives</p><p className="mt-1 text-2xl font-black text-slate-900">{Number(accessCenterData.cooperatives?.summary?.totalCooperatives || 0).toLocaleString()}</p></Card>
                  <Card className="p-4"><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Transporters</p><p className="mt-1 text-2xl font-black text-slate-900">{Number(accessCenterData.transporters?.summary?.totalTransporters || 0).toLocaleString()}</p></Card>
                  <Card className="p-4"><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Market Agents</p><p className="mt-1 text-2xl font-black text-slate-900">{Number(accessCenterData.marketAgents?.summary?.totalMarketAgents || 0).toLocaleString()}</p></Card>
                  <Card className="p-4"><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Storage Facilities</p><p className="mt-1 text-2xl font-black text-slate-900">{Number(accessCenterData.storageKeepers?.summary?.totalFacilities || 0).toLocaleString()}</p></Card>
                </div>

                {[
                  { key: 'farmers', title: 'Farmers Registry', reportTypeValue: 'farmers' },
                  { key: 'cooperatives', title: 'Cooperatives', reportTypeValue: 'cooperatives' },
                  { key: 'transporters', title: 'Transporters', reportTypeValue: 'transporters' },
                  { key: 'marketAgents', title: 'Market Agents', reportTypeValue: 'market-agents' },
                  { key: 'storageKeepers', title: 'Storage Keepers', reportTypeValue: 'storage-keepers' },
                ].map((section) => {
                  const rows = Array.isArray(accessCenterData?.[section.key]?.data) ? accessCenterData[section.key].data : [];
                  const columns = rows.length > 0 ? Object.keys(rows[0]).slice(0, 5) : [];
                  return (
                    <Card key={section.key} className="p-5">
                      <div className="flex items-center justify-between">
                        <h4 className="text-base font-bold text-slate-900">{section.title}</h4>
                        <button
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          onClick={() => { setActiveTab('reports'); setReportType(section.reportTypeValue); }}
                        >
                          Open full report
                        </button>
                      </div>
                      {rows.length === 0 ? (
                        <p className="mt-3 text-sm text-slate-500">No records found for current filters.</p>
                      ) : (
                        <div className="mt-3 overflow-x-auto">
                          <table className="min-w-full text-left text-xs">
                            <thead>
                              <tr className="border-b border-slate-200 text-slate-500">
                                {columns.map((col) => <th key={col} className="pb-2 pr-3 font-semibold">{col.replace(/([A-Z])/g, ' $1').trim()}</th>)}
                              </tr>
                            </thead>
                            <tbody>
                              {rows.slice(0, 8).map((row: any, idx: number) => (
                                <tr key={idx} className="border-b border-slate-100">
                                  {columns.map((col) => <td key={col} className="py-2 pr-3 text-slate-700">{String(row[col] ?? '—')}</td>)}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* ===== REPORTS TAB ===== */}
        {activeTab === 'reports' && (
          <div className="space-y-5">
            <Card className="p-5">
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-emerald-600" />
                National Report Builder
              </h3>
              <p className="mt-1 text-xs text-slate-500">Generate comprehensive reports on any aspect of the agricultural system. Export as Excel-compatible CSV for external analysis and stakeholder presentations.</p>

              {/* Quick report buttons */}
              <div className="mt-4 flex flex-wrap gap-2">
                {REPORT_TYPES.map(t => (
                  <button key={t.value} onClick={() => { setReportType(t.value); }} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${reportType === t.value ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-4">
                <div>
                  <label className="text-xs font-semibold text-slate-600">Report Type *</label>
                  <select className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" value={reportType} onChange={e => setReportType(e.target.value)}>
                    {REPORT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Crop (optional)</label>
                  <select className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" value={reportFilters.crop} onChange={e => setReportFilters(f => ({ ...f, crop: e.target.value }))}>
                    <option value="">All crops</option>
                    {reportCropOptions.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Region (optional)</label>
                  <select className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" value={reportFilters.region} onChange={e => setReportFilters(f => ({ ...f, region: e.target.value, district: '' }))}>
                    <option value="">All regions</option>
                    {regionOptions.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">District (optional)</label>
                  <select className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" value={reportFilters.district} onChange={e => setReportFilters(f => ({ ...f, district: e.target.value }))} disabled={!reportFilters.region}>
                    <option value="">All districts</option>
                    {reportDistrictOptions.map((district) => <option key={district} value={district}>{district}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Start Date</label>
                  <input type="date" className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" value={reportFilters.startDate} onChange={e => setReportFilters(f => ({ ...f, startDate: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">End Date</label>
                  <input type="date" className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" value={reportFilters.endDate} onChange={e => setReportFilters(f => ({ ...f, endDate: e.target.value }))} />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 shadow-sm" onClick={generateReport} disabled={reportLoading}>
                  <FileText className="h-4 w-4" /> {reportLoading ? 'Generating...' : 'Generate Report'}
                </button>
                <button className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 shadow-sm" onClick={exportCSV}>
                  <Download className="h-4 w-4" /> Download Excel (CSV)
                </button>
              </div>
              <p className="mt-2 text-[10px] text-slate-400">CSV files open directly in Microsoft Excel, Google Sheets, or LibreOffice Calc.</p>
            </Card>

            {generatedReport && (
              <Card className="p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-slate-900">
                    {generatedReport.error ? 'Error' : generatedReport.reportType || generatedReport.reportTitle || 'Report Results'}
                  </h3>
                  {!generatedReport.error && (
                    <button className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700" onClick={exportCSV}>
                      <Download className="h-3.5 w-3.5" /> Export this report
                    </button>
                  )}
                </div>
                {generatedReport.error ? (
                  <p className="mt-2 text-sm text-red-600">{generatedReport.error}</p>
                ) : (
                  <div className="mt-3 space-y-4">
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      {generatedReport.generatedAt && <span>Generated: {new Date(generatedReport.generatedAt).toLocaleString()}</span>}
                      {generatedReport.period && <span>Period: {generatedReport.period}</span>}
                      <span>Filters: {generatedReport.filters ? Object.entries(generatedReport.filters).filter(([,v]) => v).map(([k,v]) => `${k}: ${v}`).join(', ') || 'None' : 'None'}</span>
                    </div>

                    {/* Summary stats */}
                    {generatedReport.summary && (
                      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
                        {Object.entries(generatedReport.summary).map(([key, val]: [string, any]) => (
                          <div key={key} className="rounded-xl border border-emerald-100 bg-emerald-50/50 px-4 py-3">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                            <p className="mt-0.5 text-xl font-black text-slate-900">{typeof val === 'number' ? val.toLocaleString() : String(val)}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Insights */}
                    {generatedReport.insights && Array.isArray(generatedReport.insights) && generatedReport.insights.length > 0 && (
                      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
                        <p className="text-xs font-bold uppercase tracking-wider text-blue-700">Key Insights</p>
                        <ul className="mt-1.5 space-y-1 text-sm text-blue-800">
                          {generatedReport.insights.map((i: string, idx: number) => <li key={idx} className="flex items-start gap-1.5"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />{i}</li>)}
                        </ul>
                      </div>
                    )}

                    {/* Breakdowns (ByCrop, ByStatus, ByRegion, etc.) */}
                    {['byCrop', 'byStatus', 'byRegion', 'byCondition', 'byType', 'byDistrict'].map(key => {
                      const breakdown = generatedReport[key] as any[];
                      if (!Array.isArray(breakdown) || breakdown.length === 0) return null;
                      return (
                        <div key={key}>
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">{key.replace(/([A-Z])/g, ' $1').replace('by ', 'By ').trim()}</p>
                          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
                            {breakdown.slice(0, 12).map((item: any, idx: number) => {
                              const label = item.crop || item.status || item.region || item.district || item.condition || item.type || item.season || `Item ${idx + 1}`;
                              const count = item.count ?? item.farmerCount ?? item.lots;
                              const extra = item.totalKg ?? item.totalExpectedKg ?? item.totalAmount ?? item.totalValue;
                              return (
                                <div key={idx} className="rounded-lg border border-slate-200 px-3 py-2">
                                  <p className="text-sm font-semibold text-slate-800">{label}</p>
                                  {count != null && <p className="text-xs text-slate-500">{Number(count).toLocaleString()} records</p>}
                                  {extra != null && <p className="text-xs font-semibold text-emerald-600">{Number(extra).toLocaleString()} {typeof extra === 'number' && extra > 1000 ? 'kg/RWF' : ''}</p>}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}

                    {/* Data table */}
                    {generatedReport.data && Array.isArray(generatedReport.data) && generatedReport.data.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Data ({generatedReport.data.length} rows)</p>
                        </div>
                        <div className="max-h-[500px] overflow-auto rounded-xl border border-slate-200 shadow-sm">
                          <table className="min-w-full text-sm">
                            <thead className="bg-slate-50 sticky top-0 z-10">
                              <tr>
                                <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">#</th>
                                {Object.keys(generatedReport.data[0]).map((col: string) => (
                                  <th key={col} className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">
                                    {col.replace(/([A-Z])/g, ' $1').trim()}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {generatedReport.data.slice(0, 200).map((row: any, idx: number) => (
                                <tr key={idx} className="hover:bg-emerald-50/50 transition-colors">
                                  <td className="px-3 py-1.5 text-xs text-slate-400">{idx + 1}</td>
                                  {Object.entries(row).map(([key, val]: [string, any], ci: number) => (
                                    <td key={ci} className={`px-3 py-1.5 whitespace-nowrap ${key.toLowerCase().includes('price') || key.toLowerCase().includes('value') || key.toLowerCase().includes('amount') ? 'font-semibold text-emerald-700' : key.toLowerCase().includes('status') || key.toLowerCase().includes('compliance') ? 'font-semibold' : 'text-slate-700'}`}>
                                      {val == null ? '—' : typeof val === 'number' ? val.toLocaleString() : typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val).includes('T') && String(val).includes(':') ? new Date(String(val)).toLocaleDateString() : String(val)}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {generatedReport.data.length > 200 && (
                            <div className="border-t border-slate-200 px-4 py-3 bg-amber-50 flex items-center justify-between">
                              <p className="text-xs text-amber-700">Showing 200 of {generatedReport.data.length} rows.</p>
                              <button className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700" onClick={exportCSV}>
                                <Download className="h-3.5 w-3.5" /> Download full data as Excel (CSV)
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            )}
          </div>
        )}

        {activeTab === 'price-moderation' && (
          <div className="space-y-5">
            <Card className="p-5">
              <h3 className="text-lg font-black text-slate-900">Price submission moderation</h3>
              <p className="mt-1 text-xs text-slate-500">Review market agent price submissions. Prices outside government regulation are flagged for manual review. Approve or reject with notes.</p>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Status filter</label>
                  <select className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" value={modFilter.status} onChange={e => setModFilter(f => ({ ...f, status: e.target.value }))}>
                    <option value="">All statuses</option>
                    <option value="Pending">Pending</option>
                    <option value="Flagged">Flagged</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>
                <CropSelector value={modFilter.crop} onChange={v => setModFilter(f => ({ ...f, crop: v }))} label="Crop filter" allowCustom={false} />
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Days back</label>
                  <select className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" value={modFilter.days} onChange={e => setModFilter(f => ({ ...f, days: e.target.value }))}>
                    <option value="7">Last 7 days</option>
                    <option value="30">Last 30 days</option>
                    <option value="90">Last 90 days</option>
                    <option value="365">Last year</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button className="h-10 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700" onClick={() => loadPriceSubmissions(modFilter.status, modFilter.crop, modFilter.days)}>Load submissions</button>
                </div>
              </div>
            </Card>

            {modLoading && <p className="text-sm text-slate-500">Loading submissions...</p>}

            {!modLoading && priceSubmissions.length > 0 && (
              <Card className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-slate-700">{priceSubmissions.length} submissions</p>
                  <div className="flex gap-2 text-xs">
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-red-700 font-bold">{priceSubmissions.filter((p: any) => p.verificationStatus === 'Rejected').length} rejected</span>
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700 font-bold">{priceSubmissions.filter((p: any) => p.verificationStatus === 'Flagged').length} flagged</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600 font-bold">{priceSubmissions.filter((p: any) => p.verificationStatus === 'Pending').length} pending</span>
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 font-bold">{priceSubmissions.filter((p: any) => p.verificationStatus === 'Approved').length} approved</span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                        <th className="pb-2 pr-3">Crop</th>
                        <th className="pb-2 pr-3">Market</th>
                        <th className="pb-2 pr-3">Region</th>
                        <th className="pb-2 pr-3">Price/kg</th>
                        <th className="pb-2 pr-3">Observed</th>
                        <th className="pb-2 pr-3">Agent</th>
                        <th className="pb-2 pr-3">Status</th>
                        <th className="pb-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {priceSubmissions.map((p: any) => {
                        const matchReg = regulations.find((r: any) => r.crop === p.crop && r.status === 'Active');
                        const isAbove = matchReg && p.pricePerKg > matchReg.maxPricePerKg;
                        const isBelow = matchReg && matchReg.minPricePerKg && p.pricePerKg < matchReg.minPricePerKg;
                        return (
                        <tr key={p.id} className={`border-b border-slate-100 align-top ${isAbove || isBelow ? 'bg-red-50/50' : ''}`}>
                          <td className="py-2.5 pr-3 font-semibold">{p.crop}</td>
                          <td className="py-2.5 pr-3">{p.market}</td>
                          <td className="py-2.5 pr-3 text-xs">{[p.district, p.region].filter(Boolean).join(' • ')}</td>
                          <td className="py-2.5 pr-3">
                            <span className={`font-bold ${isAbove || isBelow ? 'text-red-600' : 'text-emerald-700'}`}>{Number(p.pricePerKg || 0).toLocaleString()} RWF</span>
                            {matchReg && (
                              <p className="text-[10px] text-slate-500 mt-0.5">
                                Gov: {matchReg.minPricePerKg ? `${Number(matchReg.minPricePerKg).toLocaleString()}–` : ''}{Number(matchReg.maxPricePerKg).toLocaleString()} RWF
                                {(isAbove || isBelow) && <span className="ml-1 text-red-600 font-bold">VIOLATION</span>}
                              </p>
                            )}
                            {!matchReg && <p className="text-[10px] text-slate-400">No regulation</p>}
                          </td>
                          <td className="py-2.5 pr-3 text-xs">{p.observedAt ? new Date(p.observedAt).toLocaleDateString() : '—'}</td>
                          <td className="py-2.5 pr-3 text-xs">{p.agentName}</td>
                          <td className="py-2.5 pr-3">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                              p.verificationStatus === 'Approved' ? 'bg-emerald-50 text-emerald-700' :
                              p.verificationStatus === 'Flagged' ? 'bg-amber-50 text-amber-700' :
                              p.verificationStatus === 'Rejected' ? 'bg-red-50 text-red-700' :
                              'bg-slate-100 text-slate-600'
                            }`}>{p.verificationStatus}</span>
                            {p.moderationNote && <p className="text-[10px] text-slate-500 mt-0.5 max-w-[150px] truncate" title={p.moderationNote}>{p.moderationNote}</p>}
                            {p.moderatedAt && <p className="text-[9px] text-slate-400">{new Date(p.moderatedAt).toLocaleDateString()}</p>}
                          </td>
                          <td className="py-2.5">
                            <div className="flex flex-col gap-1">
                              <button className="rounded bg-slate-200 px-2 py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-300" onClick={() => setSelectedSubmission(selectedSubmission?.id === p.id ? null : p)}>
                                {selectedSubmission?.id === p.id ? 'Hide' : 'Details'}
                              </button>
                              {(p.verificationStatus === 'Flagged' || p.verificationStatus === 'Pending') && (
                                <>
                                  <button className="rounded bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-emerald-700" onClick={() => moderatePrice(p.id, 'Approved', 'Reviewed and approved by government.')}>Approve</button>
                                  <button className="rounded bg-red-500 px-2 py-1 text-[10px] font-bold text-white hover:bg-red-600" onClick={() => { setShowRejectModal(p.id); setModerationNote(''); }}>Reject</button>
                                </>
                              )}
                              {p.verificationStatus === 'Approved' && (
                                <button className="rounded bg-amber-500 px-2 py-1 text-[10px] font-bold text-white hover:bg-amber-600" onClick={() => moderatePrice(p.id, 'Flagged', 'Re-flagged for review.')}>Flag</button>
                              )}
                            </div>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Detail panel for selected submission */}
                {selectedSubmission && (
                  <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-blue-900">Submission Details</h4>
                      <button className="text-xs text-blue-600 hover:underline" onClick={() => setSelectedSubmission(null)}>Close</button>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
                      <div><p className="text-[10px] uppercase text-blue-600">Crop</p><p className="text-sm font-bold text-slate-900">{selectedSubmission.crop}</p></div>
                      <div><p className="text-[10px] uppercase text-blue-600">Market</p><p className="text-sm font-bold text-slate-900">{selectedSubmission.market}</p></div>
                      <div><p className="text-[10px] uppercase text-blue-600">Region / Province</p><p className="text-sm font-bold text-slate-900">{selectedSubmission.region}</p></div>
                      <div><p className="text-[10px] uppercase text-blue-600">District</p><p className="text-sm font-bold text-slate-900">{selectedSubmission.district || 'N/A'}</p></div>
                      <div><p className="text-[10px] uppercase text-blue-600">Sector</p><p className="text-sm font-bold text-slate-900">{selectedSubmission.sector || 'N/A'}</p></div>
                      <div><p className="text-[10px] uppercase text-blue-600">Cell</p><p className="text-sm font-bold text-slate-900">{selectedSubmission.cell || 'N/A'}</p></div>
                      <div><p className="text-[10px] uppercase text-blue-600">Submitted Price</p><p className="text-sm font-bold text-emerald-700">{Number(selectedSubmission.pricePerKg).toLocaleString()} RWF/kg</p></div>
                      <div><p className="text-[10px] uppercase text-blue-600">Observation Date</p><p className="text-sm font-bold text-slate-900">{selectedSubmission.observedAt ? new Date(selectedSubmission.observedAt).toLocaleString() : 'N/A'}</p></div>
                      <div><p className="text-[10px] uppercase text-blue-600">Submitted By</p><p className="text-sm font-bold text-slate-900">{selectedSubmission.agentName}</p></div>
                      <div><p className="text-[10px] uppercase text-blue-600">Agent Email</p><p className="text-sm font-bold text-slate-900">{selectedSubmission.agentEmail || 'N/A'}</p></div>
                      <div><p className="text-[10px] uppercase text-blue-600">Submission ID</p><p className="text-xs font-mono text-slate-600">{selectedSubmission.id}</p></div>
                      <div><p className="text-[10px] uppercase text-blue-600">Status</p><p className={`text-sm font-bold ${selectedSubmission.verificationStatus === 'Approved' ? 'text-emerald-700' : selectedSubmission.verificationStatus === 'Rejected' ? 'text-red-700' : 'text-amber-700'}`}>{selectedSubmission.verificationStatus}</p></div>
                    </div>
                    {(() => {
                      const reg = regulations.find((r: any) => r.crop === selectedSubmission.crop && r.status === 'Active');
                      if (!reg) return <p className="mt-3 text-xs text-slate-500">No active government regulation found for {selectedSubmission.crop}.</p>;
                      const price = Number(selectedSubmission.pricePerKg);
                      const compliant = price >= (reg.minPricePerKg || 0) && price <= reg.maxPricePerKg;
                      return (
                        <div className={`mt-3 rounded-lg px-3 py-2 ${compliant ? 'bg-emerald-100 border border-emerald-200' : 'bg-red-100 border border-red-200'}`}>
                          <p className={`text-xs font-bold ${compliant ? 'text-emerald-800' : 'text-red-800'}`}>
                            {compliant ? 'COMPLIANT' : 'NON-COMPLIANT'} — Government range: {reg.minPricePerKg ? `${Number(reg.minPricePerKg).toLocaleString()}–` : ''}{Number(reg.maxPricePerKg).toLocaleString()} RWF/kg
                          </p>
                          <p className={`text-[10px] mt-0.5 ${compliant ? 'text-emerald-700' : 'text-red-700'}`}>
                            Submitted price {compliant ? 'is within' : 'violates'} the regulated range for {reg.region}.
                            {!compliant && price > reg.maxPricePerKg && ` Exceeds maximum by ${(price - reg.maxPricePerKg).toLocaleString()} RWF/kg.`}
                            {!compliant && reg.minPricePerKg && price < reg.minPricePerKg && ` Below minimum by ${(reg.minPricePerKg - price).toLocaleString()} RWF/kg.`}
                          </p>
                        </div>
                      );
                    })()}
                    {selectedSubmission.moderationNote && (
                      <div className="mt-2 rounded-lg bg-white px-3 py-2 border border-slate-200">
                        <p className="text-[10px] uppercase text-slate-500">Moderation Note</p>
                        <p className="text-sm text-slate-700">{selectedSubmission.moderationNote}</p>
                        {selectedSubmission.moderatedAt && <p className="text-[9px] text-slate-400 mt-0.5">Moderated: {new Date(selectedSubmission.moderatedAt).toLocaleString()}</p>}
                      </div>
                    )}
                    {/* Message Agent button */}
                    {selectedSubmission.agentUserId && (
                      <div className="mt-3 flex items-center gap-3">
                        <button
                          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
                          onClick={() => navigate(`/messages?userId=${encodeURIComponent(selectedSubmission.agentUserId)}`)}
                        >
                          <MessageSquare className="h-4 w-4" />
                          Message {selectedSubmission.agentName || 'Agent'}
                        </button>
                        <span className="text-xs text-slate-500">Contact agent for clarification on this price submission</span>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            )}

            {!modLoading && priceSubmissions.length === 0 && (
              <Card className="p-8 text-center">
                <Scale className="mx-auto h-10 w-10 text-slate-300" />
                <p className="mt-3 text-sm text-slate-500">Click "Load submissions" to review market agent price data.</p>
              </Card>
            )}

            {/* Reject Modal */}
            {showRejectModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
                  <h3 className="text-lg font-bold text-slate-900">Reject Price Submission</h3>
                  <p className="mt-1 text-xs text-slate-500">Provide a reason for rejecting this price. The market agent will be notified.</p>
                  <textarea
                    className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    rows={3}
                    placeholder="Reason for rejection (e.g., Price exceeds maximum regulated range, suspicious data entry...)"
                    value={moderationNote}
                    onChange={e => setModerationNote(e.target.value)}
                  />
                  <div className="mt-4 flex justify-end gap-2">
                    <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={() => setShowRejectModal(null)}>Cancel</button>
                    <button
                      className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                      disabled={!moderationNote.trim()}
                      onClick={async () => {
                        await moderatePrice(showRejectModal, 'Rejected', moderationNote.trim());
                        setShowRejectModal(null);
                        setModerationNote('');
                      }}
                    >
                      Reject Submission
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'contracts' && (
          <Card className="p-5">
            <h3 className="text-lg font-black text-slate-900">Read-only ongoing contracts</h3>
            <p className="mt-1 text-xs text-slate-500">Government oversight view for contractor security and national market continuity.</p>
            <div className="mt-4 space-y-2">
              {ongoingContracts.map((c: any) => (
                <div key={c.id} className="rounded-xl border border-slate-200 px-3 py-2.5">
                  <p className="text-sm font-semibold">{c.crop} • {Number(c.totalQuantityKg || 0).toLocaleString()}kg • {c.status}</p>
                  <p className="text-xs text-slate-500">{c.buyer} ↔ {c.cooperative} • {Number(c.totalValue || 0).toLocaleString()} RWF • {new Date(c.createdAt || Date.now()).toLocaleString()}</p>
                </div>
              ))}
              {ongoingContracts.length === 0 && <p className="text-sm text-slate-500">No ongoing contracts found.</p>}
            </div>
          </Card>
        )}

        {activeTab === 'warnings' && (
          <div className="space-y-4">
            <Card className="p-5">
              <h3 className="text-lg font-black text-slate-900">Risk and shortage warnings</h3>
              <div className="mt-4 space-y-2">
                {alertRows.map((a: any, idx: number) => (
                  <div key={idx} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                    <p className="text-sm font-semibold text-amber-800">{a.title || 'Alert'}</p>
                    <p className="text-xs text-amber-700">{a.description || 'No details'}</p>
                  </div>
                ))}
                {alertRows.length === 0 && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                    <p className="text-sm font-semibold text-emerald-800">No active national shortage alerts</p>
                    <p className="text-xs text-emerald-700">Supply and demand are currently within safe threshold based on available regional data.</p>
                  </div>
                )}
              </div>
              <div className="mt-5 rounded-xl border border-slate-200 p-4">
                <p className="text-xs font-black uppercase tracking-wider text-slate-500">Recent policy reports & annotations</p>
                <div className="mt-3 max-h-60 space-y-2 overflow-y-auto">
                  {reports.slice(0, 20).map((r: any) => (
                    <div key={r.id} className="rounded-lg border border-slate-200 px-3 py-2">
                      <p className="text-sm font-semibold text-slate-800">{r.action}</p>
                      <p className="text-xs text-slate-500">{r.actor} • {new Date(r.timestamp || Date.now()).toLocaleString()}</p>
                    </div>
                  ))}
                  {reports.length === 0 && <p className="text-sm text-slate-500">No policy reports yet.</p>}
                </div>
              </div>
            </Card>
            <RoleAssistantCard
              title="Government AI Assistant"
              intro="I can interpret national signals, shortages, and policy trade-offs using current platform data."
              placeholder="Ask about food security, regional risk, or policy actions..."
            />
          </div>
        )}

        {activeTab === 'ai-assistant' && (
          <RoleAssistantCard
            title="Government AI Assistant"
            intro="I can interpret national signals, shortages, policy trade-offs, and contract oversight indicators."
            placeholder="Ask about supply-demand balance, trends, contract risk, or food-security policy actions..."
          />
        )}

        {cropRejectTargetId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
            <Card className="w-full max-w-lg p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black text-slate-900">Reject crop submission</h3>
                  <p className="mt-1 text-xs text-slate-500">Provide a clear reason. The submitter will be notified immediately.</p>
                </div>
                <button className="rounded-lg p-1 text-slate-500 hover:bg-slate-100" onClick={() => setCropRejectTargetId(null)}><X className="h-4 w-4" /></button>
              </div>
              <textarea
                className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                rows={4}
                placeholder="Reason for rejection..."
                value={cropRejectReason}
                onChange={(e) => setCropRejectReason(e.target.value)}
              />
              <div className="mt-4 flex justify-end gap-2">
                <button className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={() => setCropRejectTargetId(null)}>Cancel</button>
                <button
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                  onClick={async () => {
                    await rejectCrop(cropRejectTargetId, cropRejectReason.trim());
                    setCropRejectTargetId(null);
                    setCropRejectReason('');
                    if (expandedCropId === cropRejectTargetId) await loadCropDetail(cropRejectTargetId);
                  }}
                  disabled={!cropRejectReason.trim()}
                >
                  Confirm reject
                </button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </DashboardShell>
  );
};
