import { useEffect, useMemo, useState } from 'react';
import { Activity, BarChart3, BrainCircuit, Download, FileText, LayoutDashboard, Package, Thermometer, TrendingUp, Warehouse } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useSignalR } from '../context/SignalRContext';
import { DashboardShell } from '../components/layout/DashboardShell';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Loader } from '../components/ui/Loader';
import { RoleAIAnalyticsPanel } from '../components/RoleAIAnalyticsPanel';
import { NationalMarketPulsePanel } from '../components/NationalMarketPulsePanel';
import { RoleAssistantCard } from '../components/RoleAssistantCard';
import { RwandaLocationFields } from '../components/location/RwandaLocationFields';
import { buildLocationText, emptyRwandaLocation, parseLocationText } from '../utils/rwandaLocation';

import { PriceChart } from '../components/charts/PriceChart';
import { exportReportCsv } from '../utils/exportCsv';

type Tab = 'overview' | 'capacity' | 'bookings' | 'inventory' | 'monitoring' | 'reports' | 'ai-assistant';

const FAQS = [
  {
    q: 'How does the system know the storage temperature and measure it?',
    a: 'The platform integrates storage-zone sensors (thermocouples or IoT probes). Readings are streamed at configured intervals, saved in telemetry logs, and threshold rules trigger alerts when values drift outside safe ranges.',
  },
  {
    q: 'Are these utilization and booking numbers hardcoded?',
    a: 'No. Capacity, utilization, inventory, and booking figures are loaded from live database records and update as real bookings and inventory states change.',
  },
  {
    q: 'How are spoilage risks detected?',
    a: 'The module combines storage duration, crop type, and telemetry trends (temperature/humidity) to flag elevated spoilage risk and recommend corrective actions.',
  },
];

export const StorageDashboardPage = () => {
  const { user, logout } = useAuth();
  const { notifications } = useSignalR();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [lots, setLots] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [facilities, setFacilities] = useState<any[]>([]);
  const [telemetry, setTelemetry] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [marketPrices, setMarketPrices] = useState<any[]>([]);
  const [bookingForm, setBookingForm] = useState({ storageFacilityId: '', quantityKg: '', startDate: '', endDate: '' });
  const [facilityForm, setFacilityForm] = useState({ id: '', name: '', location: '', capacityKg: '', availableKg: '', features: '' });
  const [facilityLocationForm, setFacilityLocationForm] = useState(emptyRwandaLocation());
  const [telemetryProvenance] = useState({
    sensorSource: 'IoT probes (thermocouples + humidity sensors)',
    pollingInterval: '5 minutes',
    calibrationStatus: 'Quarterly calibration required; last checks tracked by ops SOP',
  });

  const loadData = async () => {
    setLoading(true);
    const [sR, inventoryR, bookingsR, facilitiesR, telemetryR, alertsR, pricesR] = await Promise.all([
      api.get('/api/storage/stats').catch(() => ({ data: null })),
      api.get('/api/storage/inventory').catch(() => ({ data: [] })),
      api.get('/api/storage/bookings').catch(() => ({ data: [] })),
      api.get('/api/storage/facilities').catch(() => ({ data: [] })),
      api.get('/api/tracking/telemetry').catch(() => ({ data: [] })),
      api.get('/api/ai-insights/alerts?status=Open&pageSize=6').catch(() => ({ data: { alerts: [] } })),
      api.get('/api/marketprices/latest').catch(() => ({ data: [] })),
    ]);
    setStats(sR.data);
    setLots(Array.isArray(inventoryR.data) ? inventoryR.data : []);
    setBookings(Array.isArray(bookingsR.data) ? bookingsR.data : []);
    setFacilities(Array.isArray(facilitiesR.data) ? facilitiesR.data : []);
    setTelemetry(Array.isArray(telemetryR.data) ? telemetryR.data : []);
    setAlerts(Array.isArray(alertsR.data?.alerts) ? alertsR.data.alerts : []);
    setMarketPrices(Array.isArray(pricesR.data) ? pricesR.data.slice(0, 8) : []);
    setLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (notifications.length > 0) void loadData();
  }, [notifications.length]);

  const activeBookings = useMemo(() => bookings.filter((b) => !['released', 'completed', 'rejected'].includes(String(b.status || '').toLowerCase())), [bookings]);
  const pendingBookings = useMemo(() => bookings.filter((b) => String(b.status || '').toLowerCase() === 'reserved').length, [bookings]);
  const telemetryAlerts = useMemo(() => {
    return telemetry.filter((t: any) => Number(t.temperatureC ?? t.temperature ?? 0) > 30 || Number(t.humidity ?? 0) > 75).slice(0, 5);
  }, [telemetry]);

  const createBooking = async () => {
    await api.post('/api/storage/book', {
      storageFacilityId: bookingForm.storageFacilityId,
      quantityKg: Number(bookingForm.quantityKg),
      startDate: bookingForm.startDate,
      endDate: bookingForm.endDate,
    });
    setBookingForm({ storageFacilityId: '', quantityKg: '', startDate: '', endDate: '' });
    await loadData();
  };

  const handleBooking = async (id: string, approved: boolean) => {
    const notes = approved ? '' : (window.prompt('Rejection reason (optional)') || '');
    await api.post(`/api/storage/bookings/${id}/handle`, { approved, notes });
    await loadData();
  };

  const releaseBooking = async (id: string) => {
    await api.post(`/api/storage/bookings/${id}/release`);
    await loadData();
  };

  const saveFacility = async () => {
    const payload = {
      name: facilityForm.name,
      location: buildLocationText(facilityLocationForm),
      capacityKg: Number(facilityForm.capacityKg),
      availableKg: facilityForm.availableKg ? Number(facilityForm.availableKg) : undefined,
      features: facilityForm.features,
    };
    if (facilityForm.id) await api.put(`/api/storage/facilities/${facilityForm.id}`, payload);
    else await api.post('/api/storage/facilities', payload);
    setFacilityForm({ id: '', name: '', location: '', capacityKg: '', availableKg: '', features: '' });
    setFacilityLocationForm(emptyRwandaLocation());
    await loadData();
  };

  const deleteFacility = async (id: string) => {
    if (!window.confirm('Delete this storage facility?')) return;
    await api.delete(`/api/storage/facilities/${id}`);
    await loadData();
  };

  if (loading) return <Loader label="Loading storage dashboard..." />;

  return (
    <DashboardShell
      brand="RASS Storage"
      subtitle="Warehouse operations"
      title="Storage operator dashboard"
      activeKey={activeTab}
      navItems={[
        { key: 'overview', label: 'Overview', icon: <LayoutDashboard className="h-4 w-4" /> },
        { key: 'capacity', label: 'Capacity', icon: <Warehouse className="h-4 w-4" /> },
        { key: 'bookings', label: `Bookings${pendingBookings > 0 ? ` (${pendingBookings})` : ''}`, icon: <Package className="h-4 w-4" /> },
        { key: 'inventory', label: 'Inventory', icon: <BarChart3 className="h-4 w-4" /> },
        { key: 'monitoring', label: 'Monitoring', icon: <Thermometer className="h-4 w-4" /> },
        { key: 'reports', label: 'Reports', icon: <FileText className="h-4 w-4" /> },
        { key: 'ai-assistant', label: 'AI Assistant', icon: <BrainCircuit className="h-4 w-4" /> },
      ]}
      onNavChange={(k) => setActiveTab(k as Tab)}
      onLogout={logout}
      rightStatus={user?.fullName || 'Storage operator'}
    >
      <div className="space-y-6">
        {activeTab === 'overview' && (
          <div className="space-y-5">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
              <button type="button" onClick={() => setActiveTab('capacity')} className="text-left">
                <Card className="p-4 bg-gradient-to-br from-emerald-700 to-emerald-500 text-white">
                  <p className="text-[10px] uppercase tracking-wider text-emerald-100">Utilization</p>
                  <p className="mt-1 text-2xl font-black">{stats?.utilization ?? 0}%</p>
                </Card>
              </button>
              <button type="button" onClick={() => setActiveTab('inventory')} className="text-left">
                <Card className="p-4 bg-gradient-to-br from-blue-700 to-blue-500 text-white">
                  <p className="text-[10px] uppercase tracking-wider text-blue-100">Stored lots</p>
                  <p className="mt-1 text-2xl font-black">{lots.length}</p>
                </Card>
              </button>
              <button type="button" onClick={() => setActiveTab('bookings')} className="text-left">
                <Card className="p-4 bg-gradient-to-br from-violet-700 to-violet-500 text-white">
                  <p className="text-[10px] uppercase tracking-wider text-violet-100">Active bookings</p>
                  <p className="mt-1 text-2xl font-black">{activeBookings.length}</p>
                </Card>
              </button>
              <button type="button" onClick={() => setActiveTab('capacity')} className="text-left">
                <Card className="p-4">
                  <p className="text-[10px] font-semibold uppercase text-slate-400">Facilities</p>
                  <p className="mt-1 text-2xl font-black text-slate-900">{facilities.length}</p>
                </Card>
              </button>
              <button type="button" onClick={() => setActiveTab('monitoring')} className="text-left">
                <Card className="p-4">
                  <p className="text-[10px] font-semibold uppercase text-amber-500">Alerts</p>
                  <p className="mt-1 text-2xl font-black text-amber-700">{alerts.length + telemetryAlerts.length}</p>
                </Card>
              </button>
              <Card className="p-4">
                <p className="text-[10px] font-semibold uppercase text-slate-400">Total capacity</p>
                <p className="mt-1 text-2xl font-black text-slate-900">{facilities.reduce((s: number, f: any) => s + Number(f.capacityKg || 0), 0).toLocaleString()} <span className="text-xs">kg</span></p>
              </Card>
            </div>

            {/* Capacity Visual */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card className="p-5">
                <h3 className="text-base font-black text-slate-900">Capacity by facility</h3>
                <div className="mt-3 space-y-3">
                  {facilities.map((f: any) => {
                    const total = Number(f.capacityKg || 0);
                    const avail = Number(f.availableKg || 0);
                    const used = total - avail;
                    const pct = total > 0 ? Math.round((used / total) * 100) : 0;
                    return (
                      <div key={f.id} className="rounded-xl border border-slate-200 p-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-bold text-slate-900">{f.name}</p>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${pct > 80 ? 'bg-red-50 text-red-700' : pct > 50 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{pct}% used</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">{used.toLocaleString()} / {total.toLocaleString()} kg • {avail.toLocaleString()} kg available</p>
                        <div className="mt-1.5 h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                          <div className={`h-full rounded-full ${pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                  {facilities.length === 0 && <p className="py-4 text-center text-xs text-slate-400">No facilities registered. Go to Capacity tab to create one.</p>}
                </div>
              </Card>

              <Card className="p-5">
                <h3 className="text-base font-black text-slate-900">Recent booking activity</h3>
                <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
                  {bookings.slice(0, 10).map((b: any) => (
                    <div key={b.id} className="rounded-xl border border-slate-100 px-3 py-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-800">{Number(b.quantityKg || 0).toLocaleString()} kg</p>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${String(b.status || '').toLowerCase() === 'approved' || String(b.status || '').toLowerCase() === 'active' ? 'bg-emerald-50 text-emerald-700' : String(b.status || '').toLowerCase() === 'reserved' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{b.status}</span>
                      </div>
                      <p className="text-xs text-slate-500">{b.facility || b.storageFacility || ''} • {b.startDate?.slice(0, 10)} – {b.endDate?.slice(0, 10)}</p>
                    </div>
                  ))}
                  {bookings.length === 0 && <p className="py-4 text-center text-xs text-slate-400">No bookings yet.</p>}
                </div>
              </Card>
            </div>

            <PriceChart
              title="Capacity distribution across facilities"
              data={facilities.map((f: any) => ({ name: f.name || 'Unnamed', value: Number(f.capacityKg || 0) }))}
            />

            <RoleAIAnalyticsPanel contextData={{ bookings, facilities, lots }} />
            <NationalMarketPulsePanel title="Storage market pulse" />
          </div>
        )}

        {activeTab === 'capacity' && (
          <Card className="p-5 space-y-5">
            <h3 className="text-lg font-black text-slate-900">{facilityForm.id ? 'Edit storage capacity' : 'Create storage capacity'}</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Input label="Facility name" value={facilityForm.name} onChange={(e) => setFacilityForm((p) => ({ ...p, name: e.target.value }))} />
              <div className="md:col-span-2">
                <RwandaLocationFields
                  value={facilityLocationForm}
                  onChange={setFacilityLocationForm}
                  showDetail
                  detailRequired
                  detailLabel="Facility location"
                  detailPlaceholder="Warehouse name, block, or gate reference"
                />
              </div>
              <Input label="Total capacity (kg)" type="number" value={facilityForm.capacityKg} onChange={(e) => setFacilityForm((p) => ({ ...p, capacityKg: e.target.value }))} />
              <Input label="Available capacity (kg)" type="number" value={facilityForm.availableKg} onChange={(e) => setFacilityForm((p) => ({ ...p, availableKg: e.target.value }))} />
              <Input label="Features (comma separated)" className="md:col-span-2" value={facilityForm.features} onChange={(e) => setFacilityForm((p) => ({ ...p, features: e.target.value }))} />
            </div>
            <div className="flex gap-2">
              <Button onClick={saveFacility}>{facilityForm.id ? 'Update capacity' : 'Create capacity'}</Button>
              {facilityForm.id && <Button variant="outline" onClick={() => { setFacilityForm({ id: '', name: '', location: '', capacityKg: '', availableKg: '', features: '' }); setFacilityLocationForm(emptyRwandaLocation()); }}>Cancel edit</Button>}
            </div>
            <div className="space-y-2">
              {facilities.map((f: any) => (
                <div key={f.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-semibold">{f.name}</p>
                    <p className="text-xs text-slate-500">{f.location} • Cap: {Number(f.capacityKg || 0).toLocaleString()}kg • Avail: {Number(f.availableKg || 0).toLocaleString()}kg</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => {
                      setFacilityForm({
                        id: f.id || '',
                        name: f.name || '',
                        location: f.location || '',
                        capacityKg: String(f.capacityKg || ''),
                        availableKg: String(f.availableKg || ''),
                        features: Array.isArray(f.features) ? f.features.join(', ') : (f.features || ''),
                      });
                      setFacilityLocationForm(parseLocationText(f.location || ''));
                    }}>Edit</Button>
                    <Button size="sm" variant="danger" onClick={() => deleteFacility(f.id)}>Delete</Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {activeTab === 'bookings' && (
          <Card className="p-5">
            <h3 className="text-lg font-black text-slate-900">Storage bookings</h3>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-600">Facility</span>
                <select className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" value={bookingForm.storageFacilityId} onChange={(e) => setBookingForm((p) => ({ ...p, storageFacilityId: e.target.value }))}>
                  <option value="">Select facility</option>
                  {facilities.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </label>
              <Input label="Quantity (kg)" type="number" value={bookingForm.quantityKg} onChange={(e) => setBookingForm((p) => ({ ...p, quantityKg: e.target.value }))} />
              <Input label="Start date" type="date" value={bookingForm.startDate} onChange={(e) => setBookingForm((p) => ({ ...p, startDate: e.target.value }))} />
              <Input label="End date" type="date" value={bookingForm.endDate} onChange={(e) => setBookingForm((p) => ({ ...p, endDate: e.target.value }))} />
            </div>
            <div className="mt-4"><Button onClick={createBooking}>Create booking</Button></div>
            <div className="mt-5 space-y-2">
              {bookings.map((b: any) => (
                <div key={b.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-semibold">{Number(b.quantityKg || 0).toLocaleString()} kg • {b.facility || b.storageFacility || 'Facility'}</p>
                    <p className="text-xs text-slate-500">{b.status} • {b.startDate?.slice(0, 10)} - {b.endDate?.slice(0, 10)} {b.tracking ? `• Contract ${b.tracking}` : ''}</p>
                  </div>
                  <div className="flex gap-2">
                    {String(b.status || '').toLowerCase() === 'reserved' && (
                      <>
                        <Button size="sm" onClick={() => handleBooking(b.id, true)}>Approve</Button>
                        <Button size="sm" variant="outline" onClick={() => handleBooking(b.id, false)}>Reject</Button>
                      </>
                    )}
                    {['approved', 'active'].includes(String(b.status || '').toLowerCase()) && <Button size="sm" variant="outline" onClick={() => releaseBooking(b.id)}>Release</Button>}
                    {b.contractId && <Button size="sm" variant="outline" onClick={() => { window.location.href = '/contracts'; }}>Open contract</Button>}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {activeTab === 'monitoring' && (
          <div className="space-y-4">
            <RoleAIAnalyticsPanel contextData={{ bookings, facilities, lots }} />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Card className="p-5">
                <h3 className="text-lg font-black text-slate-900">Live telemetry alerts</h3>
                <div className="mt-3 space-y-2">
                  {telemetryAlerts.length === 0 ? <p className="text-sm text-slate-500">No abnormal telemetry right now.</p> : telemetryAlerts.map((t: any) => (
                    <div key={t.id} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                      Temp {Number(t.temperatureC ?? t.temperature ?? 0).toFixed(1)}°C • Humidity {Number(t.humidity ?? 0).toFixed(1)}%
                    </div>
                  ))}
                </div>
              </Card>
              <Card className="p-5">
                <h3 className="text-lg font-black text-slate-900">Telemetry provenance</h3>
                <div className="mt-3 space-y-2 text-xs text-slate-700">
                  <p><span className="font-black text-slate-900">Sensor source:</span> {telemetryProvenance.sensorSource}</p>
                  <p><span className="font-black text-slate-900">Polling interval:</span> {telemetryProvenance.pollingInterval}</p>
                  <p><span className="font-black text-slate-900">Calibration status:</span> {telemetryProvenance.calibrationStatus}</p>
                </div>
              </Card>
              <Card className="p-5">
                <h3 className="text-lg font-black text-slate-900">Live activity feed</h3>
                <div className="mt-3 space-y-2 max-h-52 overflow-y-auto">
                  {notifications.slice(0, 10).map((n: any, idx: number) => (
                    <div key={n.id || idx} className="rounded-xl border border-slate-200 px-3 py-2 text-xs">
                      <p className="font-semibold text-slate-800">{n.title}</p>
                      <p className="text-slate-500">{n.message}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Card className="p-5">
                <h3 className="text-lg font-black text-slate-900">AI monitoring alerts</h3>
                <div className="mt-3 space-y-2">
                  {alerts.length === 0 ? <p className="text-sm text-slate-500">No open AI alerts.</p> : alerts.map((a: any) => (
                    <div key={a.id} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs">
                      <p className="font-semibold text-amber-800">{a.title}</p>
                      <p className="text-amber-700">{a.description}</p>
                    </div>
                  ))}
                </div>
              </Card>
              <Card className="p-5">
                <h3 className="text-lg font-black text-slate-900">Latest market prices</h3>
                <div className="mt-3 space-y-2">
                  {marketPrices.map((p: any, idx: number) => (
                    <div key={`${p.crop}-${p.market}-${idx}`} className="rounded-xl border border-slate-200 px-3 py-2 text-xs">
                      <p className="font-semibold text-slate-800">{p.crop} • {p.market}</p>
                      <p className="text-slate-600">{Number(p.pricePerKg || 0).toLocaleString()} RWF/kg</p>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
            <RoleAssistantCard
              title="Storage AI Assistant"
              intro="I can help forecast capacity pressure, storage demand, spoilage risk, and contract/storage strategy."
              placeholder="Ask about capacity optimization, telemetry risks, or booking strategy..."
            />
            <Card className="p-5">
              <h3 className="text-lg font-black text-slate-900">Storage FAQ quick answers</h3>
              <div className="mt-3 space-y-3">
                {FAQS.map((f) => (
                  <div key={f.q} className="rounded-xl border border-slate-200 px-3 py-2">
                    <p className="text-sm font-semibold text-slate-900">{f.q}</p>
                    <p className="mt-1 text-xs text-slate-600">{f.a}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'inventory' && (
          <div className="space-y-5">
            {/* Inventory summary cards */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Card className="p-4 bg-gradient-to-br from-emerald-700 to-emerald-500 text-white">
                <p className="text-[10px] uppercase tracking-wider text-emerald-100">Total lots</p>
                <p className="mt-1 text-2xl font-black">{lots.length}</p>
              </Card>
              <Card className="p-4 bg-gradient-to-br from-blue-700 to-blue-500 text-white">
                <p className="text-[10px] uppercase tracking-wider text-blue-100">Total stored</p>
                <p className="mt-1 text-2xl font-black">{lots.reduce((s: number, l: any) => s + Number(l.quantityKg || l.quantity || 0), 0).toLocaleString()} <span className="text-xs">kg</span></p>
              </Card>
              <Card className="p-4">
                <p className="text-[10px] font-semibold uppercase text-amber-500">Aging &gt; 30 days</p>
                <p className="mt-1 text-2xl font-black text-amber-700">
                  {lots.filter((l: any) => {
                    const stored = new Date(l.storedAt || l.createdAt || l.date || '');
                    return !isNaN(stored.getTime()) && (Date.now() - stored.getTime()) > 30 * 86400000;
                  }).length}
                </p>
              </Card>
              <Card className="p-4">
                <p className="text-[10px] font-semibold uppercase text-slate-400">Unique crops</p>
                <p className="mt-1 text-2xl font-black text-slate-900">{new Set(lots.map((l: any) => l.crop || l.cropType || 'Unknown')).size}</p>
              </Card>
            </div>

            {/* Crop breakdown chart */}
            {(() => {
              const cropMap: Record<string, number> = {};
              lots.forEach((l: any) => {
                const crop = l.crop || l.cropType || 'Unknown';
                cropMap[crop] = (cropMap[crop] || 0) + Number(l.quantityKg || l.quantity || 0);
              });
              const chartData = Object.entries(cropMap).map(([name, value]) => ({ name, value }));
              return chartData.length > 0 ? <PriceChart title="Inventory by crop type (kg)" data={chartData} /> : null;
            })()}

            {/* Inventory table */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-black text-slate-900">Inventory details</h3>
                <span className="text-xs text-slate-500">{lots.length} lot{lots.length !== 1 ? 's' : ''} stored</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                      <th className="pb-2 pr-3">Crop</th>
                      <th className="pb-2 pr-3">Quantity (kg)</th>
                      <th className="pb-2 pr-3">Quality</th>
                      <th className="pb-2 pr-3">Facility</th>
                      <th className="pb-2 pr-3">Stored since</th>
                      <th className="pb-2 pr-3">Days stored</th>
                      <th className="pb-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lots.map((l: any, idx: number) => {
                      const storedDate = new Date(l.storedAt || l.createdAt || l.date || '');
                      const daysStored = !isNaN(storedDate.getTime()) ? Math.floor((Date.now() - storedDate.getTime()) / 86400000) : 0;
                      const aging = daysStored > 60 ? 'critical' : daysStored > 30 ? 'warning' : 'good';
                      return (
                        <tr key={l.id || idx} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="py-2 pr-3 font-semibold text-slate-800">{l.crop || l.cropType || 'N/A'}</td>
                          <td className="py-2 pr-3">{Number(l.quantityKg || l.quantity || 0).toLocaleString()}</td>
                          <td className="py-2 pr-3">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${(l.quality || l.grade || '').toLowerCase() === 'a' || (l.quality || '').toLowerCase() === 'premium' ? 'bg-emerald-50 text-emerald-700' : (l.quality || l.grade || '').toLowerCase() === 'b' || (l.quality || '').toLowerCase() === 'standard' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                              {l.quality || l.grade || 'Standard'}
                            </span>
                          </td>
                          <td className="py-2 pr-3 text-slate-600">{l.facilityName || l.facility || l.storageFacility || '—'}</td>
                          <td className="py-2 pr-3 text-slate-500">{!isNaN(storedDate.getTime()) ? storedDate.toLocaleDateString() : '—'}</td>
                          <td className="py-2 pr-3">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${aging === 'critical' ? 'bg-red-50 text-red-700' : aging === 'warning' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                              {daysStored}d
                            </span>
                          </td>
                          <td className="py-2">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${String(l.status || '').toLowerCase() === 'stored' || String(l.status || '').toLowerCase() === 'active' ? 'bg-emerald-50 text-emerald-700' : String(l.status || '').toLowerCase() === 'released' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                              {l.status || 'Stored'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {lots.length === 0 && (
                      <tr><td colSpan={7} className="py-8 text-center text-sm text-slate-400">No inventory lots found. Lots appear here when cooperatives or farmers book storage.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Aging distribution */}
            {(() => {
              const buckets = { '0-7 days': 0, '8-14 days': 0, '15-30 days': 0, '31-60 days': 0, '60+ days': 0 };
              lots.forEach((l: any) => {
                const d = new Date(l.storedAt || l.createdAt || l.date || '');
                if (isNaN(d.getTime())) return;
                const days = Math.floor((Date.now() - d.getTime()) / 86400000);
                if (days <= 7) buckets['0-7 days']++;
                else if (days <= 14) buckets['8-14 days']++;
                else if (days <= 30) buckets['15-30 days']++;
                else if (days <= 60) buckets['31-60 days']++;
                else buckets['60+ days']++;
              });
              const data = Object.entries(buckets).map(([name, value]) => ({ name, value }));
              return <PriceChart title="Lot aging distribution" data={data} />;
            })()}
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="space-y-5">
            {/* Report header */}
            <div className="rounded-2xl bg-gradient-to-r from-[#002D15] via-[#003D20] to-[#00793E] p-6 text-white">
              <h2 className="text-xl font-black">Storage Reports</h2>
              <p className="mt-1 text-sm text-emerald-100">Generate capacity, inventory, and operational reports for your storage facilities.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={() => exportReportCsv('storage')} className="inline-flex items-center gap-1.5 rounded-lg bg-white/20 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/30 transition">
                  <Download className="h-3.5 w-3.5" /> Export storage report
                </button>
                <button onClick={() => exportReportCsv('inventory')} className="inline-flex items-center gap-1.5 rounded-lg bg-white/20 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/30 transition">
                  <Download className="h-3.5 w-3.5" /> Export inventory
                </button>
                <button onClick={() => exportReportCsv('prices')} className="inline-flex items-center gap-1.5 rounded-lg bg-white/20 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/30 transition">
                  <Download className="h-3.5 w-3.5" /> Export market prices
                </button>
              </div>
            </div>

            {/* Quick report cards */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              {/* Capacity report */}
              <Card className="p-5 hover:shadow-lg transition-shadow">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
                    <Warehouse className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900">Capacity report</h4>
                    <p className="text-xs text-slate-500">Utilization & availability</p>
                  </div>
                </div>
                <div className="mt-4 space-y-2 text-xs text-slate-700">
                  <div className="flex justify-between"><span>Total facilities</span><span className="font-bold">{facilities.length}</span></div>
                  <div className="flex justify-between"><span>Total capacity</span><span className="font-bold">{facilities.reduce((s: number, f: any) => s + Number(f.capacityKg || 0), 0).toLocaleString()} kg</span></div>
                  <div className="flex justify-between"><span>Available</span><span className="font-bold">{facilities.reduce((s: number, f: any) => s + Number(f.availableKg || 0), 0).toLocaleString()} kg</span></div>
                  <div className="flex justify-between"><span>Utilization</span><span className="font-bold">{stats?.utilization ?? 0}%</span></div>
                </div>
              </Card>

              {/* Inventory aging report */}
              <Card className="p-5 hover:shadow-lg transition-shadow">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50">
                    <Activity className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900">Inventory aging</h4>
                    <p className="text-xs text-slate-500">Spoilage risk analysis</p>
                  </div>
                </div>
                <div className="mt-4 space-y-2 text-xs text-slate-700">
                  <div className="flex justify-between"><span>Total lots stored</span><span className="font-bold">{lots.length}</span></div>
                  <div className="flex justify-between">
                    <span>Fresh (&lt; 7 days)</span>
                    <span className="font-bold text-emerald-600">{lots.filter((l: any) => { const d = new Date(l.storedAt || l.createdAt || l.date || ''); return !isNaN(d.getTime()) && (Date.now() - d.getTime()) < 7 * 86400000; }).length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Aging (&gt; 30 days)</span>
                    <span className="font-bold text-amber-600">{lots.filter((l: any) => { const d = new Date(l.storedAt || l.createdAt || l.date || ''); return !isNaN(d.getTime()) && (Date.now() - d.getTime()) > 30 * 86400000; }).length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Critical (&gt; 60 days)</span>
                    <span className="font-bold text-red-600">{lots.filter((l: any) => { const d = new Date(l.storedAt || l.createdAt || l.date || ''); return !isNaN(d.getTime()) && (Date.now() - d.getTime()) > 60 * 86400000; }).length}</span>
                  </div>
                </div>
              </Card>

              {/* Booking report */}
              <Card className="p-5 hover:shadow-lg transition-shadow">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                    <Package className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900">Booking activity</h4>
                    <p className="text-xs text-slate-500">Reservation trends</p>
                  </div>
                </div>
                <div className="mt-4 space-y-2 text-xs text-slate-700">
                  <div className="flex justify-between"><span>Total bookings</span><span className="font-bold">{bookings.length}</span></div>
                  <div className="flex justify-between"><span>Active</span><span className="font-bold text-emerald-600">{activeBookings.length}</span></div>
                  <div className="flex justify-between"><span>Pending</span><span className="font-bold text-amber-600">{pendingBookings}</span></div>
                  <div className="flex justify-between">
                    <span>Completed</span>
                    <span className="font-bold text-blue-600">{bookings.filter((b: any) => ['released', 'completed'].includes(String(b.status || '').toLowerCase())).length}</span>
                  </div>
                </div>
              </Card>

              {/* Environmental report */}
              <Card className="p-5 hover:shadow-lg transition-shadow">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50">
                    <Thermometer className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900">Environmental</h4>
                    <p className="text-xs text-slate-500">Temperature & humidity</p>
                  </div>
                </div>
                <div className="mt-4 space-y-2 text-xs text-slate-700">
                  <div className="flex justify-between"><span>Active sensors</span><span className="font-bold">{telemetry.length}</span></div>
                  <div className="flex justify-between"><span>Active alerts</span><span className="font-bold text-red-600">{telemetryAlerts.length}</span></div>
                  <div className="flex justify-between"><span>Avg temp</span><span className="font-bold">{telemetry.length > 0 ? (telemetry.reduce((s: number, t: any) => s + Number(t.temperatureC ?? t.temperature ?? 0), 0) / telemetry.length).toFixed(1) : '—'}°C</span></div>
                  <div className="flex justify-between"><span>Avg humidity</span><span className="font-bold">{telemetry.length > 0 ? (telemetry.reduce((s: number, t: any) => s + Number(t.humidity ?? 0), 0) / telemetry.length).toFixed(1) : '—'}%</span></div>
                </div>
              </Card>
            </div>

            {/* Facility-by-facility report table */}
            <Card className="p-5">
              <h3 className="text-base font-black text-slate-900 mb-4">Facility performance report</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                      <th className="pb-2 pr-3">Facility</th>
                      <th className="pb-2 pr-3">Location</th>
                      <th className="pb-2 pr-3">Capacity (kg)</th>
                      <th className="pb-2 pr-3">Available (kg)</th>
                      <th className="pb-2 pr-3">Utilization</th>
                      <th className="pb-2 pr-3">Lots stored</th>
                      <th className="pb-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {facilities.map((f: any) => {
                      const total = Number(f.capacityKg || 0);
                      const avail = Number(f.availableKg || 0);
                      const pct = total > 0 ? Math.round(((total - avail) / total) * 100) : 0;
                      const lotsInFacility = lots.filter((l: any) => (l.facilityId || l.storageFacilityId) === f.id).length;
                      return (
                        <tr key={f.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="py-2 pr-3 font-semibold text-slate-800">{f.name}</td>
                          <td className="py-2 pr-3 text-slate-600 text-xs">{f.location || '—'}</td>
                          <td className="py-2 pr-3">{total.toLocaleString()}</td>
                          <td className="py-2 pr-3">{avail.toLocaleString()}</td>
                          <td className="py-2 pr-3">
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-16 rounded-full bg-slate-100 overflow-hidden">
                                <div className={`h-full rounded-full ${pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-xs font-bold">{pct}%</span>
                            </div>
                          </td>
                          <td className="py-2 pr-3 text-center">{lotsInFacility}</td>
                          <td className="py-2">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${pct > 90 ? 'bg-red-50 text-red-700' : pct > 70 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                              {pct > 90 ? 'Near full' : pct > 70 ? 'Moderate' : 'Available'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {facilities.length === 0 && (
                      <tr><td colSpan={7} className="py-8 text-center text-sm text-slate-400">No facilities to report on.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Usage trend chart */}
            <PriceChart
              title="Storage usage by facility (kg used)"
              data={facilities.map((f: any) => ({ name: f.name || 'Unnamed', value: Number(f.capacityKg || 0) - Number(f.availableKg || 0) }))}
            />

            {/* Spoilage risk table */}
            <Card className="p-5">
              <h3 className="text-base font-black text-slate-900 mb-1">Spoilage risk assessment</h3>
              <p className="text-xs text-slate-500 mb-4">Lots stored beyond recommended duration may be at risk of quality degradation.</p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                      <th className="pb-2 pr-3">Crop</th>
                      <th className="pb-2 pr-3">Quantity</th>
                      <th className="pb-2 pr-3">Days stored</th>
                      <th className="pb-2 pr-3">Facility</th>
                      <th className="pb-2">Risk level</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lots.filter((l: any) => {
                      const d = new Date(l.storedAt || l.createdAt || l.date || '');
                      return !isNaN(d.getTime()) && (Date.now() - d.getTime()) > 14 * 86400000;
                    }).sort((a: any, b: any) => {
                      const da = new Date(a.storedAt || a.createdAt || a.date || '').getTime();
                      const db = new Date(b.storedAt || b.createdAt || b.date || '').getTime();
                      return da - db;
                    }).map((l: any, idx: number) => {
                      const d = new Date(l.storedAt || l.createdAt || l.date || '');
                      const days = Math.floor((Date.now() - d.getTime()) / 86400000);
                      const risk = days > 60 ? 'High' : days > 30 ? 'Medium' : 'Low';
                      return (
                        <tr key={l.id || idx} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="py-2 pr-3 font-semibold">{l.crop || l.cropType || 'N/A'}</td>
                          <td className="py-2 pr-3">{Number(l.quantityKg || l.quantity || 0).toLocaleString()} kg</td>
                          <td className="py-2 pr-3 font-bold">{days}d</td>
                          <td className="py-2 pr-3 text-slate-600">{l.facilityName || l.facility || '—'}</td>
                          <td className="py-2">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${risk === 'High' ? 'bg-red-50 text-red-700' : risk === 'Medium' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                              {risk}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {lots.filter((l: any) => {
                      const d = new Date(l.storedAt || l.createdAt || l.date || '');
                      return !isNaN(d.getTime()) && (Date.now() - d.getTime()) > 14 * 86400000;
                    }).length === 0 && (
                      <tr><td colSpan={5} className="py-8 text-center text-sm text-emerald-600 font-semibold">No lots at elevated spoilage risk. All inventory is within safe storage duration.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'ai-assistant' && (
          <RoleAssistantCard
            title="Storage AI Assistant"
            intro="I can analyze telemetry, capacity, bookings, and market movements to guide storage decisions."
            placeholder="Ask about spoilage risk, demand forecasting, or booking allocation..."
          />
        )}
      </div>
    </DashboardShell>
  );
};
