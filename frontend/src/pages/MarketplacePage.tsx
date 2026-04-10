import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, SlidersHorizontal } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { ProductGrid } from '../components/feature/ProductGrid';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Loader } from '../components/ui/Loader';
import { useRwandaAdministrativeData } from '../hooks/useRwandaAdministrativeData';

interface MarketListing {
  id: string;
  crop: string;
  quantityKg: number;
  minimumPrice: number;
  qualityGrade: string;
  location?: string;
  description?: string;
  cooperative: { id: string; name: string; region: string; district: string; sector?: string; cell?: string; location?: string };
  images?: string[] | { imageUrl: string }[];
  primaryImage?: string;
}

interface ListingResponse {
  listings: MarketListing[];
  totalCount: number;
}

export const MarketplacePage = () => {
  const navigate = useNavigate();
  const { isAuthenticated, hasRole } = useAuth();
  const { addToCart } = useCart();
  const [actionError, setActionError] = useState('');
  const { provinces, getDistricts, getSectors } = useRwandaAdministrativeData();

  const [search, setSearch] = useState('');
  const [region, setRegion] = useState('');
  const [district, setDistrict] = useState('');
  const [sector, setSector] = useState('');
  const [selectedCrop, setSelectedCrop] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'price_asc' | 'price_desc' | 'qty_desc'>('newest');

  const { data, isLoading } = useQuery<ListingResponse>({
    queryKey: ['market-listings-redesign'],
    queryFn: async () => (await api.get('/api/market-listings?take=500&includeExpired=true')).data,
  });

  const listings = useMemo(() => {
    const rows = [...(data?.listings || [])].filter((x) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        x.crop.toLowerCase().includes(q) ||
        x.cooperative?.name?.toLowerCase().includes(q) ||
        x.cooperative?.region?.toLowerCase().includes(q) ||
        x.cooperative?.district?.toLowerCase().includes(q) ||
        x.cooperative?.sector?.toLowerCase().includes(q) ||
        x.cooperative?.cell?.toLowerCase().includes(q) ||
        x.location?.toLowerCase().includes(q) ||
        x.description?.toLowerCase().includes(q)
      );
    }).filter((x) => {
      if (region && x.cooperative?.region !== region) return false;
      if (district && x.cooperative?.district !== district) return false;
      if (sector && x.cooperative?.sector !== sector) return false;
      if (selectedCrop && x.crop !== selectedCrop) return false;
      return true;
    });

    rows.sort((a, b) => {
      if (sortBy === 'price_asc') return a.minimumPrice - b.minimumPrice;
      if (sortBy === 'price_desc') return b.minimumPrice - a.minimumPrice;
      if (sortBy === 'qty_desc') return b.quantityKg - a.quantityKg;
      return 0;
    });

    return rows;
  }, [data?.listings, district, region, search, sector, selectedCrop, sortBy]);

  const districtOptions = getDistricts(region);
  const sectorOptions = getSectors(district);

  const cropCategories = useMemo(() => {
    const counts: Record<string, number> = {};
    (data?.listings || []).forEach(l => { counts[l.crop] = (counts[l.crop] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [data?.listings]);

  const totalValue = useMemo(() => listings.reduce((s, l) => s + Number(l.minimumPrice || 0) * Number(l.quantityKg || 0), 0), [listings]);
  const totalKg = useMemo(() => listings.reduce((s, l) => s + Number(l.quantityKg || 0), 0), [listings]);
  const uniqueCoops = useMemo(() => new Set(listings.map(l => l.cooperative?.id).filter(Boolean)).size, [listings]);

  const handleAddToCart = async (listingId: string, quantityKg: number) => {
    setActionError('');
    if (!isAuthenticated) return navigate('/login');
    if (!hasRole('Buyer')) {
      setActionError('Only buyers can add listings to cart.');
      return;
    }
    try {
      await addToCart(listingId, Math.max(1, Math.min(100, Number(quantityKg) || 1)));
    } catch (e: any) {
      setActionError(String(e?.response?.data || e?.message || 'Unable to add listing to cart.'));
    }
  };

  const handleContactSeller = async (listingId: string) => {
    setActionError('');
    if (!isAuthenticated) return navigate('/login');
    if (!hasRole('Buyer')) {
      setActionError('Only buyers can contact sellers from the marketplace.');
      return;
    }
    try {
      const res = await api.get(`/api/chat/listing-target/${listingId}`);
      const targetUserId = res.data?.userId;
      if (targetUserId) navigate(`/messages?userId=${encodeURIComponent(targetUserId)}&listingId=${encodeURIComponent(listingId)}`);
    } catch (e: any) {
      setActionError(String(e?.response?.data || e?.message || 'Unable to contact seller.'));
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex w-full max-w-screen-xl flex-col gap-6 px-4 pb-16 pt-8 sm:px-6">
        <div className="rounded-3xl border border-slate-200 bg-gradient-to-r from-emerald-900 via-emerald-800 to-emerald-700 px-6 py-10 text-white sm:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-emerald-200">National marketplace</p>
          <h1 className="mt-3 text-4xl font-black">Verified crop listings</h1>
          <p className="mt-2 max-w-2xl text-sm text-emerald-100">Search and procure quality-assured produce from active cooperatives across Rwanda.</p>
          <p className="mt-5 text-sm font-semibold text-emerald-200">{(data?.totalCount || 0).toLocaleString()} active listings</p>
        </div>

        <Card className="p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search crop, cooperative, district..." className="md:col-span-2" />
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-600">Province</span>
              <select value={region} onChange={(e) => { setRegion(e.target.value); setDistrict(''); setSector(''); }} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm">
                <option value="">All provinces</option>
                {provinces.map((province) => (
                  <option key={province} value={province}>{province}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-600">District</span>
              <select value={district} onChange={(e) => { setDistrict(e.target.value); setSector(''); }} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" disabled={!region}>
                <option value="">All districts</option>
                {districtOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-600">Sector</span>
              <select value={sector} onChange={(e) => setSector(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" disabled={!district}>
                <option value="">All sectors</option>
                {sectorOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-600">Sort by</span>
              <div className="flex h-11 items-center rounded-xl border border-slate-300 px-3">
                <SlidersHorizontal className="mr-2 h-4 w-4 text-slate-400" />
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="w-full border-none bg-transparent text-sm outline-none">
                  <option value="newest">Newest</option>
                  <option value="price_asc">Price low to high</option>
                  <option value="price_desc">Price high to low</option>
                  <option value="qty_desc">Quantity high to low</option>
                </select>
              </div>
            </label>
            <div className="flex items-end">
              <Button variant="outline" className="w-full" leftIcon={<Search className="h-4 w-4" />} onClick={() => setSearch(search.trim())}>
                Apply filters
              </Button>
            </div>
          </div>
        </Card>

        {cropCategories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedCrop('')}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${!selectedCrop ? 'bg-emerald-700 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-emerald-300'}`}
            >All crops</button>
            {cropCategories.map(([crop, count]) => (
              <button
                key={crop}
                type="button"
                onClick={() => setSelectedCrop(selectedCrop === crop ? '' : crop)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${selectedCrop === crop ? 'bg-emerald-700 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-emerald-300'}`}
              >{crop} ({count})</button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Card className="p-3 text-center">
            <p className="text-[10px] font-semibold uppercase text-slate-400">Matching listings</p>
            <p className="text-xl font-black text-slate-900">{listings.length}</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-[10px] font-semibold uppercase text-slate-400">Total quantity</p>
            <p className="text-xl font-black text-emerald-700">{totalKg.toLocaleString()} <span className="text-xs">kg</span></p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-[10px] font-semibold uppercase text-slate-400">Estimated value</p>
            <p className="text-xl font-black text-blue-700">{totalValue.toLocaleString()} <span className="text-xs">RWF</span></p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-[10px] font-semibold uppercase text-slate-400">Cooperatives</p>
            <p className="text-xl font-black text-violet-700">{uniqueCoops}</p>
          </Card>
        </div>

        {isLoading ? (
          <Loader label="Loading listings..." />
        ) : listings.length === 0 ? (
          <Card className="p-12 text-center">
            <Search className="mx-auto h-12 w-12 text-slate-200" />
            <p className="mt-3 text-sm font-semibold text-slate-500">No listings match your filters</p>
            <p className="mt-1 text-xs text-slate-400">Try broadening your search, removing filters, or checking back later for new listings.</p>
            <Button variant="outline" className="mt-4" onClick={() => { setSearch(''); setRegion(''); setDistrict(''); setSector(''); setSelectedCrop(''); }}>Clear all filters</Button>
          </Card>
        ) : (
          <>
            {actionError && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{actionError}</div>}
            <ProductGrid items={listings} onView={(id) => navigate(`/marketplace/${id}`)} onContact={handleContactSeller} onAdd={handleAddToCart} />
          </>
        )}
      </div>
    </div>
  );
};
