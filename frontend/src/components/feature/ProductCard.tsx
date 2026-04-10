import { MapPin, MessageSquare, ShoppingCart } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { AGRI_IMAGES } from '../../api/unsplash';
import { API_BASE_URL } from '../../api/client';

interface ProductCardProps {
  id: string;
  crop: string;
  quantityKg: number;
  minimumPrice: number;
  qualityGrade: string;
  cooperativeName: string;
  cooperativeLocation: string;
  imageUrl?: string;
  onView: (id: string) => void;
  onContact: (id: string) => void;
  onAdd: (id: string, quantity: number) => void;
}

export const ProductCard = ({
  id,
  crop,
  quantityKg,
  minimumPrice,
  qualityGrade,
  cooperativeName,
  cooperativeLocation,
  imageUrl,
  onView,
  onContact,
  onAdd,
}: ProductCardProps) => {
  const resolvedImage = imageUrl
    ? (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')
      ? imageUrl
      : `${API_BASE_URL}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`)
    : AGRI_IMAGES.farming.url;

  return (
    <Card className="overflow-hidden">
      <button type="button" className="block w-full text-left" onClick={() => onView(id)}>
        <img src={resolvedImage} alt={crop} className="h-44 w-full object-cover" />
      </button>
      <div className="p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-lg font-bold text-slate-900">{crop}</h3>
          <Badge text={`Grade ${qualityGrade}`} tone="success" />
        </div>
        <p className="mb-2 text-sm font-semibold text-emerald-700">{minimumPrice.toLocaleString()} RWF / kg</p>
        <p className="mb-3 text-xs text-slate-500">{quantityKg.toLocaleString()} kg available</p>
        <div className="mb-4 flex items-center gap-1 text-xs text-slate-500">
          <MapPin className="h-3.5 w-3.5" />
          <span>{cooperativeName}</span>
          <span>•</span>
          <span>{cooperativeLocation}</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" leftIcon={<MessageSquare className="h-3.5 w-3.5" />} onClick={() => onContact(id)}>
            Contact
          </Button>
          <Button size="sm" className="flex-1" leftIcon={<ShoppingCart className="h-3.5 w-3.5" />} onClick={() => onAdd(id, 1)}>
            Add
          </Button>
        </div>
      </div>
    </Card>
  );
};
