
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, Briefcase, BrainCircuit, Download, FileText, Handshake, LayoutDashboard, Package, ShoppingCart, Sprout, Truck, Users, Warehouse } from 'lucide-react';
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
import { RwandaLocationFields } from '../components/location/RwandaLocationFields';
import { CropSelector } from '../components/forms/CropSelector';
import { buildLocationText, emptyRwandaLocation, parseLocationText, type RwandaLocationParts } from '../utils/rwandaLocation';
import { useTranslation } from 'react-i18next';
import { KpiBanner } from '../components/ui/KpiBanner';
import { MiniDonut } from '../components/charts/MiniDonut';
import { HorizontalBars } from '../components/charts/HorizontalBars';
import { exportReportCsv } from '../utils/exportCsv';

type Tab = 'overview' | 'farmers' | 'inventory' | 'listings' | 'price-moderations' | 'orders' | 'logistics' | 'inventory-submissions' | 'profile-requests' | 'harvest-declarations' | 'crop-sharing' | 'transport-jobs' | 'reports' | 'ai-insights' | 'ai-assistant';

const emptyFarmerForm = {
  id: '',
  fullName: '',
  email: '',
  phone: '',
  nationalId: '',
  district: '',
  sector: '',
  crops: '',
  farmSizeHectares: '',
};

const emptyListingForm = {
  id: '',
  lotId: '',
  crop: '',
  quantityKg: '',
  marketPriceReference: '',
  minimumPrice: '',
  availabilityWindowStart: '',
  availabilityWindowEnd: '',
  location: '',
  qualityGrade: 'A',
  description: '',
};

const emptyDeliveryForm = {
  contractId: '',
  origin: '',
  destination: '',
  loadKg: '',
  distanceKm: '',
  estimatedDeliveryHours: '',
  transporterId: '',
  pickupStart: '',
  pickupEnd: '',
  price: '',
};

export const CooperativeDashboardPage = () => {
  const { user, logout } = useAuth();
  const { notifications, unreadByRoute } = useSignalR();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [cooperative, setCooperative] = useState<any>(null);
  const [farmers, setFarmers] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [listings, setListings] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [storageFacilities, setStorageFacilities] = useState<any[]>([]);
  const [transporters, setTransporters] = useState<any[]>([]);
  const [transportRequests, setTransportRequests] = useState<any[]>([]);
  const [inventorySubmissions, setInventorySubmissions] = useState<any[]>([]);
  const [profileRequests, setProfileRequests] = useState<any[]>([]);
  const [harvestDeclarations, setHarvestDeclarations] = useState<any[]>([]);
  const [priceModerations, setPriceModerations] = useState<any[]>([]);
  const [moderationActionStatus, setModerationActionStatus] = useState('');
  const [farmerForm, setFarmerForm] = useState(emptyFarmerForm);
  const [farmerLocationForm, setFarmerLocationForm] = useState(emptyRwandaLocation());
  const [inventoryForm, setInventoryForm] = useState({
    id: '',
    crop: '',
    quantityKg: '',
    qualityGrade: 'A',
    expectedHarvestDate: '',
    expectedPricePerKg: '',
  });
  const [listingForm, setListingForm] = useState(emptyListingForm);
  const [listingLocationForm, setListingLocationForm] = useState(emptyRwandaLocation());
  const [listingImages, setListingImages] = useState<Array<{ preview: string; base64: string }>>([]);
  const [listingActionStatus, setListingActionStatus] = useState('');
  const [deliveryForm, setDeliveryForm] = useState(emptyDeliveryForm);
  const [deliveryOriginForm, setDeliveryOriginForm] = useState(emptyRwandaLocation());
  const [deliveryDestinationForm, setDeliveryDestinationForm] = useState(emptyRwandaLocation());
  const [assistantQuestion, setAssistantQuestion] = useState('');
  const [assistantLoading, setAssistantLoading] = useState(false);

  // Crop Sharing state
  const [csMyRequests, setCsMyRequests] = useState<{ sent: any[]; received: any[]; submittedBids: any[]; incomingBids: any[] }>({ sent: [], received: [], submittedBids: [], incomingBids: [] });
  const [csSupplyBalance, setCsSupplyBalance] = useState<any[]>([]);
  const [csForm, setCsForm] = useState({ crop: 'Maize', quantityKg: '', offeredPricePerKg: '', urgencyLevel: 'Medium', notes: '', broadcastToAll: true, targetCooperativeId: '' });
  const [csStatus, setCsStatus] = useState('');
  const [csGuidance, setCsGuidance] = useState<any[]>([]);
  const [csTargetCoops, setCsTargetCoops] = useState<any[]>([]);
  const [csBidForms, setCsBidForms] = useState<Record<string, { proposedPricePerKg: string; proposedQuantityKg: string; deliveryTerms: string; notes: string }>>({});

  // Transport Jobs state
  const [transportJobs, setTransportJobs] = useState<any[]>([]);
  const [tjForm, setTjForm] = useState({ title: '', description: '', crop: '', quantityKg: '', qualityGrade: '', pickupLocation: '', deliveryLocation: '', distanceKm: '', pickupDate: '', deliveryDeadline: '', minPaymentRwf: '', maxPaymentRwf: '', paymentTerms: 'OnDelivery', requiredVehicleType: '', requiresColdChain: false, specialInstructions: '' });
  const [tjStatus, setTjStatus] = useState('');
  const [tjViewAppsJobId, setTjViewAppsJobId] = useState<string | null>(null);
  const [tjApplications, setTjApplications] = useState<any[]>([]);

  const loadTransportJobs = async () => {
    const res = await api.get('/api/transport-jobs/my-jobs').catch(() => ({ data: [] }));
    setTransportJobs(Array.isArray(res.data) ? res.data : []);
  };
  const loadJobApplications = async (jobId: string) => {
    setTjViewAppsJobId(jobId);
    const res = await api.get(`/api/transport-jobs/${jobId}/applications`).catch(() => ({ data: [] }));
    setTjApplications(Array.isArray(res.data) ? res.data : []);
  };
  const submitTransportJob = async () => {
    setTjStatus('');
    try {
      await api.post('/api/transport-jobs', {
        title: tjForm.title, description: tjForm.description || null,
        crop: tjForm.crop, quantityKg: Number(tjForm.quantityKg),
        qualityGrade: tjForm.qualityGrade || null,
        pickupLocation: tjForm.pickupLocation, deliveryLocation: tjForm.deliveryLocation,
        distanceKm: tjForm.distanceKm ? Number(tjForm.distanceKm) : null,
        pickupDate: tjForm.pickupDate || null, deliveryDeadline: tjForm.deliveryDeadline || null,
        minPaymentRwf: tjForm.minPaymentRwf ? Number(tjForm.minPaymentRwf) : null,
        maxPaymentRwf: tjForm.maxPaymentRwf ? Number(tjForm.maxPaymentRwf) : null,
        paymentTerms: tjForm.paymentTerms, requiredVehicleType: tjForm.requiredVehicleType || null,
        requiresColdChain: tjForm.requiresColdChain, specialInstructions: tjForm.specialInstructions || null,
      });
      setTjStatus('Transport job posted! All transporters have been notified.');
      setTjForm({ title: '', description: '', crop: '', quantityKg: '', qualityGrade: '', pickupLocation: '', deliveryLocation: '', distanceKm: '', pickupDate: '', deliveryDeadline: '', minPaymentRwf: '', maxPaymentRwf: '', paymentTerms: 'OnDelivery', requiredVehicleType: '', requiresColdChain: false, specialInstructions: '' });
      await loadTransportJobs();
    } catch (e: any) { setTjStatus(e?.response?.data?.message || 'Failed to post job.'); }
  };
  const processApplication = async (appId: string, accepted: boolean, reviewNote?: string) => {
    await api.post(`/api/transport-jobs/applications/${appId}/process`, { accepted, reviewNote: reviewNote || null });
    if (tjViewAppsJobId) await loadJobApplications(tjViewAppsJobId);
    await loadTransportJobs();
  };

  const [assistantMessages, setAssistantMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([
    { role: 'assistant', text: t('cooperative_dashboard.assistant_welcome', 'Ask me anything about cooperative performance, risks, listings, inventory, or operational strategy.') },
  ]);

  const loadData = async () => {
    setLoading(true);
    const [coopRes, farmersRes, inventoryRes, listingsRes, moderationsRes, ordersRes, facilitiesRes, transportersRes, transportRes, submissionsRes, profileReqRes, harvestRes, csMyRes, csBalanceRes, csGuidanceRes, csCoopsRes] = await Promise.all([
      api.get('/api/cooperative/my-cooperative').catch(() => ({ data: null })),
      api.get('/api/cooperative/farmers').catch(() => ({ data: [] })),
      api.get('/api/cooperative/inventory').catch(() => ({ data: [] })),
      api.get('/api/cooperative/my-listings').catch(() => ({ data: [] })),
      api.get('/api/cooperative/price-moderations').catch(() => ({ data: [] })),
      api.get('/api/cooperative/orders').catch(() => ({ data: [] })),
      api.get('/api/storage/facilities').catch(() => ({ data: [] })),
      api.get('/api/cooperative/available-transporters').catch(() => ({ data: [] })),
      api.get('/api/transport').catch(() => ({ data: [] })),
      api.get('/api/cooperative/inventory-submissions').catch(() => ({ data: [] })),
      api.get('/api/cooperative/profile-update-requests').catch(() => ({ data: [] })),
      api.get('/api/cooperative/harvest-declarations').catch(() => ({ data: [] })),
      api.get('/api/crop-sharing/my-requests').catch(() => ({ data: { sent: [], received: [], submittedBids: [], incomingBids: [] } })),
      api.get('/api/crop-sharing/supply-balance').catch(() => ({ data: [] })),
      api.get('/api/reference/seasonal-guidance').catch(() => ({ data: [] })),
      api.get('/api/cooperative').catch(() => ({ data: [] })),
    ]);
    setCooperative(coopRes.data);
    setFarmers(Array.isArray(farmersRes.data) ? farmersRes.data : []);
    setInventory(Array.isArray(inventoryRes.data) ? inventoryRes.data : []);
    setListings(Array.isArray(listingsRes.data) ? listingsRes.data : []);
    setPriceModerations(Array.isArray(moderationsRes.data) ? moderationsRes.data : []);
    setOrders(Array.isArray(ordersRes.data) ? ordersRes.data : []);
    setStorageFacilities(Array.isArray(facilitiesRes.data) ? facilitiesRes.data : []);
    setTransporters(Array.isArray(transportersRes.data) ? transportersRes.data : []);
    setTransportRequests(Array.isArray(transportRes.data) ? transportRes.data : []);
    setInventorySubmissions(Array.isArray(submissionsRes.data) ? submissionsRes.data : []);
    setProfileRequests(Array.isArray(profileReqRes.data) ? profileReqRes.data : []);
    setHarvestDeclarations(Array.isArray(harvestRes.data) ? harvestRes.data : []);
    setCsMyRequests(csMyRes.data && typeof csMyRes.data === 'object' ? csMyRes.data : { sent: [], received: [], submittedBids: [], incomingBids: [] });
    setCsSupplyBalance(Array.isArray(csBalanceRes.data) ? csBalanceRes.data : []);
    setCsGuidance(Array.isArray(csGuidanceRes.data) ? csGuidanceRes.data : []);
    const coopRows = Array.isArray(csCoopsRes.data) ? csCoopsRes.data : [];
    setCsTargetCoops(coopRows.filter((c: any) => c.id !== coopRes.data?.id));
    await loadTransportJobs();
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);
  useEffect(() => {
    if (notifications.length > 0) void loadData();
  }, [notifications.length]);
  useEffect(() => {
    if (!cooperative) return;
    const parsedLocation = parseLocationText(cooperative.location || '');
    const cooperativeLocation = {
      province: cooperative.region || parsedLocation.province,
      district: cooperative.district || parsedLocation.district,
      sector: cooperative.sector || parsedLocation.sector,
      cell: cooperative.cell || parsedLocation.cell,
      detail: parsedLocation.detail,
    };

    setListingLocationForm((current) => (
      current.province || current.district || current.sector || current.cell || current.detail
        ? current
        : cooperativeLocation
    ));
    setDeliveryOriginForm((current) => (
      current.province || current.district || current.sector || current.cell || current.detail
        ? current
        : cooperativeLocation
    ));
  }, [cooperative]);

  const totalInventory = useMemo(() => inventory.reduce((s, i) => s + Number(i.quantityKg || 0), 0), [inventory]);
  const pendingInventorySubmissions = useMemo(() => inventorySubmissions.filter((s: any) => s.status === 'Submitted').length, [inventorySubmissions]);
  const pendingProfileRequests = useMemo(() => profileRequests.length, [profileRequests]);
  const pendingHarvestDeclarations = useMemo(() => harvestDeclarations.filter((h: any) => (h.status || '').toLowerCase() === 'pending').length, [harvestDeclarations]);
  const nonCompliantModerations = useMemo(
    () => priceModerations.filter((m: any) => m.hasRegulation && !m.isCompliant).length,
    [priceModerations],
  );
  const pendingBidReviews = useMemo(
    () => (csMyRequests.incomingBids || []).filter((b: any) => b.status === 'Pending').length,
    [csMyRequests.incomingBids],
  );
  const listingStatusSummary = useMemo(() => {
    const summary = {
      active: 0,
      inactive: 0,
      disabled: 0,
      cancelled: 0,
      other: 0,
    };
    for (const listing of listings) {
      const status = String(listing.status || '').toLowerCase();
      if (status === 'active') summary.active += 1;
      else if (status === 'inactive') summary.inactive += 1;
      else if (status === 'disabled') summary.disabled += 1;
      else if (status === 'cancelled') summary.cancelled += 1;
      else summary.other += 1;
    }
    return summary;
  }, [listings]);
  const newModerationActivity = (unreadByRoute['/prices'] || 0) + nonCompliantModerations;
  const cropSharingActivity = (unreadByRoute['/cooperative-dashboard?tab=crop-sharing'] || 0) + pendingBidReviews;
  const tabLabelWithBadge = (label: string, count: number) => (
    <span className="inline-flex items-center gap-2">
      <span>{label}{count > 0 ? ` (${count})` : ''}</span>
      {count > 0 && <span className="h-2 w-2 rounded-full bg-red-500" />}
    </span>
  );

  const submitInventory = async () => {
    if (inventoryForm.id) {
      await api.put(`/api/lots/${inventoryForm.id}`, {
        crop: inventoryForm.crop,
        quantityKg: Number(inventoryForm.quantityKg),
        qualityGrade: inventoryForm.qualityGrade,
        expectedHarvestDate: inventoryForm.expectedHarvestDate || undefined,
        expectedPricePerKg: Number(inventoryForm.expectedPricePerKg || 0),
      });
    } else {
      await api.post('/api/lots', {
        crop: inventoryForm.crop,
        quantityKg: Number(inventoryForm.quantityKg),
        qualityGrade: inventoryForm.qualityGrade,
        expectedHarvestDate: inventoryForm.expectedHarvestDate,
        cooperativeId: cooperative?.id || null,
        farmerContributions: null,
        expectedPricePerKg: Number(inventoryForm.expectedPricePerKg || 0),
      });
    }
    setInventoryForm({ id: '', crop: '', quantityKg: '', qualityGrade: 'A', expectedHarvestDate: '', expectedPricePerKg: '' });
    await loadData();
  };

  const applyRecommendedModeration = async (item: any) => {
    setModerationActionStatus('');
    try {
      await api.put(`/api/cooperative/market-listing/${item.listingId}`, {
        minimumPrice: Number(item.recommendedPrice || item.minimumPrice),
        status: 'Active',
      });
      setModerationActionStatus(`${item.crop} listing updated to ${Number(item.recommendedPrice || item.minimumPrice).toLocaleString()} RWF/kg.`);
      await loadData();
    } catch (e: any) {
      setModerationActionStatus(String(e?.response?.data || e?.message || 'Failed to apply recommended price.'));
    }
  };

  const submitListing = async () => {
    if (!listingForm.id && listingImages.length === 0) {
      alert(t('cooperative_dashboard.add_image_required', 'Add at least one product image before creating a listing.'));
      return;
    }
    const listingLocation = buildLocationText(listingLocationForm);
    if (listingForm.id) {
      await api.put(`/api/cooperative/market-listing/${listingForm.id}`, {
        crop: listingForm.crop,
        quantityKg: Number(listingForm.quantityKg),
        marketPriceReference: listingForm.marketPriceReference ? Number(listingForm.marketPriceReference) : undefined,
        minimumPrice: Number(listingForm.minimumPrice),
        availabilityWindowStart: listingForm.availabilityWindowStart || undefined,
        availabilityWindowEnd: listingForm.availabilityWindowEnd || undefined,
        location: listingLocation,
        description: listingForm.description,
        qualityGrade: listingForm.qualityGrade,
        status: 'Active',
      });
      if (listingImages.length > 0) {
        await api.post(`/api/cooperative/market-listing/${listingForm.id}/images`, listingImages.map((img, i) => ({
          imageBase64: img.base64,
          displayOrder: i,
        })));
      }
    } else {
      const created = await api.post('/api/cooperative/market-listing', {
        lotId: listingForm.lotId || null,
        crop: listingForm.crop,
        quantityKg: Number(listingForm.quantityKg),
        marketPriceReference: Number(listingForm.marketPriceReference),
        minimumPrice: Number(listingForm.minimumPrice),
        availabilityWindowStart: listingForm.availabilityWindowStart,
        availabilityWindowEnd: listingForm.availabilityWindowEnd,
        location: listingLocation,
        qualityGrade: listingForm.qualityGrade,
        description: listingForm.description,
      });
      if (created.data?.id && listingImages.length > 0) {
        await api.post(`/api/cooperative/market-listing/${created.data.id}/images`, listingImages.map((img, i) => ({
          imageBase64: img.base64,
          displayOrder: i,
        })));
      }
    }
    setListingForm(emptyListingForm);
    setListingImages([]);
    setListingLocationForm(cooperative ? {
      province: cooperative.region || '',
      district: cooperative.district || '',
      sector: cooperative.sector || '',
      cell: cooperative.cell || '',
      detail: parseLocationText(cooperative.location || '').detail,
    } : emptyRwandaLocation());
    await loadData();
  };

  const submitFarmer = async () => {
    if (farmerForm.id) {
      await api.put(`/api/cooperative/farmers/${farmerForm.id}`, {
        fullName: farmerForm.fullName,
        phone: farmerForm.phone,
        district: farmerLocationForm.district,
        sector: farmerLocationForm.sector,
        crops: farmerForm.crops,
        farmSizeHectares: Number(farmerForm.farmSizeHectares || 0),
      });
    } else {
      await api.post('/api/cooperative/farmers', {
        fullName: farmerForm.fullName,
        email: farmerForm.email,
        phone: farmerForm.phone,
        nationalId: farmerForm.nationalId,
        district: farmerLocationForm.district,
        sector: farmerLocationForm.sector,
        crops: farmerForm.crops,
        farmSizeHectares: Number(farmerForm.farmSizeHectares || 0),
      });
    }
    setFarmerForm(emptyFarmerForm);
    setFarmerLocationForm(emptyRwandaLocation());
    await loadData();
  };

  const submitDelivery = async () => {
    const origin = buildLocationText(deliveryOriginForm);
    const destination = buildLocationText(deliveryDestinationForm);
    await api.post('/api/transport', {
      contractId: deliveryForm.contractId || null,
      origin,
      destination,
      loadKg: Number(deliveryForm.loadKg),
      distanceKm: Number(deliveryForm.distanceKm),
      estimatedDeliveryHours: Number(deliveryForm.estimatedDeliveryHours),
      transporterId: deliveryForm.transporterId || null,
      pickupStart: deliveryForm.pickupStart,
      pickupEnd: deliveryForm.pickupEnd,
      price: Number(deliveryForm.price),
    });
    setDeliveryForm(emptyDeliveryForm);
    setDeliveryOriginForm(cooperative ? {
      province: cooperative.region || '',
      district: cooperative.district || '',
      sector: cooperative.sector || '',
      cell: cooperative.cell || '',
      detail: parseLocationText(cooperative.location || '').detail,
    } : emptyRwandaLocation());
    setDeliveryDestinationForm(emptyRwandaLocation());
    await loadData();
  };

  const deleteFarmer = async (id: string) => {
    if (!window.confirm(t('cooperative_dashboard.confirm_deactivate_farmer', 'Deactivate this farmer?'))) return;
    await api.delete(`/api/cooperative/farmers/${id}`);
    await loadData();
  };

  const deleteInventory = async (id: string) => {
    if (!window.confirm(t('cooperative_dashboard.confirm_delete_inventory', 'Delete this inventory lot?'))) return;
    await api.delete(`/api/lots/${id}`);
    await loadData();
  };

  const deleteListing = async (id: string) => {
    if (!window.confirm(t('cooperative_dashboard.confirm_cancel_listing', 'Cancel this listing?'))) return;
    await api.delete(`/api/cooperative/market-listing/${id}`);
    setListingActionStatus('Listing cancelled successfully.');
    await loadData();
  };

  const setListingStatus = async (id: string, status: 'Active' | 'Inactive') => {
    await api.post(`/api/cooperative/market-listing/${id}/status`, {
      status,
      reason: status === 'Inactive' ? 'Temporarily hidden by cooperative manager.' : 'Reactivated by cooperative manager.',
    });
    setListingActionStatus(`Listing ${status.toLowerCase()} successfully.`);
    await loadData();
  };

  const reviewInventorySubmission = async (id: string, approved: boolean) => {
    const notes = approved ? undefined : window.prompt(t('cooperative_dashboard.rejection_reason', 'Rejection reason (optional)')) || '';
    await api.post(`/api/cooperative/inventory-submissions/${id}/review`, { approved, notes });
    await loadData();
  };

  const processProfileRequest = async (id: string, approved: boolean) => {
    const notes = approved ? undefined : window.prompt(t('cooperative_dashboard.rejection_reason', 'Rejection reason (optional)')) || '';
    await api.post(`/api/cooperative/profile-update-requests/${id}/process`, { approved, notes });
    await loadData();
  };

  const assignStorage = async (orderId: string, storageFacilityId: string) => {
    if (!storageFacilityId) return;
    const startDate = new Date().toISOString();
    const endDate = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
    await api.post(`/api/cooperative/order/${orderId}/assign-storage`, { storageFacilityId, startDate, endDate });
    await loadData();
  };

  const assignTransporter = async (transportId: string, transporterId: string) => {
    if (!transporterId) return;
    await api.post(`/api/cooperative/transport/${transportId}/assign-transporter`, { transporterId });
    await loadData();
  };

  const onListingImagesSelected = (files: FileList | null) => {
    if (!files?.length) return;
    Array.from(files).slice(0, 6).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        if (!base64) return;
        setListingImages((prev) => [...prev.slice(0, 5), { preview: result, base64 }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const askAssistant = async () => {
    const q = assistantQuestion.trim();
    if (!q) return;
    setAssistantMessages((prev) => [...prev, { role: 'user', text: q }]);
    setAssistantQuestion('');
    setAssistantLoading(true);
    try {
      const res = await api.post('/api/role-analytics/assistant', { question: q });
      setAssistantMessages((prev) => [...prev, { role: 'assistant', text: String(res.data?.answer || t('cooperative_dashboard.no_answer', 'No answer generated.')) }]);
    } catch {
      setAssistantMessages((prev) => [...prev, { role: 'assistant', text: t('cooperative_dashboard.assistant_unavailable', 'Assistant is temporarily unavailable. Please retry.') }]);
    } finally {
      setAssistantLoading(false);
    }
  };

  if (loading) return <Loader label={t('cooperative_dashboard.loading', 'Loading cooperative dashboard...')} />;

  return (
    <DashboardShell
      brand="RASS Cooperative"
      subtitle={t('cooperative_dashboard.subtitle', 'Aggregation operations')}
      title={t('cooperative_dashboard.title', 'Cooperative manager dashboard')}
      activeKey={activeTab}
      navItems={[
        { key: 'overview', label: t('cooperative_dashboard.tabs.overview', 'Overview'), icon: <LayoutDashboard className="h-4 w-4" /> },
        { key: 'farmers', label: t('cooperative_dashboard.tabs.farmers', 'Farmers'), icon: <Users className="h-4 w-4" /> },
        { key: 'inventory', label: t('cooperative_dashboard.tabs.inventory', 'Inventory'), icon: <Package className="h-4 w-4" /> },
        { key: 'listings', label: t('cooperative_dashboard.tabs.listings', 'Listings'), icon: <ShoppingCart className="h-4 w-4" /> },
        { key: 'price-moderations', label: tabLabelWithBadge('Price Moderations', newModerationActivity), icon: <AlertTriangle className="h-4 w-4" /> },
        { key: 'orders', label: t('cooperative_dashboard.tabs.orders', 'Orders'), icon: <ShoppingCart className="h-4 w-4" /> },
        { key: 'logistics', label: t('cooperative_dashboard.tabs.logistics', 'Logistics'), icon: <Truck className="h-4 w-4" /> },
        { key: 'inventory-submissions', label: tabLabelWithBadge(t('cooperative_dashboard.tabs.inventory_submissions', 'Inventory submissions'), pendingInventorySubmissions), icon: <Package className="h-4 w-4" /> },
        { key: 'profile-requests', label: tabLabelWithBadge(t('cooperative_dashboard.tabs.profile_requests', 'Profile requests'), pendingProfileRequests), icon: <Users className="h-4 w-4" /> },
        { key: 'harvest-declarations', label: tabLabelWithBadge(t('cooperative_dashboard.tabs.harvest_declarations', 'Harvest declarations'), pendingHarvestDeclarations), icon: <Package className="h-4 w-4" /> },
        { key: 'crop-sharing', label: tabLabelWithBadge('Crop Sharing', cropSharingActivity), icon: <Handshake className="h-4 w-4" /> },
        { key: 'transport-jobs', label: 'Transport Jobs', icon: <Briefcase className="h-4 w-4" /> },
        { key: 'reports', label: 'Reports & Export', icon: <FileText className="h-4 w-4" /> },
        { key: 'ai-insights', label: t('cooperative_dashboard.tabs.ai_insights', 'AI Insights'), icon: <BrainCircuit className="h-4 w-4" /> },
        { key: 'ai-assistant', label: t('cooperative_dashboard.tabs.ai_assistant', 'AI Assistant'), icon: <BrainCircuit className="h-4 w-4" /> },
      ]}
      onNavChange={(k) => setActiveTab(k as Tab)}
      onLogout={logout}
      rightStatus={cooperative?.name || user?.fullName || t('cooperative_dashboard.session', 'Cooperative')}
    >
      <div className="space-y-6">
        {activeTab === 'overview' && (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <KpiBanner icon={<Users className="h-5 w-5 text-white" />} label="Farmers" value={farmers.length} sub={`${pendingProfileRequests} profile requests`} color="emerald" onClick={() => setActiveTab('farmers')} />
              <KpiBanner icon={<Warehouse className="h-5 w-5 text-white" />} label="Inventory" value={`${totalInventory.toLocaleString()} kg`} sub={`${inventory.length} lots tracked`} color="blue" onClick={() => setActiveTab('inventory')} />
              <KpiBanner icon={<Package className="h-5 w-5 text-white" />} label="Pending actions" value={pendingInventorySubmissions + pendingHarvestDeclarations} sub={`${pendingInventorySubmissions} submissions, ${pendingHarvestDeclarations} harvests`} color="amber" onClick={() => setActiveTab('inventory-submissions')} />
              <KpiBanner icon={<ShoppingCart className="h-5 w-5 text-white" />} label="Active orders" value={orders.filter((o) => (o.status || '').toLowerCase() === 'open').length} sub={`${listings.length} listings • ${transportJobs.length} transport jobs`} color="violet" onClick={() => setActiveTab('orders')} />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Card className="p-5">
                <MiniDonut
                  title="Order status breakdown"
                  slices={[
                    { label: 'Open', value: orders.filter((o: any) => (o.status || '').toLowerCase() === 'open').length, color: '#3b82f6' },
                    { label: 'Confirmed', value: orders.filter((o: any) => (o.status || '').toLowerCase() === 'confirmed').length, color: '#059669' },
                    { label: 'Delivered', value: orders.filter((o: any) => (o.status || '').toLowerCase() === 'delivered').length, color: '#8b5cf6' },
                    { label: 'Cancelled', value: orders.filter((o: any) => (o.status || '').toLowerCase() === 'cancelled').length, color: '#ef4444' },
                  ].filter(s => s.value > 0)}
                />
              </Card>

              <Card className="p-5 lg:col-span-2">
                <HorizontalBars
                  title="Inventory by crop (top 6)"
                  unit="kg"
                  bars={(() => {
                    const grouped: Record<string, number> = {};
                    inventory.forEach((item: any) => { grouped[item.crop || 'Other'] = (grouped[item.crop || 'Other'] || 0) + Number(item.quantityKg || 0); });
                    return Object.entries(grouped)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 6)
                      .map(([label, value], i) => ({ label, value, color: ['#059669', '#0891b2', '#7c3aed', '#ea580c', '#dc2626', '#64748b'][i] }));
                  })()}
                />
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card className="p-5">
                <h3 className="text-sm font-bold text-slate-800 mb-3">Recent listings</h3>
                {listings.length === 0 && <p className="py-6 text-center text-xs text-slate-500">No listings yet. Create one in the Listings tab.</p>}
                <div className="space-y-2">
                  {listings.slice(0, 4).map((l: any) => (
                    <div key={l.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2.5">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{l.crop || l.title}</p>
                        <p className="text-[10px] text-slate-500">{Number(l.quantityKg || 0).toLocaleString()} kg • {Number(l.pricePerKg || 0).toLocaleString()} RWF/kg</p>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${l.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{l.status || 'Active'}</span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-5">
                <h3 className="text-sm font-bold text-slate-800 mb-3">Transport jobs</h3>
                {transportJobs.length === 0 && <p className="py-6 text-center text-xs text-slate-500">No transport jobs posted yet.</p>}
                <div className="space-y-2">
                  {transportJobs.slice(0, 4).map((j: any) => (
                    <div key={j.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2.5">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{j.title}</p>
                        <p className="text-[10px] text-slate-500">{j.crop} • {j.pickupLocation} → {j.deliveryLocation}</p>
                      </div>
                      <div className="text-right">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${j.status === 'Open' ? 'bg-emerald-50 text-emerald-700' : j.status === 'Assigned' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>{j.status}</span>
                        <p className="text-[10px] text-slate-400 mt-0.5">{j.applicationCount || 0} apps</p>
                      </div>
                    </div>
                  ))}
                </div>
                {transportJobs.length > 0 && <button className="mt-2 text-xs font-semibold text-emerald-700 hover:underline" onClick={() => setActiveTab('transport-jobs')}>Manage transport jobs →</button>}
              </Card>
            </div>

            <RoleAIAnalyticsPanel contextData={{ farmers, inventory, listings, orders, facilities: storageFacilities }} />
            <NationalMarketPulsePanel title={t('cooperative_dashboard.market_pulse', 'Cooperative market pulse')} />
          </>
        )}

        {activeTab === 'farmers' && (
          <Card className="p-5 space-y-5">
            <h3 className="text-lg font-black text-slate-900">{farmerForm.id ? 'Edit farmer' : 'Register farmer'}</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Input label="Full name" value={farmerForm.fullName} onChange={(e) => setFarmerForm((p) => ({ ...p, fullName: e.target.value }))} />
              <Input label="Email" type="email" value={farmerForm.email} onChange={(e) => setFarmerForm((p) => ({ ...p, email: e.target.value }))} disabled={Boolean(farmerForm.id)} />
              <Input label="Phone" value={farmerForm.phone} onChange={(e) => setFarmerForm((p) => ({ ...p, phone: e.target.value }))} />
              <Input label="National ID" value={farmerForm.nationalId} onChange={(e) => setFarmerForm((p) => ({ ...p, nationalId: e.target.value }))} disabled={Boolean(farmerForm.id)} />
              <div className="md:col-span-2">
                <RwandaLocationFields
                  value={farmerLocationForm}
                  onChange={(next) => setFarmerLocationForm(next)}
                  showCell={false}
                  showDetail={false}
                />
              </div>
              <Input label="Crops" value={farmerForm.crops} onChange={(e) => setFarmerForm((p) => ({ ...p, crops: e.target.value }))} />
              <Input label="Farm size (ha)" type="number" value={farmerForm.farmSizeHectares} onChange={(e) => setFarmerForm((p) => ({ ...p, farmSizeHectares: e.target.value }))} />
            </div>
            <div className="flex gap-2">
              <Button onClick={submitFarmer}>{farmerForm.id ? 'Update farmer' : 'Add farmer'}</Button>
              {farmerForm.id && <Button variant="outline" onClick={() => { setFarmerForm(emptyFarmerForm); setFarmerLocationForm(emptyRwandaLocation()); }}>Cancel edit</Button>}
            </div>
            <div className="space-y-2">
              {farmers.map((f: any) => (
                <div key={f.id || f.userId} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-semibold">{f.fullName || f.user?.fullName || 'Farmer'}</p>
                    <p className="text-xs text-slate-500">{f.phone || 'No phone'} • {[f.district, f.sector].filter(Boolean).join(' / ') || 'No location'} • {(f.crops || 'No crops')}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => {
                      setFarmerForm({
                        id: f.id || '',
                        fullName: f.fullName || '',
                        email: f.email || '',
                        phone: f.phone || '',
                        nationalId: f.nationalId || '',
                        district: f.district || '',
                        sector: f.sector || '',
                        crops: f.crops || '',
                        farmSizeHectares: String(f.farmSizeHectares || ''),
                      });
                      setFarmerLocationForm({
                        ...emptyRwandaLocation(),
                        district: f.district || '',
                        sector: f.sector || '',
                      });
                    }}>Edit</Button>
                    <Button size="sm" variant="danger" onClick={() => deleteFarmer(f.id)}>Deactivate</Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {activeTab === 'inventory' && (
          <Card className="p-5 space-y-5">
            <h3 className="text-lg font-black text-slate-900">{inventoryForm.id ? 'Edit inventory lot' : 'Create inventory lot'}</h3>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              High-quality inventory records improve cooperative AI forecasts, pricing strategy, and contract match quality. Select from the government crop catalog or create a new crop that government can later regulate.
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              <CropSelector value={inventoryForm.crop} onChange={(value) => setInventoryForm((p) => ({ ...p, crop: value }))} label="Crop" allowCustom />
              <Input label="Quantity (kg)" type="number" value={inventoryForm.quantityKg} onChange={(e) => setInventoryForm((p) => ({ ...p, quantityKg: e.target.value }))} />
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-600">Quality grade</span>
                <select className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" value={inventoryForm.qualityGrade} onChange={(e) => setInventoryForm((p) => ({ ...p, qualityGrade: e.target.value }))}>
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                </select>
              </label>
              <Input label="Expected harvest date" type="date" value={inventoryForm.expectedHarvestDate} onChange={(e) => setInventoryForm((p) => ({ ...p, expectedHarvestDate: e.target.value }))} />
              <Input label="Expected price (RWF/kg)" type="number" value={inventoryForm.expectedPricePerKg} onChange={(e) => setInventoryForm((p) => ({ ...p, expectedPricePerKg: e.target.value }))} />
            </div>
            <div className="mt-4 flex gap-2">
              <Button onClick={submitInventory}>{inventoryForm.id ? 'Update inventory' : 'Save inventory'}</Button>
              {inventoryForm.id && <Button variant="outline" onClick={() => setInventoryForm({ id: '', crop: '', quantityKg: '', qualityGrade: 'A', expectedHarvestDate: '', expectedPricePerKg: '' })}>Cancel edit</Button>}
            </div>
            <div className="space-y-2">
              {inventory.map((i: any) => (
                <div key={i.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-semibold">{i.crop} • {Number(i.quantityKg || 0).toLocaleString()}kg</p>
                    <p className="text-xs text-slate-500">{i.qualityGrade || 'A'} • {i.status || 'Listed'} • {i.expectedHarvestDate ? new Date(i.expectedHarvestDate).toLocaleDateString() : 'No date'}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setInventoryForm({
                      id: i.id || '',
                      crop: i.crop || '',
                      quantityKg: String(i.quantityKg || ''),
                      qualityGrade: i.qualityGrade || 'A',
                      expectedHarvestDate: i.expectedHarvestDate ? new Date(i.expectedHarvestDate).toISOString().slice(0, 10) : '',
                      expectedPricePerKg: String(i.expectedPricePerKg || ''),
                    })}>Edit</Button>
                    <Button size="sm" variant="danger" onClick={() => deleteInventory(i.id)}>Delete</Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {activeTab === 'listings' && (
          <Card className="p-5 space-y-5">
            <h3 className="text-lg font-black text-slate-900">{listingForm.id ? 'Edit listing' : 'Create listing'}</h3>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">Active</p>
                <p className="text-lg font-black text-emerald-800">{listingStatusSummary.active}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">Inactive</p>
                <p className="text-lg font-black text-slate-800">{listingStatusSummary.inactive}</p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-700">Disabled</p>
                <p className="text-lg font-black text-amber-800">{listingStatusSummary.disabled}</p>
              </div>
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-red-700">Cancelled</p>
                <p className="text-lg font-black text-red-800">{listingStatusSummary.cancelled}</p>
              </div>
              <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-700">Visible</p>
                <p className="text-lg font-black text-blue-800">{listingStatusSummary.active}</p>
              </div>
            </div>
            {!listingForm.id && (
              <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Listings without images reduce buyer trust and conversion. Add clear product images before publishing.
              </div>
            )}
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-600">Linked lot</span>
                <select className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" value={listingForm.lotId} onChange={(e) => setListingForm((p) => ({ ...p, lotId: e.target.value }))} disabled={Boolean(listingForm.id)}>
                  <option value="">Select lot</option>
                  {inventory.map((l: any) => <option key={l.id} value={l.id}>{l.crop} - {Number(l.quantityKg || 0).toLocaleString()}kg</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-600">Crop</span>
                <CropSelector value={listingForm.crop} onChange={(value) => setListingForm((p) => ({ ...p, crop: value }))} allowCustom helperText="New crops remain visible to government for optional price moderation." />
              </label>
              <Input label="Available quantity (kg)" type="number" value={listingForm.quantityKg} onChange={(e) => setListingForm((p) => ({ ...p, quantityKg: e.target.value }))} />
              <Input label="Market reference (RWF/kg)" type="number" value={listingForm.marketPriceReference} onChange={(e) => setListingForm((p) => ({ ...p, marketPriceReference: e.target.value }))} />
              <Input label="Minimum price (RWF/kg)" type="number" value={listingForm.minimumPrice} onChange={(e) => setListingForm((p) => ({ ...p, minimumPrice: e.target.value }))} />
              <div className="md:col-span-3">
                <RwandaLocationFields
                  value={listingLocationForm}
                  onChange={(next) => setListingLocationForm(next)}
                  showDetail
                  detailLabel="Listing details"
                  detailPlaceholder="Collection point, market stall, or landmark"
                />
              </div>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-600">Quality grade</span>
                <select className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" value={listingForm.qualityGrade} onChange={(e) => setListingForm((p) => ({ ...p, qualityGrade: e.target.value }))}>
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                </select>
              </label>
              <Input label="Availability start" type="datetime-local" value={listingForm.availabilityWindowStart} onChange={(e) => setListingForm((p) => ({ ...p, availabilityWindowStart: e.target.value }))} />
              <Input label="Availability end" type="datetime-local" value={listingForm.availabilityWindowEnd} onChange={(e) => setListingForm((p) => ({ ...p, availabilityWindowEnd: e.target.value }))} />
              <Input label="Description" className="md:col-span-3" value={listingForm.description} onChange={(e) => setListingForm((p) => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-600">{listingForm.id ? 'Add listing images' : 'Listing images (max 6)'}</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="block w-full text-sm text-slate-700"
                  onChange={(e) => onListingImagesSelected(e.target.files)}
                />
              </label>
              {listingImages.length > 0 && (
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  {listingImages.map((img, idx) => (
                    <div key={`${idx}-${img.preview}`} className="relative rounded-xl border border-slate-200 p-1">
                      <img src={img.preview} alt={`Listing preview ${idx + 1}`} className="h-24 w-full rounded-lg object-cover" />
                      <button
                        type="button"
                        className="absolute right-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white"
                        onClick={() => setListingImages((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {!listingForm.id && (
              <div className="space-y-2">
                <p className="text-xs text-slate-500">At least one image is required when creating a listing.</p>
              </div>
            )}
            <div className="mt-4 flex gap-2">
              <Button onClick={submitListing}>{listingForm.id ? 'Update listing' : 'Create listing'}</Button>
              {listingForm.id && <Button variant="outline" onClick={() => {
                setListingForm(emptyListingForm);
                setListingImages([]);
                setListingLocationForm(cooperative ? {
                  province: cooperative.region || '',
                  district: cooperative.district || '',
                  sector: cooperative.sector || '',
                  cell: cooperative.cell || '',
                  detail: parseLocationText(cooperative.location || '').detail,
                } : emptyRwandaLocation());
              }}>Cancel edit</Button>}
            </div>
            <div className="space-y-2">
              {listings.map((l: any) => (
                <div key={l.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-semibold">{l.crop} • {Number(l.quantityKg || 0).toLocaleString()}kg • {Number(l.minimumPrice || 0).toLocaleString()} RWF/kg</p>
                    <p className="text-xs text-slate-500">Grade {l.qualityGrade || 'A'} • {l.status} • {l.location || 'Location not specified'} • {l.availabilityWindowEnd ? new Date(l.availabilityWindowEnd).toLocaleString() : 'No expiry'} • {Array.isArray(l.images) ? l.images.length : 0} image(s)</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => {
                      setListingForm({
                        id: l.id || '',
                        lotId: '',
                        crop: l.crop || '',
                        quantityKg: String(l.quantityKg || ''),
                        marketPriceReference: String(l.marketPriceReference || ''),
                        minimumPrice: String(l.minimumPrice || ''),
                        availabilityWindowStart: l.availabilityWindowStart ? new Date(l.availabilityWindowStart).toISOString().slice(0, 16) : '',
                        availabilityWindowEnd: l.availabilityWindowEnd ? new Date(l.availabilityWindowEnd).toISOString().slice(0, 16) : '',
                        location: l.location || '',
                        qualityGrade: l.qualityGrade || 'A',
                        description: l.description || '',
                      });
                      const parsedLocation = parseLocationText(l.location || '');
                      setListingLocationForm({
                        province: parsedLocation.province || cooperative?.region || '',
                        district: parsedLocation.district || cooperative?.district || '',
                        sector: parsedLocation.sector || cooperative?.sector || '',
                        cell: parsedLocation.cell || cooperative?.cell || '',
                        detail: parsedLocation.detail,
                      });
                    }}>Edit</Button>
                    {String(l.status || '').toLowerCase() === 'active' && (
                      <Button size="sm" variant="outline" onClick={() => setListingStatus(l.id, 'Inactive')}>Disable</Button>
                    )}
                    {String(l.status || '').toLowerCase() === 'inactive' && (
                      <Button size="sm" onClick={() => setListingStatus(l.id, 'Active')}>Enable</Button>
                    )}
                    <Button size="sm" variant="danger" onClick={() => deleteListing(l.id)}>Delete</Button>
                  </div>
                </div>
              ))}
            </div>
            {listingActionStatus && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                {listingActionStatus}
              </div>
            )}
          </Card>
        )}

        {activeTab === 'orders' && (
          <Card className="p-5">
            <h3 className="text-lg font-black text-slate-900">{t('cooperative_dashboard.cooperative_orders', 'Cooperative orders')}</h3>
            <div className="mt-4 space-y-2">
              {orders.map((o: any) => (
                <div key={o.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-semibold">{o.crop} • {o.quantityKg}kg</p>
                    <p className="text-xs text-slate-500">{o.status} • {o.deliveryLocation || 'No location'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-emerald-700">{Number(o.priceOffer || 0).toLocaleString()} RWF/kg</p>
                    {String(o.status || '').toLowerCase() === 'open' && (
                      <>
                        <Button size="sm" onClick={async () => { await api.post(`/api/cooperative/order/${o.id}/respond`, { accepted: true }); await loadData(); }}>Accept</Button>
                        <Button size="sm" variant="outline" onClick={async () => { await api.post(`/api/cooperative/order/${o.id}/respond`, { accepted: false }); await loadData(); }}>Reject</Button>
                      </>
                    )}
                    {String(o.status || '').toLowerCase() === 'accepted' && (
                      <label className="block">
                        <select className="h-8 rounded-lg border border-slate-300 px-2 text-xs" defaultValue="" onChange={(e) => { void assignStorage(o.id, e.target.value); }}>
                          <option value="">Book storage</option>
                          {storageFacilities.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </select>
                      </label>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {activeTab === 'price-moderations' && (
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-slate-900">Price Moderations</h3>
                <p className="text-sm text-slate-500">National regulation intelligence for your active listings in your cooperative region.</p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                {nonCompliantModerations} action required
              </div>
            </div>

            {moderationActionStatus && (
              <div className={`mt-4 rounded-xl border px-3 py-2 text-xs font-semibold ${moderationActionStatus.toLowerCase().includes('failed') ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                {moderationActionStatus}
              </div>
            )}

            <div className="mt-5 space-y-3">
              {priceModerations.length === 0 && (
                <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                  No active listings available for moderation tracking yet.
                </p>
              )}
              {priceModerations.map((item: any) => (
                <div key={item.listingId} className={`rounded-2xl border px-4 py-3 ${item.hasRegulation ? (item.isCompliant ? 'border-emerald-200 bg-emerald-50/40' : 'border-red-200 bg-red-50/40') : 'border-slate-200 bg-slate-50/60'}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-slate-900">{item.crop}</p>
                      <p className="text-xs text-slate-500">
                        Current listing: {Number(item.minimumPrice || 0).toLocaleString()} RWF/kg • Qty {Number(item.quantityKg || 0).toLocaleString()} kg
                      </p>
                      {item.hasRegulation ? (
                        <p className="mt-1 text-xs text-slate-600">
                          Regulated range: {(item.regulation?.minPricePerKg != null ? Number(item.regulation.minPricePerKg).toLocaleString() : '0')} – {Number(item.regulation?.maxPricePerKg || 0).toLocaleString()} RWF/kg
                          {' '}({item.regulation?.district || item.regulation?.region || item.cooperativeRegion})
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-slate-500">No active government regulation for this crop in your area yet.</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${item.hasRegulation ? (item.isCompliant ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700') : 'bg-slate-100 text-slate-600'}`}>
                        {item.hasRegulation ? (item.isCompliant ? 'Compliant' : 'Action needed') : 'Unregulated'}
                      </span>
                      {!item.isCompliant && item.hasRegulation && (
                        <Button size="sm" onClick={() => applyRecommendedModeration(item)}>
                          Apply {Number(item.recommendedPrice || item.minimumPrice).toLocaleString()} RWF/kg
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const listing = listings.find((l: any) => l.id === item.listingId);
                          if (listing) {
                            setListingForm({
                              id: listing.id || '',
                              lotId: '',
                              crop: listing.crop || '',
                              quantityKg: String(listing.quantityKg || ''),
                              marketPriceReference: String(listing.marketPriceReference || ''),
                              minimumPrice: String(listing.minimumPrice || ''),
                              availabilityWindowStart: listing.availabilityWindowStart ? new Date(listing.availabilityWindowStart).toISOString().slice(0, 16) : '',
                              availabilityWindowEnd: listing.availabilityWindowEnd ? new Date(listing.availabilityWindowEnd).toISOString().slice(0, 16) : '',
                              location: listing.location || '',
                              qualityGrade: listing.qualityGrade || 'A',
                              description: listing.description || '',
                            });
                          }
                          setActiveTab('listings');
                        }}
                      >
                        Open listing
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {activeTab === 'logistics' && (
          <Card className="p-5">
            <h3 className="text-lg font-black text-slate-900">{t('cooperative_dashboard.create_delivery_job', 'Create delivery job')}</h3>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              <Input label="Contract ID (optional)" value={deliveryForm.contractId} onChange={(e) => setDeliveryForm((p) => ({ ...p, contractId: e.target.value }))} />
              <div className="md:col-span-3">
                <RwandaLocationFields
                  value={deliveryOriginForm}
                  onChange={(next) => setDeliveryOriginForm(next)}
                  showDetail
                  detailLabel={t('cooperative_dashboard.pickup_location', 'Pickup location')}
                  detailPlaceholder="Loading bay, collection point, or landmark"
                />
              </div>
              <div className="md:col-span-3">
                <RwandaLocationFields
                  value={deliveryDestinationForm}
                  onChange={(next) => setDeliveryDestinationForm(next)}
                  showDetail
                  detailLabel={t('cooperative_dashboard.drop_location', 'Drop location')}
                  detailPlaceholder="Delivery point, warehouse, or buyer landmark"
                />
              </div>
              <Input label={t('cooperative_dashboard.load', 'Load (kg)')} type="number" value={deliveryForm.loadKg} onChange={(e) => setDeliveryForm((p) => ({ ...p, loadKg: e.target.value }))} />
              <Input label={t('cooperative_dashboard.distance', 'Distance (km)')} type="number" value={deliveryForm.distanceKm} onChange={(e) => setDeliveryForm((p) => ({ ...p, distanceKm: e.target.value }))} />
              <Input label={t('cooperative_dashboard.eta', 'ETA (hours)')} type="number" value={deliveryForm.estimatedDeliveryHours} onChange={(e) => setDeliveryForm((p) => ({ ...p, estimatedDeliveryHours: e.target.value }))} />
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-600">{t('cooperative_dashboard.transporter', 'Transporter')}</span>
                <select className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" value={deliveryForm.transporterId} onChange={(e) => setDeliveryForm((p) => ({ ...p, transporterId: e.target.value }))}>
                  <option value="">{t('cooperative_dashboard.select_transporter', 'Select transporter')}</option>
                  {transporters.map((tr: any) => <option key={tr.id || tr.userId} value={tr.id || tr.userId}>{tr.companyName || tr.fullName || tr.user?.fullName || tr.licensePlate || 'Transporter'}</option>)}
                </select>
              </label>
               <Input label={t('cooperative_dashboard.pickup_start', 'Pickup start')} type="datetime-local" value={deliveryForm.pickupStart} onChange={(e) => setDeliveryForm((p) => ({ ...p, pickupStart: e.target.value }))} />
               <Input label={t('cooperative_dashboard.pickup_end', 'Pickup end')} type="datetime-local" value={deliveryForm.pickupEnd} onChange={(e) => setDeliveryForm((p) => ({ ...p, pickupEnd: e.target.value }))} />
               <Input label={t('cooperative_dashboard.price_rwf', 'Price (RWF)')} type="number" value={deliveryForm.price} onChange={(e) => setDeliveryForm((p) => ({ ...p, price: e.target.value }))} />
            </div>
            <div className="mt-4"><Button onClick={submitDelivery}>{t('cooperative_dashboard.create_delivery', 'Create delivery')}</Button></div>
            <div className="mt-5">
               <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">{t('cooperative_dashboard.storage_facilities', 'Storage facilities')}</p>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {storageFacilities.slice(0, 8).map((f: any) => (
                  <div key={f.id} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
                    <p className="font-semibold">{f.name}</p>
                    <p className="text-xs text-slate-500">{f.location} • {Number(f.capacityKg || 0).toLocaleString()}kg</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-5">
               <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">{t('cooperative_dashboard.transport_requests', 'Transport requests')}</p>
              <div className="space-y-2">
                {transportRequests.map((tr: any) => (
                  <div key={tr.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
                    <div>
                      <p className="font-semibold">{tr.origin} → {tr.destination}</p>
                      <p className="text-xs text-slate-500">{Number(tr.loadKg || 0).toLocaleString()}kg • {tr.status}</p>
                    </div>
                    {!tr.transporterId && String(tr.status || '').toLowerCase() !== 'completed' && (
                      <label className="block">
                        <select className="h-8 rounded-lg border border-slate-300 px-2 text-xs" defaultValue="" onChange={(e) => { void assignTransporter(tr.id, e.target.value); }}>
                           <option value="">{t('cooperative_dashboard.assign_transporter', 'Assign transporter')}</option>
                          {transporters.map((tp: any) => <option key={tp.id} value={tp.id}>{tp.companyName || tp.fullName || 'Transporter'}</option>)}
                        </select>
                      </label>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}

        {activeTab === 'inventory-submissions' && (
          <Card className="p-5">
            <h3 className="text-lg font-black text-slate-900">{t('cooperative_dashboard.inventory_submissions', 'Inventory submissions')}</h3>
            <div className="mt-4 space-y-2">
              {inventorySubmissions.map((s: any) => (
                <div key={s.id} className="rounded-xl border border-slate-200 px-3 py-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">{s.crop} • {Number(s.quantityKg || 0).toLocaleString()}kg • Grade {s.qualityGrade || 'A'}</p>
                      <p className="text-xs text-slate-500">{s.farmer?.fullName || 'Farmer'} • {s.status}</p>
                    </div>
                    <div className="flex gap-2">
                       <Button size="sm" onClick={() => reviewInventorySubmission(s.id, true)}>{t('common.approve', 'Approve')}</Button>
                       <Button size="sm" variant="outline" onClick={() => reviewInventorySubmission(s.id, false)}>{t('common.reject', 'Reject')}</Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {activeTab === 'profile-requests' && (
          <Card className="p-5">
            <h3 className="text-lg font-black text-slate-900">{t('cooperative_dashboard.farmer_profile_requests', 'Farmer profile requests')}</h3>
            <div className="mt-4 space-y-2">
              {profileRequests.map((r: any) => (
                <div key={r.id} className="rounded-xl border border-slate-200 px-3 py-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">{r.farmerName || r.actor}</p>
                      <p className="text-xs text-slate-500">{new Date(r.timestamp).toLocaleString()}</p>
                    </div>
                    <div className="flex gap-2">
                       <Button size="sm" onClick={() => processProfileRequest(r.id, true)}>{t('common.approve', 'Approve')}</Button>
                       <Button size="sm" variant="outline" onClick={() => processProfileRequest(r.id, false)}>{t('common.reject', 'Reject')}</Button>
                    </div>
                  </div>
                  {r.metadata && <pre className="mt-2 whitespace-pre-wrap text-[11px] text-slate-600">{typeof r.metadata === 'string' ? r.metadata : JSON.stringify(r.metadata)}</pre>}
                </div>
              ))}
            </div>
          </Card>
        )}

        {activeTab === 'harvest-declarations' && (
          <Card className="p-5">
            <h3 className="text-lg font-black text-slate-900">{t('cooperative_dashboard.harvest_declarations', 'Farmers harvest declarations')}</h3>
            <p className="mt-1 text-xs text-slate-500">Review and approve harvest declarations. Quality condition assessment is required for approval.</p>
            <div className="mt-4 space-y-3">
              {harvestDeclarations.map((h: any) => {
                const isPending = (h.status || '').toLowerCase() === 'pending';
                return (
                  <div key={h.id} className={`rounded-xl border px-4 py-3 ${isPending ? 'border-amber-200 bg-amber-50' : 'border-slate-200'}`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-semibold">{h.crop} • {Number(h.expectedQuantityKg || 0).toLocaleString()} kg • Grade {h.qualityIndicators || 'A'}</p>
                        <p className="text-xs text-slate-500">{h.farmer?.fullName || 'Farmer'} • {h.status}</p>
                        {h.conditionGrade && <p className="mt-0.5 text-xs text-emerald-600">Condition: {h.conditionGrade}</p>}
                        {h.conditionNote && <p className="text-xs text-slate-500 italic">{h.conditionNote}</p>}
                      </div>
                      <p className="text-xs font-semibold text-slate-500">{h.expectedHarvestDate ? new Date(h.expectedHarvestDate).toLocaleDateString() : 'No date'}</p>
                    </div>
                    {isPending && (
                      <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                        <p className="text-xs font-semibold text-slate-600 mb-2">Quality Assessment (required for approval)</p>
                        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                          <select className="h-9 rounded-lg border border-slate-300 px-2 text-sm" id={`grade-${h.id}`} defaultValue="">
                            <option value="" disabled>Select condition grade</option>
                            <option value="Excellent">Excellent</option>
                            <option value="Good">Good</option>
                            <option value="MinorDefects">Minor Defects</option>
                            <option value="ModerateDamage">Moderate Damage</option>
                            <option value="HighSpoilage">High Spoilage</option>
                          </select>
                          <input className="h-9 rounded-lg border border-slate-300 px-2 text-sm" id={`note-${h.id}`} placeholder="Condition notes (e.g. slight discoloration on 5%)" />
                        </div>
                        <div className="mt-2 flex gap-2">
                          <button className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700" onClick={async () => {
                            const grade = (document.getElementById(`grade-${h.id}`) as HTMLSelectElement)?.value;
                            const note = (document.getElementById(`note-${h.id}`) as HTMLInputElement)?.value;
                            if (!grade) { alert('Please select a condition grade.'); return; }
                            if (!note?.trim()) { alert('Please provide condition notes.'); return; }
                            try {
                              await api.post(`/api/farmers/harvest-declaration/${h.id}/review-enhanced`, {
                                status: 'Approved',
                                conditionGrade: grade,
                                conditionNote: note.trim(),
                              });
                              await loadData();
                            } catch (e: any) {
                              alert(e?.response?.data?.message || e?.response?.data || 'Failed to approve');
                            }
                          }}>Approve with Assessment</button>
                          <button className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-600" onClick={async () => {
                            const grade = (document.getElementById(`grade-${h.id}`) as HTMLSelectElement)?.value;
                            const note = (document.getElementById(`note-${h.id}`) as HTMLInputElement)?.value;
                            if (!grade) { alert('Please select a condition grade before rejecting.'); return; }
                            if (!note?.trim()) { alert('Please provide a condition note before rejecting.'); return; }
                            try {
                              await api.post(`/api/farmers/harvest-declaration/${h.id}/review-enhanced`, {
                                status: 'Rejected',
                                conditionGrade: grade,
                                conditionNote: note.trim(),
                              });
                              await loadData();
                            } catch (e: any) {
                              alert(e?.response?.data?.message || e?.response?.data || 'Failed to reject');
                            }
                          }}>Reject</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {harvestDeclarations.length === 0 && <p className="text-sm text-slate-500">No harvest declarations yet.</p>}
            </div>
          </Card>
        )}

        {/* ===== CROP SHARING TAB ===== */}
        {activeTab === 'crop-sharing' && (
          <div className="space-y-5">
            {/* Regional Supply Balance */}
            <Card className="p-5">
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Handshake className="h-5 w-5 text-emerald-600" />
                Regional Supply Balance
              </h3>
              <p className="mt-1 text-xs text-slate-500">View which crops are in surplus or scarcity across regions. Request crops your cooperative needs from others with surplus.</p>
              {csSupplyBalance.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">No supply data available yet.</p>
              ) : (
                <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
                  {csSupplyBalance.map((b: any, i: number) => (
                    <div key={i} className={`rounded-xl border px-3 py-2.5 ${b.status === 'Scarcity' ? 'border-red-200 bg-red-50' : b.status === 'Surplus' ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200'}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold">{b.crop}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${b.status === 'Scarcity' ? 'bg-red-100 text-red-700' : b.status === 'Surplus' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{b.status}</span>
                      </div>
                      <p className="text-xs text-slate-600">{b.region} • Supply: {Number(b.supplyKg).toLocaleString()} kg • Demand: {Number(b.nationalDemandKg).toLocaleString()} kg</p>
                      <p className="text-xs text-slate-500">{b.cooperativeCount} cooperative(s) • Ratio: {b.supplyRatio}</p>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Government Seasonal Guidance */}
            {csGuidance.length > 0 && (
              <Card className="p-5">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Sprout className="h-5 w-5 text-emerald-600" />
                  Government Seasonal Guidance
                </h3>
                <div className="mt-3 space-y-2">
                  {csGuidance.map((g: any, i: number) => (
                    <div key={i} className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-emerald-800">{g.crop}</span>
                        <span className="text-xs text-emerald-600">{g.region} • Season {g.season}</span>
                        <span className={`text-xs font-semibold ${g.expectedTrend === 'Rise' ? 'text-red-600' : g.expectedTrend === 'Fall' ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {g.expectedTrend === 'Rise' ? '↑' : g.expectedTrend === 'Fall' ? '↓' : '→'} {g.expectedTrend}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-emerald-800">{g.recommendationForFarmers}</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Create Sharing Request */}
            <Card className="p-5">
              <h3 className="text-base font-bold text-slate-900">Request Crops from Other Cooperatives</h3>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600">Crop Needed *</label>
                  <div className="mt-1">
                    <CropSelector value={csForm.crop} onChange={(value) => setCsForm((f) => ({ ...f, crop: value }))} allowCustom />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Quantity (kg) *</label>
                  <input type="number" className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" placeholder="e.g. 5000" value={csForm.quantityKg} onChange={e => setCsForm(f => ({ ...f, quantityKg: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Offered Price (RWF/kg)</label>
                  <input type="number" className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" placeholder="Optional" value={csForm.offeredPricePerKg} onChange={e => setCsForm(f => ({ ...f, offeredPricePerKg: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Urgency *</label>
                  <select className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" value={csForm.urgencyLevel} onChange={e => setCsForm(f => ({ ...f, urgencyLevel: e.target.value }))}>
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-slate-600">Notes</label>
                  <input className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" placeholder="Additional details..." value={csForm.notes} onChange={e => setCsForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Send request mode</label>
                  <select className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" value={csForm.broadcastToAll ? 'all' : 'targeted'} onChange={(e) => setCsForm((f) => ({ ...f, broadcastToAll: e.target.value === 'all', targetCooperativeId: e.target.value === 'all' ? '' : f.targetCooperativeId }))}>
                    <option value="all">All cooperatives (open bidding)</option>
                    <option value="targeted">Specific cooperative</option>
                  </select>
                </div>
                {!csForm.broadcastToAll && (
                  <div className="md:col-span-2">
                    <label className="text-xs font-semibold text-slate-600">Target cooperative</label>
                    <select className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" value={csForm.targetCooperativeId} onChange={(e) => setCsForm((f) => ({ ...f, targetCooperativeId: e.target.value }))}>
                      <option value="">Select cooperative</option>
                      {csTargetCoops.map((c: any) => (
                        <option key={c.id} value={c.id}>{c.name} • {c.region} • {c.district}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div className="mt-3">
                <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700" disabled={!csForm.quantityKg || (!csForm.broadcastToAll && !csForm.targetCooperativeId)} onClick={async () => {
                  setCsStatus('');
                  try {
                    await api.post('/api/crop-sharing/requests', {
                      crop: csForm.crop,
                      quantityKg: Number(csForm.quantityKg),
                      offeredPricePerKg: csForm.offeredPricePerKg ? Number(csForm.offeredPricePerKg) : null,
                      urgencyLevel: csForm.urgencyLevel,
                      notes: csForm.notes || null,
                      broadcastToAll: csForm.broadcastToAll,
                      targetCooperativeId: csForm.broadcastToAll ? null : csForm.targetCooperativeId,
                    });
                    setCsStatus('Request submitted successfully.');
                    setCsForm({ crop: 'Maize', quantityKg: '', offeredPricePerKg: '', urgencyLevel: 'Medium', notes: '', broadcastToAll: true, targetCooperativeId: '' });
                    await loadData();
                  } catch (e: any) {
                    setCsStatus(e?.response?.data?.message || 'Failed to submit request.');
                  }
                }}>Submit Request</button>
              </div>
              {csStatus && <p className="mt-2 text-xs font-semibold text-emerald-700">{csStatus}</p>}
            </Card>

            {/* My Requests - Sent */}
            <Card className="p-5">
              <h3 className="text-base font-bold text-slate-900">My Sent Requests</h3>
              <div className="mt-3 space-y-2">
                {(csMyRequests.sent || []).length === 0 && <p className="text-sm text-slate-500">No sent requests.</p>}
                {(csMyRequests.sent || []).map((r: any) => (
                  <div key={r.id} className="rounded-xl border border-slate-200 px-4 py-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold">{r.crop}</span>
                      <span className="text-xs text-slate-500">{Number(r.quantityKg).toLocaleString()} kg</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${r.status === 'Open' ? 'bg-blue-100 text-blue-700' : r.status === 'Accepted' ? 'bg-emerald-100 text-emerald-700' : r.status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{r.status}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${r.urgencyLevel === 'Critical' ? 'bg-red-100 text-red-700' : r.urgencyLevel === 'High' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>{r.urgencyLevel}</span>
                    </div>
                    {r.partner && <p className="mt-1 text-xs text-slate-500">Supplier: {r.partner.name} ({r.partner.region})</p>}
                    <p className="text-xs text-slate-500">
                      Scope: {r.broadcastToAll ? 'Sent to all cooperatives for bidding' : `Targeted to ${r.target?.name || 'selected cooperative'}`}
                    </p>
                    {r.offeredPricePerKg && <p className="text-xs text-slate-500">Offered: {Number(r.offeredPricePerKg).toLocaleString()} RWF/kg</p>}
                    {r.agreedPricePerKg && <p className="text-xs text-emerald-600">Agreed: {Number(r.agreedPricePerKg).toLocaleString()} RWF/kg • {Number(r.agreedQuantityKg).toLocaleString()} kg</p>}
                    <p className="text-xs text-slate-400">{new Date(r.createdAt).toLocaleDateString()}</p>
                    <p className="text-xs text-indigo-600">Bids: {Number(r.bidCount || 0)} total • {Number(r.pendingBidCount || 0)} pending review</p>
                    {r.status === 'Open' && (
                      <button className="mt-1 text-xs text-red-500 hover:underline" onClick={async () => {
                        await api.post(`/api/crop-sharing/requests/${r.id}/cancel`);
                        await loadData();
                      }}>Cancel request</button>
                    )}
                    {r.status === 'Accepted' && (
                      <button className="mt-1 text-xs text-emerald-600 hover:underline" onClick={async () => {
                        await api.post(`/api/crop-sharing/requests/${r.id}/fulfill`);
                        await loadData();
                      }}>Mark fulfilled</button>
                    )}
                  </div>
                ))}
              </div>
            </Card>

            {/* Incoming requests where my cooperative can submit bids */}
            <Card className="p-5">
              <h3 className="text-base font-bold text-slate-900">Incoming Requests to Bid</h3>
              <div className="mt-3 space-y-2">
                {(csMyRequests.received || []).length === 0 && <p className="text-sm text-slate-500">No incoming requests.</p>}
                {(csMyRequests.received || []).map((r: any) => (
                  <div key={r.id} className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-emerald-800">{r.crop}</span>
                      <span className="text-xs text-emerald-600">{Number(r.quantityKg).toLocaleString()} kg</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${r.status === 'Open' ? 'bg-blue-100 text-blue-700' : r.status === 'Accepted' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{r.status}</span>
                    </div>
                    {r.partner && <p className="mt-1 text-xs text-emerald-700">Requester: {r.partner.name} ({r.partner.region})</p>}
                    {r.offeredPricePerKg && <p className="text-xs text-emerald-600">Offered price: {Number(r.offeredPricePerKg).toLocaleString()} RWF/kg</p>}
                    {r.status === 'Open' && (
                      <div className="mt-2 flex gap-2">
                        <input className="h-8 rounded border border-slate-300 px-2 text-xs" placeholder="Bid RWF/kg" value={csBidForms[r.id]?.proposedPricePerKg || ''} onChange={(e) => setCsBidForms((prev) => ({ ...prev, [r.id]: { proposedPricePerKg: e.target.value, proposedQuantityKg: prev[r.id]?.proposedQuantityKg || '', deliveryTerms: prev[r.id]?.deliveryTerms || '', notes: prev[r.id]?.notes || '' } }))} />
                        <input className="h-8 rounded border border-slate-300 px-2 text-xs" placeholder="Bid kg" value={csBidForms[r.id]?.proposedQuantityKg || ''} onChange={(e) => setCsBidForms((prev) => ({ ...prev, [r.id]: { proposedPricePerKg: prev[r.id]?.proposedPricePerKg || '', proposedQuantityKg: e.target.value, deliveryTerms: prev[r.id]?.deliveryTerms || '', notes: prev[r.id]?.notes || '' } }))} />
                        <input className="h-8 rounded border border-slate-300 px-2 text-xs" placeholder="Delivery terms" value={csBidForms[r.id]?.deliveryTerms || ''} onChange={(e) => setCsBidForms((prev) => ({ ...prev, [r.id]: { proposedPricePerKg: prev[r.id]?.proposedPricePerKg || '', proposedQuantityKg: prev[r.id]?.proposedQuantityKg || '', deliveryTerms: e.target.value, notes: prev[r.id]?.notes || '' } }))} />
                        <button className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700" onClick={async () => {
                          try {
                            const form = csBidForms[r.id] || { proposedPricePerKg: '', proposedQuantityKg: '', deliveryTerms: '', notes: '' };
                            await api.post(`/api/crop-sharing/requests/${r.id}/bids`, {
                              proposedPricePerKg: Number(form.proposedPricePerKg || r.offeredPricePerKg || 0),
                              proposedQuantityKg: Number(form.proposedQuantityKg || r.quantityKg || 0),
                              deliveryTerms: form.deliveryTerms || undefined,
                              notes: form.notes || undefined,
                            });
                            await loadData();
                          } catch (e: any) {
                            alert(e?.response?.data?.message || e?.response?.data || 'Failed to submit bid');
                          }
                        }}>Submit / Update Bid</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="text-base font-bold text-slate-900">Bid Review Center (My Requests)</h3>
              <div className="mt-3 space-y-2">
                {(csMyRequests.incomingBids || []).length === 0 && <p className="text-sm text-slate-500">No supplier bids yet.</p>}
                {(csMyRequests.incomingBids || []).map((b: any) => (
                  <div key={b.id} className="rounded-xl border border-indigo-200 bg-indigo-50/40 px-4 py-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="text-sm font-bold text-indigo-900">
                        {b.supplier?.name || 'Supplier'} • {Number(b.proposedPricePerKg || 0).toLocaleString()} RWF/kg • {Number(b.proposedQuantityKg || 0).toLocaleString()} kg
                      </p>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${b.status === 'Pending' ? 'bg-amber-100 text-amber-700' : b.status === 'Selected' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{b.status}</span>
                    </div>
                    {b.deliveryTerms && <p className="text-xs text-indigo-700">Delivery: {b.deliveryTerms}</p>}
                    {b.notes && <p className="text-xs text-slate-600">{b.notes}</p>}
                    {b.status === 'Pending' && (
                      <button className="mt-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700" onClick={async () => {
                        try {
                          await api.post(`/api/crop-sharing/requests/${b.cropShareRequestId}/select-bid`, { bidId: b.id });
                          await loadData();
                        } catch (e: any) {
                          alert(e?.response?.data?.message || e?.response?.data || 'Failed to select bid');
                        }
                      }}>
                        Select this bid
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="text-base font-bold text-slate-900">My Submitted Bids</h3>
              <div className="mt-3 space-y-2">
                {(csMyRequests.submittedBids || []).length === 0 && <p className="text-sm text-slate-500">No submitted bids yet.</p>}
                {(csMyRequests.submittedBids || []).map((b: any) => (
                  <div key={b.id} className="rounded-xl border border-slate-200 px-4 py-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="text-sm font-semibold">{b.request?.crop || 'Crop request'} • {Number(b.proposedPricePerKg || 0).toLocaleString()} RWF/kg • {Number(b.proposedQuantityKg || 0).toLocaleString()} kg</p>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${b.status === 'Pending' ? 'bg-blue-100 text-blue-700' : b.status === 'Selected' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{b.status}</span>
                    </div>
                    <p className="text-xs text-slate-500">Requester: {b.request?.requester?.name || 'Requester cooperative'}</p>
                    {b.deliveryTerms && <p className="text-xs text-slate-500">Delivery: {b.deliveryTerms}</p>}
                    <p className="text-xs text-slate-400">{new Date(b.createdAt).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'transport-jobs' && (
          <div className="space-y-6">
            <Card className="p-5">
              <h3 className="text-lg font-black text-slate-900">Post a transport job</h3>
              <p className="mt-1 text-xs text-slate-500">Describe the cargo and route. All registered transporters will be notified immediately.</p>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                <Input label="Job title *" value={tjForm.title} onChange={e => setTjForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Maize delivery Kigali → Musanze" />
                <CropSelector value={tjForm.crop} onChange={v => setTjForm(f => ({ ...f, crop: v }))} label="Crop *" allowCustom />
                <Input label="Quantity (kg) *" type="number" value={tjForm.quantityKg} onChange={e => setTjForm(f => ({ ...f, quantityKg: e.target.value }))} placeholder="e.g. 5000" />
                <Input label="Quality grade" value={tjForm.qualityGrade} onChange={e => setTjForm(f => ({ ...f, qualityGrade: e.target.value }))} placeholder="e.g. Grade A" />
                <Input label="Pickup location *" value={tjForm.pickupLocation} onChange={e => setTjForm(f => ({ ...f, pickupLocation: e.target.value }))} placeholder="e.g. Kigali warehouse" />
                <Input label="Delivery location *" value={tjForm.deliveryLocation} onChange={e => setTjForm(f => ({ ...f, deliveryLocation: e.target.value }))} placeholder="e.g. Musanze market" />
                <Input label="Distance (km)" type="number" value={tjForm.distanceKm} onChange={e => setTjForm(f => ({ ...f, distanceKm: e.target.value }))} />
                <Input label="Pickup date" type="datetime-local" value={tjForm.pickupDate} onChange={e => setTjForm(f => ({ ...f, pickupDate: e.target.value }))} />
                <Input label="Delivery deadline" type="datetime-local" value={tjForm.deliveryDeadline} onChange={e => setTjForm(f => ({ ...f, deliveryDeadline: e.target.value }))} />
                <Input label="Min payment (RWF)" type="number" value={tjForm.minPaymentRwf} onChange={e => setTjForm(f => ({ ...f, minPaymentRwf: e.target.value }))} placeholder="e.g. 50000" />
                <Input label="Max payment (RWF)" type="number" value={tjForm.maxPaymentRwf} onChange={e => setTjForm(f => ({ ...f, maxPaymentRwf: e.target.value }))} placeholder="e.g. 100000" />
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Payment terms</label>
                  <select className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" value={tjForm.paymentTerms} onChange={e => setTjForm(f => ({ ...f, paymentTerms: e.target.value }))}>
                    <option value="OnDelivery">On delivery</option>
                    <option value="OnPickup">On pickup</option>
                    <option value="50/50">50% upfront, 50% on delivery</option>
                    <option value="Net7">Net 7 days</option>
                    <option value="Net30">Net 30 days</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Required vehicle type</label>
                  <select className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" value={tjForm.requiredVehicleType} onChange={e => setTjForm(f => ({ ...f, requiredVehicleType: e.target.value }))}>
                    <option value="">Any vehicle</option>
                    <option value="Pickup">Pickup truck</option>
                    <option value="Truck">Truck</option>
                    <option value="Lorry">Lorry</option>
                    <option value="Refrigerated">Refrigerated truck</option>
                    <option value="Motorcycle">Motorcycle</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <input type="checkbox" checked={tjForm.requiresColdChain} onChange={e => setTjForm(f => ({ ...f, requiresColdChain: e.target.checked }))} className="h-4 w-4 rounded border-slate-300" />
                  <label className="text-sm text-slate-700">Requires cold chain</label>
                </div>
              </div>
              <div className="mt-3">
                <label className="mb-1 block text-xs font-semibold text-slate-600">Description / special instructions</label>
                <textarea className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" rows={2} value={tjForm.description} onChange={e => setTjForm(f => ({ ...f, description: e.target.value }))} placeholder="Additional details for transporters..." />
              </div>
              <div className="mt-3 flex items-center gap-3">
                <Button onClick={submitTransportJob} disabled={!tjForm.title.trim() || !tjForm.crop || !tjForm.quantityKg || !tjForm.pickupLocation.trim() || !tjForm.deliveryLocation.trim()}>Post job</Button>
                {tjStatus && <p className="text-xs font-semibold text-emerald-700">{tjStatus}</p>}
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="text-lg font-black text-slate-900">My transport jobs ({transportJobs.length})</h3>
              <div className="mt-4 space-y-3">
                {transportJobs.length === 0 && <p className="text-sm text-slate-500">No transport jobs posted yet.</p>}
                {transportJobs.map((job: any) => (
                  <div key={job.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{job.title}</p>
                        <p className="text-xs text-slate-500">{job.crop} • {Number(job.quantityKg || 0).toLocaleString()} kg • {job.pickupLocation} → {job.deliveryLocation}</p>
                        {job.minPaymentRwf != null && <p className="text-xs text-slate-500">Budget: {Number(job.minPaymentRwf).toLocaleString()}–{Number(job.maxPaymentRwf || 0).toLocaleString()} RWF</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${job.status === 'Open' ? 'bg-emerald-50 text-emerald-700' : job.status === 'Assigned' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>{job.status}</span>
                        <span className="text-xs text-slate-500">{job.applicationCount || 0} applications</span>
                      </div>
                    </div>
                    {job.assignedTransporter && <p className="mt-1 text-xs text-emerald-700 font-semibold">Assigned to: {job.assignedTransporter}</p>}
                    {job.status === 'Open' && (job.applicationCount || 0) > 0 && (
                      <Button size="sm" variant="outline" className="mt-2" onClick={() => loadJobApplications(job.id)}>View applications</Button>
                    )}

                    {tjViewAppsJobId === job.id && (
                      <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                        <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Applications</p>
                        {tjApplications.length === 0 && <p className="text-xs text-slate-500">No applications yet.</p>}
                        {tjApplications.map((app: any) => (
                          <div key={app.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-sm font-semibold">{app.transporterName}</p>
                                <p className="text-xs text-slate-500">{app.transporterEmail} • {app.driverPhone || 'No phone'}</p>
                                <p className="text-xs text-slate-600 mt-1">
                                  Proposed: <span className="font-bold">{Number(app.proposedPriceRwf || 0).toLocaleString()} RWF</span>
                                  {app.vehicleType && ` • ${app.vehicleType}`}
                                  {app.plateNumber && ` • ${app.plateNumber}`}
                                  {app.vehicleCapacityKg && ` • ${Number(app.vehicleCapacityKg).toLocaleString()} kg capacity`}
                                  {app.estimatedDeliveryHours && ` • ~${app.estimatedDeliveryHours}h delivery`}
                                </p>
                                {app.coverLetter && <p className="text-xs text-slate-600 mt-1 italic">"{app.coverLetter}"</p>}
                                {app.drivingLicenseUrl && <a href={app.drivingLicenseUrl} target="_blank" rel="noreferrer" className="text-xs text-emerald-700 underline mr-2">License</a>}
                                {app.insuranceDocUrl && <a href={app.insuranceDocUrl} target="_blank" rel="noreferrer" className="text-xs text-emerald-700 underline">Insurance</a>}
                              </div>
                              <div className="flex items-center gap-1">
                                {app.status === 'Submitted' && (
                                  <>
                                    <Button size="sm" onClick={() => processApplication(app.id, true, 'Selected as best transporter.')}>Accept</Button>
                                    <Button size="sm" variant="danger" onClick={() => processApplication(app.id, false, 'Not selected.')}>Reject</Button>
                                  </>
                                )}
                                {app.status !== 'Submitted' && (
                                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${app.status === 'Accepted' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>{app.status}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="space-y-5">
            <div className="rounded-2xl bg-gradient-to-r from-[#002D15] via-[#003D20] to-[#00793E] p-6 text-white">
              <h2 className="text-xl font-black">Cooperative Reports & Export</h2>
              <p className="mt-1 text-sm text-emerald-200">Export data as CSV/Excel files for offline analysis, audits, and government reporting.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { type: 'listings', label: 'Market Listings', desc: 'All your cooperative\'s listings with prices, quantities, and status', icon: <ShoppingCart className="h-5 w-5 text-emerald-600" />, bg: 'bg-emerald-50' },
                { type: 'harvests', label: 'Harvest Declarations', desc: 'Farmer harvest declarations with crop, quantity, and quality data', icon: <Sprout className="h-5 w-5 text-green-600" />, bg: 'bg-green-50' },
                { type: 'inventory', label: 'Inventory (Lots)', desc: 'Current inventory with quality grades, verification status, and pricing', icon: <Package className="h-5 w-5 text-blue-600" />, bg: 'bg-blue-50' },
                { type: 'contracts', label: 'Contracts', desc: 'Contract history with buyers including values and delivery status', icon: <FileText className="h-5 w-5 text-violet-600" />, bg: 'bg-violet-50' },
                { type: 'orders', label: 'Buyer Orders', desc: 'All orders received with buyer info, pricing, and fulfilment status', icon: <ShoppingCart className="h-5 w-5 text-amber-600" />, bg: 'bg-amber-50' },
                { type: 'transport-jobs', label: 'Transport Jobs', desc: 'Transport jobs posted with pickup/delivery details and assignments', icon: <Truck className="h-5 w-5 text-rose-600" />, bg: 'bg-rose-50' },
                { type: 'payments', label: 'Payments', desc: 'Payment and transaction records for completed contracts', icon: <BarChart3 className="h-5 w-5 text-cyan-600" />, bg: 'bg-cyan-50' },
                { type: 'prices', label: 'Market Prices', desc: 'Current and historical market price data across crops and regions', icon: <BarChart3 className="h-5 w-5 text-slate-600" />, bg: 'bg-slate-50' },
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

        {activeTab === 'ai-insights' && (
          <div className="space-y-4">
            <RoleAIAnalyticsPanel contextData={{ farmers, inventory, listings, orders, facilities: storageFacilities }} />
            <Card className="p-5">
              <h3 className="text-lg font-black text-slate-900">{t('cooperative_dashboard.ai_assistant_title', 'Cooperative AI Assistant')}</h3>
              <p className="mt-1 text-xs text-slate-500">{t('cooperative_dashboard.ai_assistant_intro', 'Ask role-specific operational and strategic questions based on your live analytics.')}</p>
              <div className="mt-4 h-64 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                {assistantMessages.map((m, idx) => (
                  <div key={idx} className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${m.role === 'user' ? 'ml-auto bg-emerald-700 text-white' : 'bg-white text-slate-800 border border-slate-200'}`}>
                    {m.text}
                  </div>
                ))}
                {assistantLoading && <p className="text-xs text-slate-500">{t('cooperative_dashboard.assistant_preparing', 'AI assistant is preparing response...')}</p>}
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  className="h-11 flex-1 rounded-xl border border-slate-300 px-3 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  placeholder={t('cooperative_dashboard.assistant_placeholder', 'e.g. Which crop should we prioritize this week and why?')}
                  value={assistantQuestion}
                  onChange={(e) => setAssistantQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      askAssistant();
                    }
                  }}
                />
                <Button onClick={askAssistant} disabled={assistantLoading || !assistantQuestion.trim()}>{t('cooperative_dashboard.ask_ai', 'Ask AI')}</Button>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'ai-assistant' && (
          <Card className="p-5">
            <h3 className="text-lg font-black text-slate-900">{t('cooperative_dashboard.ai_assistant_title', 'Cooperative AI Assistant')}</h3>
            <p className="mt-1 text-xs text-slate-500">{t('cooperative_dashboard.ai_assistant_intro', 'Ask role-specific operational and strategic questions based on your live analytics.')}</p>
            <div className="mt-4 h-64 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
              {assistantMessages.map((m, idx) => (
                <div key={idx} className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${m.role === 'user' ? 'ml-auto bg-emerald-700 text-white' : 'bg-white text-slate-800 border border-slate-200'}`}>
                  {m.text}
                </div>
              ))}
              {assistantLoading && <p className="text-xs text-slate-500">{t('cooperative_dashboard.assistant_preparing', 'AI assistant is preparing response...')}</p>}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                className="h-11 flex-1 rounded-xl border border-slate-300 px-3 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                placeholder={t('cooperative_dashboard.assistant_placeholder', 'e.g. Which crop should we prioritize this week and why?')}
                value={assistantQuestion}
                onChange={(e) => setAssistantQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    askAssistant();
                  }
                }}
              />
              <Button onClick={askAssistant} disabled={assistantLoading || !assistantQuestion.trim()}>{t('cooperative_dashboard.ask_ai', 'Ask AI')}</Button>
            </div>
          </Card>
        )}
      </div>
    </DashboardShell>
  );
};
