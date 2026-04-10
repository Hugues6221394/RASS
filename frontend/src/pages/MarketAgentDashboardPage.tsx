import { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, BarChart3, Download, Globe, LayoutDashboard, MapPin, PlusCircle, Search, TrendingUp } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { DashboardShell } from '../components/layout/DashboardShell';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Loader } from '../components/ui/Loader';
import { PriceChart } from '../components/charts/PriceChart';
import { RoleAIAnalyticsPanel } from '../components/RoleAIAnalyticsPanel';
import { NationalMarketPulsePanel } from '../components/NationalMarketPulsePanel';
import { RoleAssistantCard } from '../components/RoleAssistantCard';
import { useRegisteredMarkets } from '../hooks/useRegisteredMarkets';
import { CropSelector } from '../components/forms/CropSelector';
import { KpiBanner } from '../components/ui/KpiBanner';
import { MiniDonut } from '../components/charts/MiniDonut';
import { HorizontalBars } from '../components/charts/HorizontalBars';
import { exportReportCsv } from '../utils/exportCsv';

type Tab = 'overview' | 'submit' | 'submissions' | 'regional' | 'reports' | 'ai-assistant';

export const MarketAgentDashboardPage = () => {
  const { user, logout } = useAuth();
  const { markets } = useRegisteredMarkets();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [recentPrices, setRecentPrices] = useState<any[]>([]);
  const [regionalData, setRegionalData] = useState<any[]>([]);
  const [priceForm, setPriceForm] = useState({ market: '', crop: '', pricePerKg: '', observedAt: '' });
  const [regValidation, setRegValidation] = useState<any>(null);
  const [nationalTrends, setNationalTrends] = useState<any>(null);
  const [trendFilter, setTrendFilter] = useState({ crop: '', region: '', days: '90' });
  const [trendLoading, setTrendLoading] = useState(false);
  const [marketReports, setMarketReports] = useState<any[]>([]);
  const [reportForm, setReportForm] = useState({ market: '', reportType: 'PriceAnomaly', severity: 'Medium', description: '', affectedCrops: '' });

  const loadData = async () => {
    setLoading(true);
    const [dashboardRes, pricesRes, regionalRes, reportsRes] = await Promise.all([
      api.get('/api/market-agents/dashboard').catch(() => ({ data: { stats: null } })),
      api.get('/api/market-agents/prices').catch(() => ({ data: [] })),
      api.get('/api/market-agents/regional-comparison').catch(() => ({ data: [] })),
      api.get('/api/market-agents/reports').catch(() => ({ data: [] })),
    ]);
    setStats(dashboardRes.data?.stats || null);
    setRecentPrices(Array.isArray(pricesRes.data) ? pricesRes.data : []);
    setRegionalData(Array.isArray(regionalRes.data) ? regionalRes.data : []);
    setMarketReports(Array.isArray(reportsRes.data) ? reportsRes.data : []);
    setLoading(false);
  };

  const loadNationalTrends = async () => {
    setTrendLoading(true);
    const params = new URLSearchParams();
    if (trendFilter.crop) params.set('crop', trendFilter.crop);
    if (trendFilter.region) params.set('region', trendFilter.region);
    params.set('days', trendFilter.days || '90');
    const res = await api.get(`/api/market-agents/national-trends?${params.toString()}`).catch(() => ({ data: null }));
    setNationalTrends(res.data);
    setTrendLoading(false);
  };

  const submitReport = async () => {
    await api.post('/api/market-agents/reports', reportForm);
    setReportForm({ market: '', reportType: 'PriceAnomaly', severity: 'Medium', description: '', affectedCrops: '' });
    await loadData();
  };

  useEffect(() => {
    loadData();
  }, []);

  const selectedMarket = markets.find((option) => option.name === priceForm.market);
  const validatePrice = async (crop: string, pricePerKg: string, marketName: string) => {
    const marketMeta = markets.find((option) => option.name === marketName);
    if (!crop || !pricePerKg || !marketMeta) {
      setRegValidation(null);
      return;
    }

    const params = new URLSearchParams({
      crop,
      price: pricePerKg,
      region: marketMeta.province,
      district: marketMeta.district,
      market: marketMeta.name,
    });

    try {
      const response = await api.get(`/api/price-regulations/validate?${params.toString()}`);
      setRegValidation(response.data);
    } catch {
      setRegValidation(null);
    }
  };

  const submitPrice = async () => {
    await api.post('/api/market-agents/prices', {
      market: priceForm.market,
      crop: priceForm.crop,
      pricePerKg: Number(priceForm.pricePerKg),
      observedAt: priceForm.observedAt || null,
    });
    setPriceForm({ market: '', crop: '', pricePerKg: '', observedAt: '' });
    await loadData();
  };

  const correctPrice = async (id: string, currentPrice: number) => {
    await api.put(`/api/market-agents/prices/${id}`, { pricePerKg: Number(currentPrice), notes: 'Manual correction' });
    await loadData();
  };

  const removePrice = async (id: string) => {
    await api.delete(`/api/market-agents/prices/${id}`);
    await loadData();
  };

  if (loading) return <Loader label="Loading market agent dashboard..." />;

  return (
    <DashboardShell
      brand="RASS Market Agent"
      subtitle="Field intelligence"
      title="Market agent dashboard"
      activeKey={activeTab}
      navItems={[
        { key: 'overview', label: 'Overview', icon: <LayoutDashboard className="h-4 w-4" /> },
        { key: 'submit', label: 'Submit price', icon: <PlusCircle className="h-4 w-4" /> },
        { key: 'submissions', label: 'My submissions', icon: <Search className="h-4 w-4" /> },
        { key: 'regional', label: 'National intelligence', icon: <TrendingUp className="h-4 w-4" /> },
        { key: 'reports', label: 'Market reports', icon: <AlertTriangle className="h-4 w-4" /> },
        { key: 'ai-assistant', label: 'AI Assistant', icon: <BarChart3 className="h-4 w-4" /> },
      ]}
      onNavChange={(k) => setActiveTab(k as Tab)}
      onLogout={logout}
      rightStatus={user?.fullName || 'Market agent'}
    >
      <div className="space-y-6">
        {activeTab === 'overview' && (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <KpiBanner icon={<PlusCircle className="h-5 w-5 text-white" />} label="Today" value={stats?.todaySubmissions ?? 0} sub="Price submissions today" color="emerald" onClick={() => setActiveTab('submit')} />
              <KpiBanner icon={<MapPin className="h-5 w-5 text-white" />} label="Markets" value={stats?.marketsCovered ?? 0} sub={`${markets.length} registered markets`} color="blue" />
              <KpiBanner icon={<BarChart3 className="h-5 w-5 text-white" />} label="Total submissions" value={stats?.totalPriceSubmissions ?? 0} sub="All-time price records" color="violet" onClick={() => setActiveTab('submissions')} />
              <KpiBanner icon={<Globe className="h-5 w-5 text-white" />} label="Regional signals" value={regionalData.length} sub="Province-level price data" color="teal" onClick={() => setActiveTab('regional')} />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Card className="p-5">
                <MiniDonut
                  title="Verification status"
                  slices={[
                    { label: 'Approved', value: recentPrices.filter((p: any) => p.verificationStatus === 'Approved').length, color: '#059669' },
                    { label: 'Pending', value: recentPrices.filter((p: any) => !p.verificationStatus || p.verificationStatus === 'Pending').length, color: '#94a3b8' },
                    { label: 'Flagged', value: recentPrices.filter((p: any) => p.verificationStatus === 'Flagged').length, color: '#f59e0b' },
                    { label: 'Rejected', value: recentPrices.filter((p: any) => p.verificationStatus === 'Rejected').length, color: '#ef4444' },
                  ].filter(s => s.value > 0)}
                />
              </Card>
              <Card className="p-5 lg:col-span-2">
                <HorizontalBars
                  title="Prices by crop (recent submissions)"
                  unit="RWF/kg"
                  bars={(() => {
                    const grouped: Record<string, { sum: number; count: number }> = {};
                    recentPrices.forEach((p: any) => {
                      const key = p.crop || 'Other';
                      if (!grouped[key]) grouped[key] = { sum: 0, count: 0 };
                      grouped[key].sum += Number(p.pricePerKg || 0);
                      grouped[key].count += 1;
                    });
                    return Object.entries(grouped)
                      .map(([label, { sum, count }]) => ({ label, value: Math.round(sum / count), sub: `${count} records`, color: undefined }))
                      .sort((a, b) => b.value - a.value)
                      .slice(0, 6)
                      .map((b, i) => ({ ...b, color: ['#059669', '#0891b2', '#7c3aed', '#ea580c', '#dc2626', '#64748b'][i] }));
                  })()}
                />
              </Card>
            </div>

            <Card className="p-5">
              <h3 className="text-sm font-bold text-slate-800 mb-3">Recent price submissions</h3>
              <div className="space-y-2">
                {recentPrices.slice(0, 6).map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2.5">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                        p.verificationStatus === 'Approved' ? 'bg-emerald-100 text-emerald-700' :
                        p.verificationStatus === 'Flagged' ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-500'
                      }`}>
                        <BarChart3 className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{p.crop} - {p.market}</p>
                        <p className="text-[10px] text-slate-500">{new Date(p.observedAt || Date.now()).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-emerald-700">{Number(p.pricePerKg || 0).toLocaleString()} RWF/kg</p>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        p.verificationStatus === 'Approved' ? 'bg-emerald-50 text-emerald-700' :
                        p.verificationStatus === 'Flagged' ? 'bg-amber-50 text-amber-700' :
                        p.verificationStatus === 'Rejected' ? 'bg-red-50 text-red-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>{p.verificationStatus || 'Pending'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <RoleAIAnalyticsPanel contextData={{ recentPrices, regionalData, dashboard: stats }} />
            <NationalMarketPulsePanel title="Market intelligence pulse" />
          </>
        )}

        {activeTab === 'submit' && (
          <Card className="p-5">
            <h3 className="text-lg font-black text-slate-900">Submit market price</h3>
            <p className="mt-1 text-xs text-slate-500">Market selection now carries district and province context so the regulation check matches the exact trading zone.</p>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Market</label>
                <select
                  value={priceForm.market}
                  onChange={(e) => {
                    const nextMarket = e.target.value;
                    setPriceForm((p) => ({ ...p, market: nextMarket }));
                    void validatePrice(priceForm.crop, priceForm.pricePerKg, nextMarket);
                  }}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                >
                  <option value="">Select market</option>
                  {markets.map((option) => (
                    <option key={option.id} value={option.name}>{option.name}</option>
                  ))}
                </select>
                {selectedMarket && (
                  <p className="mt-1 text-xs text-slate-500">{selectedMarket.district} • {selectedMarket.sector} • {selectedMarket.province}</p>
                )}
              </div>
              <CropSelector
                value={priceForm.crop}
                onChange={(nextCrop) => {
                  setPriceForm((p) => ({ ...p, crop: nextCrop }));
                  void validatePrice(nextCrop, priceForm.pricePerKg, priceForm.market);
                }}
                label="Crop"
                allowCustom
              />
              <div>
                <Input label="Price per kg (RWF)" type="number" value={priceForm.pricePerKg} onChange={(e) => {
                  const val = e.target.value;
                  setPriceForm((p) => ({ ...p, pricePerKg: val }));
                  void validatePrice(priceForm.crop, val, priceForm.market);
                }} />
                {regValidation && regValidation.allowed === false && (
                  <p className="mt-1 text-xs text-red-600 font-semibold">RURA: {regValidation.message}</p>
                )}
                {regValidation && regValidation.allowed && regValidation.regulation && (
                  <p className="mt-1 text-xs text-emerald-600">Regulated range: {regValidation.regulation.minPricePerKg ? `${Number(regValidation.regulation.minPricePerKg).toLocaleString()}` : '—'}–{regValidation.regulation.maxPricePerKg ? `${Number(regValidation.regulation.maxPricePerKg).toLocaleString()}` : '—'} RWF/kg</p>
                )}
              </div>
              <Input label="Observed at" type="datetime-local" value={priceForm.observedAt} onChange={(e) => setPriceForm((p) => ({ ...p, observedAt: e.target.value }))} />
            </div>
            <div className="mt-4"><Button onClick={submitPrice} disabled={!priceForm.market || !priceForm.crop || !priceForm.pricePerKg}>Submit price</Button></div>
          </Card>
        )}

        {activeTab === 'submissions' && (
          <Card className="p-5">
            <h3 className="text-lg font-black text-slate-900">Submitted prices</h3>
            <div className="mt-4 space-y-2">
              {recentPrices.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-semibold">{p.crop} • {p.market}</p>
                    <p className="text-xs text-slate-500">{new Date(p.observedAt || p.createdAt || Date.now()).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      p.verificationStatus === 'Approved' ? 'bg-emerald-50 text-emerald-700' :
                      p.verificationStatus === 'Flagged' ? 'bg-amber-50 text-amber-700' :
                      p.verificationStatus === 'Rejected' ? 'bg-red-50 text-red-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {p.verificationStatus || 'Pending'}
                    </span>
                    {p.moderationNote && <span className="text-xs text-slate-500" title={p.moderationNote}>note</span>}
                    <p className="text-sm font-semibold">{Number(p.pricePerKg || 0).toLocaleString()} RWF/kg</p>
                    <Button size="sm" variant="outline" onClick={() => correctPrice(p.id, Number(p.pricePerKg || 0))}>Correct</Button>
                    <Button size="sm" variant="danger" onClick={() => removePrice(p.id)}>Delete</Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {activeTab === 'regional' && (
          <div className="space-y-5">
            {/* National Intelligence Header */}
            <div className="rounded-2xl bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-8 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-300">National market intelligence</p>
              <h2 className="mt-2 text-2xl font-black">Price trends, regional analysis & AI insights</h2>
              <p className="mt-1 text-sm text-slate-400">Aggregated data from all market agents, with district-level breakdowns, volatility analysis, and AI-powered forecasting signals.</p>
            </div>

            {/* Filters */}
            <Card className="p-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                <Input label="Crop filter" value={trendFilter.crop} onChange={(e) => setTrendFilter((p) => ({ ...p, crop: e.target.value }))} placeholder="e.g. Maize" />
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-slate-600">Region</span>
                  <select className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" value={trendFilter.region} onChange={(e) => setTrendFilter((p) => ({ ...p, region: e.target.value }))}>
                    <option value="">All regions</option>
                    {['Kigali City', 'Northern', 'Southern', 'Eastern', 'Western'].map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-slate-600">Time range</span>
                  <select className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" value={trendFilter.days} onChange={(e) => setTrendFilter((p) => ({ ...p, days: e.target.value }))}>
                    <option value="7">Last 7 days</option>
                    <option value="30">Last 30 days</option>
                    <option value="90">Last 90 days</option>
                    <option value="180">Last 6 months</option>
                    <option value="365">Last year</option>
                  </select>
                </label>
                <div className="flex items-end">
                  <Button className="w-full" onClick={loadNationalTrends} disabled={trendLoading}>{trendLoading ? 'Loading...' : 'Analyze trends'}</Button>
                </div>
                <div className="flex items-end">
                  <Button variant="outline" className="w-full" onClick={() => { setTrendFilter({ crop: '', region: '', days: '90' }); setNationalTrends(null); }}>Reset</Button>
                </div>
              </div>
            </Card>

            {nationalTrends ? (
              <>
                {/* Summary KPIs */}
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <Card className="p-4 text-center bg-gradient-to-br from-emerald-700 to-emerald-500 text-white">
                    <p className="text-[10px] uppercase tracking-wider text-emerald-100">Total submissions</p>
                    <p className="mt-1 text-2xl font-black">{Number(nationalTrends.summary?.totalSubmissions || 0).toLocaleString()}</p>
                  </Card>
                  <Card className="p-4 text-center bg-gradient-to-br from-blue-700 to-blue-500 text-white">
                    <p className="text-[10px] uppercase tracking-wider text-blue-100">Markets covered</p>
                    <p className="mt-1 text-2xl font-black">{Number(nationalTrends.summary?.totalMarkets || 0)}</p>
                  </Card>
                  <Card className="p-4 text-center bg-gradient-to-br from-violet-700 to-violet-500 text-white">
                    <p className="text-[10px] uppercase tracking-wider text-violet-100">Active agents</p>
                    <p className="mt-1 text-2xl font-black">{Number(nationalTrends.summary?.totalAgents || 0)}</p>
                  </Card>
                  <Card className="p-4 text-center bg-gradient-to-br from-amber-700 to-amber-500 text-white">
                    <p className="text-[10px] uppercase tracking-wider text-amber-100">Analysis period</p>
                    <p className="mt-1 text-2xl font-black">{nationalTrends.summary?.periodDays || 0}d</p>
                  </Card>
                </div>

                {/* Time Series Chart */}
                {nationalTrends.timeSeries?.length > 0 && (
                  <PriceChart
                    title="Price trends over time (daily averages)"
                    data={nationalTrends.timeSeries.map((t: any) => ({ name: String(t.date || '').slice(5, 10), value: Math.round(Number(t.avgPrice || 0)) }))}
                  />
                )}

                {/* Regional + Crop Breakdown */}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {/* By Region */}
                  <Card className="p-5">
                    <h3 className="text-base font-black text-slate-900">Regional price comparison</h3>
                    <p className="mt-1 text-xs text-slate-500">Average prices across Rwanda's 5 provinces</p>
                    <div className="mt-4 space-y-3">
                      {(nationalTrends.byRegion || []).map((r: any) => (
                        <div key={r.region} className="rounded-xl border border-slate-200 p-3">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-bold text-slate-900">{r.region}</p>
                            <p className="text-sm font-black text-emerald-700">{Math.round(Number(r.avgPrice || 0)).toLocaleString()} RWF/kg</p>
                          </div>
                          <div className="mt-1 flex items-center gap-3 text-[10px] text-slate-500">
                            <span>Min: {Math.round(Number(r.minPrice || 0)).toLocaleString()}</span>
                            <span>Max: {Math.round(Number(r.maxPrice || 0)).toLocaleString()}</span>
                            <span>{r.count} records</span>
                          </div>
                          <div className="mt-1.5 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, (Number(r.avgPrice || 0) / Math.max(...(nationalTrends.byRegion || []).map((x: any) => Number(x.avgPrice || 1)), 1)) * 100)}%` }} />
                          </div>
                        </div>
                      ))}
                      {(nationalTrends.byRegion || []).length === 0 && <p className="text-xs text-slate-400">No regional data</p>}
                    </div>
                  </Card>

                  {/* By Crop */}
                  <Card className="p-5">
                    <h3 className="text-base font-black text-slate-900">Crop price analysis</h3>
                    <p className="mt-1 text-xs text-slate-500">Top crops by submission frequency and pricing</p>
                    <div className="mt-4 space-y-3">
                      {(nationalTrends.byCrop || []).slice(0, 10).map((c: any) => (
                        <div key={c.crop} className="rounded-xl border border-slate-200 p-3">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-bold text-slate-900">{c.crop}</p>
                            <p className="text-sm font-black text-blue-700">{Math.round(Number(c.avgPrice || 0)).toLocaleString()} RWF/kg</p>
                          </div>
                          <div className="mt-1 flex items-center gap-3 text-[10px] text-slate-500">
                            <span>Range: {Math.round(Number(c.minPrice || 0)).toLocaleString()}–{Math.round(Number(c.maxPrice || 0)).toLocaleString()}</span>
                            <span>{c.count} records</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>

                {/* District-level Breakdown */}
                {(nationalTrends.byDistrict || []).length > 0 && (
                  <Card className="p-5">
                    <h3 className="text-base font-black text-slate-900">District-level price intelligence</h3>
                    <p className="mt-1 text-xs text-slate-500">Granular pricing data at the district level — essential for identifying local price anomalies and arbitrage opportunities.</p>
                    <div className="mt-4 max-h-80 overflow-auto rounded-xl border border-slate-200">
                      <table className="min-w-full text-sm">
                        <thead className="sticky top-0 bg-slate-100">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Region</th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">District</th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Avg Price</th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Min</th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Max</th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Records</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(nationalTrends.byDistrict || []).map((d: any, i: number) => (
                            <tr key={i} className="hover:bg-slate-50">
                              <td className="px-3 py-2 text-xs text-slate-500">{d.region}</td>
                              <td className="px-3 py-2 font-semibold">{d.district}</td>
                              <td className="px-3 py-2 font-bold text-emerald-700">{Math.round(Number(d.avgPrice || 0)).toLocaleString()} RWF</td>
                              <td className="px-3 py-2 text-slate-600">{Math.round(Number(d.minPrice || 0)).toLocaleString()}</td>
                              <td className="px-3 py-2 text-slate-600">{Math.round(Number(d.maxPrice || 0)).toLocaleString()}</td>
                              <td className="px-3 py-2">{d.count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                )}

                {/* Volatility Analysis */}
                {(nationalTrends.volatility || []).length > 0 && (
                  <Card className="p-5">
                    <h3 className="text-base font-black text-slate-900">Price volatility analysis</h3>
                    <p className="mt-1 text-xs text-slate-500">Crops ranked by price spread — higher volatility indicates unstable markets requiring agent attention.</p>
                    <div className="mt-4 space-y-3">
                      {(nationalTrends.volatility || []).map((v: any) => (
                        <div key={v.crop} className="rounded-xl border border-slate-200 p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-bold text-slate-900">{v.crop}</p>
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${Number(v.volatilityPct) > 40 ? 'bg-red-50 text-red-700' : Number(v.volatilityPct) > 20 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                                {Number(v.volatilityPct) > 40 ? 'HIGH' : Number(v.volatilityPct) > 20 ? 'MODERATE' : 'STABLE'} ({v.volatilityPct}%)
                              </span>
                            </div>
                            <p className="text-xs text-slate-500">{Math.round(Number(v.minPrice || 0)).toLocaleString()} – {Math.round(Number(v.maxPrice || 0)).toLocaleString()} RWF/kg</p>
                          </div>
                          <div className="mt-2 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                            <div className={`h-full rounded-full ${Number(v.volatilityPct) > 40 ? 'bg-red-500' : Number(v.volatilityPct) > 20 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, Number(v.volatilityPct))}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {/* AI Insights */}
                <Card className="p-5 border-blue-200 bg-blue-50">
                  <h3 className="text-base font-black text-blue-900">AI-generated market insights</h3>
                  <div className="mt-3 space-y-2">
                    {(nationalTrends.byRegion || []).length > 1 && (() => {
                      const sorted = [...(nationalTrends.byRegion || [])].sort((a: any, b: any) => Number(b.avgPrice || 0) - Number(a.avgPrice || 0));
                      const highest = sorted[0];
                      const lowest = sorted[sorted.length - 1];
                      const spread = highest && lowest ? Math.round(Number(highest.avgPrice || 0) - Number(lowest.avgPrice || 0)) : 0;
                      return (
                        <>
                          <p className="text-sm text-blue-800"><strong>Regional spread:</strong> {spread.toLocaleString()} RWF/kg between {highest?.region} (highest) and {lowest?.region} (lowest). {spread > 100 ? 'This spread suggests significant arbitrage opportunity.' : 'Markets are relatively aligned.'}</p>
                          {(nationalTrends.volatility || []).filter((v: any) => Number(v.volatilityPct) > 30).length > 0 && (
                            <p className="text-sm text-blue-800"><strong>Volatile crops:</strong> {(nationalTrends.volatility || []).filter((v: any) => Number(v.volatilityPct) > 30).map((v: any) => v.crop).join(', ')} show high price volatility — recommend increased monitoring frequency.</p>
                          )}
                          {nationalTrends.timeSeries?.length > 2 && (() => {
                            const recent = nationalTrends.timeSeries.slice(-3);
                            const trend = recent.length > 1 ? Number(recent[recent.length - 1].avgPrice || 0) - Number(recent[0].avgPrice || 0) : 0;
                            return <p className="text-sm text-blue-800"><strong>Short-term trend:</strong> Prices are {trend > 0 ? 'rising' : trend < 0 ? 'declining' : 'stable'} ({trend > 0 ? '+' : ''}{Math.round(trend).toLocaleString()} RWF/kg over last 3 data points).</p>;
                          })()}
                        </>
                      );
                    })()}
                    {(nationalTrends.byRegion || []).length <= 1 && <p className="text-sm text-blue-800">Insufficient data for AI analysis. Submit more prices across different regions to enable trend detection.</p>}
                  </div>
                </Card>
              </>
            ) : (
              <Card className="p-8 text-center">
                <TrendingUp className="mx-auto h-12 w-12 text-slate-200" />
                <p className="mt-3 text-sm font-semibold text-slate-500">Click "Analyze trends" to load national market intelligence</p>
                <p className="mt-1 text-xs text-slate-400">Configure filters above to focus on specific crops, regions, or time ranges.</p>
              </Card>
            )}

            {/* Regional comparison from existing data */}
            {regionalData.length > 0 && (
              <Card className="p-5">
                <h3 className="text-base font-black text-slate-900">Quick regional view (last 30 days)</h3>
                <div className="mt-4 space-y-3">
                  {['Kigali City', 'Northern', 'Southern', 'Eastern', 'Western'].map((region) => {
                    const regionRows = regionalData.filter((r: any) => r.region === region);
                    if (regionRows.length === 0) return null;
                    return (
                      <div key={region}>
                        <p className="text-xs font-black uppercase tracking-widest text-emerald-700 mb-2">{region}</p>
                        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                          {regionRows.map((r: any, idx: number) => (
                            <div key={idx} className="rounded-xl border border-slate-200 px-3 py-2.5">
                              <p className="text-sm font-semibold">{r.market || 'Market'}</p>
                              <p className="text-xs text-slate-500">
                                Avg: {Number(r.avgPrice || 0).toLocaleString()} • Min: {Number(r.minPrice || 0).toLocaleString()} • Max: {Number(r.maxPrice || 0).toLocaleString()} • {r.priceCount || 0} rec
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            <RoleAssistantCard
              title="Market Intelligence AI"
              intro="I analyze price patterns, detect anomalies across regions, and provide actionable intelligence for market agents and policy makers."
              placeholder="Ask about price trends, regional disparities, volatility patterns, or market anomalies..."
            />
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="space-y-5">
            {/* Export section */}
            <Card className="p-5 bg-gradient-to-r from-[#002D15] to-[#00793E] text-white">
              <h3 className="text-lg font-black">Export reports</h3>
              <p className="mt-1 text-xs text-emerald-200">Download CSV/Excel files of your price submissions and market data.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={() => exportReportCsv('prices')} className="inline-flex items-center gap-1.5 rounded-lg bg-white/20 px-3 py-1.5 text-xs font-bold hover:bg-white/30 transition">
                  <Download className="h-3.5 w-3.5" /> Price submissions
                </button>
                <button onClick={() => exportReportCsv('listings')} className="inline-flex items-center gap-1.5 rounded-lg bg-white/20 px-3 py-1.5 text-xs font-bold hover:bg-white/30 transition">
                  <Download className="h-3.5 w-3.5" /> Market listings
                </button>
              </div>
            </Card>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card className="p-5">
                <h3 className="text-lg font-black text-slate-900">Submit market report</h3>
                <p className="mt-1 text-xs text-slate-500">Report anomalies, supply disruptions, or market conditions to government oversight.</p>
                <div className="mt-4 space-y-3">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold text-slate-600">Market</span>
                    <select className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" value={reportForm.market} onChange={(e) => setReportForm((p) => ({ ...p, market: e.target.value }))}>
                      <option value="">Select market</option>
                      {markets.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold text-slate-600">Report type</span>
                    <select className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" value={reportForm.reportType} onChange={(e) => setReportForm((p) => ({ ...p, reportType: e.target.value }))}>
                      {['PriceAnomaly', 'SupplyDisruption', 'DemandSurge', 'QualityIssue', 'MarketClosure', 'Other'].map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold text-slate-600">Severity</span>
                    <select className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" value={reportForm.severity} onChange={(e) => setReportForm((p) => ({ ...p, severity: e.target.value }))}>
                      {['Low', 'Medium', 'High', 'Critical'].map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </label>
                  <Input label="Affected crops" value={reportForm.affectedCrops} onChange={(e) => setReportForm((p) => ({ ...p, affectedCrops: e.target.value }))} placeholder="e.g. Maize, Beans" />
                  <textarea className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" rows={3} placeholder="Describe the observation..." value={reportForm.description} onChange={(e) => setReportForm((p) => ({ ...p, description: e.target.value }))} />
                  <Button onClick={submitReport} disabled={!reportForm.market || !reportForm.description.trim()}>Submit report</Button>
                </div>
              </Card>
              <Card className="p-5">
                <h3 className="text-lg font-black text-slate-900">My submitted reports</h3>
                <div className="mt-4 max-h-96 space-y-2 overflow-y-auto">
                  {marketReports.map((r: any) => (
                    <div key={r.id} className="rounded-xl border border-slate-200 px-3 py-2.5">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-slate-800">{r.reportType} — {r.market}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${r.severity === 'Critical' ? 'bg-red-50 text-red-700' : r.severity === 'High' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{r.severity}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-600">{r.description}</p>
                      {r.affectedCrops && <p className="text-[10px] text-slate-400 mt-0.5">Crops: {r.affectedCrops}</p>}
                      <p className="text-[10px] text-slate-400">{r.createdAt ? new Date(r.createdAt).toLocaleString() : ''}</p>
                    </div>
                  ))}
                  {marketReports.length === 0 && <p className="py-6 text-center text-xs text-slate-400">No reports submitted yet.</p>}
                </div>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'ai-assistant' && (
          <RoleAssistantCard
            title="Market Agent AI Assistant"
            intro="I can help validate price submissions, detect anomalies, and highlight unstable markets requiring verification."
            placeholder="Ask about anomalies, unstable prices, or data quality checks..."
          />
        )}
      </div>
    </DashboardShell>
  );
};
