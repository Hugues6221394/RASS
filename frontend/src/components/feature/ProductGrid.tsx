import { ProductCard } from './ProductCard';

interface Item {
  id: string;
  crop: string;
  quantityKg: number;
  minimumPrice: number;
  qualityGrade: string;
  cooperative: { name: string; region: string; district?: string; sector?: string; cell?: string; location?: string };
  primaryImage?: string;
  images?: string[] | { imageUrl: string }[];
}

interface ProductGridProps {
  items: Item[];
  onView: (id: string) => void;
  onContact: (id: string) => void;
  onAdd: (id: string, quantity: number) => void;
}

export const ProductGrid = ({ items, onView, onContact, onAdd }: ProductGridProps) => (
  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
    {items.map((item) => {
      const locationParts = [
        item.cooperative?.district,
        item.cooperative?.sector,
        item.cooperative?.cell,
      ].filter(Boolean);
      const cooperativeLocation = locationParts.join(' / ') || item.cooperative?.location || item.cooperative?.region || 'Rwanda';

      return (
        <ProductCard
          key={item.id}
          id={item.id}
          crop={item.crop}
          quantityKg={item.quantityKg}
          minimumPrice={item.minimumPrice}
          qualityGrade={item.qualityGrade}
          cooperativeName={item.cooperative?.name || 'Cooperative'}
          cooperativeLocation={cooperativeLocation}
          imageUrl={item.primaryImage || (typeof item.images?.[0] === 'string' ? (item.images[0] as string) : (item.images?.[0] as { imageUrl: string } | undefined)?.imageUrl)}
          onView={onView}
          onContact={onContact}
          onAdd={onAdd}
        />
      );
    })}
  </div>
);
