import { useEffect, useMemo, useState } from 'react';
import { Banknote, BrainCircuit, Download, FileText, LayoutDashboard, Package, ShoppingCart, TrendingUp, User } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { DashboardShell } from '../components/layout/DashboardShell';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Loader } from '../components/ui/Loader';
import { RoleAIAnalyticsPanel } from '../components/RoleAIAnalyticsPanel';
import { RoleAssistantCard } from '../components/RoleAssistantCard';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { RwandaLocationFields } from '../components/location/RwandaLocationFields';
import { buildLocationText, emptyRwandaLocation, parseLocationText } from '../utils/rwandaLocation';
import { KpiBanner } from '../components/ui/KpiBanner';
import { MiniDonut } from '../components/charts/MiniDonut';
import { exportReportCsv } from '../utils/exportCsv';

type Tab = 'overview' | 'marketplace' | 'orders' | 'forecast' | 'price-forecasts' | 'reports' | 'ai-insights' | 'ai-assistant' | 'profile';

export const BuyerDashboardPage = () => {
  const { user, logout } = useAuth();
  const { addToCart } = useCart();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [listings, setListings] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [orderForm, setOrderForm] = useState({
    crop: '',
    quantityKg: '',
    priceOffer: '',
    deliveryLocation: '',
    deliveryWindowStart: '',
    deliveryWindowEnd: '',
    notes: '',
    marketListingId: '',
  });
  const [profileForm, setProfileForm] = useState({ organization: '', businessType: '', location: '', phone: '' });
  const [orderLocationForm, setOrderLocationForm] = useState(emptyRwandaLocation());
  const [profileLocationForm, setProfileLocationForm] = useState(emptyRwandaLocation());
  const [editingOrderLocationForm, setEditingOrderLocationForm] = useState(emptyRwandaLocation());
  const [orderActionMessage, setOrderActionMessage] = useState('');
  const [editingOrder, setEditingOrder] = useState<any | null>(null);
  const [orderError, setOrderError] = useState('');
  const [priceCrop, setPriceCrop] = useState('');
  const [priceMarket, setPriceMarket] = useState('');
  const [priceDays, setPriceDays] = useState(7);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [priceForecast, setPriceForecast] = useState<any>(null);

  const loadData = async () => {
    setLoading(true);
    const [listRes, ordRes, contractsRes, profileRes] = await Promise.all([
      api.get('/api/market-listings').catch(() => ({ data: [] })),
      api.get('/api/buyerorders').catch(() => ({ data: [] })),
      api.get('/api/contracts').catch(() => ({ data: [] })),
      api.get('/api/profile').catch(() => ({ data: null })),
    ]);
    const listingRows = Array.isArray(listRes.data)
      ? listRes.data
      : Array.isArray(listRes.data?.listings)
        ? listRes.data.listings
        : [];
    setListings(listingRows);
    setOrders(Array.isArray(ordRes.data) ? ordRes.data : []);
    setContracts(Array.isArray(contractsRes.data) ? contractsRes.data : []);
    const p = profileRes.data?.profile;
    if (p) {
      setProfileForm({ organization: p.organization || '', businessType: p.businessType || '', location: p.location || '', phone: p.phone || '' });
      setProfileLocationForm(parseLocationText(p.location || ''));
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalSpent = useMemo(() => orders.reduce((s, o) => s + Number(o.totalPrice || (Number(o.quantityKg || 0) * Number(o.priceOffer || 0))), 0), [orders]);
  const openOrders = useMemo(() => orders.filter((o) => String(o.status || '').toLowerCase() === 'open').length, [orders]);
  const pendingContracts = useMemo(
    () => contracts.filter((c) => ['PendingApproval', 'PendingSignature'].includes(String(c.status || ''))).length,
    [contracts],
  );
  const listingOptions = useMemo(
    () => listings.filter((l) => Number(l.quantityKg || 0) > 0).slice(0, 40),
    [listings],
  );

  const submitOrder = async () => {
    setOrderError('');
    setOrderActionMessage('');
    try {
      await api.post('/api/buyerorders', {
        crop: orderForm.crop,
        quantityKg: Number(orderForm.quantityKg),
        priceOffer: Number(orderForm.priceOffer),
        marketListingId: orderForm.marketListingId || null,
        deliveryLocation: buildLocationText(orderLocationForm),
        deliveryWindowStart: orderForm.deliveryWindowStart || new Date().toISOString(),
        deliveryWindowEnd: orderForm.deliveryWindowEnd || new Date(Date.now() + 86400000).toISOString(),
        notes: orderForm.notes || '',
      });
      setOrderActionMessage(t('buyer_dashboard.order_created', 'Order created successfully.'));
      setOrderForm({ crop: '', quantityKg: '', priceOffer: '', deliveryLocation: '', deliveryWindowStart: '', deliveryWindowEnd: '', notes: '', marketListingId: '' });
      setOrderLocationForm(emptyRwandaLocation());
      await loadData();
    } catch (e: any) {
      setOrderError(String(e?.response?.data || e?.message || 'Create order failed.'));
    }
  };

  const updateOrder = async (orderId: string) => {
    const existing = orders.find((o) => o.id === orderId);
    if (!existing) return;
    setOrderError('');
    setEditingOrder({
      ...existing,
      crop: existing.crop || '',
      quantityKg: String(existing.quantityKg || ''),
      priceOffer: String(existing.priceOffer || ''),
      deliveryLocation: existing.deliveryLocation || '',
      deliveryWindowStart: existing.deliveryWindowStart ? String(existing.deliveryWindowStart).slice(0, 16) : '',
      deliveryWindowEnd: existing.deliveryWindowEnd ? String(existing.deliveryWindowEnd).slice(0, 16) : '',
      notes: existing.notes || '',
      marketListingId: existing.marketListingId || existing.marketListing?.id || '',
    });
    setEditingOrderLocationForm(parseLocationText(existing.deliveryLocation || ''));
  };

  const deleteOrder = async (orderId: string) => {
    setOrderError('');
    try {
      await api.delete(`/api/buyerorders/${orderId}`);
      await loadData();
    } catch (e: any) {
      setOrderError(String(e?.response?.data?.message || e?.response?.data || e?.message || 'Delete failed.'));
    }
  };

  const proceedToCheckout = async (order: any) => {
    setOrderActionMessage('');
    const listingId = order?.marketListingId || order?.marketListing?.id;
    if (!listingId) {
      setOrderActionMessage(t('buyer_dashboard.no_linked_listing', 'This order has no linked listing. Create from a listing to proceed to checkout.'));
      return;
    }
    const quantity = Number(order?.quantityKg || 0);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setOrderActionMessage(t('buyer_dashboard.invalid_order_quantity', 'Order quantity is invalid for checkout.'));
      return;
    }

    try {
      await addToCart(String(listingId), quantity);
      navigate('/cart');
    } catch {
      setOrderActionMessage(t('buyer_dashboard.checkout_unavailable', 'Unable to proceed to checkout for this order right now. Please refresh and try again.'));
    }
  };

  const saveOrderEdit = async () => {
    if (!editingOrder) return;
    setOrderError('');
    try {
      await api.put(`/api/buyerorders/${editingOrder.id}`, {
        crop: editingOrder.crop,
        quantityKg: Number(editingOrder.quantityKg),
        priceOffer: Number(editingOrder.priceOffer),
        marketListingId: editingOrder.marketListingId || null,
        deliveryLocation: buildLocationText(editingOrderLocationForm),
        deliveryWindowStart: editingOrder.deliveryWindowStart || new Date().toISOString(),
        deliveryWindowEnd: editingOrder.deliveryWindowEnd || new Date(Date.now() + 86400000).toISOString(),
        notes: editingOrder.notes || '',
      });
      setEditingOrder(null);
      await loadData();
    } catch (e: any) {
      setOrderError(String(e?.response?.data || e?.message || 'Update failed.'));
    }
  };

  const crops = useMemo(() => [...new Set(listings.map((l) => String(l.crop || '').trim()).filter(Boolean))], [listings]);
  const markets = useMemo(
    () => [...new Set(listings.map((l) => String(l.cooperative?.region || l.cooperative?.district || l.cooperative?.location || '').trim()).filter(Boolean))],
    [listings],
  );
  const filteredListingsForPrice = useMemo(
    () => listings.filter((l) => (!priceCrop || l.crop === priceCrop) && (!priceMarket || (l.cooperative?.region || l.cooperative?.district || l.cooperative?.location) === priceMarket)),
    [listings, priceCrop, priceMarket],
  );
  const avgPrice = useMemo(() => {
    if (!filteredListingsForPrice.length) return 0;
    const total = filteredListingsForPrice.reduce((s, l) => s + Number(l.minimumPrice || 0), 0);
    return Math.round(total / filteredListingsForPrice.length);
  }, [filteredListingsForPrice]);

  const runPriceForecast = async () => {
    if (!priceCrop || !priceMarket) return;
    setForecastLoading(true);
    try {
      const res = await api.get(`/api/marketprices/forecast/${encodeURIComponent(priceCrop)}/${encodeURIComponent(priceMarket)}?days=${priceDays}`);
      setPriceForecast(res.data);
    } catch {
      setPriceForecast(null);
    } finally {
      setForecastLoading(false);
    }
  };

  const saveProfile = async () => {
    await api.put('/api/profile', { ...profileForm, location: buildLocationText(profileLocationForm) });
    await loadData();
  };

  if (loading) return <Loader label={t('buyer_dashboard.loading', 'Loading buyer dashboard...')} />;

  return (
    <DashboardShell
      brand="RASS Buyer"
      subtitle={t('buyer_dashboard.subtitle', 'Procurement workspace')}
      title={t('buyer_dashboard.title', 'Buyer dashboard')}
      activeKey={activeTab}
        navItems={[
        { key: 'overview', label: t('buyer_dashboard.tabs.overview', 'Overview'), icon: <LayoutDashboard className="h-4 w-4" /> },
        { key: 'marketplace', label: t('buyer_dashboard.tabs.create_order', 'Create order'), icon: <ShoppingCart className="h-4 w-4" /> },
        { key: 'orders', label: t('buyer_dashboard.tabs.my_orders', 'My orders'), icon: <Package className="h-4 w-4" /> },
          { key: 'forecast', label: t('buyer_dashboard.tabs.forecast', 'Forecast'), icon: <TrendingUp className="h-4 w-4" /> },
          { key: 'price-forecasts', label: t('buyer_dashboard.tabs.price_forecasts', 'Price Forecasts'), icon: <TrendingUp className="h-4 w-4" /> },
          { key: 'reports', label: 'Reports & Export', icon: <FileText className="h-4 w-4" /> },
          { key: 'ai-insights', label: t('buyer_dashboard.tabs.ai_insights', 'AI insights'), icon: <BrainCircuit className="h-4 w-4" /> },
          { key: 'ai-assistant', label: t('buyer_dashboard.tabs.ai_assistant', 'AI Assistant'), icon: <BrainCircuit className="h-4 w-4" /> },
        { key: 'profile', label: t('buyer_dashboard.tabs.profile', 'Profile'), icon: <User className="h-4 w-4" /> },
      ]}
      onNavChange={(k) => setActiveTab(k as Tab)}
      onLogout={logout}
      rightStatus={user?.fullName || t('buyer_dashboard.session', 'Buyer session')}
    >
      <div className="space-y-6">
        {activeTab === 'overview' && (
          <>
            <Card className="border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-blue-50 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-emerald-700">{t('buyer_dashboard.control_center', 'Buyer control center')}</p>
                  <h3 className="text-xl font-black text-slate-900">{t('buyer_dashboard.snapshot_title', 'Procurement snapshot at a glance')}</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    You currently have <strong>{openOrders}</strong> open orders and <strong>{pendingContracts}</strong> pending contracts.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setActiveTab('marketplace')} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white">{t('buyer_dashboard.tabs.create_order', 'Create order')}</button>
                    <button type="button" onClick={() => setActiveTab('orders')} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700">{t('buyer_dashboard.manage_orders', 'Manage orders')}</button>
                    <button type="button" onClick={() => setActiveTab('ai-insights')} className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">{t('buyer_dashboard.tabs.ai_insights', 'AI insights')}</button>
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <KpiBanner icon={<ShoppingCart className="h-5 w-5 text-white" />} label="Marketplace" value={listings.length} sub={`${listingOptions.length} ready to buy`} color="emerald" onClick={() => navigate('/marketplace')} />
              <KpiBanner icon={<Package className="h-5 w-5 text-white" />} label="Orders" value={orders.length} sub={`${openOrders} open`} color="blue" onClick={() => setActiveTab('orders')} />
              <KpiBanner icon={<FileText className="h-5 w-5 text-white" />} label="Contracts" value={contracts.length} sub={`${pendingContracts} pending`} color="violet" onClick={() => navigate('/contracts')} />
              <KpiBanner icon={<Banknote className="h-5 w-5 text-white" />} label="Total spent" value={`${totalSpent.toLocaleString()} RWF`} sub={`${orders.filter((o: any) => o.status === 'Delivered' || o.status === 'Completed').length} completed orders`} color="teal" />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Card className="p-5">
                <MiniDonut
                  title="Order status"
                  slices={[
                    { label: 'Open', value: orders.filter((o: any) => (o.status || '').toLowerCase() === 'open' || (o.status || '').toLowerCase() === 'pending').length, color: '#f59e0b' },
                    { label: 'Confirmed', value: orders.filter((o: any) => (o.status || '').toLowerCase() === 'confirmed' || (o.status || '').toLowerCase() === 'processing').length, color: '#3b82f6' },
                    { label: 'Delivered', value: orders.filter((o: any) => (o.status || '').toLowerCase() === 'delivered' || (o.status || '').toLowerCase() === 'completed').length, color: '#059669' },
                    { label: 'Cancelled', value: orders.filter((o: any) => (o.status || '').toLowerCase() === 'cancelled').length, color: '#ef4444' },
                  ].filter(s => s.value > 0)}
                />
              </Card>
              <Card className="p-5 lg:col-span-2">
                <h3 className="text-sm font-bold text-slate-800 mb-3">Recent orders</h3>
                {orders.length === 0 && <p className="py-6 text-center text-xs text-slate-500">No orders yet. Browse the marketplace to get started!</p>}
                <div className="space-y-2">
                  {orders.slice(0, 5).map((o: any) => (
                    <div key={o.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2.5">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{o.crop || o.title || 'Order'}</p>
                        <p className="text-[10px] text-slate-500">{Number(o.quantityKg || o.totalQuantityKg || 0).toLocaleString()} kg • {new Date(o.createdAt || Date.now()).toLocaleDateString()}</p>
                      </div>
                      <div className="text-right">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          (o.status || '').toLowerCase() === 'open' || (o.status || '').toLowerCase() === 'pending' ? 'bg-amber-50 text-amber-700' :
                          (o.status || '').toLowerCase() === 'delivered' || (o.status || '').toLowerCase() === 'completed' ? 'bg-emerald-50 text-emerald-700' :
                          (o.status || '').toLowerCase() === 'cancelled' ? 'bg-red-50 text-red-600' :
                          'bg-blue-50 text-blue-700'
                        }`}>{o.status || 'Pending'}</span>
                        <p className="text-[10px] text-slate-500 mt-0.5">{Number(o.totalPrice || o.price || 0).toLocaleString()} RWF</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <RoleAIAnalyticsPanel contextData={{ listings, orders, contracts }} />
          </>
        )}

        {activeTab === 'marketplace' && (
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900">{t('buyer_dashboard.create_buyer_order', 'Create buyer order')}</h3>
              <button type="button" onClick={loadData} className="text-xs font-bold text-emerald-700">{t('buyer_dashboard.refresh_listings', 'Refresh listings')}</button>
            </div>
            {orderActionMessage && (
              <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                {orderActionMessage}
              </div>
            )}
            {orderError && (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {orderError}
              </div>
            )}
            {listingOptions.length === 0 && (
              <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                 {t('buyer_dashboard.no_active_listings', 'No active listings are currently available for selection. You can still create a direct manual order.')}
              </div>
            )}
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              <label className="block md:col-span-3">
                 <span className="mb-1.5 block text-xs font-semibold text-slate-600">{t('buyer_dashboard.from_listing_optional', 'From listing (optional)')}</span>
                <select className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" value={orderForm.marketListingId} onChange={(e) => {
                  const selected = listings.find((l) => String(l.id) === e.target.value);
                  setOrderForm((p) => ({
                    ...p,
                    marketListingId: e.target.value,
                    crop: selected?.crop || p.crop,
                    quantityKg: selected?.quantityKg ? String(selected.quantityKg) : p.quantityKg,
                    priceOffer: selected?.minimumPrice ? String(selected.minimumPrice) : p.priceOffer,
                  }));
                  if (selected?.cooperative?.location) {
                    setOrderLocationForm(parseLocationText(selected.cooperative.location));
                  }
                }}>
                  <option value="">{t('buyer_dashboard.select_listing', 'Select listing')}</option>
                  {listingOptions.map((l) => <option key={l.id} value={l.id}>{l.crop} - {Number(l.quantityKg || 0).toLocaleString()}kg • {Number(l.minimumPrice || 0).toLocaleString()} RWF/kg</option>)}
                </select>
              </label>
               <Input label={t('common.crop', 'Crop')} value={orderForm.crop} onChange={(e) => setOrderForm((p) => ({ ...p, crop: e.target.value }))} />
               <Input label={t('common.quantity', 'Quantity (kg)')} type="number" value={orderForm.quantityKg} onChange={(e) => setOrderForm((p) => ({ ...p, quantityKg: e.target.value }))} />
               <Input label={t('buyer_dashboard.price_offer', 'Price offer (RWF/kg)')} type="number" value={orderForm.priceOffer} onChange={(e) => setOrderForm((p) => ({ ...p, priceOffer: e.target.value }))} />
               <div className="md:col-span-3">
                 <RwandaLocationFields
                   value={orderLocationForm}
                   onChange={setOrderLocationForm}
                   showDetail
                   detailRequired
                   detailLabel={t('common.delivery_location', 'Delivery location')}
                   detailPlaceholder="Warehouse gate, branch office, or unloading point"
                 />
               </div>
               <Input label={t('buyer_dashboard.delivery_window_start', 'Delivery window start')} type="datetime-local" value={orderForm.deliveryWindowStart} onChange={(e) => setOrderForm((p) => ({ ...p, deliveryWindowStart: e.target.value }))} />
               <Input label={t('buyer_dashboard.delivery_window_end', 'Delivery window end')} type="datetime-local" value={orderForm.deliveryWindowEnd} onChange={(e) => setOrderForm((p) => ({ ...p, deliveryWindowEnd: e.target.value }))} />
               <Input label={t('common.notes', 'Notes')} className="md:col-span-3" value={orderForm.notes} onChange={(e) => setOrderForm((p) => ({ ...p, notes: e.target.value }))} />
            </div>
            <div className="mt-4">
               <Button onClick={submitOrder}>{t('buyer_dashboard.tabs.create_order', 'Create order')}</Button>
            </div>
            <div className="mt-5 space-y-2">
              {listingOptions.slice(0, 8).map((l: any) => (
                <div key={l.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-semibold">{l.crop} • {Number(l.quantityKg || 0).toLocaleString()}kg • Grade {l.qualityGrade || 'A'}</p>
                    <p className="text-xs text-slate-500">{Number(l.minimumPrice || 0).toLocaleString()} RWF/kg • {l.cooperative?.name || 'Cooperative'}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => addToCart(String(l.id), Math.max(1, Math.min(100, Number(l.quantityKg || 1))))}>Add to cart</Button>
                    <Button size="sm" onClick={async () => { await addToCart(String(l.id), Math.max(1, Math.min(100, Number(l.quantityKg || 1)))); navigate('/cart'); }}>Checkout</Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {activeTab === 'orders' && (
          <Card className="p-5">
             <h3 className="text-lg font-black text-slate-900">{t('buyer_dashboard.order_operations', 'Order operations')}</h3>
            {orderActionMessage && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {orderActionMessage}
              </div>
            )}
            {orderError && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {orderError}
              </div>
            )}
            {orders.length === 0 && (
              <div className="mt-4 rounded-xl border-2 border-dashed border-slate-200 p-8 text-center">
                <Package className="mx-auto h-10 w-10 text-slate-300" />
                <p className="mt-2 text-sm font-semibold text-slate-500">No orders yet</p>
                <p className="mt-1 text-xs text-slate-400">Browse the marketplace or create a direct order to get started.</p>
                <div className="mt-3 flex justify-center gap-2">
                  <Button size="sm" onClick={() => navigate('/marketplace')}>Browse marketplace</Button>
                  <Button size="sm" variant="outline" onClick={() => setActiveTab('marketplace')}>Create order</Button>
                </div>
              </div>
            )}
            <div className="mt-4 space-y-3">
              {orders.map((o: any) => (
                <div key={o.id} className="rounded-xl border border-slate-200 px-4 py-3 hover:border-emerald-300 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-slate-900">{o.crop}</p>
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          (o.status || '').toLowerCase() === 'open' || (o.status || '').toLowerCase() === 'pending' ? 'bg-amber-50 text-amber-700' :
                          (o.status || '').toLowerCase() === 'delivered' || (o.status || '').toLowerCase() === 'completed' ? 'bg-emerald-50 text-emerald-700' :
                          (o.status || '').toLowerCase() === 'cancelled' ? 'bg-red-50 text-red-600' :
                          'bg-blue-50 text-blue-700'
                        }`}>{o.status || 'Pending'}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {Number(o.quantityKg || 0).toLocaleString()} kg • {Number(o.priceOffer || 0).toLocaleString()} RWF/kg
                        {o.quantityKg && o.priceOffer && <span className="font-semibold"> = {(Number(o.quantityKg) * Number(o.priceOffer)).toLocaleString()} RWF total</span>}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {o.deliveryLocation && `Deliver to: ${o.deliveryLocation}`}
                        {o.deliveryWindowStart && ` • ${new Date(o.deliveryWindowStart).toLocaleDateString()} – ${o.deliveryWindowEnd ? new Date(o.deliveryWindowEnd).toLocaleDateString() : '—'}`}
                      </p>
                      {o.contract && <p className="mt-0.5 text-[10px] text-emerald-600 font-semibold">Contract: {o.contract.trackingId} • {o.contract.status}</p>}
                      {o.notes && <p className="mt-0.5 text-[10px] text-slate-400 italic">"{o.notes}"</p>}
                      {o.createdAt && <p className="text-[10px] text-slate-300">Created {new Date(o.createdAt).toLocaleDateString()}</p>}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {(o.status || '').toLowerCase() === 'open' && (
                        <>
                          <Button size="sm" onClick={() => proceedToCheckout(o)}>{t('buyer_dashboard.proceed_to_checkout', 'Checkout')}</Button>
                          <Button size="sm" variant="outline" onClick={() => updateOrder(o.id)}>Edit</Button>
                          {(!Array.isArray(o.contracts) || o.contracts.length === 0) && (
                            <Button size="sm" variant="danger" onClick={() => deleteOrder(o.id)}>Delete</Button>
                          )}
                        </>
                      )}
                      {o.contract?.trackingId && (
                        <Button size="sm" variant="outline" onClick={() => navigate(`/tracking?id=${o.contract.trackingId}`)}>Track</Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {activeTab === 'forecast' && <RoleAIAnalyticsPanel contextData={{ listings, orders, contracts }} />}

        {activeTab === 'price-forecasts' && (
          <Card className="p-5">
            <div className="flex flex-wrap items-end gap-3">
              <label className="block min-w-[180px]">
                 <span className="mb-1 block text-xs font-semibold text-slate-600">{t('common.crop', 'Crop')}</span>
                <select className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" value={priceCrop} onChange={(e) => setPriceCrop(e.target.value)}>
                   <option value="">{t('common.select_crop', 'Select crop')}</option>
                  {crops.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label className="block min-w-[180px]">
                 <span className="mb-1 block text-xs font-semibold text-slate-600">{t('buyer_dashboard.region_market', 'Region/Market')}</span>
                <select className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" value={priceMarket} onChange={(e) => setPriceMarket(e.target.value)}>
                   <option value="">{t('buyer_dashboard.select_market', 'Select market')}</option>
                  {markets.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </label>
              <label className="block min-w-[120px]">
                 <span className="mb-1 block text-xs font-semibold text-slate-600">{t('buyer_dashboard.days', 'Days')}</span>
                <Input type="number" min={3} max={30} value={String(priceDays)} onChange={(e) => setPriceDays(Number(e.target.value || 7))} />
              </label>
              <Button onClick={runPriceForecast} disabled={!priceCrop || !priceMarket || forecastLoading}>
                 {forecastLoading ? t('buyer_dashboard.forecasting', 'Forecasting...') : t('buyer_dashboard.run_forecast', 'Run Forecast')}
              </Button>
            </div>
            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
              <Card className="p-4"><p className="text-xs text-slate-500">Matching listings</p><p className="text-2xl font-black">{filteredListingsForPrice.length}</p></Card>
              <Card className="p-4"><p className="text-xs text-slate-500">Average current price</p><p className="text-2xl font-black">{avgPrice.toLocaleString()} RWF/kg</p></Card>
              <Card className="p-4"><p className="text-xs text-slate-500">Forecast horizon</p><p className="text-2xl font-black">{priceDays} days</p></Card>
            </div>
            <div className="mt-5 rounded-xl border border-slate-200">
              <div className="grid grid-cols-4 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-500">
                <span>Date</span><span>Median</span><span>Lower</span><span>Upper</span>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {(priceForecast?.predictions || []).length > 0 ? (
                  (priceForecast.predictions as any[]).map((p, idx) => (
                    <div key={idx} className="grid grid-cols-4 px-3 py-2 text-sm border-b border-slate-100">
                      <span>{new Date(p.date).toLocaleDateString()}</span>
                      <span className="font-semibold">{Number(p.median || 0).toLocaleString()} RWF</span>
                      <span>{Number(p.lower_bound || 0).toLocaleString()} RWF</span>
                      <span>{Number(p.upper_bound || 0).toLocaleString()} RWF</span>
                    </div>
                  ))
                ) : (
                  <p className="p-4 text-sm text-slate-500">Run a forecast to view market projections by region.</p>
                )}
              </div>
            </div>
          </Card>
        )}

        {activeTab === 'reports' && (
          <div className="space-y-5">
            <div className="rounded-2xl bg-gradient-to-r from-[#002D15] via-[#003D20] to-[#00793E] p-6 text-white">
              <h2 className="text-xl font-black">Buyer Reports & Export</h2>
              <p className="mt-1 text-sm text-emerald-200">Export your orders, contracts, and payment history as CSV/Excel files.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { type: 'my-orders', label: 'My Orders', desc: 'All your purchase orders with crop, quantity, price, and delivery status', icon: <Package className="h-5 w-5 text-blue-600" />, bg: 'bg-blue-50' },
                { type: 'my-contracts', label: 'My Contracts', desc: 'Signed contracts with cooperatives including values and tracking IDs', icon: <FileText className="h-5 w-5 text-violet-600" />, bg: 'bg-violet-50' },
                { type: 'payments', label: 'Payments', desc: 'Payment and transaction records for completed contracts', icon: <Banknote className="h-5 w-5 text-emerald-600" />, bg: 'bg-emerald-50' },
                { type: 'prices', label: 'Market Prices', desc: 'Current and historical market prices across all crops and regions', icon: <TrendingUp className="h-5 w-5 text-amber-600" />, bg: 'bg-amber-50' },
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
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Card className="p-4">
                <p className="text-xs font-black uppercase tracking-widest text-slate-500">Fulfillment readiness</p>
                <p className="mt-1 text-2xl font-black text-slate-900">{Math.max(0, 100 - openOrders * 8)}%</p>
                <p className="mt-1 text-xs text-slate-500">Lower open-order backlog improves delivery speed.</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs font-black uppercase tracking-widest text-slate-500">Contract momentum</p>
                <p className="mt-1 text-2xl font-black text-slate-900">{contracts.length - pendingContracts}/{contracts.length || 0}</p>
                <p className="mt-1 text-xs text-slate-500">Signed contracts unlock escrow and transport flow.</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs font-black uppercase tracking-widest text-slate-500">Procurement focus</p>
                <p className="mt-1 text-2xl font-black text-slate-900">{listings.length ? 'Active' : 'Limited'}</p>
                <p className="mt-1 text-xs text-slate-500">Track listings, pricing, and contract conversion together.</p>
              </Card>
            </div>
            <RoleAIAnalyticsPanel contextData={{ listings, orders, contracts }} />
            <RoleAssistantCard
                 title={t('buyer_dashboard.ai_assistant_title', 'Buyer AI Assistant')}
                 intro={t('buyer_dashboard.ai_assistant_intro', 'I can help optimize purchasing timing, contract completion, supplier selection, and delivery risk.')}
                 placeholder={t('buyer_dashboard.ai_assistant_placeholder_one', 'Ask about timing, negotiation strategy, contracts, or delivery risk...')}
            />
          </div>
        )}

        {activeTab === 'ai-assistant' && (
          <RoleAssistantCard
             title={t('buyer_dashboard.ai_assistant_title', 'Buyer AI Assistant')}
             intro={t('buyer_dashboard.ai_assistant_intro_two', 'I can optimize buying timing, suggest suppliers, improve negotiation range, and reduce delivery/contract risk.')}
             placeholder={t('buyer_dashboard.ai_assistant_placeholder_two', 'Ask what to buy, when to buy, and how to cut procurement costs...')}
          />
        )}

        {activeTab === 'profile' && (
          <Card className="p-5">
            <h3 className="text-lg font-black text-slate-900">{t('buyer_dashboard.profile_title', 'Buyer profile')}</h3>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <Input label={t('common.organization', 'Organization')} value={profileForm.organization} onChange={(e) => setProfileForm((p) => ({ ...p, organization: e.target.value }))} />
              <Input label={t('common.business_type', 'Business type')} value={profileForm.businessType} onChange={(e) => setProfileForm((p) => ({ ...p, businessType: e.target.value }))} />
              <div className="md:col-span-2">
                <RwandaLocationFields
                  value={profileLocationForm}
                  onChange={setProfileLocationForm}
                  showDetail
                  detailRequired
                  detailLabel={t('common.location', 'Location')}
                  detailPlaceholder="Business premises, storefront, or delivery office"
                />
              </div>
              <Input label={t('common.phone', 'Phone')} value={profileForm.phone} onChange={(e) => setProfileForm((p) => ({ ...p, phone: e.target.value }))} />
            </div>
            <div className="mt-4">
              <Button onClick={saveProfile}>{t('buyer_dashboard.save_profile', 'Save profile')}</Button>
            </div>
          </Card>
        )}
      </div>
      {editingOrder && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <h3 className="text-lg font-black text-slate-900">{t('buyer_dashboard.update_order', 'Update order')}</h3>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <Input label={t('common.crop', 'Crop')} value={editingOrder.crop} onChange={(e) => setEditingOrder((p: any) => ({ ...p, crop: e.target.value }))} />
              <Input label={t('common.quantity', 'Quantity (kg)')} type="number" value={editingOrder.quantityKg} onChange={(e) => setEditingOrder((p: any) => ({ ...p, quantityKg: e.target.value }))} />
              <Input label={t('buyer_dashboard.price_offer', 'Price offer (RWF/kg)')} type="number" value={editingOrder.priceOffer} onChange={(e) => setEditingOrder((p: any) => ({ ...p, priceOffer: e.target.value }))} />
              <div className="md:col-span-2">
                <RwandaLocationFields
                  value={editingOrderLocationForm}
                  onChange={setEditingOrderLocationForm}
                  showDetail
                  detailRequired
                  detailLabel={t('common.delivery_location', 'Delivery location')}
                  detailPlaceholder="Warehouse gate, branch office, or unloading point"
                />
              </div>
              <Input label={t('buyer_dashboard.delivery_window_start', 'Delivery window start')} type="datetime-local" value={editingOrder.deliveryWindowStart || ''} onChange={(e) => setEditingOrder((p: any) => ({ ...p, deliveryWindowStart: e.target.value }))} />
              <Input label={t('buyer_dashboard.delivery_window_end', 'Delivery window end')} type="datetime-local" value={editingOrder.deliveryWindowEnd || ''} onChange={(e) => setEditingOrder((p: any) => ({ ...p, deliveryWindowEnd: e.target.value }))} />
              <Input label={t('common.notes', 'Notes')} className="md:col-span-2" value={editingOrder.notes || ''} onChange={(e) => setEditingOrder((p: any) => ({ ...p, notes: e.target.value }))} />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingOrder(null)}>Cancel</Button>
              <Button onClick={saveOrderEdit}>{t('buyer_dashboard.save_changes', 'Save changes')}</Button>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
};
