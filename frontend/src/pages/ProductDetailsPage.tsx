import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, MessageSquare, ShoppingCart } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { ProductGallery } from '../components/feature/ProductGallery';
import { FarmerInfo } from '../components/feature/FarmerInfo';
import { PriceChart } from '../components/charts/PriceChart';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Loader } from '../components/ui/Loader';

interface ListingDetails {
  id: string;
  crop: string;
  quantityKg: number;
  minimumPrice: number;
  qualityGrade: string;
  location?: string;
  marketPriceReference?: number;
  description?: string;
  images: { id: string; imageUrl: string; displayOrder: number }[];
  cooperative: {
    name: string;
    region: string;
    district: string;
    sector?: string;
    cell?: string;
    location?: string;
    phone?: string;
    email?: string;
    isVerified?: boolean;
  };
}

export const ProductDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, hasRole } = useAuth();
  const { addToCart } = useCart();
  const [actionError, setActionError] = useState('');

  const { data: listing, isLoading } = useQuery<ListingDetails>({
    queryKey: ['listing-detail', id],
    queryFn: async () => (await api.get(`/api/market-listings/${id}`)).data,
    enabled: Boolean(id),
  });

  const chartData = useMemo(() => {
    const base = listing?.minimumPrice || 0;
    return [
      { name: 'W-6', value: Math.round(base * 0.94) },
      { name: 'W-5', value: Math.round(base * 0.97) },
      { name: 'W-4', value: Math.round(base * 0.95) },
      { name: 'W-3', value: Math.round(base * 0.99) },
      { name: 'W-2', value: Math.round(base * 1.01) },
      { name: 'W-1', value: Math.round(base * 1.0) },
      { name: 'Now', value: Math.round(base) },
    ];
  }, [listing?.minimumPrice]);

  const handleAdd = async () => {
    setActionError('');
    if (!listing) return;
    if (!isAuthenticated) return navigate('/login');
    if (!hasRole('Buyer')) {
      setActionError('Only buyers can add listings to cart.');
      return;
    }
    try {
      await addToCart(listing.id, 1);
    } catch (e: any) {
      setActionError(String(e?.response?.data || e?.message || 'Unable to add listing to cart.'));
    }
  };

  const handleContact = async () => {
    setActionError('');
    if (!listing) return;
    if (!isAuthenticated) return navigate('/login');
    if (!hasRole('Buyer')) {
      setActionError('Only buyers can contact sellers from the marketplace.');
      return;
    }
    try {
      const res = await api.get(`/api/chat/listing-target/${listing.id}`);
      const targetUserId = res.data?.userId;
      if (targetUserId) navigate(`/messages?userId=${encodeURIComponent(targetUserId)}&listingId=${encodeURIComponent(listing.id)}`);
    } catch (e: any) {
      setActionError(String(e?.response?.data || e?.message || 'Unable to contact seller.'));
    }
  };

  if (isLoading) return <Loader label="Loading listing details..." />;
  if (!listing) return <div className="mx-auto max-w-screen-xl px-4 py-10 text-sm text-slate-500">Listing not found.</div>;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex w-full max-w-screen-xl flex-col gap-6 px-4 pb-16 pt-8 sm:px-6">
        <Button variant="outline" className="w-fit" leftIcon={<ArrowLeft className="h-4 w-4" />} onClick={() => navigate('/marketplace')}>
          Back to listings
        </Button>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="p-4 lg:col-span-2">
            <ProductGallery images={(listing.images || []).map((x) => x.imageUrl)} />
          </Card>
          <Card className="p-6">
            <h1 className="text-3xl font-black text-slate-900">{listing.crop}</h1>
            <p className="mt-2 text-sm text-slate-500">{listing.description || 'No detailed description provided.'}</p>
            <div className="mt-5 space-y-1 text-sm text-slate-600">
              <p><span className="font-semibold text-slate-800">Price:</span> {listing.minimumPrice.toLocaleString()} RWF/kg</p>
              {listing.marketPriceReference ? <p><span className="font-semibold text-slate-800">Market reference:</span> {listing.marketPriceReference.toLocaleString()} RWF/kg</p> : null}
              <p><span className="font-semibold text-slate-800">Quantity:</span> {listing.quantityKg.toLocaleString()} kg</p>
              <p><span className="font-semibold text-slate-800">Quality:</span> Grade {listing.qualityGrade}</p>
              <p><span className="font-semibold text-slate-800">Collection area:</span> {listing.location || listing.cooperative?.location || [listing.cooperative?.district, listing.cooperative?.sector, listing.cooperative?.cell].filter(Boolean).join(' / ') || listing.cooperative?.region}</p>
            </div>
            <div className="mt-6 flex gap-2">
              <Button className="flex-1" leftIcon={<ShoppingCart className="h-4 w-4" />} onClick={handleAdd}>Add to cart</Button>
              <Button variant="outline" className="flex-1" leftIcon={<MessageSquare className="h-4 w-4" />} onClick={handleContact}>Contact</Button>
            </div>
            {actionError && <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{actionError}</div>}
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <PriceChart title="Reference pricing trend" data={chartData} />
          </div>
          <FarmerInfo
            cooperativeName={listing.cooperative?.name}
            region={listing.cooperative?.region}
            district={listing.cooperative?.district}
            sector={listing.cooperative?.sector}
            cell={listing.cooperative?.cell}
            location={listing.location || listing.cooperative?.location}
            phone={listing.cooperative?.phone}
            email={listing.cooperative?.email}
            verified={listing.cooperative?.isVerified}
          />
        </div>
      </div>
    </div>
  );
};
