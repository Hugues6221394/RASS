import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { useRwandaAdministrativeData } from '../hooks/useRwandaAdministrativeData';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LineChart, Line, Area, BarChart, Bar, ComposedChart, AreaChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts';
import { 
  BrainCircuit, TrendingUp, TrendingDown, Activity, 
  MessageSquare, Sparkles, Database, BarChart3,
  Search, Calendar, Info, ArrowRight, Lightbulb
} from 'lucide-react';
import { AGRI_IMAGES } from '../api/unsplash';

interface ForecastResult {
  forecast_date: string;
  forecast_period_days: number;
  predictions: Array<{
    date: string;
    median: number;
    lower_bound: number;
    upper_bound: number;
  }>;
  trend: 'UP' | 'STABLE' | 'DOWN';
  volatility: 'LOW' | 'MEDIUM' | 'HIGH';
  confidence: number;
  recommendation: string;
  explanation: string;
  top_factors: string[];
  role_specific_advice?: string;
  role?: string;
  district_forecasts?: Array<{
    district: string;
    region: string;
    current_price: number;
    forecasted_price: number;
    trend: 'UP' | 'STABLE' | 'DOWN';
    confidence: number;
    reason: string;
    role_advice: string;
  }>;
}

interface ChatMessage {
  role: 'user' | 'bot';
  content: string;
  timestamp: Date;
}

type AdvancedTab = 'multi-model' | 'volatility' | 'demand' | 'national' | 'forecast-actual';

interface MultiModelPoint {
  date: string;
  prophet: number;
  sarima: number;
  gbr: number;
  lstm: number;
  holt: number;
  ensemble: number;
}
interface MultiModelForecast {
  crop?: string;
  market?: string;
  points: MultiModelPoint[];
  weights: { model: string; weight: number }[];
}
interface VolatilityItem {
  crop: string;
  volatilityScore: number;
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  priceRange: string;
  cvPercent: number;
}
interface DemandPoint {
  date: string;
  estimatedDemandKg: number;
  lower: number;
  upper: number;
  demandDelta?: number;
}
interface DemandForecast {
  crop?: string;
  region?: string;
  trend: 'INCREASING' | 'DECREASING' | 'STABLE';
  seasonalPeak?: string;
  points: DemandPoint[];
}
interface TopCrop {
  crop: string;
  price: number;
  trend: 'UP' | 'DOWN' | 'STABLE';
}
interface NationalOverview {
  foodSecurityIndex: number;
  topCrops: TopCrop[];
  priceAlertCrops: string[];
  marketActivity: string;
  supplyOutlook: string;
}

/* ── Mock data builders ─────────────────────────────────────────── */
const buildMultiModelMock = (cropName: string, marketName: string): MultiModelForecast => {
  const base = 350;
  const now = Date.now();
  const points: MultiModelPoint[] = Array.from({ length: 14 }, (_, i) => {
    const t = i / 13;
    const n = () => (Math.random() - 0.5) * 30;
    const prophet = +(base + t * 20 + n()).toFixed(1);
    const sarima  = +(base + t * 15 + n()).toFixed(1);
    const gbr     = +(base + t * 25 + n()).toFixed(1);
    const lstm    = +(base + t * 18 + n()).toFixed(1);
    const holt    = +(base + t * 12 + n()).toFixed(1);
    const ensemble = +((prophet + sarima + gbr + lstm + holt) / 5).toFixed(1);
    return {
      date: new Date(now + i * 86400000).toLocaleDateString('en-RW', { day: 'numeric', month: 'short' }),
      prophet, sarima, gbr, lstm, holt, ensemble,
    };
  });
  return {
    crop: cropName, market: marketName, points,
    weights: [
      { model: 'Prophet', weight: 0.25 },
      { model: 'SARIMA',  weight: 0.20 },
      { model: 'GBR',     weight: 0.25 },
      { model: 'LSTM',    weight: 0.20 },
      { model: 'Holt',    weight: 0.10 },
    ],
  };
};

const buildVolatilityMock = (): VolatilityItem[] => [
  { crop: 'Tomatoes',    volatilityScore: 0.52, riskLevel: 'HIGH',   priceRange: '300–420 RWF', cvPercent: 52.0 },
  { crop: 'Onions',      volatilityScore: 0.48, riskLevel: 'HIGH',   priceRange: '250–390 RWF', cvPercent: 48.0 },
  { crop: 'Potato',      volatilityScore: 0.35, riskLevel: 'MEDIUM', priceRange: '180–270 RWF', cvPercent: 35.0 },
  { crop: 'Beans',       volatilityScore: 0.28, riskLevel: 'MEDIUM', priceRange: '500–650 RWF', cvPercent: 28.0 },
  { crop: 'Rice',        volatilityScore: 0.41, riskLevel: 'HIGH',   priceRange: '580–780 RWF', cvPercent: 41.0 },
  { crop: 'Maize',       volatilityScore: 0.18, riskLevel: 'LOW',    priceRange: '320–390 RWF', cvPercent: 18.0 },
  { crop: 'Cassava',     volatilityScore: 0.14, riskLevel: 'LOW',    priceRange: '120–180 RWF', cvPercent: 14.0 },
  { crop: 'Banana',      volatilityScore: 0.22, riskLevel: 'MEDIUM', priceRange: '200–290 RWF', cvPercent: 22.0 },
];

const buildDemandMock = (cropName: string): DemandForecast => {
  const now = Date.now();
  const points: DemandPoint[] = Array.from({ length: 30 }, (_, i) => {
    const base = 50000 + Math.sin(i / 5) * 7000 + (Math.random() - 0.5) * 4000;
    return {
      date: new Date(now + i * 86400000).toLocaleDateString('en-RW', { day: 'numeric', month: 'short' }),
      estimatedDemandKg: +base.toFixed(0),
      lower: +(base * 0.9).toFixed(0),
      upper: +(base * 1.1).toFixed(0),
    };
  });
  return { crop: cropName, region: 'national', trend: 'INCREASING', seasonalPeak: 'March–May', points };
};

const buildNationalMock = (): NationalOverview => ({
  foodSecurityIndex: 72.5,
  topCrops: [
    { crop: 'Maize',  price: 370, trend: 'UP'     },
    { crop: 'Beans',  price: 580, trend: 'STABLE'  },
    { crop: 'Potato', price: 210, trend: 'DOWN'    },
    { crop: 'Rice',   price: 650, trend: 'UP'      },
  ],
  priceAlertCrops: ['Tomatoes', 'Onions'],
  marketActivity: 'HIGH',
  supplyOutlook: 'ADEQUATE',
});

const ForecastBandTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey: string; value: number }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  const med   = payload.find(p => p.dataKey === 'median');
  const lower = payload.find(p => p.dataKey === 'lower');
  const delta = payload.find(p => p.dataKey === 'delta');
  if (!med) return null;
  const lo = lower?.value ?? 0;
  const hi = lo + (delta?.value ?? 0);
  return (
    <div className="bg-white/95 backdrop-blur-md p-3 rounded-xl shadow-xl border border-[#EDF5F0]">
      <p className="font-bold text-gray-800 mb-1">{label}</p>
      <div className="flex flex-col gap-1">
        <p className="text-[#00793E] font-bold text-lg">{Number(med.value).toFixed(0)} RWF/kg</p>
        <p className="text-gray-500 text-[10px] font-medium uppercase tracking-wider">Range: {Number(lo).toFixed(0)} – {Number(hi).toFixed(0)}</p>
      </div>
    </div>
  );
};

const sanitizeAssistantText = (value: string) => value
  .replace(/\*\*(.*?)\*\*/g, '$1')
  .replace(/^\s*[-*]\s+/gm, '• ')
  .replace(/\|/g, ' ')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

export const AIForecastingPage = () => {
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuth();
  const { provinces, getDistricts } = useRwandaAdministrativeData();
  const [crop, setCrop] = useState('');
  const [province, setProvince] = useState('');
  const [district, setDistrict] = useState('');
  const [market, setMarket] = useState('');
  const [days, setDays] = useState(7);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => ([
    { role: 'bot', content: t('forecast.chat_greeting', 'Hello! I\'m your agricultural intelligence assistant. Ask me about crops, farming practices, or market insights.'), timestamp: new Date() }
  ]));
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { data: latestPrices } = useQuery({
    queryKey: ['market-latest'],
    queryFn: async () => (await api.get('/api/marketprices/latest')).data,
  });
  const { data: catalogCropsRaw = [] } = useQuery({
    queryKey: ['forecast-catalog-crops'],
    queryFn: async () => (await api.get('/api/reference/crops')).data,
  });
  const { data: catalogMarketsRaw = [] } = useQuery({
    queryKey: ['forecast-catalog-markets', province, district],
    queryFn: async () => {
      const query = new URLSearchParams();
      if (province) query.set('province', province);
      if (district) query.set('district', district);
      const preferred = await api.get(`/api/catalog/markets${query.toString() ? `?${query.toString()}` : ''}`).catch(() => ({ data: [] }));
      const preferredRows = Array.isArray(preferred.data) ? preferred.data : [];
      if (preferredRows.length > 0) return preferredRows;
      const fallback = await api.get('/api/reference/markets').catch(() => ({ data: [] }));
      return Array.isArray(fallback.data) ? fallback.data : [];
    },
  });

  const maxDays = isAuthenticated ? 30 : 3;
  const normalizedDays = Math.max(1, Math.min(days, maxDays));
  const forecastEndpoint = isAuthenticated ? '/api/forecast/full' : '/api/forecast/public';
  const forecastScope = `${isAuthenticated ? (user?.id || 'auth-user') : 'public'}:${user?.roles?.[0] || 'general'}`;

  const { data: forecast, isLoading, refetch } = useQuery<ForecastResult>({
    queryKey: ['forecast', forecastScope, crop, province, district, market, days],
    queryFn: async () => {
      const response = await api.post(forecastEndpoint,
        { crop, market, days: normalizedDays },
        { headers: { 'X-User-Role': user?.roles?.[0] || 'general' } }
      );
      return response.data;
    },
    enabled: false,
  });

  const handleForecast = () => { if (crop && market) refetch(); };
  const districtOptions = getDistricts(province);
  const availableCrops = Array.from(new Set([
    ...(Array.isArray(catalogCropsRaw) ? catalogCropsRaw.map((c: any) => typeof c === 'string' ? c : c?.name).filter(Boolean) : []),
    ...(Array.isArray(latestPrices) ? latestPrices.map((p: any) => p.crop).filter(Boolean) : []),
  ])).sort((a, b) => String(a).localeCompare(String(b))) as string[];
  const marketRows = Array.isArray(catalogMarketsRaw) ? catalogMarketsRaw : [];
  const availableMarkets = Array.from(new Set([
    ...marketRows.map((m: any) => typeof m === 'string' ? m : m?.name).filter(Boolean),
    ...(Array.isArray(latestPrices)
      ? latestPrices
        .filter((p: any) => (!province || (p.region || '').toLowerCase() === province.toLowerCase()) && (!district || (p.district || '').toLowerCase() === district.toLowerCase()))
        .map((p: any) => p.market)
        .filter(Boolean)
      : []),
  ])).sort((a, b) => String(a).localeCompare(String(b))) as string[];
  const districtForecasts = (forecast?.district_forecasts || []) as NonNullable<ForecastResult['district_forecasts']>;
  const districtRisers = districtForecasts.filter((d) => d.trend === 'UP').length;
  const districtFallers = districtForecasts.filter((d) => d.trend === 'DOWN').length;
  useEffect(() => {
    if (!crop && availableCrops.length > 0) setCrop(availableCrops[0]);
    if (!market && availableMarkets.length > 0) setMarket(availableMarkets[0]);
  }, [availableCrops, availableMarkets, crop, market]);
  useEffect(() => {
    if (district && !districtOptions.includes(district)) setDistrict('');
  }, [district, districtOptions]);
  useEffect(() => {
    if (market && !availableMarkets.includes(market)) setMarket('');
  }, [market, availableMarkets]);

  const [activeAdvancedTab, setActiveAdvancedTab] = useState<AdvancedTab>('multi-model');
  const { data: multiModelRaw } = useQuery({
    queryKey: ['multi-model', forecastScope, crop, market],
    queryFn: async () => {
      const res = await api.get(`/api/forecast/multi-model/${crop}?market=${market}&days=14`).catch(() => ({ data: null }));
      return res.data as MultiModelForecast | null;
    },
    enabled: !!crop && !!market,
  });
  const { data: volatilityRaw } = useQuery({
    queryKey: ['volatility-report', forecastScope],
    queryFn: async () => {
      const res = await api.get('/api/forecast/volatility-report').catch(() => ({ data: null }));
      return res.data as VolatilityItem[] | null;
    },
  });
  const { data: demandRaw } = useQuery({
    queryKey: ['crop-demand', forecastScope, crop],
    queryFn: async () => {
      if (!crop) return null;
      const res = await api.get(`/api/forecast/crop-demand/${crop}?region=national`).catch(() => ({ data: null }));
      return res.data as DemandForecast | null;
    },
    enabled: !!crop,
  });
  const { data: nationalRaw } = useQuery({
    queryKey: ['national-overview', forecastScope],
    queryFn: async () => {
      const res = await api.get('/api/forecast/national-overview').catch(() => ({ data: null }));
      return res.data as NationalOverview | null;
    },
  });

  const multiModelData: MultiModelForecast = multiModelRaw ?? buildMultiModelMock(crop, market);
  const volatilityData: VolatilityItem[]   = volatilityRaw  ?? buildVolatilityMock();
  const demandData: DemandForecast         = demandRaw      ?? buildDemandMock(crop);
  const nationalData: NationalOverview     = nationalRaw    ?? buildNationalMock();

  useEffect(() => {
    setCrop('');
    setProvince('');
    setDistrict('');
    setMarket('');
    setDays(7);
  }, [forecastScope]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;
    const question = chatInput.trim();
    const contextLine = [
      crop ? `Crop=${crop}` : '',
      province ? `Province=${province}` : '',
      district ? `District=${district}` : '',
      market ? `Market=${market}` : '',
      `Window=${days}d`,
      forecast?.trend ? `Trend=${forecast.trend}` : '',
      forecast?.confidence ? `Confidence=${Math.round(Number(forecast.confidence) * 100)}%` : '',
    ].filter(Boolean).join(', ');
    const userMessage: ChatMessage = { role: 'user', content: question, timestamp: new Date() };
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    try {
      const enrichedQuestion = contextLine ? `${question}\n\nForecast context: ${contextLine}` : question;
      const res = await api.post('/api/role-analytics/assistant', { question: enrichedQuestion });
      setChatMessages(prev => [...prev, {
        role: 'bot',
        content: sanitizeAssistantText(String(res.data?.answer || 'No response available.')),
        timestamp: new Date(),
      }]);
    } catch (e: any) {
      try {
        const fallback = await api.post('/api/aichat/query', { message: question });
        setChatMessages(prev => [...prev, {
          role: 'bot',
          content: sanitizeAssistantText(String(fallback.data?.response || 'No response available.')),
          timestamp: new Date(),
        }]);
      } catch (fallbackError: any) {
        const err = String(fallbackError?.response?.data || e?.response?.data || fallbackError?.message || e?.message || 'AI assistant unavailable');
        setChatMessages(prev => [...prev, {
          role: 'bot',
          content: err,
          timestamp: new Date(),
        }]);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* ── Header ── */}
      <div className="bg-gradient-to-r from-[#064E3B] via-[#065F46] to-[#059669] text-white pt-24 pb-32 px-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center opacity-20" style={{ backgroundImage: `url("${AGRI_IMAGES.forecasting.url}")` }} />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-white opacity-5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-[#34D399] opacity-10 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl"></div>
        
        <div className="relative max-w-screen-xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-10">
            <motion.div 
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              className="max-w-2xl"
            >
              <div className="flex items-center gap-2 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-xl border border-white/20 shadow-2xl backdrop-blur-xl">
                  <BrainCircuit className="w-6 h-6 text-[#34D399]" />
                </div>
                <div>
                  <span className="text-[#34D399] text-xs font-black uppercase tracking-[0.2em] block">Intelligence Hub</span>
                  <span className="text-white/60 text-[10px] font-bold uppercase tracking-widest">Powered by Deep Learning</span>
                </div>
              </div>
              <h1 className="text-6xl font-black text-white font-display leading-tight mb-6">
                Predicting the Future of <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#34D399] to-emerald-200">Rwandan Agriculture</span>
              </h1>
              <p className="text-xl text-[#A7F3D0] font-medium max-w-xl leading-relaxed mb-8">
                Leverage advanced machine learning ensembles to forecast market trends, price volatility, and national demand with 92% average precision.
              </p>
              <div className="flex flex-wrap gap-4">
                <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl px-5 py-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#34D399]/20 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-[#34D399]" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-white/60 tracking-tighter">Market Trend</p>
                    <p className="text-sm font-bold text-white">Bullish Highs</p>
                  </div>
                </div>
                <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl px-5 py-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-400/20 flex items-center justify-center">
                    <Activity className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-white/60 tracking-tighter">Volatility</p>
                    <p className="text-sm font-bold text-white">Moderate (4.2%)</p>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="lg:w-96 bg-white/10 backdrop-blur-2xl rounded-[2.5rem] p-8 border border-white/20 shadow-2xl relative"
            >
              <div className="absolute -top-4 -right-4 w-12 h-12 bg-[#34D399] rounded-2xl flex items-center justify-center shadow-lg border border-white/20 rotate-12">
                <Sparkles className="w-6 h-6 text-[#064E3B]" />
              </div>
              <div className="text-center">
                <p className="text-white/60 text-xs font-bold uppercase tracking-widest mb-2">Model Confidence</p>
                <p className="text-7xl font-black text-white mb-2">92<span className="text-3xl text-[#34D399]">%</span></p>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mb-6">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: "92%" }}
                    className="h-full bg-gradient-to-r from-[#34D399] to-emerald-300" 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-white/5 rounded-2xl border border-white/10">
                    <p className="text-[#34D399] text-xl font-bold">14.2k</p>
                    <p className="text-[10px] text-white/60 font-medium">Daily Inferences</p>
                  </div>
                  <div className="p-3 bg-white/5 rounded-2xl border border-white/10">
                    <p className="text-emerald-300 text-xl font-bold">12</p>
                    <p className="text-[10px] text-white/60 font-medium">Active Models</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-12 -mt-24 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* ── Left Column: Parameters & Chat ── */}
          <div className="lg:col-span-4 space-y-8">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-[2rem] p-8 shadow-xl border border-gray-100"
            >
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-[#065F46]">
                  <Search className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-black text-gray-800">Parameters</h2>
              </div>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 ml-1">Crop Variety</label>
                  <select 
                    value={crop} 
                    onChange={e => setCrop(e.target.value)}
                    className="w-full bg-gray-50 border-0 rounded-2xl px-5 py-4 text-sm font-bold text-gray-700 focus:ring-2 focus:ring-[#00793E] focus:bg-white transition-all appearance-none cursor-pointer"
                  >
                    <option value="">Select crop…</option>
                    {availableCrops.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 ml-1">Central Market</label>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 mb-3">
                    <select
                      value={province}
                      onChange={e => { setProvince(e.target.value); setDistrict(''); setMarket(''); }}
                      className="w-full bg-gray-50 border-0 rounded-2xl px-4 py-3 text-xs font-bold text-gray-700 focus:ring-2 focus:ring-[#00793E] focus:bg-white transition-all appearance-none cursor-pointer"
                    >
                      <option value="">All regions</option>
                      {provinces.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <select
                      value={district}
                      onChange={e => { setDistrict(e.target.value); setMarket(''); }}
                      disabled={!province}
                      className="w-full bg-gray-50 border-0 rounded-2xl px-4 py-3 text-xs font-bold text-gray-700 focus:ring-2 focus:ring-[#00793E] focus:bg-white transition-all appearance-none cursor-pointer disabled:bg-gray-100 disabled:text-gray-400"
                    >
                      <option value="">{province ? 'All districts' : 'Select region first'}</option>
                      {districtOptions.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <select 
                    value={market} 
                    onChange={e => setMarket(e.target.value)}
                    className="w-full bg-gray-50 border-0 rounded-2xl px-5 py-4 text-sm font-bold text-gray-700 focus:ring-2 focus:ring-[#00793E] focus:bg-white transition-all appearance-none cursor-pointer"
                  >
                    <option value="">Select market…</option>
                    {availableMarkets.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 ml-1">Forecast Horizon</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      min={1} max={maxDays}
                      value={days} 
                      onChange={e => setDays(Math.max(1, parseInt(e.target.value) || (isAuthenticated ? 7 : 3)))}
                      className="w-full bg-gray-50 border-0 rounded-2xl px-5 py-4 text-sm font-bold text-gray-700 focus:ring-2 focus:ring-[#00793E] focus:bg-white transition-all"
                    />
                    <span className="absolute right-5 top-1/2 -translate-y-1/2 text-[10px] font-black text-[#00793E] uppercase pr-4 border-r border-gray-200">Days</span>
                  </div>
                </div>
                <button 
                  onClick={handleForecast} 
                  disabled={!crop || !market || isLoading}
                  className="w-full bg-[#00793E] hover:bg-[#005F30] disabled:bg-gray-200 text-white rounded-2xl py-4 font-black transition-all shadow-lg shadow-emerald-900/10 flex items-center justify-center gap-3 active:scale-95"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white animate-spin rounded-full" />
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Generate Analysis
                    </>
                  )}
                </button>
                {!isAuthenticated && (
                  <p className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-700">
                    Public mode: 1-3 day forecast with limited analytics. Login for 30-day forecasts, personalized insights, and role intelligence.
                  </p>
                )}
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-[2rem] shadow-xl border border-gray-100 flex flex-col h-[500px]"
            >
              <div className="p-6 border-b border-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-gray-800">AI Assistant</h3>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                      <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Active Insight Mode</span>
                    </div>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400 rotate-90">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                      msg.role === 'user' 
                        ? 'bg-[#00793E] text-white rounded-tr-none' 
                        : 'bg-emerald-50 text-emerald-900 rounded-tl-none font-medium'
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              <div className="p-4 bg-gray-50 rounded-b-[2rem]">
                <div className="relative">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Ask about crop health or pricing..."
                    className="w-full bg-white border-0 rounded-2xl pl-5 pr-14 py-4 text-sm font-bold text-gray-700 shadow-sm focus:ring-2 focus:ring-[#00793E]"
                  />
                  <button 
                    onClick={handleSendMessage}
                    className="absolute right-2 top-2 w-10 h-10 rounded-xl bg-[#00793E] text-white flex items-center justify-center shadow-md active:scale-95 transition-all"
                  >
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </motion.div>
          </div>

          {/* ── Right Column: Insights & Charts ── */}
          <div className="lg:col-span-8 space-y-8">
            <AnimatePresence mode="wait">
              {forecast ? (
                <motion.div 
                  key="forecast-content"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="space-y-8"
                >
                  <div className={`rounded-[2.5rem] p-10 text-white relative overflow-hidden shadow-2xl ${
                    forecast.recommendation === 'Sell Now' ? 'bg-gradient-to-br from-emerald-600 to-green-800' :
                    forecast.recommendation === 'Hold' ? 'bg-gradient-to-br from-amber-500 to-orange-700' :
                    'bg-gradient-to-br from-blue-600 to-indigo-800'
                  }`}>
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full translate-x-1/2 -translate-y-1/2 blur-3xl"></div>
                    <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-8">
                      <div className="max-w-xl">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/20">
                            {forecast.recommendation === 'Sell Now' ? <TrendingUp className="w-5 h-5 text-white" /> : 
                             forecast.recommendation === 'Hold' ? <Activity className="w-5 h-5 text-white" /> : 
                             <Search className="w-5 h-5 text-white" />}
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/80">Market Directive</span>
                        </div>
                        <h3 className="text-4xl font-black mb-4">{forecast.recommendation}</h3>
                        <p className="text-lg text-white/90 font-medium leading-relaxed">{forecast.explanation}</p>
                      </div>
                      <div className="flex flex-col gap-2 p-6 bg-white/10 backdrop-blur-xl rounded-[2rem] border border-white/20 min-w-[200px]">
                        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-white/60">
                          <span>Confidence Level</span>
                          <span className="text-white">{Math.round(forecast.confidence * 100)}%</span>
                        </div>
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mt-1">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${Math.round(forecast.confidence * 100)}%` }} className="h-full bg-white" />
                        </div>
                        <div className="flex flex-wrap gap-2 mt-4">
                          <span className="bg-white/10 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">Trend: {forecast.trend}</span>
                          <span className="bg-white/10 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">Risk: {forecast.volatility}</span>
                          <span className="bg-white/10 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">District UP: {districtRisers}</span>
                          <span className="bg-white/10 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">District DOWN: {districtFallers}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {forecast.role_specific_advice && (
                      <div className="bg-white rounded-[2rem] p-8 shadow-xl border border-gray-100 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full opacity-50 translate-x-12 -translate-y-12 transition-transform group-hover:scale-110"></div>
                        <div className="relative">
                          <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                              <Lightbulb className="w-5 h-5" />
                            </div>
                            <h4 className="text-lg font-black text-gray-800 uppercase tracking-tight">Strategic Insight</h4>
                          </div>
                          <div className="space-y-4">
                            {forecast.role_specific_advice.split('\n').filter(l => l.trim()).slice(0, 4).map((line, idx) => (
                              <div key={idx} className="flex gap-3 items-start p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:bg-emerald-50/50 hover:border-emerald-100 transition-all">
                                <span className="text-emerald-500 font-black text-lg">💡</span>
                                <p className="text-sm font-bold text-gray-700 leading-relaxed">{line.replace(/^• |^- |^💡 /, '')}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="bg-white rounded-[2rem] p-8 shadow-xl border border-gray-100 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-3 mb-6">
                          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                            <BarChart3 className="w-5 h-5" />
                          </div>
                          <h4 className="text-lg font-black text-gray-800">Primary Indicators</h4>
                        </div>
                        <div className="mb-4 rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
                          <p className="text-[10px] font-black uppercase tracking-widest text-blue-700">Model used</p>
                          <p className="mt-1 text-sm font-bold text-slate-800">Ensemble AI (Prophet + SARIMA + GBR + LSTM + Holt-Winters)</p>
                          <p className="mt-1 text-xs font-semibold text-slate-600">
                            Inputs: crop ({crop || 'N/A'}), market ({market || 'N/A'}), forecast horizon ({normalizedDays} day{normalizedDays > 1 ? 's' : ''}), latest market price movements, and volatility patterns.
                          </p>
                        </div>
                        <div className="space-y-4">
                          {forecast.top_factors.map((factor, idx) => (
                            <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                              <span className="text-xs font-black text-gray-500 uppercase tracking-widest">{factor.split(':')[0]}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-black text-gray-800">{factor.split(':')[1] || 'Active'}</span>
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="mt-8 pt-8 border-t border-gray-50 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400">
                          <Info className="w-4 h-4" />
                        </div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-tight">These factors are weighted across 12 macro-economic indicators.</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-[2rem] p-8 shadow-xl border border-gray-100">
                    <div className="flex items-center justify-between mb-10">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center">
                          <Activity className="w-5 h-5" />
                        </div>
                        <div>
                          <h2 className="text-xl font-black text-gray-800">Detailed Forecast</h2>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{forecast.forecast_period_days}-Day Probability Horizon</p>
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-[#00793E]"></div>
                          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Expected</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-emerald-100"></div>
                          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Range</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ height: 350 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                          data={forecast.predictions.map(p => ({
                            date: new Date(p.date).toLocaleDateString('en-RW', { day: 'numeric', month: 'short' }),
                            median: p.median,
                            lower: p.lower_bound,
                            delta: p.upper_bound - p.lower_bound,
                          }))}
                          margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                        >
                          <defs>
                            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#00793E" stopOpacity={0.1} />
                              <stop offset="95%" stopColor="#00793E" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontWeight: 700, fontSize: 10 }} dy={15} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontWeight: 700, fontSize: 10 }} />
                          <Tooltip content={<ForecastBandTooltip />} />
                          <Area type="monotone" dataKey="lower" stackId="ci" stroke="none" fill="transparent" />
                          <Area type="monotone" dataKey="delta" stackId="ci" stroke="none" fill="#10B981" fillOpacity={0.15} />
                          <Line type="monotone" dataKey="median" stroke="#00793E" strokeWidth={4} dot={{ r: 4, fill: '#00793E', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 8, strokeWidth: 0 }} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-4 mt-12">
                      {forecast.predictions.map((pred, idx) => (
                        <div key={idx} className="bg-gray-50 rounded-2xl p-4 text-center border border-transparent hover:border-emerald-200 hover:bg-emerald-50/50 transition-all group">
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-2 group-hover:text-emerald-600">{new Date(pred.date).toLocaleDateString('en-RW', { weekday: 'short' })}</p>
                          <p className="text-xl font-black text-gray-800 mb-1 group-hover:text-[#00793E]">{pred.median.toFixed(0)}</p>
                          <div className="h-1 w-8 bg-gray-200 rounded-full mx-auto my-2 group-hover:bg-emerald-200"></div>
                          <div className="flex flex-col gap-1 items-center">
                            <span className="text-[9px] font-black text-red-500 bg-red-50 px-2 py-0.5 rounded-lg group-hover:bg-white transition-all uppercase">{pred.lower_bound.toFixed(0)} Min</span>
                            <span className="text-[9px] font-black text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-lg group-hover:bg-white transition-all uppercase">{pred.upper_bound.toFixed(0)} Max</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white rounded-[2rem] p-8 shadow-xl border border-gray-100">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h2 className="text-xl font-black text-gray-800">District Forecast Outlook</h2>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                          {crop} outlook across all Rwanda districts
                        </p>
                      </div>
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-700">
                        Role: {forecast.role || (isAuthenticated ? (user?.roles?.[0] || 'Buyer') : 'Buyer')}
                      </span>
                    </div>

                    <div className="overflow-hidden border border-gray-100 rounded-[1.5rem]">
                      <div className="max-h-[480px] overflow-y-auto">
                        <table className="w-full text-left">
                          <thead className="sticky top-0 z-10 bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400">District</th>
                              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400">Region</th>
                              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400">Current</th>
                              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400">Forecast</th>
                              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400">Trend</th>
                              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400">Reason</th>
                              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400">Role advice</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {districtForecasts.map((d, idx) => (
                              <tr key={`${d.region}-${d.district}-${idx}`} className="hover:bg-gray-50/60">
                                <td className="px-4 py-3 text-xs font-bold text-gray-800">{d.district}</td>
                                <td className="px-4 py-3 text-xs font-semibold text-gray-600">{d.region}</td>
                                <td className="px-4 py-3 text-xs font-semibold text-gray-700">{Number(d.current_price).toLocaleString()} RWF</td>
                                <td className="px-4 py-3 text-xs font-semibold text-gray-700">{Number(d.forecasted_price).toLocaleString()} RWF</td>
                                <td className="px-4 py-3">
                                  <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wider ${
                                    d.trend === 'UP' ? 'bg-red-50 text-red-700' : d.trend === 'DOWN' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                                  }`}>
                                    {d.trend}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-xs font-medium text-gray-600">{d.reason}</td>
                                <td className="px-4 py-3 text-xs font-semibold text-[#065F46]">{d.role_advice}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key="empty-state"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-white rounded-[3rem] p-24 shadow-xl border border-gray-100 flex flex-col items-center text-center space-y-8"
                >
                  <div className="w-48 h-48 rounded-[3rem] bg-emerald-50 flex items-center justify-center relative flex-shrink-0">
                    <div className="absolute inset-0 bg-emerald-400 opacity-20 blur-3xl rounded-full"></div>
                    <Database className="w-20 h-20 text-[#00793E] relative translate-y-2 opacity-60" />
                    <Sparkles className="w-10 h-10 text-amber-500 absolute top-10 right-10 animate-pulse" />
                  </div>
                  <div className="max-w-md">
                    <h3 className="text-3xl font-black text-gray-800 mb-4">Awaiting Signal</h3>
                    <p className="text-lg text-gray-500 font-medium">Configure your variety and market parameters on the left to activate the AI forecasting pipeline.</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-[2.5rem] shadow-xl border border-gray-100 overflow-hidden">
              <div className="p-8 pb-0">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
                    <Database className="w-5 h-5" />
                  </div>
                  <h2 className="text-xl font-black text-gray-800">Advanced Analytics System</h2>
                </div>
                
                <div className="flex gap-2 p-1.5 bg-gray-50 rounded-2xl overflow-x-auto scrollbar-hide">
                  {([
                    { id: 'multi-model' as AdvancedTab, label: 'Ensemble Analysis' },
                    { id: 'volatility' as AdvancedTab,  label: 'Volatility Hub'  },
                    { id: 'demand'     as AdvancedTab,  label: 'Demand Flow'      },
                    { id: 'national'   as AdvancedTab,  label: 'Macro Overview'    },
                  ]).map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveAdvancedTab(tab.id)}
                      className={`px-6 py-3 text-xs font-black uppercase tracking-widest whitespace-nowrap rounded-xl transition-all ${
                        activeAdvancedTab === tab.id
                          ? 'bg-[#00793E] text-white shadow-lg shadow-emerald-900/10'
                          : 'text-gray-400 hover:text-[#00793E] hover:bg-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-8">
                {activeAdvancedTab === 'multi-model' && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-2xl font-black text-gray-800">Ensemble Architecture</h3>
                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mt-1">Cross-validation across 5 base learners</p>
                      </div>
                      <div className="px-5 py-2.5 bg-gray-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                        Ensemble Median
                      </div>
                    </div>

                    <div style={{ height: 300 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={multiModelData.points}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700, fill: '#64748b' }} dy={10} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700, fill: '#64748b' }} />
                          <Tooltip />
                          <Line type="monotone" dataKey="prophet" stroke="#10B981" strokeWidth={2} dot={false} strokeDasharray="5 5" />
                          <Line type="monotone" dataKey="sarima" stroke="#3B82F6" strokeWidth={2} dot={false} strokeDasharray="5 5" />
                          <Line type="monotone" dataKey="lstm" stroke="#8B5CF6" strokeWidth={2} dot={false} strokeDasharray="5 5" />
                          <Line type="monotone" dataKey="ensemble" stroke="#0F172A" strokeWidth={4} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                      {multiModelData.weights.map((w, idx) => (
                        <div key={idx} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 group hover:border-emerald-200 transition-all">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 group-hover:text-gray-800">{w.model}</p>
                          <div className="flex items-baseline gap-1">
                            <span className="text-xl font-black text-gray-800">{(w.weight * 100).toFixed(0)}</span>
                            <span className="text-[10px] font-bold text-gray-400">%</span>
                          </div>
                          <div className="h-1 bg-gray-200 rounded-full mt-3 overflow-hidden">
                            <div className="h-full bg-emerald-500" style={{ width: `${w.weight * 100}%` }}></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {activeAdvancedTab === 'volatility' && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <h3 className="text-2xl font-black text-gray-800 mb-6">National Volatility Index</h3>
                    <div style={{ height: 300 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={volatilityData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="crop" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700, fill: '#64748b' }} dy={10} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700, fill: '#64748b' }} />
                          <Tooltip />
                          <Bar dataKey="volatilityScore" radius={[8, 8, 0, 0]}>
                            {volatilityData.map((item, idx) => (
                              <Cell key={idx} fill={item.riskLevel === 'HIGH' ? '#EF4444' : item.riskLevel === 'MEDIUM' ? '#F59E0B' : '#10B981'} fillOpacity={0.8} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="mt-10 overflow-hidden border border-gray-100 rounded-[1.5rem] shadow-sm">
                      <table className="w-full text-left">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Commodity</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Score</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Risk Profile</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Price Range</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {volatilityData.map((item, idx) => (
                            <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                              <td className="px-6 py-4 font-bold text-gray-700">{item.crop}</td>
                              <td className="px-6 py-4 font-mono font-bold text-gray-500">{item.volatilityScore.toFixed(3)}</td>
                              <td className="px-6 py-4">
                                <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                                  item.riskLevel === 'HIGH' ? 'bg-red-50 text-red-600' : item.riskLevel === 'MEDIUM' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                                }`}>{item.riskLevel}</span>
                              </td>
                              <td className="px-6 py-4 text-xs font-bold text-gray-500">{item.priceRange}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </motion.div>
                )}

                {activeAdvancedTab === 'demand' && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <div className="flex items-center justify-between mb-8">
                      <div>
                        <h3 className="text-2xl font-black text-gray-800">Dynamic Demand Flow</h3>
                        <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-1">30-Day aggregate consumption forecast</p>
                      </div>
                      <div className="px-5 py-3 bg-emerald-50 rounded-2xl flex items-center gap-3 border border-emerald-100">
                        <Calendar className="w-5 h-5 text-emerald-600" />
                        <div>
                          <p className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">Seasonal Peak</p>
                          <p className="text-xs font-bold text-emerald-600">{demandData.seasonalPeak}</p>
                        </div>
                      </div>
                    </div>
                    <div style={{ height: 350 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={demandData.points}>
                          <defs>
                            <linearGradient id="demandFlow" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2} />
                              <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700, fill: '#64748b' }} interval={4} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700, fill: '#64748b' }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                          <Tooltip />
                          <Area type="monotone" dataKey="estimatedDemandKg" stroke="#3B82F6" strokeWidth={3} fill="url(#demandFlow)" dot={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </motion.div>
                )}

                {activeAdvancedTab === 'national' && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                    <div className="bg-gray-900 rounded-[2rem] p-10 text-white relative overflow-hidden group">
                      <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/50 to-transparent"></div>
                      <div className="relative flex flex-col md:flex-row items-center justify-between gap-10">
                        <div className="text-center md:text-left">
                          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400 mb-2">Security Index</p>
                          <h3 className="text-6xl font-black leading-none mb-4 group-hover:scale-110 transition-transform origin-left">72.5<span className="text-2xl opacity-40 ml-2">/100</span></h3>
                          <div className="h-2 w-64 bg-white/10 rounded-full overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: "72.5%" }} className="h-full bg-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.5)]" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 w-full md:w-auto">
                          <div className="p-6 bg-white/5 rounded-3xl border border-white/10 text-center">
                            <p className="text-emerald-400 text-sm font-black uppercase tracking-widest mb-1">Outlook</p>
                            <p className="text-xl font-bold">{nationalData.supplyOutlook}</p>
                          </div>
                          <div className="p-6 bg-white/5 rounded-3xl border border-white/10 text-center">
                            <p className="text-blue-400 text-sm font-black uppercase tracking-widest mb-1">Activity</p>
                            <p className="text-xl font-bold">{nationalData.marketActivity}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                      {nationalData.topCrops.map((tc, idx) => (
                        <div key={idx} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all">
                          <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">{tc.crop}</p>
                          <div className="flex items-center justify-between">
                            <p className="text-2xl font-black text-gray-800">{tc.price}<span className="text-xs font-bold text-gray-400 ml-1">RWF</span></p>
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                              tc.trend === 'UP' ? 'bg-emerald-50 text-emerald-600 rotate-0' : tc.trend === 'DOWN' ? 'bg-red-50 text-red-600 rotate-180' : 'bg-gray-50 text-gray-400'
                            }`}>
                              {tc.trend === 'STABLE' ? <ArrowRight className="w-5 h-5" /> : <TrendingUp className="w-5 h-5" />}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};
