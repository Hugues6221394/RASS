import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import type { StorageFacility, TransportRequest } from '../types';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { 
  Truck, Warehouse, MapPin, Package, 
  Calendar, CheckCircle2, Clock, Navigation, 
  ArrowRight, Thermometer, ShieldCheck, Activity
} from 'lucide-react';
import { AGRI_IMAGES } from '../api/unsplash';

const statusColor = (status: string) => {
  const s = status?.toLowerCase();
  if (s === 'completed' || s === 'delivered') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (s === 'in_transit' || s === 'in transit' || s === 'active') return 'bg-blue-100 text-blue-700 border-blue-200';
  if (s === 'pending') return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-slate-100 text-slate-600 border-slate-200';
};

const safeDate = (value: unknown) => {
  const d = value ? new Date(String(value)) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString() : 'N/A';
};

export const LogisticsPage = () => {
  const { t } = useTranslation();

  const { data: transports, isLoading: loadingT } = useQuery({
    queryKey: ['transport'],
    queryFn: async () => (await api.get<TransportRequest[]>('/api/transport')).data,
  });

  const { data: facilities, isLoading: loadingF } = useQuery({
    queryKey: ['facilities'],
    queryFn: async () => (await api.get<StorageFacility[]>('/api/storage/facilities')).data,
  });

  const transportRows = Array.isArray(transports) ? transports : [];
  const facilityRows = Array.isArray(facilities) ? facilities : [];

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* ── Header ── */}
      <div className="bg-gradient-to-r from-[#064E3B] via-[#065F46] to-[#059669] text-white pt-24 pb-32 px-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center opacity-30 mix-blend-overlay" style={{ backgroundImage: `url("${AGRI_IMAGES.logistics.url}")` }} />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-white opacity-5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
        
        <div className="relative max-w-screen-xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-10">
            <motion.div 
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              className="max-w-2xl"
            >
              <div className="flex items-center gap-2 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-xl border border-white/20 shadow-2xl backdrop-blur-xl">
                  <Truck className="w-6 h-6 text-[#34D399]" />
                </div>
                <div>
                  <span className="text-[#34D399] text-xs font-black uppercase tracking-[0.2em] block">Supply Chain Hub</span>
                  <span className="text-white/60 text-[10px] font-bold uppercase tracking-widest">End-to-End Visibility</span>
                </div>
              </div>
              <h1 className="text-6xl font-black text-white font-display leading-tight mb-6">
                National <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#34D399] to-emerald-200">Logistics & Storage</span>
              </h1>
              <p className="text-xl text-[#A7F3D0] font-medium max-w-xl leading-relaxed">
                Coordinate seamless transport requests and manage premium storage facilities across Rwanda's agricultural network.
              </p>
              <div className="flex flex-wrap gap-3 mt-8">
                <span className="px-4 py-2 bg-white/10 backdrop-blur-md rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/10 flex items-center gap-2">
                  <Navigation className="w-3 h-3" /> Real-time Tracking
                </span>
                <span className="px-4 py-2 bg-white/10 backdrop-blur-md rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/10 flex items-center gap-2">
                  <Thermometer className="w-3 h-3" /> Cold Storage
                </span>
                <span className="px-4 py-2 bg-white/10 backdrop-blur-md rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/10 flex items-center gap-2">
                  <ShieldCheck className="w-3 h-3" /> Verified Carriers
                </span>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex gap-4"
            >
              <div className="rounded-[2.5rem] p-8 text-center min-w-[160px] bg-white/10 backdrop-blur-2xl border border-white/20 shadow-2xl">
                <p className="text-5xl font-black text-white mb-1">{transportRows.length}</p>
                <p className="text-emerald-300 text-[10px] font-black uppercase tracking-widest">Active Requests</p>
              </div>
              <div className="rounded-[2.5rem] p-8 text-center min-w-[160px] bg-white/10 backdrop-blur-2xl border border-white/20 shadow-2xl">
                <p className="text-5xl font-black text-white mb-1">{facilityRows.length}</p>
                <p className="text-emerald-300 text-[10px] font-black uppercase tracking-widest">Licensed Facilities</p>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 -mt-16 pb-20 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* ── Transport Requests ── */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-[2.5rem] p-10 shadow-xl border border-gray-100"
          >
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-3xl bg-emerald-50 flex items-center justify-center text-[#065F46]">
                  <Package className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-gray-800">{t('logistics.transport_requests', 'Transport Requests')}</h2>
                  <p className="text-sm font-bold text-gray-400">{t('logistics.transport_subtitle', 'Live shipment tracking')}</p>
                </div>
              </div>
              <button className="w-10 h-10 rounded-2xl bg-gray-50 flex items-center justify-center hover:bg-emerald-50 transition-colors group">
                <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-emerald-600 transition-transform group-hover:translate-x-1" />
              </button>
            </div>

            {loadingT ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => <div key={i} className="h-24 bg-gray-50 rounded-3xl animate-pulse" />)}
              </div>
            ) : !transportRows.length ? (
              <div className="py-20 text-center bg-gray-50 rounded-[2rem] border-2 border-dashed border-gray-100">
                <div className="w-20 h-20 rounded-full bg-white shadow-sm flex items-center justify-center mx-auto mb-6">
                  <Truck className="w-10 h-10 text-gray-300" />
                </div>
                <p className="text-gray-400 font-bold">{t('logistics.no_transport', 'No transport requests found')}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {transportRows.map((tr, idx) => (
                  <motion.div 
                    key={tr.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="group border border-gray-100 hover:border-emerald-200 rounded-[2rem] p-6 hover:bg-emerald-50/30 transition-all cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg font-black text-gray-800">{tr.origin}</span>
                          <ArrowRight className="w-4 h-4 text-emerald-500" />
                          <span className="text-lg font-black text-gray-800">{tr.destination}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">
                            {safeDate(tr.pickupStart)} – {safeDate(tr.pickupEnd)}
                          </span>
                        </div>
                      </div>
                      <span className={`text-[10px] font-black px-4 py-1.5 rounded-full border ${statusColor(tr.status)} uppercase tracking-widest`}>
                        {tr.status}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-white rounded-2xl border border-gray-50 group-hover:border-emerald-100 transition-all">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Cargo Load</p>
                        <p className="text-xl font-black text-gray-800">{tr.loadKg?.toLocaleString()}<span className="text-xs font-bold text-gray-400 ml-1">KG</span></p>
                      </div>
                      <div className="p-4 bg-white rounded-2xl border border-gray-50 group-hover:border-emerald-100 transition-all">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Assigned Unit</p>
                        <div className="flex items-center gap-2">
                          <p className={`text-base font-black ${tr.assignedTruck ? 'text-[#00793E]' : 'text-amber-500 italic'}`}>
                            {tr.assignedTruck ?? 'Pending Assign...'}
                          </p>
                          {tr.assignedTruck && <CheckCircle2 className="w-4 h-4 text-[#00793E]" />}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>

          {/* ── Storage Facilities ── */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-[2.5rem] p-10 shadow-xl border border-gray-100"
          >
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-3xl bg-blue-50 flex items-center justify-center text-blue-700">
                  <Warehouse className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-gray-800">{t('logistics.storage_facilities', 'Storage Facilities')}</h2>
                  <p className="text-sm font-bold text-gray-400">{t('logistics.storage_subtitle', 'Certified warehouse network')}</p>
                </div>
              </div>
              <button className="w-10 h-10 rounded-2xl bg-gray-50 flex items-center justify-center hover:bg-blue-50 transition-colors group">
                <Activity className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-all" />
              </button>
            </div>

            {loadingF ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-gray-50 rounded-3xl animate-pulse" />)}
              </div>
            ) : !facilityRows.length ? (
              <div className="py-20 text-center bg-gray-50 rounded-[2rem] border-2 border-dashed border-gray-100">
                <p className="text-gray-400 font-bold">{t('logistics.no_storage', 'No storage facilities found')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {facilityRows.map((f, idx) => {
                  const usedPct = f.capacityKg > 0 ? Math.round(((f.capacityKg - f.availableKg) / f.capacityKg) * 100) : 0;
                  const rawFeatures = (f as any).features;
                  const featureList: string[] = Array.isArray(rawFeatures)
                    ? rawFeatures
                    : typeof rawFeatures === 'string'
                      ? rawFeatures.split(',').map((x: string) => x.trim()).filter(Boolean)
                      : [];
                  return (
                    <motion.div 
                      key={f.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.05 }}
                      className="group border border-gray-100 hover:border-blue-200 rounded-[2rem] p-6 hover:bg-blue-50/20 transition-all cursor-pointer relative overflow-hidden"
                    >
                      <div className="relative z-10">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="text-lg font-black text-gray-800">{f.name}</h4>
                          <span className="p-1.5 rounded-lg bg-gray-50 text-gray-400">
                            <MapPin className="w-4 h-4" />
                          </span>
                        </div>
                        <p className="text-xs font-bold text-gray-400 mb-6 flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {f.location}
                        </p>

                        <div className="space-y-3 mb-6">
                          <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-gray-400">
                            <span>Utility Rate</span>
                            <span className={usedPct > 85 ? 'text-red-500' : usedPct > 60 ? 'text-amber-500' : 'text-emerald-500'}>{usedPct}%</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${usedPct}%` }}
                              className={`h-full rounded-full transition-all ${
                                usedPct > 85 ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.4)]' : 
                                usedPct > 60 ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.4)]' : 
                                'bg-[#00793E] shadow-[0_0_10px_rgba(0,121,62,0.4)]'
                              }`}
                            />
                          </div>
                          <div className="flex justify-between items-center bg-gray-50 rounded-xl p-3">
                            <div>
                              <p className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">Available</p>
                              <p className="text-sm font-black text-gray-700">{(f.availableKg / 1000).toFixed(1)}t</p>
                            </div>
                            <div className="h-6 w-px bg-gray-200"></div>
                            <div className="text-right">
                              <p className="text-[9px] font-black text-gray-400 uppercase tracking-tighter text-right">Capacity</p>
                              <p className="text-sm font-black text-gray-700">{(f.capacityKg / 1000).toFixed(1)}t</p>
                            </div>
                          </div>
                        </div>

                        {featureList.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {featureList.slice(0, 3).map((feat: string) => (
                              <span key={feat} className="text-[9px] font-black uppercase tracking-widest bg-white border border-gray-100 text-gray-500 px-2.5 py-1 rounded-lg">
                                {feat}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
};
