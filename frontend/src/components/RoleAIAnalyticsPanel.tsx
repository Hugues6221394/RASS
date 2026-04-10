import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { ResponsiveContainer, ComposedChart, CartesianGrid, XAxis, YAxis, Tooltip, Area, Line, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { useTranslation } from 'react-i18next';

type Metric = { key: string; label: string; value: number | string; unit?: string };
type Risk = { severity: string; title: string; detail: string };
type RoleAIContext = {
  orders?: any[];
  listings?: any[];
  contracts?: any[];
  farmers?: any[];
  inventory?: any[];
  harvests?: any[];
  payments?: any[];
  bookings?: any[];
  facilities?: any[];
  lots?: any[];
  availableJobs?: any[];
  myJobs?: any[];
  recentPrices?: any[];
  regionalData?: any[];
  dashboard?: any;
};

const toNumber = (value: unknown) => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const sanitizeAssistantText = (value: string) => value
  .replace(/^#{1,6}\s*/gm, '')
  .replace(/\*\*(.*?)\*\*/g, '$1')
  .replace(/^\s*[-*]\s+/gm, '• ')
  .replace(/^\s*\d+\.\s+/gm, '• ')
  .replace(/^\s*[-=]{3,}\s*$/gm, '')
  .replace(/\|/g, ' ')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

export const RoleAIAnalyticsPanel = ({ compact = false, contextData }: { compact?: boolean; contextData?: RoleAIContext }) => {
  const { t } = useTranslation();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [assistantQuestion, setAssistantQuestion] = useState('');
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantMessages, setAssistantMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([
    { role: 'assistant', text: t('role_ai_panel.assistant_ready', 'AI Insights is ready. Ask anything about your role performance, risks, and priorities.') },
  ]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await api.get('/api/role-analytics/summary');
        if (mounted) setData(res.data);
      } catch {
        if (mounted) setData(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const analytics = data ?? {};
  const metrics: Metric[] = Array.isArray(analytics.metrics) ? analytics.metrics : [];
  const risks: Risk[] = Array.isArray(analytics.risks) ? analytics.risks : [];
  const recommendations: string[] = Array.isArray(analytics.recommendations) ? analytics.recommendations : [];
  const forecastVsActual = Array.isArray(analytics.forecastVsActual) ? analytics.forecastVsActual : [];
  const confidenceBands = Array.isArray(analytics.confidenceBands) ? analytics.confidenceBands : [];
  const demandProjection = Array.isArray(analytics.demandProjection) ? analytics.demandProjection : [];
  const highRisks = risks.filter((r) => (r.severity || '').toLowerCase() === 'high').length;
  const mediumRisks = risks.filter((r) => (r.severity || '').toLowerCase() === 'medium').length;
  const lowRisks = Math.max(0, risks.length - highRisks - mediumRisks);
  const riskScore = clamp(highRisks * 35 + mediumRisks * 18 + lowRisks * 7);
  const role = String(analytics.role || '').toLowerCase();

  const statusDistribution = useMemo(() => {
    const rows = [
      ...(contextData?.orders || []),
      ...(contextData?.inventory || []),
      ...(contextData?.bookings || []),
      ...(contextData?.myJobs || []),
      ...(contextData?.harvests || []),
    ];
    const map = new Map<string, number>();
    rows.forEach((item: any) => {
      const status = String(item?.status || item?.state || 'Unknown');
      map.set(status, (map.get(status) || 0) + 1);
    });
    return Array.from(map.entries()).slice(0, 8).map(([name, count]) => ({ name, count }));
  }, [contextData]);

  const cropMix = useMemo(() => {
    const rows = [
      ...(contextData?.inventory || []),
      ...(contextData?.listings || []),
      ...(contextData?.orders || []),
      ...(contextData?.harvests || []),
      ...(contextData?.recentPrices || []),
      ...(demandProjection || []),
    ];
    const map = new Map<string, number>();
    rows.forEach((item: any) => {
      const crop = item?.crop || item?.name;
      if (!crop) return;
      const qty = toNumber(item?.quantityKg || item?.demandKg || item?.expectedQuantityKg || 1);
      map.set(String(crop), (map.get(String(crop)) || 0) + qty);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, value]) => ({ name, value }));
  }, [contextData, demandProjection]);

  const procurementBars = useMemo(() => {
    const orders = contextData?.orders || [];
    const listings = contextData?.listings || [];
    const openOrders = orders.filter((o: any) => String(o.status || '').toLowerCase() === 'open').length;
    const uniqueCrops = new Set(orders.map((o: any) => String(o.crop || '').toLowerCase()).filter(Boolean)).size;
    const contractCoverage = clamp(((contextData?.contracts?.length || 0) / Math.max(orders.length, 1)) * 100);
    const timingScore = clamp(100 - (openOrders / Math.max(orders.length, 1)) * 100);
    const varietyScore = clamp((uniqueCrops / Math.max(Math.min(listings.length, 8), 1)) * 100);
    const frequencyScore = clamp((orders.length / Math.max(listings.length, 1)) * 100);
    return [
      { label: 'Order Timing', value: Math.round(timingScore), color: '#059669', base: 100 },
      { label: 'Crop Variety', value: Math.round(varietyScore), color: '#1d4ed8', base: 100 },
      { label: 'Order Frequency', value: Math.round(frequencyScore), color: '#d97706', base: 100 },
      { label: 'Contract Coverage', value: Math.round(contractCoverage), color: '#7c3aed', base: 100 },
    ];
  }, [contextData]);

  const aiScore = useMemo(() => {
    const metricSignal = clamp(metrics.length * 8);
    const recommendationSignal = clamp(recommendations.length * 10);
    const forecastSignal = clamp(forecastVsActual.length * 4);
    const qualityPenalty = clamp(riskScore);
    return Math.round(clamp(30 + metricSignal + recommendationSignal + forecastSignal - qualityPenalty * 0.45));
  }, [forecastVsActual.length, metrics.length, recommendations.length, riskScore]);

  const commentaryBlocks = useMemo(() => {
    const comments = [];
    if ((contextData?.regionalData || []).length > 0) {
      comments.push({
        title: t('role_ai_panel.commentary.market_overview', 'Market Overview'),
        detail: t('role_ai_panel.commentary.market_overview_detail', 'Regional signals tracked: {{count}}. Variance is being monitored from live submissions.', { count: (contextData?.regionalData || []).length }),
        color: 'border-blue-200 bg-blue-50 text-blue-900',
      });
    }
    if ((contextData?.orders || []).length > 0) {
      const openOrders = (contextData?.orders || []).filter((o: any) => String(o.status || '').toLowerCase() === 'open').length;
      comments.push({
        title: t('role_ai_panel.commentary.operations_recommendation', 'Operations Recommendation'),
        detail: t('role_ai_panel.commentary.operations_recommendation_detail', '{{count}} open orders detected. Prioritize matching contracts and logistics for faster fulfillment.', { count: openOrders }),
        color: 'border-emerald-200 bg-emerald-50 text-emerald-900',
      });
    }
    if ((contextData?.bookings || []).length > 0) {
      const activeBookings = (contextData?.bookings || []).filter((b: any) => String(b.status || '').toLowerCase() !== 'released').length;
      comments.push({
        title: t('role_ai_panel.commentary.capacity_advisory', 'Capacity Advisory'),
        detail: t('role_ai_panel.commentary.capacity_advisory_detail', '{{count}} active bookings currently hold warehouse capacity. Release completed slots quickly to optimize turnover.', { count: activeBookings }),
        color: 'border-amber-200 bg-amber-50 text-amber-900',
      });
    }
    if (recommendations[0]) {
      comments.push({
        title: t('role_ai_panel.commentary.ai_priority', 'AI Priority'),
        detail: recommendations[0],
        color: 'border-slate-200 bg-slate-50 text-slate-900',
      });
    }
    return comments.slice(0, 4);
  }, [contextData, recommendations]);

  const pieColors = ['#16a34a', '#2563eb', '#d97706', '#7c3aed', '#0f766e'];
  const quickPrompts = useMemo(() => {
    if ((role.includes('buyer') || (contextData?.orders || []).length > 0)) {
      return [
        t('role_ai_panel.quick_prompts.buy_week', 'What should I buy this week?'),
        t('role_ai_panel.quick_prompts.reduce_open_orders', 'How do I reduce open orders?'),
        t('role_ai_panel.quick_prompts.contract_action', 'What contracts need action now?'),
      ];
    }
    return [
      t('role_ai_panel.quick_prompts.prioritize_today', 'What should I prioritize today?'),
      t('role_ai_panel.quick_prompts.top_risks', 'Show top risks and fixes'),
      t('role_ai_panel.quick_prompts.short_plan', 'Give a short action plan'),
    ];
  }, [contextData, role, t]);

  const askAssistant = async () => {
    const question = assistantQuestion.trim();
    if (!question || assistantLoading) return;
    setAssistantMessages((prev) => [...prev, { role: 'user', text: question }]);
    setAssistantQuestion('');
    setAssistantLoading(true);
    try {
      const res = await api.post('/api/role-analytics/assistant', { question });
      const answer = sanitizeAssistantText(String(res.data?.answer || t('role_ai_panel.no_response', 'No response available.')));
      setAssistantMessages((prev) => [...prev, { role: 'assistant', text: answer }]);
    } catch (e: any) {
      const err = String(e?.response?.data || e?.message || t('shared.assistant_unavailable', 'Assistant is temporarily unavailable.'));
      setAssistantMessages((prev) => [...prev, { role: 'assistant', text: err }]);
    } finally {
      setAssistantLoading(false);
    }
  };

  if (loading) return <div className="glass-panel p-6">{t('role_ai_panel.loading', 'Loading AI analytics...')}</div>;
  if (!data) return <div className="glass-panel p-6 text-slate-400">{t('role_ai_panel.unavailable', 'AI analytics are currently unavailable.')}</div>;

  return (
    <div className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-black text-slate-900 tracking-tight">{t('role_ai_panel.title', 'AI Operational Intelligence')}</h3>
        <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-[10px] uppercase tracking-widest font-bold text-emerald-700">
          {analytics.role || t('role_ai_panel.role', 'Role')} • {t('role_ai_panel.live', 'Live')}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3">
          <p className="text-[10px] uppercase tracking-widest text-emerald-700 font-bold">{t('role_ai_panel.signals_processed', 'Signals Processed')}</p>
          <p className="text-xl font-black text-slate-900 mt-1">{metrics.length + risks.length + recommendations.length + statusDistribution.length}</p>
        </div>
        <div className="rounded-xl bg-amber-50 border border-amber-100 p-3">
          <p className="text-[10px] uppercase tracking-widest text-amber-700 font-bold">{t('role_ai_panel.risk_score', 'Risk Score')}</p>
          <p className="text-xl font-black text-slate-900 mt-1">{riskScore}/100</p>
        </div>
        <div className="rounded-xl bg-blue-50 border border-blue-100 p-3">
          <p className="text-[10px] uppercase tracking-widest text-blue-700 font-bold">{t('role_ai_panel.recommended_actions', 'Recommended Actions')}</p>
          <p className="text-xl font-black text-slate-900 mt-1">{recommendations.length}</p>
        </div>
      </div>

      {(role.includes('buyer') || (contextData?.orders || []).length > 0) && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[180px_1fr] rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-col items-center justify-center">
            <div
              className="grid h-28 w-28 place-items-center rounded-full text-slate-900"
              style={{
                background: `conic-gradient(#f59e0b ${aiScore * 3.6}deg, #e5e7eb 0deg)`,
              }}
            >
              <div className="grid h-20 w-20 place-items-center rounded-full bg-white">
                <div className="text-center">
                  <p className="text-3xl font-black leading-none">{aiScore}</p>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">/ 100</p>
                </div>
              </div>
            </div>
            <p className="mt-2 text-xs font-semibold text-slate-600">{t('role_ai_panel.procurement_score', 'AI Procurement Score')}</p>
          </div>
          <div className="space-y-2">
            {procurementBars.map((bar) => (
              <div key={bar.label}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">{bar.label}</span>
                  <span className="font-bold text-slate-700">{bar.value}/{bar.base}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-200">
                  <div className="h-2 rounded-full" style={{ width: `${bar.value}%`, backgroundColor: bar.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={`grid ${compact ? 'grid-cols-2' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'} gap-3`}>
        {metrics.map((m) => (
          <div key={m.key} className="rounded-xl bg-slate-50 border border-slate-200 p-3">
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">{m.label}</p>
            <p className="text-xl font-black text-slate-900 mt-1">{m.value}{m.unit ? ` ${m.unit}` : ''}</p>
          </div>
        ))}
      </div>

      {!compact && (
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
          <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2">{t('role_ai_panel.summary_title', 'Comprehensive Insight Summary')}</p>
          <p className="text-sm text-slate-700">
            {t('role_ai_panel.summary_body', 'This AI panel combines operational metrics, detected risks, and prioritized recommendations for the current role. As marketplace, inventory, contracts, and logistics data changes, these results are recalculated to keep decisions data-driven.')}
          </p>
        </div>
      )}

      {!compact && commentaryBlocks.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-3 text-sm font-black text-slate-900">{t('role_ai_panel.market_commentary', 'AI Market Commentary')}</p>
          <div className="space-y-2">
            {commentaryBlocks.map((item, idx) => (
              <div key={`${item.title}-${idx}`} className={`rounded-lg border px-3 py-2 ${item.color}`}>
                <p className="text-sm font-bold">{item.title}</p>
                <p className="text-sm">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {!compact && forecastVsActual.length > 0 && (
        <div className="rounded-xl bg-white border border-slate-200 p-3">
          <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2">{t('role_ai_panel.forecast_vs_actual', 'Forecast vs Actual + Confidence')}</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={forecastVsActual.map((row: any, idx: number) => ({
                  ...row,
                  lower: confidenceBands[idx]?.lower,
                  upper: confidenceBands[idx]?.upper,
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.25)" />
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                <Tooltip />
                <Area type="monotone" dataKey="upper" stroke="transparent" fill="rgba(59,130,246,0.15)" />
                <Area type="monotone" dataKey="lower" stroke="transparent" fill="rgba(226,232,240,1)" />
                <Line type="monotone" dataKey="actual" stroke="#10b981" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="predicted" stroke="#6366f1" strokeWidth={2.5} dot={false} strokeDasharray="5 5" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {!compact && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {demandProjection.length > 0 && (
            <div className="rounded-xl bg-white border border-slate-200 p-3">
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2">{t('role_ai_panel.demand_projection', 'Demand Projection by Crop')}</p>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={demandProjection.slice(0, 8)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                    <XAxis dataKey="crop" tick={{ fill: '#64748b', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="demandKg" fill="#22c55e" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
          {cropMix.length > 0 && (
            <div className="rounded-xl bg-white border border-slate-200 p-3">
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2">{t('role_ai_panel.crop_mix', 'Crop Mix Distribution')}</p>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={cropMix} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={78} label>
                      {cropMix.map((_, index) => <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {!compact && statusDistribution.length > 0 && (
        <div className="rounded-xl bg-white border border-slate-200 p-3">
          <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2">{t('role_ai_panel.workflow_status', 'Workflow Status Distribution')}</p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#16a34a" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="rounded-xl bg-white border border-slate-200 p-3 space-y-2">
          <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">{t('role_ai_panel.risk_radar', 'Risk Radar')}</p>
          {risks.length === 0 && <p className="text-sm text-slate-500">{t('role_ai_panel.no_risks', 'No notable risks detected.')}</p>}
          {risks.map((r, i) => (
            <div key={i} className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
              <p className="text-sm font-bold text-slate-900">{r.title} <span className="text-[10px] uppercase text-amber-600">{r.severity}</span></p>
              <p className="text-xs text-slate-600">{r.detail}</p>
            </div>
          ))}
        </div>
        <div className="rounded-xl bg-white border border-slate-200 p-3 space-y-2">
          <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">{t('role_ai_panel.ai_recommendations', 'AI Recommendations')}</p>
          {recommendations.length === 0 && <p className="text-sm text-slate-500">{t('role_ai_panel.no_recommendations', 'No recommendations currently available.')}</p>}
          {recommendations.map((rec, i) => (
            <p key={i} className="text-sm text-slate-700">• {rec}</p>
          ))}
        </div>
      </div>

      {!compact && (
        <div className="rounded-xl bg-white border border-slate-200 p-3 space-y-3">
          <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">{t('role_ai_panel.ai_assistant', 'AI Insights Assistant')}</p>
          <div className="flex flex-wrap gap-2">
            {quickPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => setAssistantQuestion(prompt)}
                className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100"
              >
                {prompt}
              </button>
            ))}
          </div>
          <div className="max-h-56 overflow-y-auto space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
            {assistantMessages.map((m, idx) => (
              <div key={idx} className={`whitespace-pre-line rounded-md px-3 py-2 text-sm leading-6 ${m.role === 'assistant' ? 'bg-emerald-50 text-emerald-900' : 'bg-slate-900 text-white'}`}>
                {m.text}
              </div>
            ))}
            {assistantLoading && <p className="text-xs text-slate-500">{t('role_ai_panel.preparing_response', 'Preparing AI response...')}</p>}
          </div>
          <div className="flex gap-2">
            <input
              value={assistantQuestion}
              onChange={(e) => setAssistantQuestion(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') askAssistant(); }}
              placeholder={t('role_ai_panel.ask_about_role', 'Ask AI about this role...')}
              className="h-10 flex-1 rounded-lg border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="button"
              onClick={askAssistant}
              disabled={assistantLoading || !assistantQuestion.trim()}
              className="h-10 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t('shared.ask', 'Ask')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
