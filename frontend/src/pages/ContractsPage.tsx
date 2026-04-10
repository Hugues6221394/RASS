import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, ShieldCheck, Clock, CheckCircle2, 
  AlertCircle, ArrowRight, Download, PenTool,
  History, Info, ChevronRight, Scale, Search
} from 'lucide-react';

type ContractItem = {
  id: string;
  buyerOrderId?: string;
  trackingId: string;
  status: string;
  crop?: string;
  totalQuantityKg: number;
  totalValue: number;
  buyer?: string;
  cooperative?: string;
  documentTitle?: string;
  documentContent?: string;
  buyerApproved?: boolean;
  sellerApproved?: boolean;
  buyerSigned?: boolean;
  sellerSigned?: boolean;
  escrowStatus?: string;
};

const getStatusStyles = (status: string) => {
  const s = status?.toLowerCase();
  if (s?.includes('approved') || s?.includes('signed') || s?.includes('completed')) 
    return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  if (s?.includes('pending') || s?.includes('review')) 
    return 'bg-amber-50 text-amber-700 border-amber-100';
  if (s?.includes('rejected') || s?.includes('cancelled')) 
    return 'bg-red-50 text-red-700 border-red-100';
  return 'bg-gray-50 text-gray-600 border-gray-100';
};

export const ContractsPage = () => {
  const { hasRole } = useAuth();
  const [contracts, setContracts] = useState<ContractItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ContractItem | null>(null);
  const [actions, setActions] = useState<any>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadContent, setUploadContent] = useState('');
  const [uploadMimeType, setUploadMimeType] = useState('text/plain');
  const [otpCode, setOtpCode] = useState('');
  const [otpOpen, setOtpOpen] = useState(false);
  const [amendOpen, setAmendOpen] = useState(false);
  const [amendComment, setAmendComment] = useState('');

  const currentParty = useMemo<'Buyer' | 'Seller' | null>(() => {
    if (hasRole('Buyer')) return 'Buyer';
    if (hasRole('CooperativeManager')) return 'Seller';
    return null;
  }, [hasRole]);
  const isBuyer = hasRole('Buyer');
  const buyerSummary = useMemo(() => {
    const pendingReview = contracts.filter((c) => c.status === 'PendingApproval').length;
    const pendingSign = contracts.filter((c) => c.status === 'PendingSignature').length;
    const active = contracts.filter((c) => c.status === 'Active' || c.status === 'InDelivery').length;
    const totalValue = contracts.reduce((sum, c) => sum + Number(c.totalValue || 0), 0);
    return { pendingReview, pendingSign, active, totalValue };
  }, [contracts]);

  const nationalSummary = useMemo(() => {
    const total = contracts.length;
    const pendingAction = contracts.filter((c) => ['pendingapproval', 'pendingsignature'].includes(String(c.status || '').toLowerCase())).length;
    const disputed = contracts.filter((c) => String(c.status || '').toLowerCase().includes('disputed')).length;
    const escrowReady = contracts.filter((c) => ['funded', 'released'].includes(String(c.escrowStatus || '').toLowerCase())).length;
    return { total, pendingAction, disputed, escrowReady };
  }, [contracts]);

  const filteredContracts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return contracts;
    return contracts.filter((c) =>
      `${c.trackingId} ${c.crop || ''} ${c.buyer || ''} ${c.cooperative || ''} ${c.status || ''}`
        .toLowerCase()
        .includes(q),
    );
  }, [contracts, searchTerm]);

  const lifecycle = useMemo(() => {
    if (!detail) return [];
    const d: any = detail;
    const status = String(d.status || '').toLowerCase();
    const reviewComplete = Boolean(d.review?.bothApproved ?? (d.buyerApproved && d.sellerApproved));
    const signatureComplete = Boolean(d.signature?.bothSigned ?? (d.buyerSigned && d.sellerSigned));
    const escrowStatus = String(d.escrow?.escrowStatus ?? d.escrowStatus ?? '').toLowerCase();
    const escrowComplete = escrowStatus.includes('funded') || escrowStatus.includes('released');
    const deliveryComplete = status.includes('delivery') || status.includes('completed');

    return [
      { key: 'review', label: 'Review', done: reviewComplete || status.includes('pendingsignature') || status.includes('active') || status.includes('delivery') || status.includes('completed') },
      { key: 'signature', label: 'Signature', done: signatureComplete || status.includes('active') || status.includes('delivery') || status.includes('completed') },
      { key: 'escrow', label: 'Escrow', done: escrowComplete || status.includes('delivery') || status.includes('completed') },
      { key: 'delivery', label: 'Delivery', done: deliveryComplete },
    ];
  }, [detail]);

  const loadContracts = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/contracts', { params: statusFilter === 'all' ? {} : { status: statusFilter } });
      const rows = Array.isArray(res.data) ? res.data : [];
      setContracts(rows);
      if (!selectedId && rows[0]?.id) setSelectedId(rows[0].id);
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (id: string) => {
    const [d, a, tl] = await Promise.all([
      api.get(`/api/contracts/${id}`),
      api.get(`/api/contracts/${id}/actions`),
      api.get(`/api/contracts/${id}/timeline`).catch(() => ({ data: { events: [] } })),
    ]);
    setDetail(d.data);
    setActions(a.data?.actions || null);
    setTimeline(Array.isArray(tl.data?.events) ? tl.data.events : []);
  };

  useEffect(() => { void loadContracts(); }, [statusFilter]);
  useEffect(() => { if (selectedId) void loadDetail(selectedId); }, [selectedId]);

  const act = async (fn: () => Promise<unknown>) => {
    if (!selectedId) return;
    setBusy(true);
    setActionError('');
    setActionSuccess('');
    try {
      const result: any = await fn();
      const message = String(result?.data?.message || '');
      if (message) setActionSuccess(message);
      await loadDetail(selectedId);
      await loadContracts();
    } catch (e: any) {
      setActionError(String(e?.response?.data || e?.message || 'Action failed.'));
    } finally {
      setBusy(false);
    }
  };

  const review = async (approved: boolean) => {
    if (!selectedId || !currentParty) return;
    await act(() => api.post(`/api/contracts/${selectedId}/review`, { party: currentParty, approved }));
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* ── Header ── */}
      <div className="bg-[#064E3B] text-white pt-20 pb-28 px-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500 opacity-10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-[#34D399] opacity-5 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl"></div>
        
        <div className="relative max-w-screen-xl mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20 shadow-2xl backdrop-blur-md">
                <ShieldCheck className="w-6 h-6 text-[#34D399]" />
              </div>
              <div>
                <span className="text-[#34D399] text-[10px] font-black uppercase tracking-[0.2em] block">Trust & Compliance</span>
                <span className="text-white/60 text-[10px] font-bold uppercase tracking-widest">National Contract Center</span>
              </div>
            </div>
            <h1 className="text-5xl font-black text-white font-display mb-4">
              Secure <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#34D399] to-emerald-200">Digital Agreements</span>
            </h1>
            <p className="text-lg text-[#A7F3D0] font-medium max-w-xl opacity-80 leading-relaxed">
              Legally binding smart contracts powered by Rwanda's digital agricultural standard for total supply chain transparency.
            </p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 -mt-16 pb-20 relative z-10">
        <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Contracts in scope</p>
            <p className="mt-1 text-2xl font-black text-slate-900">{nationalSummary.total}</p>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Pending action</p>
            <p className="mt-1 text-2xl font-black text-amber-700">{nationalSummary.pendingAction}</p>
          </div>
          <div className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Disputes</p>
            <p className="mt-1 text-2xl font-black text-red-700">{nationalSummary.disputed}</p>
          </div>
          <div className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Escrow ready</p>
            <p className="mt-1 text-2xl font-black text-blue-700">{nationalSummary.escrowReady}</p>
          </div>
        </div>
        {isBuyer && (
          <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Pending review</p>
              <p className="mt-1 text-2xl font-black text-amber-700">{buyerSummary.pendingReview}</p>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Pending signature</p>
              <p className="mt-1 text-2xl font-black text-blue-700">{buyerSummary.pendingSign}</p>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Active flow</p>
              <p className="mt-1 text-2xl font-black text-emerald-700">{buyerSummary.active}</p>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Total contract value</p>
              <p className="mt-1 text-2xl font-black text-slate-900">{buyerSummary.totalValue.toLocaleString()} RWF</p>
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* ── Sidebar: Contract List ── */}
          <div className="lg:col-span-4 space-y-6">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white rounded-[2.5rem] shadow-xl border border-gray-100 overflow-hidden flex flex-col h-[600px]"
            >
              <div className="p-6 border-b border-gray-50 flex items-center justify-between">
                <h2 className="text-xl font-black text-gray-800 tracking-tight">Active Contracts</h2>
                <div className="flex items-center gap-2">
                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-gray-600">
                    <option value="all">All</option>
                    <option value="PendingApproval">PendingApproval</option>
                    <option value="PendingSignature">PendingSignature</option>
                    <option value="Active">Active</option>
                    <option value="InDelivery">InDelivery</option>
                    <option value="Disputed">Disputed</option>
                    <option value="Completed">Completed</option>
                  </select>
                  <div className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center text-[10px] font-black text-gray-400 border border-gray-100 italic">
                    {filteredContracts.length}
                  </div>
                </div>
              </div>
              <div className="px-6 pb-4 pt-3 border-b border-gray-50">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search tracking ID, crop, party, status..."
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-emerald-400 focus:bg-white"
                  />
                </label>
              </div>
              
              <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
                {loading ? (
                  [1, 2, 3, 4].map(i => <div key={i} className="h-20 bg-gray-50 rounded-2xl animate-pulse" />)
                ) : filteredContracts.length === 0 ? (
                  <div className="p-10 text-center opacity-30">
                    <History className="w-12 h-12 mx-auto mb-4" />
                    <p className="font-bold">No history available</p>
                  </div>
                ) : (
                  filteredContracts.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedId(c.id)}
                      className={`w-full text-left rounded-2xl p-4 transition-all group border
                        ${selectedId === c.id 
                          ? 'border-emerald-200 bg-emerald-50 shadow-sm' 
                          : 'border-transparent hover:bg-gray-50 hover:border-gray-100'}`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="font-black text-sm text-gray-800">#{c.trackingId}</p>
                        <ChevronRight className={`w-4 h-4 transition-transform ${selectedId === c.id ? 'translate-x-1 text-[#00793E]' : 'text-gray-300'}`} />
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">{c.crop || 'Agreement'} • {Number(c.totalQuantityKg || 0).toLocaleString()}kg</p>
                        <span className={`text-[8px] font-black px-2 py-0.5 rounded-full border ${getStatusStyles(c.status)} uppercase tracking-[0.05em]`}>
                          {c.status}
                        </span>
                      </div>
                      <p className="mt-1 text-[10px] font-bold text-gray-400">{Number(c.totalValue || 0).toLocaleString()} RWF</p>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </div>

          {/* ── Detail View ── */}
          <div className="lg:col-span-8">
            <AnimatePresence mode="wait">
              {detail ? (
                <motion.div 
                  key={detail.id}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="space-y-6"
                >
                  <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-gray-100">
                    <div className="flex flex-wrap items-center justify-between gap-6 mb-10 pb-8 border-b border-gray-50">
                      <div className="flex items-center gap-5">
                        <div className="w-16 h-16 rounded-3xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-900/10">
                          <FileText className="w-8 h-8" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h2 className="text-3xl font-black text-gray-800 tracking-tight">{detail.trackingId}</h2>
                            <span className={`px-4 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest ${getStatusStyles(detail.status)}`}>
                              {detail.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-400">
                              <Scale className="w-3.5 h-3.5" />
                              Escrow: <span className="text-[#00793E]">{detail.escrowStatus || 'None'}</span>
                            </div>
                            <span className="w-1 h-1 rounded-full bg-gray-200"></span>
                            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-400">
                              <Clock className="w-3.5 h-3.5" />
                              Last Action: Just now
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            const content = detail.documentContent || '';
                            const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `${detail.trackingId || 'contract'}.txt`;
                            document.body.appendChild(a);
                            a.click();
                            a.remove();
                            URL.revokeObjectURL(url);
                          }}
                          className="px-6 py-3 bg-gray-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 active:scale-95 transition-all shadow-xl shadow-gray-900/20"
                        >
                          <Download className="w-4 h-4" /> Download
                        </button>
                        {(hasRole('Buyer') || hasRole('CooperativeManager') || hasRole('Admin')) && String(detail.status || '').toLowerCase() === 'completed' && (
                          <button
                            onClick={() => {
                              void act(() => api.delete(`/api/contracts/${detail.id}`));
                              setSelectedId(null);
                            }}
                            className="px-6 py-3 bg-red-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 active:scale-95 transition-all shadow-xl shadow-red-900/20"
                          >
                            Delete completed
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
                      {[
                        { label: 'Crop Variety', value: detail.crop || '—', icon: <History className="w-4 h-4" /> },
                        { label: 'Total Volume', value: `${(detail.totalQuantityKg || 0).toLocaleString()} kg`, icon: <CheckCircle2 className="w-4 h-4" /> },
                        { label: 'Market Value', value: `${(detail.totalValue || 0).toLocaleString()} RWF`, icon: <CheckCircle2 className="w-4 h-4" /> },
                        { label: 'Agreement Type', value: detail.documentTitle || 'Standard', icon: <AlertCircle className="w-4 h-4" /> }
                      ].map((item, i) => (
                        <div key={i} className="p-5 bg-gray-50 rounded-3xl border border-transparent hover:border-emerald-100 hover:bg-emerald-50/50 transition-all">
                          <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-gray-400 mb-4 shadow-sm">
                            {item.icon}
                          </div>
                          <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">{item.label}</p>
                          <p className="text-base font-black text-gray-800">{item.value}</p>
                        </div>
                      ))}
                    </div>

                    {isBuyer && (
                      <div className="mb-8 rounded-2xl border border-blue-100 bg-blue-50 p-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-blue-700">Order linkage</p>
                        <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
                          <p className="text-xs font-semibold text-slate-700">Buyer order: <span className="font-black">{detail.buyerOrderId || 'N/A'}</span></p>
                          <p className="text-xs font-semibold text-slate-700">Crop: <span className="font-black">{detail.crop || 'N/A'}</span></p>
                          <p className="text-xs font-semibold text-slate-700">Quantity: <span className="font-black">{Number(detail.totalQuantityKg || 0).toLocaleString()} kg</span></p>
                        </div>
                      </div>
                    )}

                    {isBuyer && lifecycle.length > 0 && (
                      <div className="mb-8 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Contract progress flow</p>
                        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-4">
                          {lifecycle.map((step, idx) => (
                            <div key={step.key} className={`rounded-xl border px-3 py-2 ${step.done ? 'border-emerald-200 bg-white text-emerald-800' : 'border-slate-200 bg-white text-slate-500'}`}>
                              <p className="text-[10px] font-black uppercase tracking-widest">Step {idx + 1}</p>
                              <p className="text-sm font-black">{step.label}</p>
                              <p className="text-[11px]">{step.done ? 'Complete' : 'Pending'}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="bg-[#0D1B12] rounded-[2rem] p-10 text-white relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500 opacity-5 rounded-full translate-x-1/2 -translate-y-1/2 blur-3xl group-hover:opacity-10 transition-opacity"></div>
                      <div className="relative">
                        <div className="flex items-center gap-3 mb-8">
                          <div className="w-1.5 h-6 bg-emerald-500 rounded-full"></div>
                          <h3 className="text-xl font-black uppercase tracking-tighter">Agreement Document</h3>
                        </div>
                        <div className="bg-white/5 rounded-3xl p-8 border border-white/10 backdrop-blur-sm min-h-[300px]">
                          <p className="text-emerald-100 font-medium leading-relaxed font-mono text-sm whitespace-pre-wrap selection:bg-[#34D399] selection:text-gray-900">
                            {detail.documentContent || 'No contract text uploaded yet.'}
                          </p>
                        </div>
                        {(detail.documentContent || '').includes('AMENDMENT REQUEST') && (
                          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/90 p-4 text-slate-800">
                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">Amendment requests</p>
                            <div className="mt-2 space-y-1">
                              {(detail.documentContent || '').split('\n').filter((line) => line.includes('AMENDMENT REQUEST')).map((line, idx) => (
                                <p key={idx} className="text-xs font-semibold">{line}</p>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {currentParty && (
                      <div className="mt-8 pt-8 border-t border-gray-50 flex flex-wrap items-center justify-between gap-6">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#00793E] flex items-center justify-center">
                            <PenTool className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Signer Role</p>
                            <p className="font-black text-gray-800">{currentParty} Identity</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-3">
                          {((actions?.approveAsBuyer && currentParty === 'Buyer') || (actions?.approveAsSeller && currentParty === 'Seller')) && (
                          <button 
                            disabled={busy} 
                            onClick={() => review(true)} 
                            className="px-8 py-4 bg-[#00793E] hover:bg-[#005F30] text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-900/10 active:scale-95 flex items-center gap-2"
                          >
                            <CheckCircle2 className="w-4 h-4" /> Approve Agreement
                          </button>
                          )}
                          {((actions?.approveAsBuyer && currentParty === 'Buyer') || (actions?.approveAsSeller && currentParty === 'Seller')) && (
                          <button 
                            disabled={busy} 
                            onClick={() => setAmendOpen(true)} 
                            className="px-8 py-4 bg-white border-2 border-gray-100 text-gray-500 hover:bg-gray-50 hover:border-gray-200 rounded-2xl text-xs font-black uppercase tracking-widest transition-all active:scale-95"
                          >
                            Request Amendments
                          </button>
                          )}
                          
                          {/* Dynamic Actions */}
                          {((actions?.uploadBuyerDocument && currentParty === 'Buyer') || (actions?.uploadSellerDocument && currentParty === 'Seller')) && (
                            <button
                              disabled={busy}
                              onClick={() => {
                                setUploadTitle(detail.documentTitle || 'Revised Contract Agreement');
                                setUploadContent(detail.documentContent || '');
                                setUploadMimeType('text/plain');
                                setUploadOpen(true);
                              }}
                              className="px-6 py-4 bg-blue-50 text-blue-700 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-blue-100 transition-all"
                            >
                              Upload Revised Terms
                            </button>
                          )}
                          
                          {((actions?.requestBuyerSignature && currentParty === 'Buyer') || (actions?.requestSellerSignature && currentParty === 'Seller')) && (
                            <button 
                              disabled={busy} 
                              onClick={() => act(() => api.post(`/api/contracts/${detail.id}/request-signature`, { party: currentParty }))} 
                              className="px-8 py-4 bg-emerald-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-900/10"
                            >
                              Request Signature OTP
                            </button>
                          )}
                          
                          {((actions?.verifyBuyerSignature && currentParty === 'Buyer') || (actions?.verifySellerSignature && currentParty === 'Seller')) && (
                            <button
                              disabled={busy}
                              onClick={() => {
                                setOtpCode('');
                                setOtpOpen(true);
                              }}
                              className="px-8 py-4 bg-[#00793E] text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-emerald-900/20 active:scale-95 transition-all flex items-center gap-2"
                            >
                              <PenTool className="w-4 h-4" /> Sign Digitally
                            </button>
                          )}

                          {actions?.fundEscrow && (
                            <button
                              disabled={busy}
                              onClick={() => {
                                const amount = window.prompt('Escrow amount', String(detail.totalValue || 0));
                                if (!amount) return;
                                void act(() => api.post(`/api/contracts/${detail.id}/fund-escrow`, { amount: Number(amount), paymentMethod: 'MobileMoney' }));
                              }}
                              className="px-6 py-4 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all"
                            >
                              Fund Escrow
                            </button>
                          )}

                          {actions?.releaseEscrow && (
                            <button
                              disabled={busy}
                              onClick={() => act(() => api.post(`/api/contracts/${detail.id}/release-escrow`))}
                              className="px-6 py-4 bg-emerald-700 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-emerald-800 transition-all"
                            >
                              Release Escrow
                            </button>
                          )}

                          {actions?.raiseDispute && (
                            <button
                              disabled={busy}
                              onClick={() => {
                                const reason = window.prompt('Dispute reason');
                                if (!reason) return;
                                void act(() => api.post(`/api/contracts/${detail.id}/dispute`, { reason }));
                              }}
                              className="px-6 py-4 bg-amber-100 text-amber-800 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-amber-200 transition-all"
                            >
                              Raise Dispute
                            </button>
                          )}

                          {hasRole('Admin') && actions?.resolveDispute && (
                            <button
                              disabled={busy}
                              onClick={() => {
                                const resolution = window.prompt('Resolution: ReleaseFunds | Refund | PartialRefund', 'ReleaseFunds');
                                if (!resolution) return;
                                void act(() => api.post(`/api/contracts/${detail.id}/resolve-dispute`, { resolution, notes: 'Admin resolution from contract center' }));
                              }}
                              className="px-6 py-4 bg-red-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-red-700 transition-all"
                            >
                              Resolve Dispute
                            </button>
                          )}
                        </div>
                        {(actionError || actionSuccess) && (
                          <div className={`w-full rounded-xl px-3 py-2 text-xs font-semibold ${actionError ? 'border border-red-200 bg-red-50 text-red-700' : 'border border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                            {actionError || actionSuccess}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="mt-8 pt-8 border-t border-gray-50">
                      <h3 className="text-lg font-black text-gray-800 mb-4 uppercase tracking-tight">Contract Timeline</h3>
                      <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar">
                        {timeline.length === 0 ? (
                          <p className="text-sm text-gray-400">No timeline events yet.</p>
                        ) : timeline.map((event, idx) => (
                          <div key={idx} className="rounded-xl border border-gray-100 bg-gray-50 p-3 flex items-center justify-between gap-3">
                            <div>
                              <p className="text-xs font-black text-gray-700 uppercase tracking-widest">{event.type} · {event.action}</p>
                              <p className="text-[11px] text-gray-500">{event.origin && event.destination ? `${event.origin} → ${event.destination}` : (event.metadata || event.reference || 'Event logged')}</p>
                            </div>
                            <p className="text-[10px] font-bold text-gray-500">{event.at ? new Date(event.at).toLocaleString() : '-'}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <div className="bg-white rounded-[3rem] p-24 shadow-xl border border-gray-100 flex flex-col items-center text-center">
                  <div className="w-32 h-32 rounded-[2.5rem] bg-gray-50 flex items-center justify-center text-gray-300 mb-8 border border-dashed border-gray-200">
                    <FileText className="w-12 h-12" />
                  </div>
                  <h3 className="text-3xl font-black text-gray-800 mb-4 tracking-tight">Contract Nexus</h3>
                  <p className="text-lg text-gray-400 font-bold max-w-sm">Select a contract from the sidebar to view legal terms, sign documents, and track escrow status.</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
      {uploadOpen && detail && currentParty && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <h3 className="text-lg font-black text-slate-900">Upload revised terms</h3>
              <p className="mt-1 text-xs text-slate-500">Choose a local file or paste revised contract terms below.</p>
            <div className="mt-3 grid gap-3">
              <input
                type="text"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                placeholder="Document title"
                className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
              />
                <input
                  type="file"
                  accept=".txt,.md,.json,.html,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setUploadMimeType(file.type || 'application/octet-stream');
                    const reader = new FileReader();
                    reader.onload = () => {
                      const content = String(reader.result || '');
                      setUploadContent(content.slice(0, 7800));
                    };
                    reader.readAsText(file);
                  }}
                  className="block w-full text-xs text-slate-600"
                />
              <textarea
                value={uploadContent}
                onChange={(e) => setUploadContent(e.target.value)}
                rows={12}
                placeholder="Paste revised contract terms..."
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold" onClick={() => setUploadOpen(false)}>Cancel</button>
              <button
                type="button"
                disabled={busy || !uploadTitle.trim() || !uploadContent.trim()}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                onClick={() => {
                  void act(() => api.post(`/api/contracts/${detail.id}/upload-document`, {
                    party: currentParty,
                    documentTitle: uploadTitle.trim(),
                    documentContent: uploadContent.trim(),
                    documentMimeType: uploadMimeType,
                  }));
                  setUploadOpen(false);
                }}
              >
                Save revised terms
              </button>
            </div>
          </div>
        </div>
      )}
      {otpOpen && detail && currentParty && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <h3 className="text-lg font-black text-slate-900">Verify signature OTP</h3>
            <p className="mt-1 text-xs text-slate-500">Enter the 6-digit OTP sent for {currentParty.toLowerCase()} signing.</p>
            <input
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="6-digit OTP"
              className="mt-3 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm tracking-[0.3em]"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold" onClick={() => setOtpOpen(false)}>Cancel</button>
              <button
                type="button"
                disabled={busy || otpCode.length !== 6}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                onClick={() => {
                  void act(() => api.post(`/api/contracts/${detail.id}/verify-signature`, { party: currentParty, otp: otpCode }));
                  setOtpOpen(false);
                }}
              >
                Sign contract
              </button>
            </div>
          </div>
        </div>
      )}
      {amendOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <h3 className="text-lg font-black text-slate-900">Request amendments</h3>
            <p className="mt-1 text-xs text-slate-500">Explain what should change in this agreement.</p>
            <textarea
              value={amendComment}
              onChange={(e) => setAmendComment(e.target.value)}
              rows={6}
              placeholder="Describe required changes..."
              className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold" onClick={() => setAmendOpen(false)}>Cancel</button>
              <button
                type="button"
                disabled={busy}
                className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                onClick={() => {
                  void act(() => api.post(`/api/contracts/${selectedId}/review`, { party: currentParty, approved: false, comment: amendComment.trim() || null }));
                  setAmendOpen(false);
                  setAmendComment('');
                }}
              >
                Submit amendment request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
