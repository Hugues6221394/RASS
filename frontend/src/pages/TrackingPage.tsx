import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../api/client';
import type { TrackingInfo } from '../types';
import { useTranslation } from 'react-i18next';
import { useSearchParams, Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Truck, MapPin, Navigation, Clock, ShieldCheck, AlertCircle, Search, Phone, CheckCircle2 } from 'lucide-react';
import * as signalR from '@microsoft/signalr';

// Fix Leaflet default icon issue in bundlers
const initLeaflet = () => {
  if (typeof window === 'undefined') return;
  
  // Reset default icon paths which are often broken in bundlers
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  });
};

// Custom icons - initialize lazily to avoid top-level L access issues
const getTruckIcon = () => new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

const getOriginIcon = () => new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

const getDestIcon = () => new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

// Rwanda center coordinates
const RWANDA_CENTER: [number, number] = [-1.9403, 29.8739];
const RWANDA_ZOOM = 9;

// Simulated delivery locations for demo (Rwanda locations)
const DEMO_LOCATIONS = {
  'RASS-123456': {
    origin: { lat: -1.9536, lng: 30.0606, name: 'Kigali (Origin)' },
    destination: { lat: -2.5966, lng: 29.7483, name: 'Huye (Destination)' },
    current: { lat: -2.2751, lng: 29.9044, name: 'Truck In Transit' },
    route: [
      [-1.9536, 30.0606], [-2.0500, 29.9800], [-2.1500, 29.9200],
      [-2.2751, 29.9044], [-2.4000, 29.8200], [-2.5000, 29.7800],
      [-2.5966, 29.7483]
    ] as [number, number][],
    speed: 45, eta: '1h 20min', distanceKm: 134, status: 'In Transit'
  }
};

const statusColor = (status: string) => {
  const s = status?.toLowerCase();
  if (s === 'delivered' || s === 'completed') return 'bg-green-100 text-green-700';
  if (s === 'in_transit' || s === 'in transit') return 'bg-blue-100 text-blue-700';
  if (s === 'pending' || s === 'assigned') return 'bg-amber-100 text-amber-700';
  return 'bg-gray-100 text-gray-600';
};

// Auto-fit map to markers
const FitBounds = ({ positions }: { positions: [number, number][] }) => {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 0) {
      const bounds = L.latLngBounds(positions.map(p => L.latLng(p[0], p[1])));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [positions, map]);
  return null;
};

export const TrackingPage = () => {
  const { t } = useTranslation();
  const { user, token } = useAuth();
  const [searchParams] = useSearchParams();
  const [trackingId, setTrackingId] = useState('');
  const [liveLocation, setLiveLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [liveDetails, setLiveDetails] = useState<any>(null);
  const [locationHistory, setLocationHistory] = useState<any[]>([]);
  const [loadingTelemetry, setLoadingTelemetry] = useState(false);
  const [trackingLiveConnected, setTrackingLiveConnected] = useState(false);
  const [currentBgIndex, setCurrentBgIndex] = useState(0);
  const [sharedDeliveries, setSharedDeliveries] = useState<any[]>([]);
  const [loadingSharedDeliveries, setLoadingSharedDeliveries] = useState(false);
  const [coordinateInput, setCoordinateInput] = useState('');
  const [coordinateStatus, setCoordinateStatus] = useState('');

  const bgImages = [
    'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=2000&auto=format&fit=crop', // Logistics warehouse
    'https://images.unsplash.com/photo-1519003722824-194d4455a60c?q=80&w=2000&auto=format&fit=crop', // Truck on road
    'https://images.unsplash.com/photo-1506484334402-40f44534a8f9?q=80&w=2000&auto=format&fit=crop', // Harvest transport
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentBgIndex((prev) => (prev + 1) % bgImages.length);
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Eligibility check: Admins, Buyers, Farmers (if involved), Cooperative Managers, and Transporters can access tracking.
  const isEligible = user?.roles.some(r => ['Admin', 'Buyer', 'Farmer', 'CooperativeManager', 'Transporter'].includes(r));

  useEffect(() => {
    initLeaflet();
  }, []);

  useEffect(() => {
    if (!user) return;
    const canSeeShared = user.roles.some((r) => ['Buyer', 'CooperativeManager', 'Admin'].includes(r));
    if (!canSeeShared) return;

    let cancelled = false;
    const loadShared = async () => {
      setLoadingSharedDeliveries(true);
      try {
        const res = await api.get('/api/tracking/live-shares?take=30').catch(() => ({ data: [] }));
        if (cancelled) return;
        setSharedDeliveries(Array.isArray(res.data) ? res.data : []);
      } finally {
        if (!cancelled) setLoadingSharedDeliveries(false);
      }
    };

    void loadShared();
    const timer = setInterval(() => {
      void loadShared();
    }, 10000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [user]);

  const trackingMutation = useMutation({
    mutationFn: async (id: string) => (await api.get<TrackingInfo>(`/api/tracking/${id}`)).data,
  });

  const handleTrack = () => {
    if (!trackingId.trim()) return;
    trackingMutation.mutate(trackingId.trim());
  };

  const handleTrackCoordinates = async () => {
    setCoordinateStatus('');
    const raw = coordinateInput.trim();
    const normalized = raw.replace(/\s+/g, '');
    const parts = normalized.split(',');
    if (parts.length !== 2) {
      setCoordinateStatus('Invalid format. Use: latitude,longitude (e.g. 1.94530,30.12356)');
      return;
    }
    const lat = Number(parts[0]);
    const lng = Number(parts[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setCoordinateStatus('Invalid coordinates. Latitude must be -90..90 and longitude -180..180.');
      return;
    }

    try {
      const res = await api.get(`/api/tracking/live-shares/lookup?latitude=${lat}&longitude=${lng}&radiusKm=5`);
      const row = res.data;
      if (!row?.trackingId) {
        setCoordinateStatus('No active transporter found near these coordinates.');
        return;
      }
      setTrackingId(row.trackingId);
      trackingMutation.mutate(row.trackingId);
      setCoordinateStatus(`Tracking started for ${row.assignedTruck || 'transporter'} (${row.matchedDistanceKm ?? '?'} km away).`);
    } catch (error: any) {
      const message = error?.response?.data || 'No active transporter found near these coordinates.';
      setCoordinateStatus(String(message));
    }
  };

  useEffect(() => {
    const initialTrackingId = searchParams.get('trackingId');
    if (initialTrackingId) {
      setTrackingId(initialTrackingId);
      trackingMutation.mutate(initialTrackingId);
    }
  }, [searchParams]);

  const tracking = trackingMutation.data;
  const demo = trackingId ? (DEMO_LOCATIONS as any)[trackingId.trim()] : null;
  const primaryTransportId = (tracking as any)?.transports?.[0]?.id as string | undefined;
  const originPosition =
    liveDetails?.trackingInfo && Number.isFinite(Number(liveDetails.trackingInfo.originLatitude)) && Number.isFinite(Number(liveDetails.trackingInfo.originLongitude))
      ? ([Number(liveDetails.trackingInfo.originLatitude), Number(liveDetails.trackingInfo.originLongitude)] as [number, number])
      : null;
  const destinationPosition =
    liveDetails?.trackingInfo && Number.isFinite(Number(liveDetails.trackingInfo.destinationLatitude)) && Number.isFinite(Number(liveDetails.trackingInfo.destinationLongitude))
      ? ([Number(liveDetails.trackingInfo.destinationLatitude), Number(liveDetails.trackingInfo.destinationLongitude)] as [number, number])
      : null;
  const truckPosition = liveLocation
    ? ([liveLocation.lat, liveLocation.lng] as [number, number])
    : (liveDetails?.latestLocation && Number.isFinite(Number(liveDetails.latestLocation.latitude)) && Number.isFinite(Number(liveDetails.latestLocation.longitude))
      ? ([Number(liveDetails.latestLocation.latitude), Number(liveDetails.latestLocation.longitude)] as [number, number])
      : null);

  useEffect(() => {
    if (!primaryTransportId) {
      setLiveDetails(null);
      setLocationHistory([]);
      return;
    }

    let cancelled = false;
    const loadTelemetry = async () => {
      setLoadingTelemetry(true);
      try {
        const [liveRes, historyRes] = await Promise.all([
          api.get(`/api/tracking/live/${primaryTransportId}`).catch(() => ({ data: null })),
          api.get(`/api/tracking/history/${primaryTransportId}`).catch(() => ({ data: [] })),
        ]);
        if (cancelled) return;
        setLiveDetails(liveRes.data);
        setLocationHistory(Array.isArray(historyRes.data) ? historyRes.data : []);
        const currentLat = Number(liveRes.data?.trackingInfo?.currentLatitude);
        const currentLng = Number(liveRes.data?.trackingInfo?.currentLongitude);
        if (Number.isFinite(currentLat) && Number.isFinite(currentLng)) {
          setLiveLocation({ lat: currentLat, lng: currentLng });
        } else {
          const history = Array.isArray(historyRes.data) ? historyRes.data : [];
          const last = history[history.length - 1];
          if (last && typeof last.latitude === 'number' && typeof last.longitude === 'number') {
            setLiveLocation({ lat: last.latitude, lng: last.longitude });
          }
        }
      } finally {
        if (!cancelled) setLoadingTelemetry(false);
      }
    };

    loadTelemetry();
    const interval = setInterval(loadTelemetry, 10000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [primaryTransportId]);

  useEffect(() => {
    if (!primaryTransportId || !token) {
      setTrackingLiveConnected(false);
      return;
    }

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5172';
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${apiUrl}/hubs/tracking`, { accessTokenFactory: () => token })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    connection.on('LocationUpdate', (payload: any) => {
      const lat = Number(payload?.latitude ?? payload?.lat);
      const lng = Number(payload?.longitude ?? payload?.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        setLiveLocation({ lat, lng });
        setLocationHistory((prev) => [
          ...prev.slice(-199),
          {
            latitude: lat,
            longitude: lng,
            speed: payload?.speed ?? null,
            status: payload?.status ?? 'InTransit',
            recordedAt: payload?.recordedAt ?? new Date().toISOString(),
          },
        ]);
      }
    });

    connection.on('DeliveryDelayed', (payload: any) => {
      setLiveDetails((prev: any) => ({
        ...(prev || {}),
        trackingInfo: {
          ...(prev?.trackingInfo || {}),
          isDelayed: true,
          delayMinutes: Number(payload?.delayMinutes || 0),
          currentEta: payload?.newEta ?? prev?.trackingInfo?.currentEta ?? null,
        },
      }));
    });

    connection.onreconnected(async () => {
      setTrackingLiveConnected(true);
      try { await connection.invoke('SubscribeToDelivery', primaryTransportId); } catch { }
    });
    connection.onreconnecting(() => setTrackingLiveConnected(false));
    connection.onclose(() => setTrackingLiveConnected(false));

    let mounted = true;
    connection.start()
      .then(async () => {
        if (!mounted) return;
        setTrackingLiveConnected(true);
        await connection.invoke('SubscribeToDelivery', primaryTransportId);
      })
      .catch(() => {
        if (mounted) setTrackingLiveConnected(false);
      });

    return () => {
      mounted = false;
      connection.invoke('UnsubscribeFromDelivery', primaryTransportId).catch(() => { });
      connection.stop();
    };
  }, [primaryTransportId, token]);

  if (!isEligible) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#F4FAF7]">
        <div className="card p-8 max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4 text-red-600">
            <AlertCircle size={32} />
          </div>
          <h1 className="text-xl font-black text-[#0D1B12] mb-2">Access Restricted</h1>
          <p className="text-gray-600 text-sm mb-6">
            Only authenticated users with ongoing orders or administrative privileges can access the live tracking system.
          </p>
          <Link to="/dashboard" className="btn btn-primary w-full justify-center">Return to Dashboard</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4FAF7]">
      {/* ── Dynamic Hero ── */}
      <div className="relative h-[300px] flex items-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-br from-[#003D20]/90 via-[#003D20]/60 to-transparent z-10" />
          <AnimatePresence mode="wait">
            <motion.div
              key={currentBgIndex}
              initial={{ opacity: 0, scale: 1.05 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2 }}
              className="absolute inset-0 w-full h-full"
            >
              <img src={bgImages[currentBgIndex]} className="w-full h-full object-cover" />
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="relative z-20 max-w-screen-xl mx-auto px-4 sm:px-6 w-full text-white">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl"
          >
            <div className="flex items-center gap-2 mb-4">
              <span className="px-3 py-1 rounded-full bg-[#34D399]/20 text-[#34D399] border border-[#34D399]/30 text-[10px] font-black uppercase tracking-widest">
                Real-time Intelligence
              </span>
            </div>
            <h1 className="text-4xl font-black mb-4 tracking-tight">Live Supply Chain <span className="text-[#34D399]">Visibility</span></h1>
            <div className="flex flex-wrap gap-4 text-sm font-medium text-green-100/80">
              <div className="flex items-center gap-2">
                <Navigation size={16} className="text-[#34D399]" />
                <span>GPS Precision</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-[#34D399]" />
                <span>Live ETA Updates</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-[#34D399]" />
                <span>Verified Chain of Custody</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 -mt-2 pb-10">

        {/* Search + Map Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Left panel - Search & Details */}
          <div className="space-y-5">
            {/* Search card */}
            <div className="card p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-[#EDF5F0] flex items-center justify-center">
                  <svg className="w-5 h-5 text-[#003D20]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h2 className="font-extrabold text-[#0D1B12]">Find Delivery</h2>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={trackingId}
                  onChange={e => setTrackingId(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleTrack()}
                  className="form-input flex-1"
                  placeholder={t('tracking.tracking_id', 'e.g. RASS-123456')}
                />
                <button onClick={handleTrack} disabled={trackingMutation.isPending || !trackingId.trim()}
                  className="btn btn-primary flex-shrink-0">
                  {trackingMutation.isPending ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Tracking…
                    </span>
                  ) : '🔍 Track'}
                </button>
              </div>

              {trackingMutation.isError && (
                <div className="alert alert-error mt-3">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{t('tracking.not_found', 'Order not found. Please check your tracking ID.')}</span>
                </div>
              )}

              {user?.roles.some((r) => ['Buyer', 'CooperativeManager', 'Admin'].includes(r)) && (
                <div className="mt-3 rounded-xl border border-[#E5EFE9] bg-[#F9FCFA] p-3">
                  <p className="mb-2 text-xs font-black uppercase tracking-wider text-[#0D1B12]">Track by transporter coordinates</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={coordinateInput}
                      onChange={(e) => setCoordinateInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && void handleTrackCoordinates()}
                      className="form-input flex-1"
                      placeholder="e.g. 1.94530, 30.12356"
                    />
                    <button onClick={() => void handleTrackCoordinates()} className="btn btn-primary btn-sm whitespace-nowrap">
                      Start tracking
                    </button>
                  </div>
                  {coordinateStatus && <p className="mt-1 text-[11px] font-semibold text-[#4A6358]">{coordinateStatus}</p>}
                </div>
              )}

              {user?.roles.some((r) => ['Buyer', 'CooperativeManager', 'Admin'].includes(r)) && (
                <div className="mt-4 rounded-xl border border-[#E5EFE9] bg-[#F9FCFA] p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-black uppercase tracking-wider text-[#0D1B12]">Transporters sharing location</p>
                    <span className="text-[10px] font-bold text-[#4A6358]">{loadingSharedDeliveries ? 'Refreshing…' : `${sharedDeliveries.length} live`}</span>
                  </div>
                  {sharedDeliveries.length === 0 ? (
                    <p className="text-xs text-[#4A6358]">No transporter has shared location yet for your deliveries.</p>
                  ) : (
                    <div className="space-y-2">
                      {sharedDeliveries.slice(0, 6).map((row: any) => (
                        <div key={row.transportRequestId} className="rounded-lg border border-[#E5EFE9] bg-white px-2.5 py-2">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-xs font-bold text-[#0D1B12]">{row.crop || 'Delivery'} • {row.origin} → {row.destination}</p>
                              <p className="text-[10px] text-[#4A6358]">
                                {row.assignedTruck || 'Truck'} • {row.isLive ? 'LIVE now' : 'Recently active'} • {new Date(row.lastLocation?.recordedAt).toLocaleTimeString()}
                              </p>
                            </div>
                            <button
                              onClick={() => {
                                setTrackingId(row.trackingId);
                                trackingMutation.mutate(row.trackingId);
                              }}
                              className="btn btn-primary btn-sm whitespace-nowrap"
                            >
                              Start tracking
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Delivery Stepper */}
            {(tracking || demo) && (
              <div className="card p-5">
                <h3 className="font-extrabold text-[#0D1B12] mb-4">Delivery Progress</h3>
                <div className="relative">
                  <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-[#EDF5F0]"></div>
                  {[
                    { label: 'Order Confirmed', status: 'Completed', time: '10:00 AM' },
                    { label: 'Driver Assigned', status: 'Completed', time: '11:45 AM' },
                    { label: 'In Transit', status: tracking?.status === 'Delivered' || demo?.status === 'Delivered' ? 'Completed' : (tracking?.status === 'In Transit' || demo?.status === 'In Transit' ? 'Active' : 'Pending'), time: 'Now' },
                    { label: 'Delivered', status: tracking?.status === 'Delivered' || demo?.status === 'Delivered' ? 'Completed' : 'Pending', time: 'Pending' },
                  ].map((step, idx) => (
                    <div key={idx} className="flex gap-4 mb-4 relative z-10">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${step.status === 'Completed' ? 'bg-[#00793E] text-white shadow-md' : step.status === 'Active' ? 'bg-[#1D4ED8] text-white ring-4 ring-blue-100 shadow-md' : 'bg-[#EDF5F0] text-[#9AAFA6]'}`}>
                        {step.status === 'Completed' ? '✓' : idx + 1}
                      </div>
                      <div className="pt-1">
                        <p className={`font-semibold ${step.status === 'Pending' ? 'text-[#9AAFA6]' : 'text-[#0D1B12]'}`}>{step.label}</p>
                        <p className="text-xs text-[#4A6358]">{step.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Live Status Panel */}
            {(tracking || demo) && (
              <div className="card p-5 space-y-4">
                <h3 className="font-extrabold text-[#0D1B12] flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                  Live Status Updates
                </h3>
                <div className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold ${trackingLiveConnected ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                  {trackingLiveConnected ? 'Live channel connected (SignalR).' : 'Live channel reconnecting. Using polling fallback.'}
                </div>

                {/* ETA & Speed */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 text-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiMzQjgyRjYiIGZpbGwtb3BhY2l0eT0iMC4xNSIvPjwvc3ZnPg==')] opacity-50 block"></div>
                    <p className="text-xs text-blue-800 font-bold uppercase tracking-wider relative z-10">Live ETA</p>
                    <p className="text-2xl font-black text-blue-700 relative z-10 drop-shadow-sm tracking-tight">
                      {liveDetails?.trackingInfo?.currentEta ? new Date(liveDetails.trackingInfo.currentEta).toLocaleTimeString() : (demo?.eta || '—')}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-gradient-to-br from-green-50 to-green-100 border border-green-200 text-center">
                    <p className="text-xs text-green-800 font-bold uppercase tracking-wider">Speed</p>
                    <p className="text-2xl font-black text-green-700">{liveDetails?.latestLocation?.speed || demo?.speed || 0} km/h</p>
                  </div>
                </div>

                {/* Distance */}
                <div className="p-3 rounded-xl bg-purple-50 border border-purple-200">
                  <div className="flex justify-between items-center">
                    <p className="text-xs text-purple-600 font-medium">Distance</p>
                      <p className="font-extrabold text-purple-700">{Math.round(liveDetails?.trackingInfo?.totalDistanceKm || demo?.distanceKm || 0)} km</p>
                  </div>
                  <div className="w-full bg-purple-200 rounded-full h-2 mt-2">
                    <div className="bg-purple-600 h-2 rounded-full transition-all duration-1000" style={{ width: `${Math.max(1, Math.min(100, Number(liveDetails?.trackingInfo?.progressPercent || 55)))}%` }} />
                  </div>
                  <p className="text-[10px] text-purple-400 mt-1">{Math.max(1, Math.min(100, Number(liveDetails?.trackingInfo?.progressPercent || 55)))}% of journey completed</p>
                </div>

                {/* Route Info */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-[#F4FAF7]">
                    <div className="w-3 h-3 rounded-full bg-green-500 flex-shrink-0" />
                    <span className="text-xs text-[#0D1B12] font-medium">{demo?.origin?.name || tracking?.transports?.[0]?.origin || 'Origin'}</span>
                  </div>
                  {truckPosition && (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-50 border border-blue-200">
                      <div className="w-3 h-3 rounded-full bg-blue-500 flex-shrink-0 animate-pulse" />
                      <span className="text-xs text-blue-700 font-medium">
                        📍 Truck @ {truckPosition[0].toFixed(4)}, {truckPosition[1].toFixed(4)}
                      </span>
                    </div>
                  )}
                  {liveDetails?.trackingInfo && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
                        Status: {liveDetails.trackingInfo.trackingStatus || liveDetails.status || 'Tracking'}
                        {liveDetails.trackingInfo.isDelayed ? ` • Delayed ${liveDetails.trackingInfo.delayMinutes ?? 0} min` : ''}
                      </p>
                    </div>
                  )}
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-[#F4FAF7]">
                    <div className="w-3 h-3 rounded-full bg-red-500 flex-shrink-0" />
                    <span className="text-xs text-[#0D1B12] font-medium">{demo?.destination?.name || tracking?.transports?.[0]?.destination || 'Destination'}</span>
                  </div>
                </div>
              </div>
            )}

            {(tracking || demo) && (
              <div className="card p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-extrabold text-[#0D1B12]">Telemetry Timeline</h3>
                  <span className="text-[10px] uppercase tracking-wider text-[#4A6358] font-bold">{loadingTelemetry ? 'Refreshing…' : `${locationHistory.length} Points`}</span>
                </div>
                <div className="space-y-2 max-h-44 overflow-y-auto">
                  {locationHistory.slice(-12).reverse().map((pt: any, idx) => (
                    <div key={idx} className="p-2 rounded-lg bg-[#F4FAF7] border border-[#E5EFE9] text-xs flex justify-between gap-3">
                      <span className="font-semibold text-[#0D1B12]">{Number(pt.latitude).toFixed(4)}, {Number(pt.longitude).toFixed(4)}</span>
                      <span className="text-[#4A6358]">{pt.speed ? `${Math.round(pt.speed)} km/h` : '—'} • {pt.status || 'InTransit'}</span>
                    </div>
                  ))}
                  {locationHistory.length === 0 && (
                    <p className="text-xs text-[#4A6358]">No location history yet. Telemetry appears once transporter starts pushing coordinates.</p>
                  )}
                </div>
              </div>
            )}

            {/* Order Details from API */}
            {tracking && (
              <div className="card p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs text-[#4A6358] font-medium uppercase tracking-wider mb-0.5">Tracking ID</p>
                    <p className="font-extrabold text-[#0D1B12] text-lg">{tracking.trackingId}</p>
                  </div>
                  <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${statusColor(tracking.status)}`}>{tracking.status}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[#EDF5F0]">
                  <div>
                    <p className="text-xs text-[#4A6358] mb-0.5">Crop</p>
                    <p className="font-semibold text-[#0D1B12] text-sm">{tracking.order.crop} · {tracking.order.market}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#4A6358] mb-0.5">Delivery Window</p>
                    <p className="font-semibold text-[#0D1B12] text-sm">
                      {new Date(tracking.order.deliveryWindowStart).toLocaleDateString()} – {new Date(tracking.order.deliveryWindowEnd).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Driver Info Card */}
            {(tracking || demo) && (
              <div className="card p-5 bg-gradient-to-br from-[#003D20] to-[#001F10] text-white overflow-hidden relative">
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/5 rounded-full blur-xl"></div>
                <div className="flex items-center justify-between mb-4 relative z-10">
                  <h3 className="font-extrabold text-white text-sm uppercase tracking-wider">Driver Details</h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-500/20 text-green-300 border border-green-500/30">Verified ✓</span>
                </div>
                <div className="flex items-center gap-4 relative z-10">
                  <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center text-2xl border-2 border-green-500/50 shadow-lg">👤</div>
                  <div>
                    <p className="font-extrabold text-lg tracking-tight">{tracking?.driver?.name || 'Jean Paul Bizimana'}</p>
                    <p className="text-sm font-medium text-green-200">{tracking?.driver?.phone || '+250 788 123 456'}</p>
                  </div>
                </div>
                <div className="mt-5 pt-4 border-t border-white/10 grid grid-cols-2 gap-3 relative z-10">
                  <div className="bg-black/20 rounded-lg p-2">
                    <p className="text-green-400/80 text-[10px] uppercase font-bold tracking-wider mb-0.5">Vehicle</p>
                    <p className="font-semibold text-sm">{tracking?.driver?.vehicleType || 'Isuzu FVR (RAB 123 C)'}</p>
                  </div>
                  <div className="bg-black/20 rounded-lg p-2">
                    <p className="text-green-400/80 text-[10px] uppercase font-bold tracking-wider mb-0.5">License Ref</p>
                    <p className="font-semibold text-sm font-mono">{tracking?.driver?.license || 'RWA-99382'}</p>
                  </div>
                </div>
                <button className="w-full mt-4 btn btn-sm bg-white text-[#003D20] hover:bg-gray-100 flex justify-center gap-2 font-bold relative z-10 transition-transform active:scale-95">
                  📞 Contact Driver
                </button>
              </div>
            )}

            {/* Empty state */}
            {!trackingMutation.isPending && !tracking && !demo && !trackingMutation.isError && (
              <div className="card p-10 text-center">
                <div className="w-16 h-16 rounded-2xl bg-[#EDF5F0] flex items-center justify-center mx-auto mb-3">
                  <svg className="w-8 h-8 text-[#9AAFA6]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <p className="font-semibold text-[#4A6358]">{t('tracking.enter_id', 'Enter a tracking ID to get started')}</p>
                <p className="text-xs text-[#9AAFA6] mt-1">Format: RASS-XXXXXX</p>
              </div>
            )}
          </div>

          {/* Right panel - Map (2 columns) */}
          <div className="lg:col-span-2">
            <div className="card p-2 h-full" style={{ minHeight: 500 }}>
              <MapContainer
                center={RWANDA_CENTER}
                zoom={RWANDA_ZOOM}
                style={{ height: '100%', minHeight: 500, borderRadius: '0.75rem' }}
                scrollWheelZoom={true}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* Origin marker */}
                {demo && (
                  <>
                    <Marker position={[demo.origin.lat, demo.origin.lng]} icon={getOriginIcon()}>
                      <Popup>
                        <strong>🟢 Origin</strong><br />{demo.origin.name}
                      </Popup>
                    </Marker>

                    {/* Destination marker */}
                    <Marker position={[demo.destination.lat, demo.destination.lng]} icon={getDestIcon()}>
                      <Popup>
                        <strong>🔴 Destination</strong><br />{demo.destination.name}
                      </Popup>
                    </Marker>

                    {/* Route polyline */}
                    <Polyline
                      positions={demo.route}
                      pathOptions={{ color: '#003D20', weight: 4, opacity: 0.7, dashArray: '10, 6' }}
                    />

                    {/* Fit map to route */}
                    <FitBounds positions={demo.route} />
                  </>
                )}

                {locationHistory.length > 1 && (
                  <Polyline
                    positions={locationHistory.map((p: any) => [Number(p.latitude), Number(p.longitude)] as [number, number])}
                    pathOptions={{ color: '#1D4ED8', weight: 4, opacity: 0.8 }}
                  />
                )}

                {originPosition && (
                  <Marker position={originPosition} icon={getOriginIcon()}>
                    <Popup>
                      <strong>🟢 Pickup / Origin</strong><br />
                      {tracking?.transports?.[0]?.origin || 'Origin'}
                    </Popup>
                  </Marker>
                )}

                {destinationPosition && (
                  <Marker position={destinationPosition} icon={getDestIcon()}>
                    <Popup>
                      <strong>🔴 Destination</strong><br />
                      {tracking?.transports?.[0]?.destination || 'Destination'}
                    </Popup>
                  </Marker>
                )}

                {/* Live truck position */}
                {truckPosition && (
                  <Marker position={truckPosition} icon={getTruckIcon()}>
                    <Popup>
                      <strong>🚚 Delivery Truck</strong><br />
                      Speed: {liveDetails?.latestLocation?.speed || demo?.speed || 0} km/h<br />
                      ETA: {liveDetails?.trackingInfo?.currentEta ? new Date(liveDetails.trackingInfo.currentEta).toLocaleString() : (demo?.eta || '—')}<br />
                      Lat: {truckPosition[0].toFixed(4)}, Lng: {truckPosition[1].toFixed(4)}
                    </Popup>
                  </Marker>
                )}

                {(originPosition || destinationPosition || truckPosition) && (
                  <FitBounds
                    positions={[
                      ...(originPosition ? [originPosition] : []),
                      ...(destinationPosition ? [destinationPosition] : []),
                      ...(truckPosition ? [truckPosition] : []),
                    ]}
                  />
                )}
              </MapContainer>
            </div>
          </div>
        </div>

        {/* Transport & Storage details */}
        {tracking && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
            {/* Transport */}
            {tracking.transports?.length > 0 && (
              <div className="card p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-[#EDF5F0] flex items-center justify-center">🚚</div>
                  <h3 className="font-extrabold text-[#0D1B12]">Transport Segments</h3>
                </div>
                <div className="space-y-3">
                  {tracking.transports.map((transport, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 bg-[#F4FAF7] rounded-xl">
                      <div className="w-6 h-6 rounded-full bg-[#003D20] flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">{idx + 1}</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-[#0D1B12]">{transport.origin} → {transport.destination}</p>
                        <p className="text-xs text-[#4A6358]">Truck: {transport.assignedTruck ?? 'TBD'}</p>
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${statusColor(transport.status)}`}>{transport.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Storage */}
            {tracking.storage?.length > 0 && (
              <div className="card p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-[#EDF5F0] flex items-center justify-center">🏪</div>
                  <h3 className="font-extrabold text-[#0D1B12]">Storage Facilities</h3>
                </div>
                <div className="space-y-3">
                  {tracking.storage.map((s, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 bg-[#F4FAF7] rounded-xl">
                      <div className="w-6 h-6 rounded-full bg-[#003D20] flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">{idx + 1}</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-[#0D1B12]">{s.facility}</p>
                        <p className="text-xs text-[#4A6358]">
                          {new Date(s.startDate).toLocaleDateString()} – {new Date(s.endDate).toLocaleDateString()}
                        </p>
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${statusColor(s.status)}`}>{s.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
