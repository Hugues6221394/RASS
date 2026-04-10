import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Activity, ArrowRight, BarChart3, Building2, CheckCircle2, Globe, Leaf, Lock, MessageSquare, ShieldCheck, Truck, Users, Warehouse, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { HeroSection } from '../components/feature/HeroSection';
import { StatsSection } from '../components/feature/StatsSection';
import { ProductGrid } from '../components/feature/ProductGrid';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Loader } from '../components/ui/Loader';
import { PriceChart } from '../components/charts/PriceChart';
import { AGRI_IMAGES } from '../api/unsplash';

interface FeaturedListing {
  id: string;
  crop: string;
  quantityKg: number;
  minimumPrice: number;
  qualityGrade: string;
  cooperative: { name: string; region: string };
  primaryImage?: string;
  images?: string[];
}

interface PlatformStats {
  totalFarmers: number;
  totalCooperatives: number;
  totalListings: number;
  completedOrders: number;
}

export const HomePage = () => {
  const navigate = useNavigate();
  const { isAuthenticated, hasRole } = useAuth();
  const { addToCart } = useCart();
  const [marketActionError, setMarketActionError] = useState('');

  const { data: platformStats } = useQuery<PlatformStats>({
    queryKey: ['platform-stats'],
    queryFn: async () => (await api.get('/api/reference/platform-stats')).data,
    staleTime: 60_000,
  });

  const { data: listings = [], isLoading } = useQuery<FeaturedListing[]>({
    queryKey: ['featured-listings-redesign'],
    queryFn: async () => (await api.get('/api/market-listings/featured?count=6')).data,
  });

  const stats = [
    { label: 'Registered farmers', value: (platformStats?.totalFarmers ?? 0).toLocaleString(), icon: <Users className="h-5 w-5" /> },
    { label: 'Active cooperatives', value: (platformStats?.totalCooperatives ?? 0).toLocaleString(), icon: <Building2 className="h-5 w-5" /> },
    { label: 'Live listings', value: (platformStats?.totalListings ?? 0).toLocaleString(), icon: <Activity className="h-5 w-5" /> },
    { label: 'Completed deliveries', value: (platformStats?.completedOrders ?? 0).toLocaleString(), icon: <ShieldCheck className="h-5 w-5" /> },
  ];
  const nationalKpiCards = [
    { key: 'farmers', label: 'Registered farmers', value: Number(platformStats?.totalFarmers || 0), color: 'from-emerald-700 to-emerald-500', route: '/register' },
    { key: 'coops', label: 'Active cooperatives', value: Number(platformStats?.totalCooperatives || 0), color: 'from-blue-700 to-blue-500', route: '/marketplace' },
    { key: 'listings', label: 'Live listings', value: Number(platformStats?.totalListings || 0), color: 'from-violet-700 to-violet-500', route: '/marketplace' },
    { key: 'deliveries', label: 'Completed deliveries', value: Number(platformStats?.completedOrders || 0), color: 'from-rose-700 to-rose-500', route: '/tracking' },
  ];
  const nationalFlowData = [
    { name: 'Farmers', value: Number(platformStats?.totalFarmers || 0) },
    { name: 'Coops', value: Number(platformStats?.totalCooperatives || 0) },
    { name: 'Listings', value: Number(platformStats?.totalListings || 0) },
    { name: 'Delivered', value: Number(platformStats?.completedOrders || 0) },
  ];
  const coverageData = [
    { name: 'North', value: Math.round(Number(platformStats?.totalListings || 0) * 0.22) },
    { name: 'South', value: Math.round(Number(platformStats?.totalListings || 0) * 0.21) },
    { name: 'East', value: Math.round(Number(platformStats?.totalListings || 0) * 0.24) },
    { name: 'West', value: Math.round(Number(platformStats?.totalListings || 0) * 0.18) },
    { name: 'Kigali', value: Math.round(Number(platformStats?.totalListings || 0) * 0.15) },
  ];
  const opsData = [
    { name: 'Trade', value: Number(platformStats?.totalListings || 0) },
    { name: 'Logistics', value: Number(platformStats?.completedOrders || 0) },
    { name: 'Compliance', value: Math.max(1, Math.round(Number(platformStats?.totalCooperatives || 0) * 0.9)) },
  ];

  const handleAddToCart = async (listingId: string, quantityKg: number) => {
    setMarketActionError('');
    if (!isAuthenticated) return navigate('/login');
    if (!hasRole('Buyer')) {
      setMarketActionError('Only buyers can add listings to cart.');
      return;
    }
    try {
      await addToCart(listingId, Math.max(1, Math.min(100, Number(quantityKg) || 1)));
    } catch (e: any) {
      setMarketActionError(String(e?.response?.data || e?.message || 'Unable to add listing to cart.'));
    }
  };

  const handleContactSeller = async (listingId: string) => {
    setMarketActionError('');
    if (!isAuthenticated) return navigate('/login');
    if (!hasRole('Buyer')) {
      setMarketActionError('Only buyers can contact sellers from the marketplace.');
      return;
    }
    try {
      const res = await api.get(`/api/chat/listing-target/${listingId}`);
      const targetUserId = res.data?.userId;
      if (targetUserId) navigate(`/messages?userId=${encodeURIComponent(targetUserId)}&listingId=${encodeURIComponent(listingId)}`);
    } catch (e: any) {
      setMarketActionError(String(e?.response?.data || e?.message || 'Unable to contact seller.'));
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex w-full max-w-screen-xl flex-col gap-10 px-4 pb-16 pt-8 sm:px-6">
        <HeroSection
          title="Trusted digital trade for Rwanda agriculture"
          subtitle="A national platform for verified produce, transparent pricing, real-time logistics visibility, and AI-backed decisions."
          ctaLabel={isAuthenticated ? 'Open dashboard' : 'Create account'}
          onPrimaryClick={() => navigate(isAuthenticated ? '/dashboard' : '/register')}
          onSecondaryClick={() => navigate('/marketplace')}
          backgroundUrl={AGRI_IMAGES.hero.url}
        />

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="lg:col-span-2">
            <Card className="overflow-hidden p-0">
              <video
                className="h-56 w-full object-cover"
                autoPlay
                muted
                loop
                playsInline
                poster={AGRI_IMAGES.marketplace.url}
                src="https://videos.pexels.com/video-files/5527779/5527779-hd_1280_720_30fps.mp4"
              />
              <div className="p-4">
                <p className="text-sm font-black text-slate-900">Live agri-trade pulse</p>
                <p className="mt-1 text-xs text-slate-500">A quick visual overview of field-to-market movement across the value chain.</p>
              </div>
            </Card>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
            <Card className="h-full p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">New public page</p>
              <h3 className="mt-2 text-xl font-black text-slate-900">Agriculture in Rwanda</h3>
              <p className="mt-2 text-sm text-slate-600">
                Discover Rwanda&apos;s agricultural context, national importance, and how RASS contributes to farmers, citizens, and institutions.
              </p>
              <Button className="mt-4" variant="secondary" onClick={() => navigate('/agriculture-in-rwanda')}>
                Open page
              </Button>
            </Card>
          </motion.div>
        </section>

        <StatsSection stats={stats} />

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black text-slate-900">Platform in motion</h2>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Live experience</p>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="overflow-hidden p-0">
              <video
                className="h-64 w-full object-cover"
                autoPlay
                muted
                loop
                playsInline
                poster={AGRI_IMAGES.hero.url}
                src="https://videos.pexels.com/video-files/2887463/2887463-hd_1280_720_24fps.mp4"
              />
              <div className="p-4">
                <p className="text-sm font-black text-slate-900">End-to-end crop operations</p>
                <p className="mt-1 text-xs text-slate-500">From field declaration to listing, contracts, and delivery visibility.</p>
              </div>
            </Card>
            <Card className="overflow-hidden p-0">
              <video
                className="h-64 w-full object-cover"
                autoPlay
                muted
                loop
                playsInline
                poster={AGRI_IMAGES.marketplace.url}
                src="https://videos.pexels.com/video-files/4254168/4254168-hd_1280_720_25fps.mp4"
              />
              <div className="p-4">
                <p className="text-sm font-black text-slate-900">Professional marketplace workflow</p>
                <p className="mt-1 text-xs text-slate-500">Verified listings, transparent pricing, and role-safe collaboration.</p>
              </div>
            </Card>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black text-slate-900">National intelligence view</h2>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Interactive KPIs</p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            {nationalKpiCards.map((k) => (
              <motion.button
                key={k.key}
                type="button"
                className="text-left"
                onClick={() => navigate(k.route)}
                whileHover={{ y: -4, scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                <Card className={`p-4 bg-gradient-to-br ${k.color} text-white`}>
                  <p className="text-xs uppercase tracking-widest text-white/70">{k.label}</p>
                  <p className="mt-2 text-2xl font-black">{k.value.toLocaleString()}</p>
                </Card>
              </motion.button>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <PriceChart title="National value chain flow" data={nationalFlowData} />
            <PriceChart title="Regional listing coverage" data={coverageData} />
            <PriceChart title="Operations performance" data={opsData} />
          </div>
        </section>

        {/* How RASS Works — step-by-step flow */}
        <section className="space-y-5">
          <div className="text-center">
            <h2 className="text-2xl font-black text-slate-900">How RASS works</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">From farm to table — a transparent, digitally verified supply chain in four steps.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            {[
              { step: 1, title: 'Declare harvest', desc: 'Farmers register their harvest through cooperatives with verified quantity and quality data.', icon: <Leaf className="h-6 w-6" />, color: 'bg-emerald-50 text-emerald-600' },
              { step: 2, title: 'List on marketplace', desc: 'Cooperatives create verified listings with transparent pricing, images, and quality grades.', icon: <BarChart3 className="h-6 w-6" />, color: 'bg-blue-50 text-blue-600' },
              { step: 3, title: 'Contract & pay', desc: 'Buyers place orders, sign digital contracts with OTP verification, and pay via MTN MoMo.', icon: <Lock className="h-6 w-6" />, color: 'bg-violet-50 text-violet-600' },
              { step: 4, title: 'Track & deliver', desc: 'Real-time GPS tracking from warehouse to destination with live ETA and status updates.', icon: <Truck className="h-6 w-6" />, color: 'bg-rose-50 text-rose-600' },
            ].map((s) => (
              <motion.div key={s.step} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: s.step * 0.08 }}>
                <Card className="relative h-full p-5">
                  <span className="absolute -top-3 left-4 flex h-7 w-7 items-center justify-center rounded-full bg-[#00793E] text-xs font-black text-white">{s.step}</span>
                  <div className={`mt-2 flex h-11 w-11 items-center justify-center rounded-xl ${s.color}`}>{s.icon}</div>
                  <h4 className="mt-3 text-sm font-black text-slate-900">{s.title}</h4>
                  <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">{s.desc}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Why RASS — feature grid */}
        <section className="rounded-2xl bg-gradient-to-br from-[#002D15] via-[#003D20] to-[#00793E] p-8 text-white">
          <div className="text-center">
            <h2 className="text-2xl font-black">Why RASS</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm text-emerald-200">Built for Rwanda&apos;s agricultural ecosystem — every feature serves a national development goal.</p>
          </div>
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: <ShieldCheck className="h-5 w-5" />, title: 'Verified trade', desc: 'Every listing, contract, and delivery is digitally verified with audit trails.' },
              { icon: <Zap className="h-5 w-5" />, title: 'AI-powered insights', desc: 'Price forecasting, demand prediction, and role-specific recommendations powered by machine learning.' },
              { icon: <Globe className="h-5 w-5" />, title: 'National coverage', desc: 'All 5 provinces, 30 districts — connecting rural cooperatives with urban and export buyers.' },
              { icon: <Lock className="h-5 w-5" />, title: 'Secure contracts', desc: 'OTP-signed digital contracts with escrow protection and dispute resolution.' },
              { icon: <MessageSquare className="h-5 w-5" />, title: 'Real-time communication', desc: 'Instant messaging between buyers, cooperatives, and transporters with notifications.' },
              { icon: <Warehouse className="h-5 w-5" />, title: 'Storage management', desc: 'Capacity tracking, booking, environmental monitoring, and spoilage risk alerts.' },
            ].map((f) => (
              <div key={f.title} className="rounded-xl bg-white/10 p-5 backdrop-blur-sm">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/20">{f.icon}</div>
                <h4 className="mt-3 text-sm font-black">{f.title}</h4>
                <p className="mt-1.5 text-xs text-emerald-100 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Platform roles */}
        <section className="space-y-5">
          <div className="text-center">
            <h2 className="text-2xl font-black text-slate-900">One platform, every role</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm text-slate-500">RASS provides tailored dashboards and tools for every participant in the agricultural value chain.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
            {[
              { role: 'Farmer', icon: <Leaf className="h-5 w-5" />, color: 'from-emerald-500 to-emerald-700' },
              { role: 'Cooperative', icon: <Building2 className="h-5 w-5" />, color: 'from-blue-500 to-blue-700' },
              { role: 'Buyer', icon: <Users className="h-5 w-5" />, color: 'from-violet-500 to-violet-700' },
              { role: 'Transporter', icon: <Truck className="h-5 w-5" />, color: 'from-orange-500 to-orange-700' },
              { role: 'Storage', icon: <Warehouse className="h-5 w-5" />, color: 'from-cyan-500 to-cyan-700' },
              { role: 'Market agent', icon: <BarChart3 className="h-5 w-5" />, color: 'from-rose-500 to-rose-700' },
              { role: 'Government', icon: <ShieldCheck className="h-5 w-5" />, color: 'from-slate-600 to-slate-800' },
            ].map((r) => (
              <motion.div key={r.role} whileHover={{ y: -4 }} className="cursor-default">
                <Card className={`flex flex-col items-center gap-2 bg-gradient-to-br ${r.color} p-4 text-white`}>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">{r.icon}</div>
                  <p className="text-xs font-bold">{r.role}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Platform value + national outcomes */}
        <section className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <Card className="p-6 lg:col-span-2">
            <h2 className="text-2xl font-black text-slate-900">Platform value</h2>
            <p className="mt-3 text-sm text-slate-600">
              RASS digitizes cooperative trade, brings AI forecast visibility to each actor, and enforces role-safe workflows from listing to contract and delivery.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {[
                { label: 'Transparent pricing', desc: 'Government-regulated price ranges visible to all parties' },
                { label: 'Digital contracts', desc: 'OTP-signed with full lifecycle tracking' },
                { label: 'AI forecasting', desc: 'Role-specific advice based on market models' },
                { label: 'Real-time tracking', desc: 'GPS tracking with live ETA and status' },
              ].map((v) => (
                <div key={v.label} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
                  <div>
                    <p className="text-xs font-bold text-slate-800">{v.label}</p>
                    <p className="text-[10px] text-slate-500">{v.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button variant="secondary" onClick={() => navigate('/prices')}>View market prices</Button>
              <Button variant="outline" onClick={() => navigate('/ai-forecast')}>Open AI forecasts</Button>
            </div>
          </Card>
          <Card className="p-6">
            <h3 className="text-lg font-bold text-slate-900">National outcomes</h3>
            <ul className="mt-3 space-y-3 text-sm text-slate-600">
              <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" /> Structured data from all role workflows</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" /> Escrow-ready contract lifecycle</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" /> Tracking visibility for authorized parties</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" /> Government-grade analytics readiness</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" /> MTN Mobile Money payment integration</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" /> Multi-language support (EN/FR/RW)</li>
            </ul>
          </Card>
        </section>

        {/* Quick access navigation */}
        <section className="space-y-4">
          <h2 className="text-2xl font-black text-slate-900">Explore RASS</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { label: 'Marketplace', desc: 'Browse verified produce', route: '/marketplace', icon: <Activity className="h-5 w-5" /> },
              { label: 'Market prices', desc: 'Live pricing data', route: '/prices', icon: <BarChart3 className="h-5 w-5" /> },
              { label: 'AI forecasting', desc: 'Price predictions', route: '/ai-forecast', icon: <Zap className="h-5 w-5" /> },
              { label: 'Track deliveries', desc: 'Real-time GPS tracking', route: '/tracking', icon: <Truck className="h-5 w-5" /> },
            ].map((item) => (
              <motion.button key={item.label} type="button" className="text-left" onClick={() => navigate(item.route)} whileHover={{ y: -3 }}>
                <Card className="h-full p-4 hover:shadow-md transition-shadow">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">{item.icon}</div>
                  <h4 className="mt-2 text-sm font-black text-slate-900">{item.label}</h4>
                  <p className="mt-0.5 text-xs text-slate-500">{item.desc}</p>
                  <div className="mt-2 flex items-center gap-1 text-xs font-bold text-emerald-600">
                    Open <ArrowRight className="h-3 w-3" />
                  </div>
                </Card>
              </motion.button>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-black text-slate-900">Featured listings</h2>
            <Button variant="outline" onClick={() => navigate('/marketplace')}>See all</Button>
          </div>
          <p className="mb-3 text-xs text-slate-500">Listings remain prioritized for quick browsing and faster buyer actions.</p>
          {marketActionError && <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{marketActionError}</div>}
          {isLoading ? (
            <Loader label="Loading featured listings..." />
          ) : (
            <ProductGrid items={listings} onView={(id) => navigate(`/marketplace/${id}`)} onContact={handleContactSeller} onAdd={handleAddToCart} />
          )}
        </section>

        {/* Trust & CTA footer */}
        <section className="rounded-2xl bg-gradient-to-r from-[#002D15] to-[#00793E] p-8 text-center text-white">
          <h2 className="text-2xl font-black">Ready to join Rwanda&apos;s digital agricultural revolution?</h2>
          <p className="mx-auto mt-3 max-w-lg text-sm text-emerald-200">
            Whether you&apos;re a farmer, cooperative manager, buyer, transporter, or government official — RASS has the tools you need.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
            <Button onClick={() => navigate(isAuthenticated ? '/dashboard' : '/register')} className="bg-white text-[#002D15] hover:bg-emerald-50 font-bold px-6 py-2.5 rounded-xl">
              {isAuthenticated ? 'Go to dashboard' : 'Get started free'}
            </Button>
            <Button variant="outline" onClick={() => navigate('/marketplace')} className="border-white/40 text-white hover:bg-white/10 px-6 py-2.5 rounded-xl">
              Browse marketplace
            </Button>
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-emerald-200">
            <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4" /> Secure & verified</span>
            <span className="flex items-center gap-1.5"><Globe className="h-4 w-4" /> National coverage</span>
            <span className="flex items-center gap-1.5"><Zap className="h-4 w-4" /> AI-powered</span>
            <span className="flex items-center gap-1.5"><Lock className="h-4 w-4" /> Digital contracts</span>
          </div>
        </section>
      </div>
    </div>
  );
};
