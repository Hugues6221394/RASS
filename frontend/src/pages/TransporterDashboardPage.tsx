import { useEffect, useMemo, useRef, useState } from 'react';
import { Briefcase, CheckCircle2, Clock, Download, FileCheck, FileText, LayoutDashboard, MapPin, Package, Star, Truck, User, Wallet } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { DashboardShell } from '../components/layout/DashboardShell';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Loader } from '../components/ui/Loader';
import { KpiBanner } from '../components/ui/KpiBanner';
import { MiniDonut } from '../components/charts/MiniDonut';
import { RoleAIAnalyticsPanel } from '../components/RoleAIAnalyticsPanel';
import { NationalMarketPulsePanel } from '../components/NationalMarketPulsePanel';
import { RoleAssistantCard } from '../components/RoleAssistantCard';
import { encodeFileToPayload } from '../utils/fileUpload';
import { exportReportCsv } from '../utils/exportCsv';

type Tab = 'overview' | 'available' | 'job-marketplace' | 'my-applications' | 'active' | 'completed' | 'reports' | 'ai-assistant';

export const TransporterDashboardPage = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState<any[]>([]);
  const [myJobs, setMyJobs] = useState<any[]>([]);
  const [workingJobId, setWorkingJobId] = useState<string | null>(null);

  // Job marketplace state
  const [openJobs, setOpenJobs] = useState<any[]>([]);
  const [myApplications, setMyApplications] = useState<any[]>([]);
  const [applyingJobId, setApplyingJobId] = useState<string | null>(null);
  const [applyForm, setApplyForm] = useState({ proposedPriceRwf: '', vehicleType: '', plateNumber: '', vehicleCapacityKg: '', coverLetter: '', estimatedDeliveryHours: '', driverPhone: '' });
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [insuranceFile, setInsuranceFile] = useState<File | null>(null);
  const [applyStatus, setApplyStatus] = useState('');
  const [gpsSendingByJob, setGpsSendingByJob] = useState<Record<string, boolean>>({});
  const [gpsLastByJob, setGpsLastByJob] = useState<Record<string, { lat: number; lng: number; sentAt: string }>>({});
  const [gpsErrorByJob, setGpsErrorByJob] = useState<Record<string, string>>({});
  const gpsWatchByJobRef = useRef<Record<string, number>>({});
  const gpsLastSentAtRef = useRef<Record<string, number>>({});

  const loadData = async () => {
    setLoading(true);
    const [aR, jR, openR, appsR] = await Promise.all([
      api.get('/api/transporters/available-jobs').catch(() => ({ data: [] })),
      api.get('/api/transporters/my-jobs').catch(() => ({ data: [] })),
      api.get('/api/transport-jobs/available').catch(() => ({ data: [] })),
      api.get('/api/transport-jobs/my-applications').catch(() => ({ data: [] })),
    ]);
    setAvailable(aR.data || []);
    setMyJobs(jR.data || []);
    setOpenJobs(Array.isArray(openR.data) ? openR.data : []);
    setMyApplications(Array.isArray(appsR.data) ? appsR.data : []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    return () => {
      Object.values(gpsWatchByJobRef.current).forEach((watchId) => navigator.geolocation.clearWatch(watchId));
      gpsWatchByJobRef.current = {};
      gpsLastSentAtRef.current = {};
    };
  }, []);

  const activeJobs = useMemo(() => myJobs.filter((j) => ['Assigned', 'Accepted', 'InTransit', 'PickedUp'].includes(j.status)), [myJobs]);
  const completedJobs = useMemo(() => myJobs.filter((j) => ['Delivered', 'Completed'].includes(j.status)), [myJobs]);
  const totalEarnings = useMemo(() => completedJobs.reduce((s, j) => s + Number(j.price || 0), 0), [completedJobs]);

  const acceptJob = async (jobId: string) => {
    setWorkingJobId(jobId);
    await api.post(`/api/transporters/job/${jobId}/accept`, {});
    setWorkingJobId(null);
    await loadData();
  };

  const pickupJob = async (jobId: string) => {
    setWorkingJobId(jobId);
    await api.post(`/api/transporters/job/${jobId}/pickup`);
    setWorkingJobId(null);
    await loadData();
  };

  const deliverJob = async (jobId: string) => {
    setWorkingJobId(jobId);
    await api.post(`/api/transporters/job/${jobId}/deliver`, { notes: 'Delivered via dashboard', proofOfDeliveryUrl: '' });
    setWorkingJobId(null);
    await loadData();
  };

  const postGpsLocation = async (jobId: string, position: GeolocationPosition) => {
    const now = Date.now();
    const lastSentAt = gpsLastSentAtRef.current[jobId] ?? 0;
    if (now - lastSentAt < 6000) return;
    gpsLastSentAtRef.current[jobId] = now;

    const { latitude, longitude, accuracy, speed, heading, altitude } = position.coords;
    await api.post('/api/tracking/location', {
      transportRequestId: jobId,
      latitude,
      longitude,
      accuracy: Number.isFinite(accuracy) ? accuracy : null,
      speed: Number.isFinite(speed as number) ? speed : null,
      heading: Number.isFinite(heading as number) ? heading : null,
      altitude: Number.isFinite(altitude as number) ? altitude : null,
    });
    setGpsLastByJob((prev) => ({ ...prev, [jobId]: { lat: latitude, lng: longitude, sentAt: new Date().toISOString() } }));
    setGpsErrorByJob((prev) => ({ ...prev, [jobId]: '' }));
  };

  const stopGpsSharing = (jobId: string) => {
    const watchId = gpsWatchByJobRef.current[jobId];
    if (typeof watchId === 'number') {
      navigator.geolocation.clearWatch(watchId);
      delete gpsWatchByJobRef.current[jobId];
    }
    delete gpsLastSentAtRef.current[jobId];
    setGpsSendingByJob((prev) => ({ ...prev, [jobId]: false }));
  };

  const startGpsSharingWithOptions = async (job: any, options: PositionOptions, fallbackAttempted = false) => {
    if (!navigator.geolocation) {
      setGpsErrorByJob((prev) => ({ ...prev, [job.id]: 'GPS is not supported on this device/browser.' }));
      return;
    }

    stopGpsSharing(job.id);
    setGpsErrorByJob((prev) => ({ ...prev, [job.id]: '' }));
    setGpsSendingByJob((prev) => ({ ...prev, [job.id]: true }));

    if (job.status === 'Assigned' || job.status === 'Accepted') {
      await api.post(`/api/transporters/job/${job.id}/update-status`, {
        status: 'InTransit',
        notes: 'GPS sharing started by transporter',
      }).catch(() => null);
      await loadData();
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        void postGpsLocation(job.id, position).catch((error: any) => {
          const msg = error?.response?.data?.message || error?.response?.data || 'Failed to send location update.';
          setGpsErrorByJob((prev) => ({ ...prev, [job.id]: String(msg) }));
        });
      },
      (error) => {
        let msg = 'Unable to read GPS location.';
        if (error.code === error.PERMISSION_DENIED) msg = 'GPS permission denied. Enable location access and retry.';
        if (error.code === error.POSITION_UNAVAILABLE) {
          if (!fallbackAttempted) {
            void startGpsSharingWithOptions(job, { enableHighAccuracy: false, maximumAge: 30000, timeout: 30000 }, true);
            return;
          }
          msg = 'GPS unavailable. Switched to network location failed too. Check location settings and move to open area.';
        }
        if (error.code === error.TIMEOUT) {
          if (!fallbackAttempted) {
            void startGpsSharingWithOptions(job, { enableHighAccuracy: false, maximumAge: 30000, timeout: 30000 }, true);
            return;
          }
          msg = 'GPS timeout. Could not lock precise or network location.';
        }
        setGpsErrorByJob((prev) => ({ ...prev, [job.id]: msg }));
        stopGpsSharing(job.id);
      },
      options,
    );

    gpsWatchByJobRef.current[job.id] = watchId;
  };

  const startGpsSharing = async (job: any) => {
    await startGpsSharingWithOptions(job, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
  };

  useEffect(() => {
    const activeIds = new Set(activeJobs.map((j) => String(j.id)));
    Object.keys(gpsWatchByJobRef.current).forEach((jobId) => {
      if (!activeIds.has(jobId)) stopGpsSharing(jobId);
    });
  }, [activeJobs]);

  const applyToJob = async (jobId: string) => {
    setApplyStatus('');
    try {
      const payload: any = {
        proposedPriceRwf: Number(applyForm.proposedPriceRwf),
        vehicleType: applyForm.vehicleType || null,
        plateNumber: applyForm.plateNumber || null,
        vehicleCapacityKg: applyForm.vehicleCapacityKg ? Number(applyForm.vehicleCapacityKg) : null,
        coverLetter: applyForm.coverLetter || null,
        estimatedDeliveryHours: applyForm.estimatedDeliveryHours ? Number(applyForm.estimatedDeliveryHours) : null,
        driverPhone: applyForm.driverPhone || null,
      };
      if (licenseFile) {
        const encoded = await encodeFileToPayload(licenseFile);
        payload.drivingLicenseBase64 = encoded.base64Content;
        payload.drivingLicenseFileName = encoded.fileName;
      }
      if (insuranceFile) {
        const encoded = await encodeFileToPayload(insuranceFile);
        payload.insuranceDocBase64 = encoded.base64Content;
        payload.insuranceDocFileName = encoded.fileName;
      }
      await api.post(`/api/transport-jobs/${jobId}/apply`, payload);
      setApplyStatus('Application submitted!');
      setApplyingJobId(null);
      setApplyForm({ proposedPriceRwf: '', vehicleType: '', plateNumber: '', vehicleCapacityKg: '', coverLetter: '', estimatedDeliveryHours: '', driverPhone: '' });
      setLicenseFile(null);
      setInsuranceFile(null);
      await loadData();
    } catch (e: any) {
      setApplyStatus(e?.response?.data?.message || e?.response?.data || 'Failed to apply.');
    }
  };

  if (loading) return <Loader label="Loading transporter dashboard..." />;

  return (
    <DashboardShell
      brand="RASS Transporter"
      subtitle="Fleet operations"
      title="Transporter dashboard"
      activeKey={activeTab}
      navItems={[
        { key: 'overview', label: 'Overview', icon: <LayoutDashboard className="h-4 w-4" /> },
        { key: 'job-marketplace', label: 'Job marketplace', icon: <Briefcase className="h-4 w-4" /> },
        { key: 'my-applications', label: 'My applications', icon: <FileCheck className="h-4 w-4" /> },
        { key: 'available', label: 'Quick jobs', icon: <Package className="h-4 w-4" /> },
        { key: 'active', label: 'Active jobs', icon: <Truck className="h-4 w-4" /> },
        { key: 'completed', label: 'Completed', icon: <User className="h-4 w-4" /> },
        { key: 'reports', label: 'Reports & Export', icon: <FileText className="h-4 w-4" /> },
        { key: 'ai-assistant', label: 'AI Assistant', icon: <Truck className="h-4 w-4" /> },
      ]}
      onNavChange={(k) => setActiveTab(k as Tab)}
      onLogout={logout}
      rightStatus={user?.fullName || 'Transporter'}
    >
      <div className="space-y-6">
        {activeTab === 'overview' && (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <KpiBanner icon={<Briefcase className="h-5 w-5 text-white" />} label="Open jobs" value={openJobs.length} sub="Cooperative transport postings" color="emerald" onClick={() => setActiveTab('job-marketplace')} />
              <KpiBanner icon={<FileCheck className="h-5 w-5 text-white" />} label="My applications" value={myApplications.length} sub={`${myApplications.filter(a => a.status === 'Accepted').length} accepted`} color="blue" onClick={() => setActiveTab('my-applications')} />
              <KpiBanner icon={<Truck className="h-5 w-5 text-white" />} label="Active deliveries" value={activeJobs.length} sub={`${available.length} quick jobs available`} color="amber" onClick={() => setActiveTab('active')} />
              <KpiBanner icon={<Wallet className="h-5 w-5 text-white" />} label="Total earnings" value={`${totalEarnings.toLocaleString()} RWF`} sub={`${completedJobs.length} deliveries completed`} color="teal" />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Card className="p-5">
                <MiniDonut
                  title="Application status breakdown"
                  slices={[
                    { label: 'Submitted', value: myApplications.filter(a => a.status === 'Submitted').length, color: '#94a3b8' },
                    { label: 'Accepted', value: myApplications.filter(a => a.status === 'Accepted').length, color: '#059669' },
                    { label: 'Rejected', value: myApplications.filter(a => a.status === 'Rejected').length, color: '#ef4444' },
                    { label: 'Shortlisted', value: myApplications.filter(a => a.status === 'Shortlisted').length, color: '#3b82f6' },
                  ].filter(s => s.value > 0)}
                />
              </Card>

              <Card className="p-5 lg:col-span-2">
                <h3 className="text-sm font-bold text-slate-800 mb-3">Recent job opportunities</h3>
                {openJobs.length === 0 && <p className="text-xs text-slate-500 py-6 text-center">No open transport jobs right now.</p>}
                <div className="space-y-2">
                  {openJobs.slice(0, 4).map((job: any) => (
                    <div key={job.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2.5">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                        <MapPin className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-800">{job.title}</p>
                        <p className="text-[10px] text-slate-500">{job.crop} • {Number(job.quantityKg || 0).toLocaleString()} kg • {job.pickupLocation} → {job.deliveryLocation}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-bold text-emerald-700">{job.maxPaymentRwf ? `${Number(job.maxPaymentRwf).toLocaleString()} RWF` : '—'}</p>
                        <p className="text-[10px] text-slate-400">{job.applicationCount || 0} bids</p>
                      </div>
                    </div>
                  ))}
                </div>
                {openJobs.length > 4 && <button className="mt-2 text-xs font-semibold text-emerald-700 hover:underline" onClick={() => setActiveTab('job-marketplace')}>View all {openJobs.length} jobs →</button>}
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card className="p-5">
                <h3 className="text-sm font-bold text-slate-800 mb-3">Active deliveries</h3>
                {activeJobs.length === 0 && (
                  <div className="py-8 text-center">
                    <Truck className="mx-auto h-8 w-8 text-slate-200" />
                    <p className="mt-2 text-xs text-slate-500">No active deliveries. Accept a job to get started!</p>
                  </div>
                )}
                <div className="space-y-2">
                  {activeJobs.slice(0, 4).map((job: any) => (
                    <div key={job.id} className="flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50/40 px-3 py-2.5">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{job.origin} → {job.destination}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${job.status === 'InTransit' ? 'bg-blue-100 text-blue-700' : job.status === 'PickedUp' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            <Clock className="h-2.5 w-2.5" /> {job.status}
                          </span>
                          <span className="text-[10px] text-slate-500">{Number(job.loadKg || 0).toLocaleString()} kg</span>
                        </div>
                      </div>
                      <p className="text-sm font-bold text-emerald-700">{Number(job.price || 0).toLocaleString()} RWF</p>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-5">
                <h3 className="text-sm font-bold text-slate-800 mb-3">Completed deliveries</h3>
                {completedJobs.length === 0 && (
                  <div className="py-8 text-center">
                    <CheckCircle2 className="mx-auto h-8 w-8 text-slate-200" />
                    <p className="mt-2 text-xs text-slate-500">No completed deliveries yet.</p>
                  </div>
                )}
                <div className="space-y-2">
                  {completedJobs.slice(0, 4).map((job: any) => (
                    <div key={job.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                          <Star className="h-3.5 w-3.5" />
                        </div>
                        <p className="text-sm text-slate-700">{job.origin} → {job.destination}</p>
                      </div>
                      <p className="text-sm font-bold text-emerald-700">{Number(job.price || 0).toLocaleString()} RWF</p>
                    </div>
                  ))}
                </div>
                {completedJobs.length > 4 && <button className="mt-2 text-xs font-semibold text-emerald-700 hover:underline" onClick={() => setActiveTab('completed')}>View all →</button>}
              </Card>
            </div>

            <RoleAIAnalyticsPanel contextData={{ availableJobs: available, myJobs }} />
            <NationalMarketPulsePanel title="Transport market pulse" />
          </>
        )}

        {activeTab === 'job-marketplace' && (
          <div className="space-y-4">
            <Card className="p-5">
              <h3 className="text-lg font-black text-slate-900">Transport job marketplace</h3>
              <p className="mt-1 text-xs text-slate-500">Cooperative-posted transport jobs. Apply with your vehicle details and proposed price.</p>
              <div className="mt-4 space-y-3">
                {openJobs.length === 0 && <p className="text-sm text-slate-500">No open transport jobs at the moment. Check back later!</p>}
                {openJobs.map((job: any) => (
                  <div key={job.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900">{job.title}</p>
                        <p className="text-xs text-slate-500 mt-1">{job.cooperativeName} • {job.cooperativeRegion}</p>
                        <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-600">
                          <p>Crop: <span className="font-semibold">{job.crop}</span></p>
                          <p>Quantity: <span className="font-semibold">{Number(job.quantityKg || 0).toLocaleString()} kg</span></p>
                          <p>Route: <span className="font-semibold">{job.pickupLocation} → {job.deliveryLocation}</span></p>
                          {job.distanceKm && <p>Distance: <span className="font-semibold">{job.distanceKm} km</span></p>}
                          {job.minPaymentRwf != null && <p>Budget: <span className="font-semibold">{Number(job.minPaymentRwf).toLocaleString()}–{Number(job.maxPaymentRwf || 0).toLocaleString()} RWF</span></p>}
                          {job.requiredVehicleType && <p>Vehicle: <span className="font-semibold">{job.requiredVehicleType}</span></p>}
                          {job.requiresColdChain && <p className="text-amber-700 font-semibold">Cold chain required</p>}
                          {job.pickupDate && <p>Pickup: <span className="font-semibold">{new Date(job.pickupDate).toLocaleDateString()}</span></p>}
                          {job.deliveryDeadline && <p>Deadline: <span className="font-semibold">{new Date(job.deliveryDeadline).toLocaleDateString()}</span></p>}
                        </div>
                        {job.description && <p className="mt-2 text-xs text-slate-600 italic">"{job.description}"</p>}
                        {job.specialInstructions && <p className="mt-1 text-xs text-amber-700">Instructions: {job.specialInstructions}</p>}
                        <p className="mt-2 text-[10px] text-slate-400">{job.applicationCount || 0} applications • Posted {new Date(job.createdAt).toLocaleDateString()}</p>
                      </div>
                      <Button size="sm" onClick={() => { setApplyingJobId(applyingJobId === job.id ? null : job.id); setApplyStatus(''); }}>
                        {applyingJobId === job.id ? 'Cancel' : 'Apply'}
                      </Button>
                    </div>

                    {applyingJobId === job.id && (
                      <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-3">
                        <p className="text-sm font-semibold text-emerald-800">Your application</p>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                          <Input label="Proposed price (RWF) *" type="number" value={applyForm.proposedPriceRwf} onChange={e => setApplyForm(f => ({ ...f, proposedPriceRwf: e.target.value }))} placeholder="e.g. 75000" />
                          <div>
                            <label className="mb-1 block text-xs font-semibold text-slate-600">Vehicle type</label>
                            <select className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" value={applyForm.vehicleType} onChange={e => setApplyForm(f => ({ ...f, vehicleType: e.target.value }))}>
                              <option value="">Select type</option>
                              <option value="Pickup">Pickup truck</option>
                              <option value="Truck">Truck</option>
                              <option value="Lorry">Lorry</option>
                              <option value="Refrigerated">Refrigerated truck</option>
                              <option value="Motorcycle">Motorcycle</option>
                            </select>
                          </div>
                          <Input label="Plate number" value={applyForm.plateNumber} onChange={e => setApplyForm(f => ({ ...f, plateNumber: e.target.value }))} placeholder="e.g. RAD 123A" />
                          <Input label="Vehicle capacity (kg)" type="number" value={applyForm.vehicleCapacityKg} onChange={e => setApplyForm(f => ({ ...f, vehicleCapacityKg: e.target.value }))} />
                          <Input label="Estimated delivery (hours)" type="number" value={applyForm.estimatedDeliveryHours} onChange={e => setApplyForm(f => ({ ...f, estimatedDeliveryHours: e.target.value }))} />
                          <Input label="Driver phone" value={applyForm.driverPhone} onChange={e => setApplyForm(f => ({ ...f, driverPhone: e.target.value }))} placeholder="e.g. 0788123456" />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-slate-600">Cover letter</label>
                          <textarea className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" rows={2} value={applyForm.coverLetter} onChange={e => setApplyForm(f => ({ ...f, coverLetter: e.target.value }))} placeholder="Why are you the best transporter for this job?" />
                        </div>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-xs font-semibold text-slate-600">Driving license (upload)</label>
                            <input type="file" accept="image/*,.pdf" onChange={e => setLicenseFile(e.target.files?.[0] || null)} className="text-sm" />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-semibold text-slate-600">Insurance document (upload)</label>
                            <input type="file" accept="image/*,.pdf" onChange={e => setInsuranceFile(e.target.files?.[0] || null)} className="text-sm" />
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Button onClick={() => applyToJob(job.id)} disabled={!applyForm.proposedPriceRwf}>Submit application</Button>
                          {applyStatus && <p className="text-xs font-semibold text-emerald-700">{applyStatus}</p>}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'my-applications' && (
          <Card className="p-5">
            <h3 className="text-lg font-black text-slate-900">My job applications</h3>
            <p className="mt-1 text-xs text-slate-500">Track the status of your transport job applications.</p>
            <div className="mt-4 space-y-3">
              {myApplications.length === 0 && <p className="text-sm text-slate-500">You haven't applied to any transport jobs yet.</p>}
              {myApplications.map((app: any) => (
                <div key={app.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{app.job?.title || 'Transport job'}</p>
                      <p className="text-xs text-slate-500">{app.job?.cooperativeName} • {app.job?.crop} • {Number(app.job?.quantityKg || 0).toLocaleString()} kg</p>
                      <p className="text-xs text-slate-500 mt-1">{app.job?.pickupLocation} → {app.job?.deliveryLocation}</p>
                      <p className="text-xs text-slate-600 mt-1">Your bid: <span className="font-bold">{Number(app.proposedPriceRwf || 0).toLocaleString()} RWF</span> • {app.vehicleType || 'Any'} {app.plateNumber ? `• ${app.plateNumber}` : ''}</p>
                      {app.reviewNote && <p className="text-xs text-slate-600 mt-1 italic">Note: "{app.reviewNote}"</p>}
                      <p className="text-[10px] text-slate-400 mt-1">Applied {new Date(app.createdAt).toLocaleDateString()}</p>
                    </div>
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                      app.status === 'Accepted' ? 'bg-emerald-50 text-emerald-700' :
                      app.status === 'Rejected' ? 'bg-red-50 text-red-600' :
                      app.status === 'Shortlisted' ? 'bg-blue-50 text-blue-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>{app.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {activeTab === 'available' && (
          <div className="space-y-4">
            <Card className="p-5">
              <h3 className="text-lg font-black text-slate-900">Quick jobs (direct assign)</h3>
              <p className="mt-1 text-xs text-slate-500">Pre-assigned transport requests ready for immediate acceptance.</p>
              <div className="mt-4 space-y-2">
                {available.map((job: any) => (
                  <div key={job.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5">
                    <div>
                      <p className="text-sm font-semibold">{job.origin} → {job.destination}</p>
                      <p className="text-xs text-slate-500">{Number(job.loadKg || 0).toLocaleString()} kg • {Number(job.price || 0).toLocaleString()} RWF</p>
                    </div>
                    <Button size="sm" disabled={workingJobId === job.id} onClick={() => acceptJob(job.id)}>Accept</Button>
                  </div>
                ))}
                {available.length === 0 && <p className="text-sm text-slate-500">No quick jobs available.</p>}
              </div>
            </Card>
            <RoleAssistantCard
              title="Transporter AI Assistant"
              intro="I can help you prioritize routes, reduce delay risk, and improve job acceptance and delivery timing."
              placeholder="Ask about route priority, delays, ETA, or fuel efficiency..."
            />
          </div>
        )}

        {activeTab === 'active' && (
          <Card className="p-5">
            <h3 className="text-lg font-black text-slate-900">Active jobs</h3>
            <div className="mt-4 space-y-2">
              {activeJobs.map((job: any) => (
                <div key={job.id} className="rounded-xl border border-slate-200 px-3 py-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">{job.origin} → {job.destination}</p>
                      <p className="text-xs text-slate-500">{job.status}</p>
                      {gpsLastByJob[job.id] && (
                        <p className="text-[11px] text-emerald-700">
                          Live GPS: {gpsLastByJob[job.id].lat.toFixed(5)}, {gpsLastByJob[job.id].lng.toFixed(5)} • {new Date(gpsLastByJob[job.id].sentAt).toLocaleTimeString()}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" disabled={workingJobId === job.id} onClick={() => pickupJob(job.id)}>Picked up</Button>
                      <Button size="sm" disabled={workingJobId === job.id} onClick={() => deliverJob(job.id)}>Delivered</Button>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    {gpsSendingByJob[job.id] ? (
                      <Button size="sm" variant="outline" onClick={() => stopGpsSharing(job.id)}>Stop GPS sharing</Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => startGpsSharing(job)}>Start live GPS</Button>
                    )}
                    {gpsSendingByJob[job.id] && (
                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                        LIVE
                      </span>
                    )}
                  </div>
                  {gpsErrorByJob[job.id] && <p className="mt-1 text-[11px] font-semibold text-red-600">{gpsErrorByJob[job.id]}</p>}
                </div>
              ))}
              {activeJobs.length === 0 && <p className="text-sm text-slate-500">No active jobs.</p>}
            </div>
          </Card>
        )}

        {activeTab === 'completed' && (
          <Card className="p-5">
            <h3 className="text-lg font-black text-slate-900">Completed jobs</h3>
            <div className="mt-4 space-y-2">
              {completedJobs.map((job: any) => (
                <div key={job.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5">
                  <p className="text-sm">{job.origin} → {job.destination}</p>
                  <p className="text-sm font-semibold text-emerald-700">{Number(job.price || 0).toLocaleString()} RWF</p>
                </div>
              ))}
              {completedJobs.length === 0 && <p className="text-sm text-slate-500">No completed jobs yet.</p>}
            </div>
          </Card>
        )}

        {activeTab === 'reports' && (
          <div className="space-y-5">
            <div className="rounded-2xl bg-gradient-to-r from-[#002D15] via-[#003D20] to-[#00793E] p-6 text-white">
              <h2 className="text-xl font-black">Transporter Reports & Export</h2>
              <p className="mt-1 text-sm text-emerald-200">Download your transport jobs and delivery records as CSV/Excel files.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { type: 'my-jobs', label: 'My Transport Jobs', desc: 'All transport jobs assigned to you with routes, loads, and payment details', icon: <Truck className="h-5 w-5 text-blue-600" />, bg: 'bg-blue-50' },
                { type: 'my-deliveries', label: 'My Deliveries', desc: 'Completed delivery records with origin, destination, and timeline', icon: <CheckCircle2 className="h-5 w-5 text-emerald-600" />, bg: 'bg-emerald-50' },
                { type: 'prices', label: 'Market Prices', desc: 'Market price data to understand cargo value and negotiate rates', icon: <Wallet className="h-5 w-5 text-amber-600" />, bg: 'bg-amber-50' },
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
            title="Transporter AI Assistant"
            intro="I can help you prioritize routes, reduce delay risk, and improve job acceptance and delivery timing."
            placeholder="Ask about route priority, delays, ETA, or fuel efficiency..."
          />
        )}
      </div>
    </DashboardShell>
  );
};
