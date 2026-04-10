import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Activity, BarChart3, BookOpen, BrainCircuit, ClipboardList, Database, Download, FileStack, FileText, Globe, LayoutDashboard, Package, Scale, Settings, ShieldCheck, Sprout, TrendingUp, Truck, Users, Wallet } from 'lucide-react';
import { api } from '../api/client';
import { DashboardShell } from '../components/layout/DashboardShell';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Loader } from '../components/ui/Loader';
import { PriceChart } from '../components/charts/PriceChart';
import { RoleAIAnalyticsPanel } from '../components/RoleAIAnalyticsPanel';
import { NationalMarketPulsePanel } from '../components/NationalMarketPulsePanel';
import { useRwandaAdministrativeData } from '../hooks/useRwandaAdministrativeData';

type AdminTab = 'overview' | 'users' | 'roles' | 'applications' | 'config' | 'audit' | 'logistics' | 'ai' | 'ai-insights' | 'live' | 'maintenance' | 'ai-assistant' | 'reports' | 'marketplace' | 'contracts';

const REPORT_TYPES = [
  { value: 'comprehensive', label: 'Comprehensive National Report', icon: '📊' },
  { value: 'farmers', label: 'Farmers Registry', icon: '🌾' },
  { value: 'cooperatives', label: 'Cooperatives Performance', icon: '🏢' },
  { value: 'listings', label: 'Market Listings', icon: '📦' },
  { value: 'harvests', label: 'Harvest Declarations', icon: '🌱' },
  { value: 'inventory', label: 'Inventory (Lots)', icon: '📋' },
  { value: 'transporters', label: 'Transporters Fleet', icon: '🚛' },
  { value: 'transport-jobs', label: 'Transport Jobs', icon: '📍' },
  { value: 'contracts', label: 'Contracts', icon: '📝' },
  { value: 'orders', label: 'Buyer Orders', icon: '🛒' },
  { value: 'payments', label: 'Payments & Transactions', icon: '💰' },
  { value: 'price-trend', label: 'Price Trend Analysis', icon: '📈' },
  { value: 'crop-growth', label: 'Crop Growth & Volume', icon: '🌿' },
  { value: 'supply-demand', label: 'Supply & Demand Balance', icon: '⚖️' },
  { value: 'regional-performance', label: 'Regional Performance', icon: '🗺️' },
  { value: 'regulation-compliance', label: 'Regulation Compliance', icon: '🔍' },
];
const tabLabelWithBadge = (label: string, count: number) => (
  <span className="inline-flex items-center gap-2">
    <span>{label}</span>
    {count > 0 && <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-black text-white">{count > 99 ? '99+' : count}</span>}
  </span>
);

export const AdminPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [systemStats, setSystemStats] = useState<any>({});
  const [modelCatalog, setModelCatalog] = useState<any[]>([]);
  const [datasets, setDatasets] = useState<any[]>([]);
  const [activeDatasetKey, setActiveDatasetKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('Ensemble');
  const [trainingDays, setTrainingDays] = useState(180);
  const [trainingStatus, setTrainingStatus] = useState<string | null>(null);
  const [userForm, setUserForm] = useState({ fullName: '', email: '', password: '', role: 'Farmer' });
  const [newDataset, setNewDataset] = useState({ key: '', name: '', source: '', description: '' });
  const [executiveDashboard, setExecutiveDashboard] = useState<any>(null);
  const [alertsFeed, setAlertsFeed] = useState<any[]>([]);
  const [recommendationsFeed, setRecommendationsFeed] = useState<any[]>([]);
  const [healthFeed, setHealthFeed] = useState<any>(null);
  const [nationalStatsFeed, setNationalStatsFeed] = useState<any>(null);
  const [assistantQuestion, setAssistantQuestion] = useState('');
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [maintenanceStatus, setMaintenanceStatus] = useState<any>(null);
  const [maintenanceForm, setMaintenanceForm] = useState({ start: '', end: '', description: '' });
  const [broadcastForm, setBroadcastForm] = useState({ role: 'Farmer', title: '', message: '', type: 'Info' });
  const [opsStatus, setOpsStatus] = useState('');
  const [systemConfig, setSystemConfig] = useState<Record<string, string>>({});
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [applicationUnreadCount, setApplicationUnreadCount] = useState(0);
  const [selectedApplication, setSelectedApplication] = useState<any>(null);
  const [applicationMessage, setApplicationMessage] = useState('');
  const [applicationNote, setApplicationNote] = useState('');
  const [logisticsRequests, setLogisticsRequests] = useState<any[]>([]);
  const [transporters, setTransporters] = useState<any[]>([]);
  const [logisticsAssignments, setLogisticsAssignments] = useState<Record<string, { transporterId: string; driverPhone: string }>>({});
  const [testPrediction, setTestPrediction] = useState({ crop: 'Maize', market: 'Kigali', days: 7 });
  const [testPredictionResult, setTestPredictionResult] = useState<any>(null);
  const [configForm, setConfigForm] = useState({ key: '', value: '' });
  const [auditFilter, setAuditFilter] = useState({ search: '', action: '', actor: '', entityType: '', days: 30, startDate: '', endDate: '' });
  const [auditCompactMode, setAuditCompactMode] = useState(false);
  const [auditDiffOnly, setAuditDiffOnly] = useState(false);
  const [auditSortBy, setAuditSortBy] = useState<'timestamp' | 'action' | 'actor' | 'entity'>('timestamp');
  const [auditSortDir, setAuditSortDir] = useState<'asc' | 'desc'>('desc');
  const [auditBackfillLoading, setAuditBackfillLoading] = useState(false);
  const [editUser, setEditUser] = useState<{ id: string; fullName: string; email: string; phone: string; role: string; isActive: boolean } | null>(null);
  const [roleFocus, setRoleFocus] = useState('All');
  // Report Builder state
  const [reportType, setReportType] = useState('comprehensive');
  const [reportFilters, setReportFilters] = useState({ crop: '', region: '', district: '', startDate: '', endDate: '', status: '' });
  const [generatedReport, setGeneratedReport] = useState<any>(null);
  const [reportLoading, setReportLoading] = useState(false);

  // Marketplace & Contracts state
  const [marketplaceListings, setMarketplaceListings] = useState<any[]>([]);
  const [contractsData, setContractsData] = useState<any[]>([]);
  const [cooperativesData, setCooperativesData] = useState<any[]>([]);
  const [farmersData, setFarmersData] = useState<any[]>([]);
  const [appFilter, setAppFilter] = useState<'all' | 'Pending' | 'Approved' | 'Rejected'>('all');

  const [assistantMessages, setAssistantMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([
    { role: 'assistant', text: 'I am your Admin AI assistant. Ask about alerts, model health, policy, contracts, or national platform risk.' },
  ]);
  const parseAuditMetadata = (raw: any) => {
    if (!raw) return null;
    if (typeof raw === 'object') return raw;
    try { return JSON.parse(String(raw)); } catch { return null; }
  };
  const normalizeForDiff = (obj: any) => {
    if (!obj || typeof obj !== 'object') return {};
    return obj;
  };
  const hasDiff = (beforeState: any, afterState: any) => JSON.stringify(normalizeForDiff(beforeState)) !== JSON.stringify(normalizeForDiff(afterState));

  const { provinces, getDistricts } = useRwandaAdministrativeData();
  const [cropOptions, setCropOptions] = useState<string[]>([]);
  useEffect(() => { api.get('/api/reference/crops').then((r) => setCropOptions(Array.isArray(r.data) ? r.data : [])).catch(() => {}); }, []);
  const reportDistrictOptions = getDistricts(reportFilters.region);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersRes, statsRes, catalogRes, datasetsRes, execRes, alertsRes, recRes, healthRes, nationalRes, maintenanceRes, configRes, auditRes, appsRes, logisticsRes, transportersRes, listingsRes, contractsRes, coopsRes, farmersRes] = await Promise.all([
        api.get('/api/admin/users').catch(() => ({ data: [] })),
        api.get('/api/admin/system-stats').catch(() => ({ data: {} })),
        api.get('/api/aiinsights/models/catalog').catch(() => ({ data: [] })),
        api.get('/api/aiinsights/datasets').catch(() => ({ data: { items: [], activeDatasetKey: '' } })),
        api.get('/api/aiinsights/executive-dashboard').catch(() => ({ data: null })),
        api.get('/api/aiinsights/alerts?pageSize=50').catch(() => ({ data: { alerts: [] } })),
        api.get('/api/aiinsights/recommendations').catch(() => ({ data: [] })),
        api.get('/api/aiinsights/health').catch(() => ({ data: null })),
        api.get('/api/aiinsights/national-stats').catch(() => ({ data: null })),
        api.get('/api/admin/maintenance/status').catch(() => ({ data: null })),
        api.get('/api/admin/system-config').catch(() => ({ data: {} })),
        api.get('/api/admin/audit-logs?days=30').catch(() => ({ data: [] })),
        api.get('/api/applications/admin').catch(() => ({ data: { items: [], unreadCount: 0 } })),
        api.get('/api/admin/transport-requests').catch(() => ({ data: [] })),
        api.get('/api/admin/transporters').catch(() => ({ data: [] })),
        api.get('/api/market-listings?take=20').catch(() => ({ data: { listings: [] } })),
        api.get('/api/government/ongoing-contracts').catch(() => ({ data: [] })),
        api.get('/api/admin/users?role=CooperativeManager').catch(() => ({ data: [] })),
        api.get('/api/admin/users?role=Farmer').catch(() => ({ data: [] })),
      ]);
      setUsers(usersRes.data || []);
      setSystemStats(statsRes.data || {});
      setModelCatalog(Array.isArray(catalogRes.data) ? catalogRes.data : []);
      setDatasets(datasetsRes.data?.items || []);
      setActiveDatasetKey(datasetsRes.data?.activeDatasetKey || '');
      setExecutiveDashboard(execRes.data || null);
      setAlertsFeed(Array.isArray(alertsRes.data?.alerts) ? alertsRes.data.alerts : []);
      setRecommendationsFeed(Array.isArray(recRes.data) ? recRes.data : []);
      setHealthFeed(healthRes.data || null);
      setNationalStatsFeed(nationalRes.data || null);
      setMaintenanceStatus(maintenanceRes.data || null);
      setSystemConfig(configRes.data || {});
      setAuditLogs(Array.isArray(auditRes.data) ? auditRes.data : []);
      setApplications(Array.isArray(appsRes.data?.items) ? appsRes.data.items : []);
      setApplicationUnreadCount(Number(appsRes.data?.unreadCount || 0));
      setLogisticsRequests(Array.isArray(logisticsRes.data) ? logisticsRes.data : []);
      setTransporters(Array.isArray(transportersRes.data) ? transportersRes.data : []);
      setMarketplaceListings(Array.isArray(listingsRes.data?.listings) ? listingsRes.data.listings : []);
      setContractsData(Array.isArray(contractsRes.data) ? contractsRes.data : []);
      setCooperativesData(Array.isArray(coopsRes.data) ? coopsRes.data : []);
      setFarmersData(Array.isArray(farmersRes.data) ? farmersRes.data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const deleteApplication = async (id: string) => {
    if (!window.confirm('Permanently delete this application? This cannot be undone.')) return;
    await api.delete(`/api/applications/admin/${id}`);
    setSelectedApplication(null);
    await loadData();
  };

  const generateReport = async () => {
    setReportLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('reportType', reportType);
      if (reportFilters.crop) params.set('crop', reportFilters.crop);
      if (reportFilters.region) params.set('region', reportFilters.region);
      if (reportFilters.district) params.set('district', reportFilters.district);
      if (reportFilters.startDate) params.set('startDate', reportFilters.startDate);
      if (reportFilters.endDate) params.set('endDate', reportFilters.endDate);
      if (reportFilters.status) params.set('status', reportFilters.status);
      const res = await api.get(`/api/government/report?${params.toString()}`).catch(() => ({ data: null }));
      setGeneratedReport(res.data);
    } finally {
      setReportLoading(false);
    }
  };

  const exportCsv = async (type: string) => {
    const params = new URLSearchParams();
    params.set('reportType', type);
    if (reportFilters.crop) params.set('crop', reportFilters.crop);
    if (reportFilters.region) params.set('region', reportFilters.region);
    if (reportFilters.district) params.set('district', reportFilters.district);
    if (reportFilters.startDate) params.set('startDate', reportFilters.startDate);
    if (reportFilters.endDate) params.set('endDate', reportFilters.endDate);
    if (reportFilters.status) params.set('status', reportFilters.status);
    try {
      const res = await api.get(`/api/reports/export-csv?${params.toString()}`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const disposition = res.headers['content-disposition'];
      a.download = disposition?.match(/filename="?(.+)"?/)?.[1] || `RASS_${type}_report.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert('Export failed: ' + (e?.message || 'Unknown error'));
    }
  };

  const filteredApplications = useMemo(
    () => applications.filter((a: any) => appFilter === 'all' || a.status === appFilter),
    [applications, appFilter],
  );

  const roleCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const u of users) {
      const role = u.role || u.Role || 'Unknown';
      map[role] = (map[role] || 0) + 1;
    }
    return map;
  }, [users]);

  const overviewStats = [
    { label: 'Total users', value: Number(systemStats?.totalUsers || users.length || 0).toLocaleString(), icon: <Users className="h-5 w-5" /> },
    { label: 'Active transactions', value: Number(systemStats?.activeTransactions || 0).toLocaleString(), icon: <Activity className="h-5 w-5" /> },
    { label: 'Trade volume', value: Number(systemStats?.tradeVolumeKg || 0).toLocaleString() + ' kg', icon: <Package className="h-5 w-5" /> },
    { label: 'Contracts', value: Number(systemStats?.contracts || 0).toLocaleString(), icon: <ClipboardList className="h-5 w-5" /> },
    { label: 'Cooperatives', value: Number(systemStats?.cooperatives || Object.keys(roleCounts).length || 0).toLocaleString(), icon: <Globe className="h-5 w-5" /> },
    { label: 'Orders', value: Number(systemStats?.totalOrders || 0).toLocaleString(), icon: <Wallet className="h-5 w-5" /> },
    { label: 'Market prices', value: Number(systemStats?.marketPrices || 0).toLocaleString(), icon: <TrendingUp className="h-5 w-5" /> },
    { label: 'Applications', value: applications.length.toLocaleString(), icon: <FileStack className="h-5 w-5" /> },
  ];

  const roleData = Object.entries(roleCounts).map(([name, value]) => ({ name, value }));
  const roleTable = Object.entries(roleCounts).map(([role, count]) => ({
    role,
    count,
    active: users.filter((u: any) => (u.role || u.Role) === role && (u.isActive ?? u.IsActive ?? true)).length,
  }));
  const rolesList = useMemo(() => ['All', ...Object.keys(roleCounts).sort()], [roleCounts]);
  const usersByRole = useMemo(
    () => users.filter((u: any) => roleFocus === 'All' || String(u.role || u.Role) === roleFocus),
    [users, roleFocus],
  );
  const inactiveByRoleData = useMemo(
    () => Object.keys(roleCounts).map((r) => ({ name: r, value: users.filter((u: any) => String(u.role || u.Role) === r && !(u.isActive ?? u.IsActive ?? true)).length })),
    [roleCounts, users],
  );
  const activeByRoleData = useMemo(
    () => Object.keys(roleCounts).map((r) => ({ name: r, value: users.filter((u: any) => String(u.role || u.Role) === r && (u.isActive ?? u.IsActive ?? true)).length })),
    [roleCounts, users],
  );
  const alertsBySeverity = useMemo(() => {
    const map: Record<string, number> = {};
    for (const a of alertsFeed) {
      const s = String(a.severity || 'Info');
      map[s] = (map[s] || 0) + 1;
    }
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [alertsFeed]);
  const modelErrorData = useMemo(
    () => (executiveDashboard?.modelHealth || []).map((m: any) => ({ name: m.model, value: Number(m.rmse ?? m.latestRmse ?? 0) })),
    [executiveDashboard],
  );
  const modelMapeData = useMemo(
    () => (executiveDashboard?.modelHealth || []).map((m: any) => ({ name: m.model, value: Number(m.mape ?? m.latestMape ?? 0) })),
    [executiveDashboard],
  );
  const modelAccuracyData = useMemo(
    () => (executiveDashboard?.modelHealth || []).map((m: any) => ({ name: m.model, value: Number(m.accuracyRate ?? 0) })),
    [executiveDashboard],
  );
  const liveOpsTiles = [
    { label: 'Platform state', value: String(healthFeed?.overall || 'Unknown'), tone: 'from-slate-900 to-slate-700' },
    { label: 'Active users (24h)', value: Number(healthFeed?.activeUsers24h || 0).toLocaleString(), tone: 'from-indigo-700 to-blue-600' },
    { label: 'Deliveries in progress', value: Number(healthFeed?.activeDeliveries || 0).toLocaleString(), tone: 'from-emerald-700 to-emerald-500' },
    { label: 'Delayed deliveries', value: Number(healthFeed?.delayedDeliveries || 0).toLocaleString(), tone: 'from-rose-700 to-rose-500' },
    { label: 'Pending orders', value: Number(healthFeed?.pendingOrders || 0).toLocaleString(), tone: 'from-amber-700 to-amber-500' },
    { label: 'Open alerts', value: Number(executiveDashboard?.executiveKpis?.openAlerts || 0).toLocaleString(), tone: 'from-fuchsia-700 to-violet-500' },
  ];

  const createUser = async () => {
    await api.post('/api/admin/users', userForm);
    setUserForm({ fullName: '', email: '', password: '', role: 'Farmer' });
    await loadData();
  };

  const suspendUser = async (id: string) => {
    await api.post(`/api/admin/users/${id}/suspend`, { reason: 'Administrative action' });
    await loadData();
  };

  const activateUser = async (id: string) => {
    await api.post(`/api/admin/users/${id}/activate`);
    await loadData();
  };

  const removeUser = async (id: string) => {
    await api.delete(`/api/admin/users/${id}`);
    await loadData();
  };

  const saveUserEdit = async () => {
    if (!editUser) return;
    await api.put(`/api/admin/users/${editUser.id}`, {
      fullName: editUser.fullName,
      email: editUser.email,
      phone: editUser.phone,
      role: editUser.role,
      isActive: editUser.isActive,
    });
    setEditUser(null);
    await loadData();
  };

  const startTraining = async () => {
    setTrainingStatus('Starting model training...');
    try {
      await api.post('/api/aiinsights/models/train', { modelType: selectedModel, trainingDataDays: Number(trainingDays) });
      setTrainingStatus('Training started successfully.');
    } catch {
      setTrainingStatus('Training request failed.');
    }
  };

  const stopTraining = async () => {
    setTrainingStatus('Stopping model training...');
    try {
      await api.post('/api/aiinsights/models/stop', { modelType: selectedModel });
      setTrainingStatus('Training stopped.');
    } catch {
      setTrainingStatus('Stop request failed.');
    }
  };

  const scheduleTraining = async () => {
    await api.post('/api/aiinsights/models/schedule', {
      modelType: selectedModel,
      scheduleCron: '0 2 * * *',
      trainingDataDays: Number(trainingDays),
    });
    setTrainingStatus('Daily 02:00 training schedule saved.');
  };

  const registerDataset = async () => {
    await api.post('/api/aiinsights/datasets/register', newDataset);
    setNewDataset({ key: '', name: '', source: '', description: '' });
    await loadData();
  };

  const setActiveDataset = async (datasetKey: string) => {
    await api.post('/api/aiinsights/datasets/active', { datasetKey });
    setActiveDatasetKey(datasetKey);
  };

  const bindDatasetToModel = async () => {
    if (!activeDatasetKey) return;
    await api.post('/api/aiinsights/models/dataset', { modelType: selectedModel, datasetKey: activeDatasetKey });
    setTrainingStatus(`Dataset "${activeDatasetKey}" bound to ${selectedModel}.`);
  };

  const runTestPrediction = async () => {
    const res = await api.post('/api/forecast/full', testPrediction).catch(() => ({ data: null }));
    setTestPredictionResult(res.data);
  };

  const toggleMaintenance = async (enabled: boolean) => {
    await api.post('/api/admin/maintenance/toggle', { enabled, reason: enabled ? 'Scheduled maintenance' : 'Maintenance ended' });
    await loadData();
  };

  const scheduleMaintenance = async () => {
    setOpsStatus('');
    await api.post('/api/admin/maintenance/schedule', {
      scheduledStart: maintenanceForm.start,
      scheduledEnd: maintenanceForm.end,
      description: maintenanceForm.description,
    });
    setOpsStatus('Maintenance schedule saved and users notified.');
    await loadData();
  };

  const broadcast = async () => {
    setOpsStatus('');
    await api.post('/api/notifications/broadcast', {
      role: broadcastForm.role,
      title: broadcastForm.title,
      message: broadcastForm.message,
      type: broadcastForm.type,
    });
    setOpsStatus(`Broadcast sent to ${broadcastForm.role}.`);
    setBroadcastForm((p) => ({ ...p, title: '', message: '' }));
  };

  const saveConfig = async () => {
    if (!configForm.key.trim()) return;
    await api.post('/api/admin/system-config', { configKey: configForm.key.trim(), configValue: configForm.value });
    setConfigForm({ key: '', value: '' });
    await loadData();
  };

  const loadAuditLogs = async () => {
    const params = new URLSearchParams();
    if (auditFilter.search.trim()) params.set('search', auditFilter.search.trim());
    if (auditFilter.action.trim()) params.set('action', auditFilter.action.trim());
    if (auditFilter.actor.trim()) params.set('actor', auditFilter.actor.trim());
    if (auditFilter.entityType.trim()) params.set('entityType', auditFilter.entityType.trim());
    if (auditFilter.startDate) params.set('startDate', auditFilter.startDate);
    if (auditFilter.endDate) params.set('endDate', auditFilter.endDate);
    params.set('days', String(auditFilter.days));
    const res = await api.get(`/api/admin/audit-logs?${params.toString()}`).catch(() => ({ data: [] }));
    setAuditLogs(Array.isArray(res.data) ? res.data : []);
  };
  const runAuditBackfill = async () => {
    setAuditBackfillLoading(true);
    try {
      await api.post('/api/admin/audit-logs/backfill');
      await loadAuditLogs();
      window.alert('Historical logs backfill completed.');
    } finally {
      setAuditBackfillLoading(false);
    }
  };

  const exportAuditCsv = () => {
    const params = new URLSearchParams();
    if (auditFilter.search.trim()) params.set('search', auditFilter.search.trim());
    if (auditFilter.action.trim()) params.set('action', auditFilter.action.trim());
    if (auditFilter.actor.trim()) params.set('actor', auditFilter.actor.trim());
    if (auditFilter.entityType.trim()) params.set('entityType', auditFilter.entityType.trim());
    if (auditFilter.startDate) params.set('startDate', auditFilter.startDate);
    if (auditFilter.endDate) params.set('endDate', auditFilter.endDate);
    params.set('days', String(auditFilter.days));
    window.open(`/api/admin/audit-logs/export?${params.toString()}`, '_blank');
  };

  const resetPassword = async (id: string) => {
    const res = await api.post(`/api/admin/users/${id}/reset-password`);
    window.alert(`Temporary password: ${res.data?.temporaryPassword || 'generated'}`);
  };

  const forceLogout = async (id: string) => {
    await api.post(`/api/admin/users/${id}/force-logout`);
    window.alert('User has been forced to logout.');
  };

  const loadApplicationDetail = async (id: string) => {
    const res = await api.get(`/api/applications/admin/${id}`);
    setSelectedApplication(res.data);
    setApplicationNote(String(res.data?.adminNote || ''));
    await loadData();
  };

  const sendApplicationMessage = async () => {
    if (!selectedApplication || !applicationMessage.trim()) return;
    await api.post(`/api/applications/admin/${selectedApplication.id}/message`, { message: applicationMessage.trim() });
    setApplicationMessage('');
    await loadApplicationDetail(selectedApplication.id);
  };

  const processApplication = async (approved: boolean) => {
    if (!selectedApplication) return;
    await api.post(`/api/applications/admin/${selectedApplication.id}/process`, { approved, note: applicationNote.trim() || null });
    await loadData();
    await loadApplicationDetail(selectedApplication.id);
  };

  const assignTransport = async (requestId: string) => {
    const payload = logisticsAssignments[requestId];
    if (!payload?.transporterId) return;
    await api.post(`/api/admin/transport-requests/${requestId}/assign`, {
      transporterId: payload.transporterId,
      driverPhone: payload.driverPhone || null,
    });
    await loadData();
  };

  const resolveAlert = async (id: string) => {
    await api.post(`/api/aiinsights/alerts/${id}/resolve`, { notes: 'Resolved from admin dashboard.' });
    await loadData();
  };

  const askAssistant = async () => {
    const q = assistantQuestion.trim();
    if (!q) return;
    setAssistantMessages((prev) => [...prev, { role: 'user', text: q }]);
    setAssistantQuestion('');
    setAssistantLoading(true);
    try {
      const res = await api.post('/api/aiinsights/assistant', { question: q });
      setAssistantMessages((prev) => [...prev, { role: 'assistant', text: String(res.data?.answer || 'No response available.') }]);
    } catch {
      setAssistantMessages((prev) => [...prev, { role: 'assistant', text: 'Assistant is temporarily unavailable.' }]);
    } finally {
      setAssistantLoading(false);
    }
  };

  const navItems = [
    { key: 'overview', label: 'National overview', icon: <LayoutDashboard className="h-4 w-4" /> },
    { key: 'reports', label: 'Reports & exports', icon: <FileText className="h-4 w-4" /> },
    { key: 'users', label: 'User management', icon: <Users className="h-4 w-4" /> },
    { key: 'roles', label: 'Role analytics', icon: <BarChart3 className="h-4 w-4" /> },
    { key: 'applications', label: tabLabelWithBadge('Applications', applicationUnreadCount), icon: <FileStack className="h-4 w-4" /> },
    { key: 'marketplace', label: 'Marketplace', icon: <Package className="h-4 w-4" /> },
    { key: 'contracts', label: 'Contracts', icon: <Scale className="h-4 w-4" /> },
    { key: 'logistics', label: 'Logistics ops', icon: <Truck className="h-4 w-4" /> },
    { key: 'audit', label: 'Audit logs', icon: <ShieldCheck className="h-4 w-4" /> },
    { key: 'config', label: 'Configuration', icon: <Settings className="h-4 w-4" /> },
    { key: 'ai', label: 'AI control', icon: <BrainCircuit className="h-4 w-4" /> },
    { key: 'ai-insights', label: 'AI insights', icon: <BrainCircuit className="h-4 w-4" /> },
    { key: 'ai-assistant', label: 'AI Assistant', icon: <BrainCircuit className="h-4 w-4" /> },
    { key: 'live', label: 'Live ops center', icon: <Database className="h-4 w-4" /> },
    { key: 'maintenance', label: 'Maintenance', icon: <Settings className="h-4 w-4" /> },
  ];
  const sortedAuditLogs = useMemo(() => {
    const rows = [...auditLogs];
    const readValue = (l: any) => {
      if (auditSortBy === 'timestamp') return String(l.timestamp || '');
      if (auditSortBy === 'action') return String(l.action || '');
      if (auditSortBy === 'actor') return String(l.actor || '');
      return `${l.entityType || ''}:${l.entityId || ''}`;
    };
    rows.sort((a, b) => {
      const av = readValue(a);
      const bv = readValue(b);
      if (auditSortBy === 'timestamp') {
        const ad = new Date(av).getTime();
        const bd = new Date(bv).getTime();
        return auditSortDir === 'asc' ? ad - bd : bd - ad;
      }
      return auditSortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    return rows;
  }, [auditLogs, auditSortBy, auditSortDir]);

  return (
    <DashboardShell
      brand="RASS Admin"
      subtitle="National command center"
      title="System administration"
      activeKey={activeTab}
      navItems={navItems}
      onNavChange={(k) => setActiveTab(k as AdminTab)}
      onLogout={() => window.location.assign('/login')}
      rightStatus="Secure session"
    >
      {loading ? (
        <Loader label="Loading admin control center..." />
      ) : (
        <div className="space-y-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Hero KPI Strip */}
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-8">
                {overviewStats.map((s) => (
                  <Card key={s.label} className="p-3 text-center">
                    <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">{s.icon}</div>
                    <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{s.label}</p>
                    <p className="mt-0.5 text-lg font-black text-slate-900">{s.value}</p>
                  </Card>
                ))}
              </div>

              {/* Quick Navigation */}
              <Card className="p-4">
                <p className="text-xs font-black uppercase tracking-wider text-slate-500">Quick access — Admin command center</p>
                <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-6">
                  {[
                    { label: 'Marketplace', route: '/marketplace', color: 'bg-emerald-600' },
                    { label: 'Contracts', route: '/contracts', color: 'bg-blue-600' },
                    { label: 'Prices', route: '/prices', color: 'bg-violet-600' },
                    { label: 'Tracking', route: '/tracking', color: 'bg-amber-600' },
                    { label: 'AI Forecast', route: '/ai-forecast', color: 'bg-rose-600' },
                    { label: 'Messages', route: '/messages', color: 'bg-indigo-600' },
                  ].map((link) => (
                    <button key={link.label} onClick={() => navigate(link.route)} className={`rounded-xl ${link.color} px-3 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition`}>
                      {link.label}
                    </button>
                  ))}
                </div>
              </Card>

              {/* Recent Activity Feed + Platform Health */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card className="p-5">
                  <h3 className="text-base font-black text-slate-900">Recent platform activity</h3>
                  <p className="mt-1 text-xs text-slate-500">Last 15 audit events across the system</p>
                  <div className="mt-3 max-h-64 space-y-1.5 overflow-y-auto">
                    {auditLogs.slice(0, 15).map((l: any) => (
                      <div key={l.id} className="rounded-lg border border-slate-100 px-3 py-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800">{l.action}</span>
                          <span className="text-[10px] text-slate-400">{l.timestamp ? new Date(l.timestamp).toLocaleString() : ''}</span>
                        </div>
                        <p className="text-[10px] text-slate-500">{l.entityType} • {l.actor}</p>
                      </div>
                    ))}
                    {auditLogs.length === 0 && <p className="py-4 text-center text-xs text-slate-400">No recent activity</p>}
                  </div>
                </Card>

                <Card className="p-5">
                  <h3 className="text-base font-black text-slate-900">Platform health snapshot</h3>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-slate-200 p-3">
                      <p className="text-[10px] font-semibold uppercase text-slate-400">Status</p>
                      <p className="text-lg font-black text-emerald-600">{healthFeed?.overall || 'Online'}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3">
                      <p className="text-[10px] font-semibold uppercase text-slate-400">Active users (24h)</p>
                      <p className="text-lg font-black text-blue-600">{Number(healthFeed?.activeUsers24h || 0).toLocaleString()}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3">
                      <p className="text-[10px] font-semibold uppercase text-slate-400">Pending applications</p>
                      <p className="text-lg font-black text-amber-600">{applications.filter((a: any) => a.status === 'Pending').length}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3">
                      <p className="text-[10px] font-semibold uppercase text-slate-400">Open alerts</p>
                      <p className="text-lg font-black text-red-600">{Number(executiveDashboard?.executiveKpis?.openAlerts || 0)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3">
                      <p className="text-[10px] font-semibold uppercase text-slate-400">Active listings</p>
                      <p className="text-lg font-black text-violet-600">{marketplaceListings.length}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3">
                      <p className="text-[10px] font-semibold uppercase text-slate-400">Ongoing contracts</p>
                      <p className="text-lg font-black text-indigo-600">{contractsData.length}</p>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <PriceChart title="User distribution by role" data={roleData.map((r) => ({ name: r.name, value: Number(r.value) }))} />
                <PriceChart
                  title="National supply vs demand"
                  data={(nationalStatsFeed?.supplyDemandBalance || []).slice(0, 12).map((x: any) => ({ name: x.crop, value: Number(x.balanceKg || 0) }))}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <PriceChart
                  title="Regional volumes"
                  data={(nationalStatsFeed?.regionalComparisons || []).slice(0, 12).map((x: any) => ({ name: x.region || 'Unknown', value: Number(x.volumeKg || 0) }))}
                />
                <PriceChart
                  title="Top crops"
                  data={(nationalStatsFeed?.topCrops || []).slice(0, 12).map((x: any) => ({ name: x.crop, value: Number(x.totalKg || 0) }))}
                />
                <PriceChart
                  title="Price trends"
                  data={(nationalStatsFeed?.aggregatedPriceTrends || []).slice(-20).map((x: any) => ({ name: `${x.date}`.slice(5, 10), value: Number(x.avgPrice || 0) }))}
                />
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <Card className="p-5 lg:col-span-1">
                <h3 className="text-lg font-black text-slate-900">Add user</h3>
                <div className="mt-4 space-y-3">
                  <Input label="Full name" value={userForm.fullName} onChange={(e) => setUserForm((p) => ({ ...p, fullName: e.target.value }))} />
                  <Input label="Email" value={userForm.email} onChange={(e) => setUserForm((p) => ({ ...p, email: e.target.value }))} />
                  <Input label="Password" type="password" value={userForm.password} onChange={(e) => setUserForm((p) => ({ ...p, password: e.target.value }))} />
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold text-slate-600">Role</span>
                    <select className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" value={userForm.role} onChange={(e) => setUserForm((p) => ({ ...p, role: e.target.value }))}>
                      {['Farmer', 'CooperativeManager', 'Buyer', 'Transporter', 'StorageOperator', 'MarketAgent', 'Government', 'Admin'].map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </label>
                  <Button className="w-full" onClick={createUser}>Create user</Button>
                </div>
              </Card>

              <Card className="p-5 lg:col-span-2">
                <h3 className="text-lg font-black text-slate-900">Users</h3>
                <div className="mt-4 space-y-2">
                  {users.slice(0, 100).map((u: any) => (
                    <div key={u.id || u.Id} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{u.fullName || u.FullName || 'User'}</p>
                        <p className="text-xs text-slate-500">{u.email || u.Email} • {u.role || u.Role}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => activateUser(u.id || u.Id)}>Activate</Button>
                        <Button variant="danger" size="sm" onClick={() => suspendUser(u.id || u.Id)}>Suspend</Button>
                        <Button size="sm" variant="outline" onClick={() => resetPassword(u.id || u.Id)}>Reset password</Button>
                        <Button size="sm" variant="outline" onClick={() => forceLogout(u.id || u.Id)}>Force logout</Button>
                        <Button size="sm" variant="outline" onClick={() => setEditUser({
                          id: String(u.id || u.Id),
                          fullName: String(u.fullName || u.FullName || ''),
                          email: String(u.email || u.Email || ''),
                          phone: String(u.phone || u.Phone || ''),
                          role: String(u.role || u.Role || 'Farmer'),
                          isActive: Boolean(u.isActive ?? u.IsActive ?? true),
                        })}>Edit</Button>
                        <Button size="sm" variant="danger" onClick={() => removeUser(u.id || u.Id)}>Delete</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {activeTab === 'ai' && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card className="p-5">
                <h3 className="text-lg font-black text-slate-900">AI model control</h3>
                <div className="mt-4 grid grid-cols-1 gap-3">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold text-slate-600">Model type</span>
                    <select className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}>
                      {(modelCatalog.length ? modelCatalog : ['ARIMA', 'SARIMA', 'Prophet', 'LSTM', 'XGBoost', 'Ensemble']).map((m: any) => (
                        <option key={typeof m === 'string' ? m : m.name} value={typeof m === 'string' ? m : m.name}>{typeof m === 'string' ? m : m.displayName || m.name}</option>
                      ))}
                    </select>
                  </label>
                  <Input label="Training window (days)" type="number" value={String(trainingDays)} onChange={(e) => setTrainingDays(Number(e.target.value || 0))} />
                  <div className="flex flex-wrap gap-2">
                    <Button leftIcon={<BrainCircuit className="h-4 w-4" />} onClick={startTraining}>Start training</Button>
                    <Button variant="outline" onClick={stopTraining}>Stop training</Button>
                    <Button variant="secondary" onClick={scheduleTraining}>Schedule daily run</Button>
                  </div>
                  {trainingStatus && <p className="rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-600">{trainingStatus}</p>}
                </div>
              </Card>

              <Card className="p-5">
                <h3 className="text-lg font-black text-slate-900">Dataset control</h3>
                <div className="mt-4 grid grid-cols-1 gap-3">
                  <Input label="Dataset key" value={newDataset.key} onChange={(e) => setNewDataset((p) => ({ ...p, key: e.target.value }))} />
                  <Input label="Dataset name" value={newDataset.name} onChange={(e) => setNewDataset((p) => ({ ...p, name: e.target.value }))} />
                  <Input label="Source" value={newDataset.source} onChange={(e) => setNewDataset((p) => ({ ...p, source: e.target.value }))} />
                  <Input label="Description" value={newDataset.description} onChange={(e) => setNewDataset((p) => ({ ...p, description: e.target.value }))} />
                  <Button leftIcon={<Database className="h-4 w-4" />} onClick={registerDataset}>Register dataset</Button>
                  <div className="space-y-2">
                    {datasets.map((d: any) => (
                      <div key={d.key} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{d.name}</p>
                          <p className="text-xs text-slate-500">{d.key}</p>
                        </div>
                        <Button size="sm" variant={activeDatasetKey === d.key ? 'secondary' : 'outline'} onClick={() => setActiveDataset(d.key)}>
                          {activeDatasetKey === d.key ? 'Active' : 'Set active'}
                        </Button>
                      </div>
                    ))}
                  </div>
                  <Button variant="secondary" onClick={bindDatasetToModel}>Bind active dataset to selected model</Button>
                </div>
              </Card>
              <Card className="p-5 lg:col-span-2">
                <h3 className="text-lg font-black text-slate-900">Test prediction & model comparison</h3>
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
                  <Input label="Crop" value={testPrediction.crop} onChange={(e) => setTestPrediction((p) => ({ ...p, crop: e.target.value }))} />
                  <Input label="Market" value={testPrediction.market} onChange={(e) => setTestPrediction((p) => ({ ...p, market: e.target.value }))} />
                  <Input label="Days" type="number" value={String(testPrediction.days)} onChange={(e) => setTestPrediction((p) => ({ ...p, days: Number(e.target.value || 1) }))} />
                  <div className="flex items-end"><Button className="w-full" onClick={runTestPrediction}>Run prediction</Button></div>
                </div>
                {testPredictionResult && (
                  <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 max-h-52 overflow-y-auto">
                    <pre className="whitespace-pre-wrap">{JSON.stringify(testPredictionResult, null, 2)}</pre>
                  </div>
                )}
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <PriceChart title="MAE by model" data={(executiveDashboard?.modelHealth || []).map((m: any) => ({ name: m.model, value: Number(m.mae ?? 0) }))} />
                  <PriceChart title="RMSE by model" data={modelErrorData} />
                  <PriceChart title="MAPE by model" data={modelMapeData} />
                </div>
              </Card>
            </div>
          )}

          {activeTab === 'ai-insights' && (
            <div className="space-y-6">
              <RoleAIAnalyticsPanel contextData={{ dashboard: executiveDashboard, regionalData: nationalStatsFeed?.regionalPerformance || [] }} />

              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <button type="button" className="text-left" onClick={() => setActiveTab('ai-insights')}>
                  <Card className="p-4 cursor-pointer hover:border-rose-300">
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Open alerts</p>
                    <p className="mt-2 text-2xl font-black text-rose-700">{Number(executiveDashboard?.executiveKpis?.openAlerts || 0).toLocaleString()}</p>
                  </Card>
                </button>
                <button type="button" className="text-left" onClick={() => setActiveTab('live')}>
                  <Card className="p-4 cursor-pointer hover:border-rose-300">
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Critical alerts</p>
                    <p className="mt-2 text-2xl font-black text-rose-800">{Number(executiveDashboard?.executiveKpis?.criticalAlerts || 0).toLocaleString()}</p>
                  </Card>
                </button>
                <button type="button" className="text-left" onClick={() => setActiveTab('audit')}>
                  <Card className="p-4 cursor-pointer hover:border-amber-300">
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Open data issues</p>
                    <p className="mt-2 text-2xl font-black text-amber-700">{Number(executiveDashboard?.executiveKpis?.dataQualityOpen || 0).toLocaleString()}</p>
                  </Card>
                </button>
                <button type="button" className="text-left" onClick={() => setActiveTab('users')}>
                  <Card className="p-4 cursor-pointer hover:border-slate-400">
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Inactive users 14d</p>
                    <p className="mt-2 text-2xl font-black text-slate-800">{Number(executiveDashboard?.executiveKpis?.inactiveUsers14d || 0).toLocaleString()}</p>
                  </Card>
                </button>
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Card className="p-5">
                  <h3 className="text-lg font-black text-slate-900">National model health</h3>
                  <div className="mt-4 space-y-2">
                    {(executiveDashboard?.modelHealth || []).map((m: any) => (
                      <div key={m.model} className="rounded-xl border border-slate-200 px-3 py-2.5">
                        <p className="text-sm font-bold text-slate-800">{m.model} • {m.status}</p>
                        <p className="text-xs text-slate-500">
                          Accuracy: {Number(m.accuracyRate || 0).toFixed(2)}%
                          {' • '}
                          MAE: {Number(m.mae ?? m.latestMae ?? 0).toFixed(2)}
                          {' • '}
                          RMSE: {Number(m.rmse ?? m.latestRmse ?? 0).toFixed(2)}
                          {' • '}
                          Drift: {m.driftDetected ? 'Yes' : 'No'}
                        </p>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card className="p-5">
                  <h3 className="text-lg font-black text-slate-900">Top AI recommendations</h3>
                  <div className="mt-4 space-y-2">
                    {recommendationsFeed.slice(0, 10).map((r: any, idx: number) => (
                      <div key={`${r.title || 'rec'}-${idx}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                        <p className="text-sm font-bold text-slate-800">{r.title || 'Recommendation'}</p>
                        <p className="text-xs text-slate-500">{r.description || r.action || 'No detail'}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              <NationalMarketPulsePanel title="Admin national market pulse" />

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Card className="p-5">
                  <h3 className="text-lg font-black text-slate-900">Live alerts feed</h3>
                  <div className="mt-4 max-h-72 space-y-2 overflow-y-auto">
                    {alertsFeed.slice(0, 30).map((a: any) => (
                      <div key={a.id} className="rounded-xl border border-slate-200 px-3 py-2.5">
                        <p className="text-sm font-bold text-slate-800">{a.title}</p>
                        <p className="text-xs text-slate-500">{a.severity} • {a.alertType} • {a.region || a.crop || 'Global'} • {a.status}</p>
                        {a.status !== 'Resolved' && (
                          <div className="mt-2">
                            <Button size="sm" variant="outline" onClick={() => resolveAlert(a.id)}>Resolve</Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>

                <Card className="p-5">
                  <h3 className="text-lg font-black text-slate-900">Admin AI Assistant</h3>
                  <div className="mt-3 h-72 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                    {assistantMessages.map((m, idx) => (
                      <div key={idx} className={`max-w-[90%] rounded-xl px-3 py-2 text-sm ${m.role === 'user' ? 'ml-auto bg-emerald-700 text-white' : 'bg-white text-slate-800 border border-slate-200'}`}>
                        {m.text}
                      </div>
                    ))}
                    {assistantLoading && <p className="text-xs text-slate-500">Preparing executive response...</p>}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <input
                      className="h-11 flex-1 rounded-xl border border-slate-300 px-3 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      placeholder="Ask about national risk, policy actions, or operational bottlenecks..."
                      value={assistantQuestion}
                      onChange={(e) => setAssistantQuestion(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          askAssistant();
                        }
                      }}
                    />
                    <Button onClick={askAssistant} disabled={assistantLoading || !assistantQuestion.trim()}>Ask AI</Button>
                  </div>
                </Card>
              </div>

              {healthFeed && (
                <Card className="p-5">
                  <h3 className="text-lg font-black text-slate-900">Platform health diagnostics</h3>
                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-5">
                    <div className="rounded-xl border border-slate-200 p-3">
                      <p className="text-xs text-slate-500">Overall</p>
                      <p className="text-lg font-black">{healthFeed.overall || 'Unknown'}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3">
                      <p className="text-xs text-slate-500">Active users 24h</p>
                      <p className="text-lg font-black">{Number(healthFeed.activeUsers24h || 0).toLocaleString()}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3">
                      <p className="text-xs text-slate-500">Active deliveries</p>
                      <p className="text-lg font-black">{Number(healthFeed.activeDeliveries || 0).toLocaleString()}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3">
                      <p className="text-xs text-slate-500">Delayed deliveries</p>
                      <p className="text-lg font-black">{Number(healthFeed.delayedDeliveries || 0).toLocaleString()}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3">
                      <p className="text-xs text-slate-500">Pending orders</p>
                      <p className="text-lg font-black">{Number(healthFeed.pendingOrders || 0).toLocaleString()}</p>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          )}

          {activeTab === 'maintenance' && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card className="p-5">
                <h3 className="text-lg font-black text-slate-900">Maintenance scheduler</h3>
                <p className="mt-2 text-sm text-slate-600">Toggle maintenance state and notify users through system channels.</p>
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-500">Current status</p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {maintenanceStatus?.enabled ? 'Enabled' : 'Disabled'}
                    {maintenanceStatus?.description ? ` • ${maintenanceStatus.description}` : ''}
                  </p>
                  <p className="text-xs text-slate-500">
                    {maintenanceStatus?.start ? `Start: ${maintenanceStatus.start}` : 'No start scheduled'}
                    {' • '}
                    {maintenanceStatus?.end ? `End: ${maintenanceStatus.end}` : 'No end scheduled'}
                  </p>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button onClick={() => toggleMaintenance(true)}>{t('common.enable', 'Enable')} maintenance</Button>
                  <Button variant="outline" onClick={() => toggleMaintenance(false)}>{t('common.disable', 'Disable')} maintenance</Button>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-3">
                  <Input label="Scheduled start" type="datetime-local" value={maintenanceForm.start} onChange={(e) => setMaintenanceForm((p) => ({ ...p, start: e.target.value }))} />
                  <Input label="Scheduled end" type="datetime-local" value={maintenanceForm.end} onChange={(e) => setMaintenanceForm((p) => ({ ...p, end: e.target.value }))} />
                  <Input label="Description" value={maintenanceForm.description} onChange={(e) => setMaintenanceForm((p) => ({ ...p, description: e.target.value }))} />
                  <Button variant="secondary" onClick={scheduleMaintenance} disabled={!maintenanceForm.start || !maintenanceForm.end || !maintenanceForm.description.trim()}>
                    Schedule maintenance
                  </Button>
                </div>
              </Card>

              <Card className="p-5">
                <h3 className="text-lg font-black text-slate-900">National broadcast center</h3>
                <p className="mt-2 text-sm text-slate-600">Send targeted operational alerts to role groups.</p>
                <div className="mt-4 grid grid-cols-1 gap-3">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold text-slate-600">Target role</span>
                    <select className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" value={broadcastForm.role} onChange={(e) => setBroadcastForm((p) => ({ ...p, role: e.target.value }))}>
                      {['Farmer', 'CooperativeManager', 'Buyer', 'Transporter', 'StorageOperator', 'MarketAgent', 'Government', 'Admin'].map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </label>
                  <Input label="Title" value={broadcastForm.title} onChange={(e) => setBroadcastForm((p) => ({ ...p, title: e.target.value }))} />
                  <Input label="Message" value={broadcastForm.message} onChange={(e) => setBroadcastForm((p) => ({ ...p, message: e.target.value }))} />
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold text-slate-600">Type</span>
                    <select className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" value={broadcastForm.type} onChange={(e) => setBroadcastForm((p) => ({ ...p, type: e.target.value }))}>
                      {['Info', 'Warning', 'Success', 'Error'].map((type) => <option key={type} value={type}>{type}</option>)}
                    </select>
                  </label>
                  <Button onClick={broadcast} disabled={!broadcastForm.title.trim() || !broadcastForm.message.trim()}>
                    Send broadcast
                  </Button>
                  {opsStatus && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">{opsStatus}</p>}
                </div>
              </Card>
            </div>
          )}

          {activeTab === 'roles' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                {roleTable.map((r) => (
                  <button key={r.role} type="button" className="text-left" onClick={() => setRoleFocus(r.role)}>
                    <Card className={`p-4 transition ${roleFocus === r.role ? 'border-emerald-400 bg-emerald-50' : ''}`}>
                      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{r.role}</p>
                      <p className="mt-2 text-2xl font-black text-slate-900">{r.count.toLocaleString()}</p>
                      <p className="text-xs text-slate-500">Active {r.active.toLocaleString()}</p>
                    </Card>
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <PriceChart title="Role population" data={roleData.map((r) => ({ name: r.name, value: Number(r.value) }))} />
                <PriceChart title="Active users by role" data={activeByRoleData} />
                <PriceChart title="Inactive users by role" data={inactiveByRoleData} />
                <PriceChart title="Model accuracy by model" data={modelAccuracyData} />
                <PriceChart title="Model RMSE by model" data={modelErrorData} />
                <Card className="p-5">
                  <h3 className="text-lg font-black text-slate-900">Role management at scale</h3>
                  <div className="mt-4 space-y-2">
                    {roleTable.map((r) => (
                      <div key={r.role} className="rounded-xl border border-slate-200 px-3 py-2.5">
                        <p className="text-sm font-bold text-slate-800">{r.role}</p>
                        <p className="text-xs text-slate-500">Total: {r.count.toLocaleString()} • Active: {r.active.toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
              <Card className="p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-black text-slate-900">Role operations console</h3>
                  <label className="text-xs font-semibold text-slate-600">
                    Focus role
                    <select className="ml-2 rounded-lg border border-slate-300 px-2 py-1 text-xs" value={roleFocus} onChange={(e) => setRoleFocus(e.target.value)}>
                      {rolesList.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </label>
                </div>
                <div className="mt-4 space-y-2">
                  {usersByRole.slice(0, 200).map((u: any) => (
                    <div key={u.id || u.Id} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{u.fullName || u.FullName || 'User'}</p>
                        <p className="text-xs text-slate-500">{u.email || u.Email} • {u.role || u.Role}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => activateUser(u.id || u.Id)}>Activate</Button>
                        <Button variant="danger" size="sm" onClick={() => suspendUser(u.id || u.Id)}>Suspend</Button>
                        <Button size="sm" variant="outline" onClick={() => resetPassword(u.id || u.Id)}>Reset password</Button>
                        <Button size="sm" variant="outline" onClick={() => forceLogout(u.id || u.Id)}>Force logout</Button>
                        <Button size="sm" variant="outline" onClick={() => setEditUser({
                          id: String(u.id || u.Id),
                          fullName: String(u.fullName || u.FullName || ''),
                          email: String(u.email || u.Email || ''),
                          phone: String(u.phone || u.Phone || ''),
                          role: String(u.role || u.Role || 'Farmer'),
                          isActive: Boolean(u.isActive ?? u.IsActive ?? true),
                        })}>Edit</Button>
                        <Button size="sm" variant="danger" onClick={() => removeUser(u.id || u.Id)}>Delete</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {activeTab === 'config' && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card className="p-5">
                <h3 className="text-lg font-black text-slate-900">System configuration</h3>
              <div className="mt-4 grid grid-cols-1 gap-3">
                <Input label="Config key" value={configForm.key} onChange={(e) => setConfigForm((p) => ({ ...p, key: e.target.value }))} />
                <Input label="Config value" value={configForm.value} onChange={(e) => setConfigForm((p) => ({ ...p, value: e.target.value }))} />
                <Button variant="outline" onClick={async () => { setConfigForm({ key: 'forecast.maxDays', value: '30' }); }}>Forecasting limits preset</Button>
                <Button variant="outline" onClick={async () => { setConfigForm({ key: 'access.level.government', value: 'readonly' }); }}>Access level preset</Button>
                <Button variant="outline" onClick={async () => { setConfigForm({ key: 'feature.logistics.enabled', value: 'true' }); }}>Feature toggle preset</Button>
                <Button onClick={saveConfig} disabled={!configForm.key.trim()}>Save configuration</Button>
              </div>
              </Card>
              <Card className="p-5">
                <h3 className="text-lg font-black text-slate-900">Current configuration map</h3>
                <div className="mt-4 max-h-96 space-y-2 overflow-y-auto">
                  {Object.entries(systemConfig).map(([key, value]) => (
                    <div key={key} className="rounded-xl border border-slate-200 px-3 py-2.5">
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-500">{key}</p>
                      <p className="text-sm font-semibold text-slate-800 break-all">{String(value)}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {activeTab === 'applications' && (
            <div className="space-y-4">
              {/* Application Stats */}
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Card className="p-3 text-center">
                  <p className="text-[10px] font-semibold uppercase text-slate-400">Total</p>
                  <p className="text-xl font-black text-slate-900">{applications.length}</p>
                </Card>
                <Card className="p-3 text-center">
                  <p className="text-[10px] font-semibold uppercase text-amber-500">Pending</p>
                  <p className="text-xl font-black text-amber-600">{applications.filter((a: any) => a.status === 'Pending').length}</p>
                </Card>
                <Card className="p-3 text-center">
                  <p className="text-[10px] font-semibold uppercase text-emerald-500">Approved</p>
                  <p className="text-xl font-black text-emerald-600">{applications.filter((a: any) => a.status === 'Approved').length}</p>
                </Card>
                <Card className="p-3 text-center">
                  <p className="text-[10px] font-semibold uppercase text-red-500">Rejected</p>
                  <p className="text-xl font-black text-red-600">{applications.filter((a: any) => a.status === 'Rejected').length}</p>
                </Card>
              </div>

              {/* Filter Tabs */}
              <div className="flex gap-2">
                {(['all', 'Pending', 'Approved', 'Rejected'] as const).map((f) => (
                  <button key={f} onClick={() => setAppFilter(f)} className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${appFilter === f ? 'bg-emerald-700 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-emerald-300'}`}>
                    {f === 'all' ? 'All' : f} {f !== 'all' ? `(${applications.filter((a: any) => a.status === f).length})` : `(${applications.length})`}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <Card className="p-5 lg:col-span-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-black text-slate-900">Applications</h3>
                    {applicationUnreadCount > 0 && <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-black text-white">{applicationUnreadCount}</span>}
                  </div>
                  <div className="mt-4 max-h-[36rem] space-y-2 overflow-y-auto">
                    {filteredApplications.map((a: any) => (
                      <button key={a.id} type="button" onClick={() => loadApplicationDetail(a.id)} className={`w-full rounded-xl border px-3 py-2 text-left ${selectedApplication?.id === a.id ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
                        <p className="text-sm font-bold text-slate-800">{a.applicantName}</p>
                        <p className="text-xs text-slate-500">{a.applicantEmail}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${a.status === 'Approved' ? 'bg-emerald-50 text-emerald-700' : a.status === 'Rejected' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{a.status}</span>
                          <span className="text-[10px] text-slate-500">{a.targetRole}</span>
                        </div>
                        {Number(a.unreadAdminCount || 0) > 0 && <span className="mt-1 inline-block rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-black text-white">{a.unreadAdminCount} new</span>}
                      </button>
                    ))}
                    {filteredApplications.length === 0 && <p className="py-8 text-center text-sm text-slate-400">No {appFilter === 'all' ? '' : appFilter.toLowerCase()} applications</p>}
                  </div>
                </Card>
                <Card className="p-5 lg:col-span-2">
                  <h3 className="text-lg font-black text-slate-900">Application thread</h3>
                  {!selectedApplication ? (
                    <div className="mt-6 text-center">
                      <FileStack className="mx-auto h-12 w-12 text-slate-200" />
                      <p className="mt-3 text-sm text-slate-500">Select an application to review details and process.</p>
                    </div>
                  ) : (
                    <div className="mt-3 space-y-4">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                          <div><p className="text-[10px] uppercase text-slate-500">Applicant</p><p className="font-bold text-slate-800">{selectedApplication.applicantName}</p></div>
                          <div><p className="text-[10px] uppercase text-slate-500">Email</p><p className="font-bold text-slate-800">{selectedApplication.applicantEmail}</p></div>
                          <div><p className="text-[10px] uppercase text-slate-500">Target role</p><p className="font-bold text-slate-800">{selectedApplication.targetRole}</p></div>
                          <div><p className="text-[10px] uppercase text-slate-500">Status</p><p className={`font-bold ${selectedApplication.status === 'Approved' ? 'text-emerald-700' : selectedApplication.status === 'Rejected' ? 'text-red-700' : 'text-amber-700'}`}>{selectedApplication.status}</p></div>
                        </div>
                        {selectedApplication.formDataJson && (() => {
                          try {
                            const fd = JSON.parse(selectedApplication.formDataJson);
                            return (
                              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-200 pt-3 text-xs md:grid-cols-3">
                                {fd.Phone && <div><span className="text-slate-500">Phone:</span> <span className="font-semibold">{fd.Phone}</span></div>}
                                {fd.OrganizationName && <div><span className="text-slate-500">Organization:</span> <span className="font-semibold">{fd.OrganizationName}</span></div>}
                                {fd.Province && <div><span className="text-slate-500">Province:</span> <span className="font-semibold">{fd.Province}</span></div>}
                                {fd.District && <div><span className="text-slate-500">District:</span> <span className="font-semibold">{fd.District}</span></div>}
                                {fd.Sector && <div><span className="text-slate-500">Sector:</span> <span className="font-semibold">{fd.Sector}</span></div>}
                                {fd.VehicleType && <div><span className="text-slate-500">Vehicle:</span> <span className="font-semibold">{fd.VehicleType}</span></div>}
                                {fd.PlateNumber && <div><span className="text-slate-500">Plate:</span> <span className="font-semibold">{fd.PlateNumber}</span></div>}
                                {fd.FarmersCount && <div><span className="text-slate-500">Farmers:</span> <span className="font-semibold">{fd.FarmersCount}</span></div>}
                                {fd.Notes && <div className="col-span-full"><span className="text-slate-500">Notes:</span> <span className="font-semibold">{fd.Notes}</span></div>}
                              </div>
                            );
                          } catch { return null; }
                        })()}
                        <p className="mt-2 text-[10px] text-slate-400">Submitted: {selectedApplication.createdAt ? new Date(selectedApplication.createdAt).toLocaleString() : 'N/A'} | Updated: {selectedApplication.updatedAt ? new Date(selectedApplication.updatedAt).toLocaleString() : 'N/A'}</p>
                      </div>
                      {(selectedApplication.documents || []).length > 0 && (
                        <div>
                          <p className="text-xs font-bold uppercase text-slate-500">Attached documents</p>
                          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                            {(selectedApplication.documents || []).map((d: any) => (
                              <div key={d.id} className="rounded-xl border border-slate-200 px-3 py-2">
                                <p className="text-sm font-semibold text-slate-800">{d.documentName}</p>
                                <a className="text-xs text-emerald-700 underline" href={d.documentUrl} target="_blank" rel="noreferrer">{d.originalFileName || d.documentUrl}</a>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="max-h-72 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
                        {(selectedApplication.messages || []).map((m: any) => (
                          <div key={m.id} className={`max-w-[90%] rounded-xl px-3 py-2 text-sm ${m.senderType === 'Admin' ? 'ml-auto bg-emerald-700 text-white' : 'bg-white text-slate-800 border border-slate-200'}`}>
                            <p className="text-[11px] font-bold opacity-80">{m.senderType} • {m.senderName}</p>
                            <p>{m.message}</p>
                          </div>
                        ))}
                        {(selectedApplication.messages || []).length === 0 && <p className="py-4 text-center text-xs text-slate-400">No messages yet</p>}
                      </div>
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
                        <div className="md:col-span-3">
                          <Input label="Admin message" value={applicationMessage} onChange={(e) => setApplicationMessage(e.target.value)} />
                        </div>
                        <div className="flex items-end">
                          <Button className="w-full" onClick={sendApplicationMessage} disabled={!applicationMessage.trim()}>Send</Button>
                        </div>
                      </div>
                      <Input label="Decision note" value={applicationNote} onChange={(e) => setApplicationNote(e.target.value)} />
                      <div className="flex flex-wrap gap-2">
                        <Button onClick={() => processApplication(true)} disabled={selectedApplication.status !== 'Pending'}>Approve</Button>
                        <Button variant="danger" onClick={() => processApplication(false)} disabled={selectedApplication.status !== 'Pending'}>Reject</Button>
                        <Button variant="danger" onClick={() => deleteApplication(selectedApplication.id)}>Delete application</Button>
                      </div>
                      {selectedApplication.adminNote && (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                          <p className="text-[10px] uppercase text-slate-500">Admin note</p>
                          <p className="text-sm text-slate-700">{selectedApplication.adminNote}</p>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              </div>
            </div>
          )}

          {activeTab === 'audit' && (
            <Card className="p-5">
              <h3 className="text-lg font-black text-slate-900">Audit logs</h3>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-7">
                <Input label="Search" value={auditFilter.search} onChange={(e) => setAuditFilter((p) => ({ ...p, search: e.target.value }))} />
                <Input label="Action" value={auditFilter.action} onChange={(e) => setAuditFilter((p) => ({ ...p, action: e.target.value }))} />
                <Input label="Actor" value={auditFilter.actor} onChange={(e) => setAuditFilter((p) => ({ ...p, actor: e.target.value }))} />
                <Input label="Entity" value={auditFilter.entityType} onChange={(e) => setAuditFilter((p) => ({ ...p, entityType: e.target.value }))} />
                <Input label="Days" type="number" value={String(auditFilter.days)} onChange={(e) => setAuditFilter((p) => ({ ...p, days: Number(e.target.value || 30) }))} />
                <Input label="Start date" type="date" value={auditFilter.startDate} onChange={(e) => setAuditFilter((p) => ({ ...p, startDate: e.target.value }))} />
                <Input label="End date" type="date" value={auditFilter.endDate} onChange={(e) => setAuditFilter((p) => ({ ...p, endDate: e.target.value }))} />
              </div>
              <div className="mt-3 flex gap-2">
                <Button variant="outline" onClick={loadAuditLogs}>Apply filters</Button>
                <Button variant="secondary" leftIcon={<Download className="h-4 w-4" />} onClick={exportAuditCsv}>Export CSV</Button>
                <Button variant="outline" onClick={runAuditBackfill} disabled={auditBackfillLoading}>{auditBackfillLoading ? 'Backfilling...' : 'Backfill historical logs'}</Button>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-700">
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={auditCompactMode} onChange={(e) => setAuditCompactMode(e.target.checked)} />
                  Compact table mode
                </label>
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={auditDiffOnly} onChange={(e) => setAuditDiffOnly(e.target.checked)} />
                  Show diff only
                </label>
                <span>Sort by:</span>
                <select className="rounded-lg border border-slate-300 px-2 py-1" value={auditSortBy} onChange={(e) => setAuditSortBy(e.target.value as any)}>
                  <option value="timestamp">Timestamp</option>
                  <option value="action">Action</option>
                  <option value="actor">Actor</option>
                  <option value="entity">Entity</option>
                </select>
                <select className="rounded-lg border border-slate-300 px-2 py-1" value={auditSortDir} onChange={(e) => setAuditSortDir(e.target.value as any)}>
                  <option value="desc">Desc</option>
                  <option value="asc">Asc</option>
                </select>
              </div>
              {auditCompactMode ? (
                <div className="mt-4 max-h-[28rem] overflow-auto rounded-xl border border-slate-200">
                  <table className="min-w-full text-xs">
                    <thead className="sticky top-0 bg-slate-100">
                      <tr>
                        <th className="px-2 py-2 text-left">Timestamp</th>
                        <th className="px-2 py-2 text-left">Action</th>
                        <th className="px-2 py-2 text-left">Actor</th>
                        <th className="px-2 py-2 text-left">Role</th>
                        <th className="px-2 py-2 text-left">Type</th>
                        <th className="px-2 py-2 text-left">Entity</th>
                        <th className="px-2 py-2 text-left">IP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedAuditLogs.slice(0, 1000).filter((l: any) => {
                        if (!auditDiffOnly) return true;
                        const md = parseAuditMetadata(l.metadata);
                        return hasDiff(md?.before_state, md?.after_state);
                      }).map((l: any) => {
                        const md = parseAuditMetadata(l.metadata) || {};
                        return (
                          <tr key={l.id} className="border-t border-slate-200">
                            <td className="px-2 py-2">{l.timestamp}</td>
                            <td className="px-2 py-2 font-semibold">{l.action}</td>
                            <td className="px-2 py-2">{l.actor}</td>
                            <td className="px-2 py-2">{l.actorRole || md.actor_role || 'N/A'}</td>
                            <td className="px-2 py-2">{md.action_type || 'N/A'}</td>
                            <td className="px-2 py-2">{l.entityType || 'System'} • {l.entityId || '—'}</td>
                            <td className="px-2 py-2">{md.ip_address || 'N/A'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
              <div className="mt-4 max-h-[28rem] space-y-2 overflow-y-auto">
                {sortedAuditLogs.slice(0, 500).filter((l: any) => {
                  if (!auditDiffOnly) return true;
                  const md = parseAuditMetadata(l.metadata);
                  return hasDiff(md?.before_state, md?.after_state);
                }).map((l: any) => (
                  <div key={l.id} className="rounded-xl border border-slate-200 px-3 py-2.5 bg-white">
                    {(() => {
                      const md = parseAuditMetadata(l.metadata);
                      const actorRole = l.actorRole || md?.actor_role || 'N/A';
                      const actionType = md?.action_type || l.action || 'N/A';
                      const ipAddress = md?.ip_address || 'N/A';
                      const deviceInfo = md?.device_info || 'N/A';
                      const beforeState = md?.before_state;
                      const afterState = md?.after_state;
                      return (
                        <>
                          <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Action</p>
                              <p className="text-xs font-semibold text-slate-800">{l.action}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Actor</p>
                              <p className="text-xs text-slate-700">{l.actor}{l.actorId ? ` (${l.actorId})` : ''}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Actor role</p>
                              <p className="text-xs text-slate-700">{actorRole}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Action type</p>
                              <p className="text-xs text-slate-700">{actionType}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Entity</p>
                              <p className="text-xs text-slate-700">{l.entityType || 'System'} • {l.entityId || '—'}</p>
                            </div>
                          </div>
                          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Timestamp</p>
                              <p className="text-xs text-slate-700">{l.timestamp}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">IP address</p>
                              <p className="text-xs text-slate-700">{ipAddress}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Device</p>
                              <p className="truncate text-xs text-slate-700" title={String(deviceInfo)}>{String(deviceInfo)}</p>
                            </div>
                          </div>
                          {(beforeState || afterState) && (
                            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                              <div className="rounded-lg border border-amber-200 bg-amber-50 p-2">
                                <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">Before state</p>
                                <pre className="mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap text-[11px] text-amber-900">{beforeState ? JSON.stringify(beforeState, null, 2) : '—'}</pre>
                              </div>
                              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2">
                                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">After state</p>
                                <pre className="mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap text-[11px] text-emerald-900">{afterState ? JSON.stringify(afterState, null, 2) : '—'}</pre>
                              </div>
                            </div>
                          )}
                          {!md && l.metadata && <p className="mt-2 text-xs text-slate-600">{String(l.metadata)}</p>}
                        </>
                      );
                    })()}
                  </div>
                ))}
              </div>
              )}
            </Card>
          )}

          {activeTab === 'logistics' && (
            <div className="space-y-6">
              {/* Logistics KPIs */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <Card className="p-4">
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Total requests</p>
                  <p className="mt-2 text-2xl font-black text-slate-900">{logisticsRequests.length}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Pending</p>
                  <p className="mt-2 text-2xl font-black text-amber-600">{logisticsRequests.filter((r: any) => r.status === 'Pending' || r.status === 'Requested').length}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">In transit</p>
                  <p className="mt-2 text-2xl font-black text-blue-600">{logisticsRequests.filter((r: any) => r.status === 'InTransit' || r.status === 'Assigned').length}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Completed</p>
                  <p className="mt-2 text-2xl font-black text-emerald-600">{logisticsRequests.filter((r: any) => r.status === 'Completed' || r.status === 'Delivered').length}</p>
                </Card>
              </div>

              {/* Active Transporters */}
              <Card className="p-5">
                <h3 className="text-lg font-black text-slate-900">Registered transporters & vehicles</h3>
                <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
                  {transporters.map((t: any) => (
                    <div key={t.id || t.Id} className={`rounded-xl border px-3 py-2.5 ${(t.isActive ?? t.IsActive ?? true) ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200'}`}>
                      <p className="text-sm font-bold text-slate-800">{t.companyName || t.CompanyName || t.fullName || t.FullName}</p>
                      <p className="text-xs text-slate-500">
                        {t.plateNumber || t.PlateNumber || 'No plate'} • {t.vehicleType || t.VehicleType || 'Vehicle'}
                        {t.capacityKg || t.CapacityKg ? ` • ${Number(t.capacityKg || t.CapacityKg || 0).toLocaleString()} kg capacity` : ''}
                      </p>
                      <p className="text-xs text-slate-500">{t.phone || t.Phone || 'No phone'} • {(t.isActive ?? t.IsActive ?? true) ? 'Active' : 'Inactive'}</p>
                    </div>
                  ))}
                  {transporters.length === 0 && <p className="text-sm text-slate-500">No transporters registered.</p>}
                </div>
              </Card>

              {/* Transport Requests - Assignment & Tracking */}
              <Card className="p-5">
                <h3 className="text-lg font-black text-slate-900">Transport requests & delivery tracking</h3>
                <div className="mt-4 space-y-3">
                  {logisticsRequests.length === 0 && <p className="text-sm text-slate-500">No transport requests yet.</p>}
                  {logisticsRequests.map((r: any) => {
                    const statusColor = r.status === 'Completed' || r.status === 'Delivered' ? 'bg-emerald-100 text-emerald-700'
                      : r.status === 'InTransit' || r.status === 'Assigned' ? 'bg-blue-100 text-blue-700'
                      : r.status === 'Cancelled' ? 'bg-red-100 text-red-700'
                      : 'bg-amber-100 text-amber-700';
                    return (
                      <div key={r.id} className="rounded-xl border border-slate-200 px-4 py-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-bold text-slate-800">{r.origin} → {r.destination}</p>
                            <p className="text-xs text-slate-500">
                              {Number(r.loadKg || 0).toLocaleString()} kg
                              {r.distanceKm ? ` • ${Number(r.distanceKm).toLocaleString()} km` : ''}
                              {r.estimatedDeliveryHours ? ` • ~${r.estimatedDeliveryHours}h` : ''}
                            </p>
                            {r.transporterName && <p className="text-xs text-emerald-600">Assigned: {r.transporterName} {r.driverPhone ? `(${r.driverPhone})` : ''}</p>}
                            {r.pickupStart && <p className="text-xs text-slate-400">Pickup: {new Date(r.pickupStart).toLocaleString()}{r.pickupEnd ? ` – ${new Date(r.pickupEnd).toLocaleString()}` : ''}</p>}
                          </div>
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColor}`}>{r.status}</span>
                        </div>
                        {(r.status === 'Pending' || r.status === 'Requested') && (
                          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
                            <select
                              className="h-10 rounded-xl border border-slate-300 px-3 text-sm"
                              value={logisticsAssignments[r.id]?.transporterId || ''}
                              onChange={(e) => setLogisticsAssignments((p) => ({ ...p, [r.id]: { transporterId: e.target.value, driverPhone: p[r.id]?.driverPhone || '' } }))}
                            >
                              <option value="">Select transporter</option>
                              {transporters.filter((t: any) => t.isActive ?? t.IsActive ?? true).map((t: any) => (
                                <option key={t.id || t.Id} value={t.id || t.Id}>{t.companyName || t.CompanyName || t.fullName || t.FullName}</option>
                              ))}
                            </select>
                            <input
                              className="h-10 rounded-xl border border-slate-300 px-3 text-sm"
                              placeholder="Driver phone (optional)"
                              value={logisticsAssignments[r.id]?.driverPhone || ''}
                              onChange={(e) => setLogisticsAssignments((p) => ({ ...p, [r.id]: { transporterId: p[r.id]?.transporterId || '', driverPhone: e.target.value } }))}
                            />
                            <Button onClick={() => assignTransport(r.id)} disabled={!logisticsAssignments[r.id]?.transporterId}>Assign transporter</Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>

              {/* Delivery History */}
              <Card className="p-5">
                <h3 className="text-lg font-black text-slate-900">Delivery history</h3>
                <div className="mt-4 max-h-80 overflow-auto rounded-xl border border-slate-200">
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 bg-slate-100">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Route</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Load</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Transporter</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Status</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {logisticsRequests.filter((r: any) => r.status === 'Completed' || r.status === 'Delivered').map((r: any) => (
                        <tr key={r.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2 text-slate-700">{r.origin} → {r.destination}</td>
                          <td className="px-3 py-2 text-slate-700">{Number(r.loadKg || 0).toLocaleString()} kg</td>
                          <td className="px-3 py-2 text-slate-700">{r.transporterName || '—'}</td>
                          <td className="px-3 py-2"><span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">{r.status}</span></td>
                          <td className="px-3 py-2 text-slate-500 text-xs">{r.pickupEnd ? new Date(r.pickupEnd).toLocaleDateString() : '—'}</td>
                        </tr>
                      ))}
                      {logisticsRequests.filter((r: any) => r.status === 'Completed' || r.status === 'Delivered').length === 0 && (
                        <tr><td colSpan={5} className="px-3 py-4 text-center text-slate-500">No completed deliveries yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {activeTab === 'ai-assistant' && (
            <Card className="p-5">
              <h3 className="text-lg font-black text-slate-900">Admin AI Assistant</h3>
              <div className="mt-3 h-72 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                {assistantMessages.map((m, idx) => (
                  <div key={idx} className={`max-w-[90%] rounded-xl px-3 py-2 text-sm ${m.role === 'user' ? 'ml-auto bg-emerald-700 text-white' : 'bg-white text-slate-800 border border-slate-200'}`}>
                    {m.text}
                  </div>
                ))}
                {assistantLoading && <p className="text-xs text-slate-500">Preparing executive response...</p>}
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  className="h-11 flex-1 rounded-xl border border-slate-300 px-3 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  placeholder="Ask about national risk, platform health, contracts, or policy actions..."
                  value={assistantQuestion}
                  onChange={(e) => setAssistantQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      askAssistant();
                    }
                  }}
                />
                <Button onClick={askAssistant} disabled={assistantLoading || !assistantQuestion.trim()}>Ask AI</Button>
              </div>
            </Card>
          )}

          {activeTab === 'reports' && (
            <div className="space-y-6">
              <div className="rounded-2xl bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-8 text-white">
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-300">National reporting center</p>
                <h2 className="mt-2 text-2xl font-black">Generate & export platform reports</h2>
                <p className="mt-1 text-sm text-slate-400">16 report types with full CSV/Excel export for all platform data. Filter by crop, region, date range.</p>
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <Card className="p-5 lg:col-span-1">
                  <h3 className="text-base font-black text-slate-900">Report builder</h3>
                  <div className="mt-4 space-y-3">
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-semibold text-slate-600">Report type</span>
                      <select className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" value={reportType} onChange={(e) => setReportType(e.target.value)}>
                        {REPORT_TYPES.map((r) => <option key={r.value} value={r.value}>{r.icon} {r.label}</option>)}
                      </select>
                    </label>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-600">Crop (optional)</label>
                      <select className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" value={reportFilters.crop} onChange={(e) => setReportFilters((p) => ({ ...p, crop: e.target.value }))}>
                        <option value="">All crops</option>
                        {cropOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-600">Region (optional)</label>
                      <select className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" value={reportFilters.region} onChange={(e) => setReportFilters((p) => ({ ...p, region: e.target.value, district: '' }))}>
                        <option value="">All regions</option>
                        {provinces.map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-600">District (optional)</label>
                      <select className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" value={reportFilters.district} onChange={(e) => setReportFilters((p) => ({ ...p, district: e.target.value }))} disabled={!reportFilters.region}>
                        <option value="">All districts</option>
                        {reportDistrictOptions.map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <Input label="Start date" type="date" value={reportFilters.startDate} onChange={(e) => setReportFilters((p) => ({ ...p, startDate: e.target.value }))} />
                    <Input label="End date" type="date" value={reportFilters.endDate} onChange={(e) => setReportFilters((p) => ({ ...p, endDate: e.target.value }))} />
                    <Button className="w-full" onClick={generateReport} disabled={reportLoading}>
                      {reportLoading ? 'Generating...' : 'Generate report'}
                    </Button>
                    <Button variant="secondary" className="w-full" leftIcon={<Download className="h-4 w-4" />} onClick={() => exportCsv(reportType)}>
                      Export as CSV / Excel
                    </Button>
                  </div>
                </Card>

                <Card className="p-5 lg:col-span-2">
                  <h3 className="text-base font-black text-slate-900">Report output</h3>
                  {!generatedReport ? (
                    <div className="mt-8 text-center">
                      <FileText className="mx-auto h-12 w-12 text-slate-200" />
                      <p className="mt-3 text-sm text-slate-500">Select a report type and click "Generate report" to see results.</p>
                      <p className="mt-1 text-xs text-slate-400">Or use "Export CSV" for direct download.</p>
                    </div>
                  ) : (
                    <div className="mt-3 space-y-4">
                      {generatedReport.title && <p className="text-sm font-bold text-slate-800">{generatedReport.title}</p>}
                      {generatedReport.summary && (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                          <p className="text-xs text-emerald-700">{typeof generatedReport.summary === 'string' ? generatedReport.summary : JSON.stringify(generatedReport.summary)}</p>
                        </div>
                      )}
                      {generatedReport.data && Array.isArray(generatedReport.data) && generatedReport.data.length > 0 && (
                        <div className="max-h-96 overflow-auto rounded-xl border border-slate-200">
                          <table className="min-w-full text-xs">
                            <thead className="sticky top-0 bg-slate-100">
                              <tr>
                                {Object.keys(generatedReport.data[0]).slice(0, 8).map((k) => (
                                  <th key={k} className="px-3 py-2 text-left font-semibold text-slate-600">{k}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {generatedReport.data.slice(0, 100).map((row: any, idx: number) => (
                                <tr key={idx} className="hover:bg-slate-50">
                                  {Object.keys(generatedReport.data[0]).slice(0, 8).map((k) => (
                                    <td key={k} className="px-3 py-2 text-slate-700">{String(row[k] ?? '')}</td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      {generatedReport.rawData && !Array.isArray(generatedReport.data) && (
                        <pre className="max-h-80 overflow-auto rounded-xl bg-slate-50 p-3 text-xs text-slate-700">{JSON.stringify(generatedReport, null, 2)}</pre>
                      )}
                    </div>
                  )}
                </Card>
              </div>

              {/* Quick Export Tiles */}
              <Card className="p-5">
                <h3 className="text-base font-black text-slate-900">Quick export — all report types</h3>
                <p className="mt-1 text-xs text-slate-500">Download any report as CSV/Excel with one click. Filters above apply.</p>
                <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-4">
                  {REPORT_TYPES.map((r) => (
                    <button key={r.value} onClick={() => exportCsv(r.value)} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-left text-xs font-semibold text-slate-700 hover:border-emerald-300 hover:bg-emerald-50 transition">
                      <Download className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span className="truncate">{r.label}</span>
                    </button>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {activeTab === 'marketplace' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-900">Marketplace oversight</h3>
                  <p className="text-xs text-slate-500">Monitor active listings, pricing, and cooperative activity across the national marketplace.</p>
                </div>
                <Button variant="outline" onClick={() => navigate('/marketplace')}>Open marketplace</Button>
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Card className="p-3 text-center">
                  <p className="text-[10px] font-semibold uppercase text-slate-400">Active listings</p>
                  <p className="text-xl font-black text-emerald-700">{marketplaceListings.length}</p>
                </Card>
                <Card className="p-3 text-center">
                  <p className="text-[10px] font-semibold uppercase text-slate-400">Total volume</p>
                  <p className="text-xl font-black text-blue-700">{marketplaceListings.reduce((s: number, l: any) => s + Number(l.quantityKg || 0), 0).toLocaleString()} kg</p>
                </Card>
                <Card className="p-3 text-center">
                  <p className="text-[10px] font-semibold uppercase text-slate-400">Total value</p>
                  <p className="text-xl font-black text-violet-700">{marketplaceListings.reduce((s: number, l: any) => s + Number(l.minimumPrice || 0) * Number(l.quantityKg || 0), 0).toLocaleString()} RWF</p>
                </Card>
                <Card className="p-3 text-center">
                  <p className="text-[10px] font-semibold uppercase text-slate-400">Cooperatives</p>
                  <p className="text-xl font-black text-amber-700">{new Set(marketplaceListings.map((l: any) => l.cooperative?.id).filter(Boolean)).size}</p>
                </Card>
              </div>
              <Card className="p-5">
                <h3 className="text-base font-black text-slate-900">Latest listings</h3>
                <div className="mt-3 max-h-96 overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 bg-slate-100">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Crop</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Cooperative</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Quantity</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Min Price</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Grade</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Location</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {marketplaceListings.map((l: any) => (
                        <tr key={l.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/marketplace/${l.id}`)}>
                          <td className="px-3 py-2 font-semibold">{l.crop}</td>
                          <td className="px-3 py-2 text-slate-600">{l.cooperative?.name || 'N/A'}</td>
                          <td className="px-3 py-2">{Number(l.quantityKg || 0).toLocaleString()} kg</td>
                          <td className="px-3 py-2 font-bold text-emerald-700">{Number(l.minimumPrice || 0).toLocaleString()} RWF</td>
                          <td className="px-3 py-2">{l.qualityGrade || 'N/A'}</td>
                          <td className="px-3 py-2 text-xs text-slate-500">{[l.cooperative?.district, l.cooperative?.region].filter(Boolean).join(' • ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {marketplaceListings.length === 0 && <p className="py-6 text-center text-sm text-slate-400">No active listings.</p>}
                </div>
              </Card>
            </div>
          )}

          {activeTab === 'contracts' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-900">Contracts oversight</h3>
                  <p className="text-xs text-slate-500">Monitor all platform contracts. Click any contract to view full details.</p>
                </div>
                <Button variant="outline" onClick={() => navigate('/contracts')}>Open contracts page</Button>
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Card className="p-3 text-center">
                  <p className="text-[10px] font-semibold uppercase text-slate-400">Total contracts</p>
                  <p className="text-xl font-black text-slate-900">{contractsData.length}</p>
                </Card>
                <Card className="p-3 text-center">
                  <p className="text-[10px] font-semibold uppercase text-emerald-500">Active</p>
                  <p className="text-xl font-black text-emerald-700">{contractsData.filter((c: any) => c.status === 'Active').length}</p>
                </Card>
                <Card className="p-3 text-center">
                  <p className="text-[10px] font-semibold uppercase text-amber-500">Disputed</p>
                  <p className="text-xl font-black text-amber-700">{contractsData.filter((c: any) => c.status === 'Disputed').length}</p>
                </Card>
                <Card className="p-3 text-center">
                  <p className="text-[10px] font-semibold uppercase text-blue-500">Total value</p>
                  <p className="text-xl font-black text-blue-700">{contractsData.reduce((s: number, c: any) => s + Number(c.totalValue || 0), 0).toLocaleString()} RWF</p>
                </Card>
              </div>
              <Card className="p-5">
                <div className="max-h-96 overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 bg-slate-100">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Tracking</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Crop</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Quantity</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Value</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Status</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Buyer</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {contractsData.map((c: any) => (
                        <tr key={c.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => navigate('/contracts')}>
                          <td className="px-3 py-2 font-mono text-xs text-emerald-700">{c.trackingId || c.id?.slice(0, 8)}</td>
                          <td className="px-3 py-2 font-semibold">{c.crop || 'N/A'}</td>
                          <td className="px-3 py-2">{Number(c.totalQuantityKg || 0).toLocaleString()} kg</td>
                          <td className="px-3 py-2 font-bold text-emerald-700">{Number(c.totalValue || 0).toLocaleString()} RWF</td>
                          <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${c.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : c.status === 'Disputed' ? 'bg-red-50 text-red-700' : c.status === 'Completed' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>{c.status}</span></td>
                          <td className="px-3 py-2 text-xs text-slate-500">{c.buyer || 'N/A'}</td>
                          <td className="px-3 py-2 text-xs text-slate-400">{c.createdAt ? new Date(c.createdAt).toLocaleDateString() : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {contractsData.length === 0 && <p className="py-6 text-center text-sm text-slate-400">No contracts found.</p>}
                </div>
              </Card>
            </div>
          )}

          {activeTab === 'live' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {liveOpsTiles.map((tile) => (
                  <Card key={tile.label} className={`p-4 bg-gradient-to-br ${tile.tone} text-white`}>
                    <p className="text-xs uppercase tracking-widest text-white/70">{tile.label}</p>
                    <p className="mt-2 text-2xl font-black">{tile.value}</p>
                  </Card>
                ))}
              </div>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <PriceChart title="Live alert severity stream" data={alertsBySeverity.map((p) => ({ name: p.name, value: Number(p.value) }))} />
                <PriceChart title="Role load distribution" data={roleData.map((p) => ({ name: p.name, value: Number(p.value) }))} />
                <PriceChart title="Model RMSE (live)" data={modelErrorData} />
              </div>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Card className="p-5">
                  <h3 className="text-lg font-black text-slate-900">National alert command stream</h3>
                  <div className="mt-4 max-h-80 space-y-2 overflow-y-auto">
                    {alertsFeed.slice(0, 40).map((a: any) => (
                      <div key={a.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                        <p className="text-sm font-bold text-slate-800">{a.title}</p>
                        <p className="text-xs text-slate-500">{a.severity} • {a.alertType} • {a.region || a.crop || 'National'} • {a.status}</p>
                      </div>
                    ))}
                  </div>
                </Card>
                <Card className="p-5">
                  <h3 className="text-lg font-black text-slate-900">Operational mission board</h3>
                  <div className="mt-4 space-y-2">
                    {(recommendationsFeed || []).slice(0, 12).map((r: any, idx: number) => (
                      <div key={`${r.title || 'task'}-${idx}`} className="rounded-xl border border-slate-200 px-3 py-2.5">
                        <p className="text-sm font-bold text-slate-800">{r.title || 'AI action item'}</p>
                        <p className="text-xs text-slate-500">{r.description || r.action || 'No detail'}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          )}
          {editUser && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
              <div className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl">
                <h3 className="text-lg font-black text-slate-900">Edit user</h3>
                <div className="mt-4 grid grid-cols-1 gap-3">
                  <Input label="Full name" value={editUser.fullName} onChange={(e) => setEditUser((p) => (p ? { ...p, fullName: e.target.value } : p))} />
                  <Input label="Email" value={editUser.email} onChange={(e) => setEditUser((p) => (p ? { ...p, email: e.target.value } : p))} />
                  <Input label="Phone" value={editUser.phone} onChange={(e) => setEditUser((p) => (p ? { ...p, phone: e.target.value } : p))} />
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold text-slate-600">Role</span>
                    <select className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" value={editUser.role} onChange={(e) => setEditUser((p) => (p ? { ...p, role: e.target.value } : p))}>
                      {['Farmer', 'CooperativeManager', 'Buyer', 'Transporter', 'StorageOperator', 'MarketAgent', 'Government', 'Admin'].map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </label>
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <input type="checkbox" checked={editUser.isActive} onChange={(e) => setEditUser((p) => (p ? { ...p, isActive: e.target.checked } : p))} />
                    Active user
                  </label>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
                  <Button onClick={saveUserEdit}>Save changes</Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </DashboardShell>
  );
};
