import { useState } from 'react';
import { API_BASE_URL } from '../../api/client';

export const ProductGallery = ({ images }: { images: string[] }) => {
  const [index, setIndex] = useState(0);
  const normalizedImages = images.map((img) =>
    !img ? '' : (img.startsWith('http://') || img.startsWith('https://') ? img : `${API_BASE_URL}${img.startsWith('/') ? '' : '/'}${img}`),
  );
  const active = normalizedImages[index] || normalizedImages[0] || '';

  return (
    <div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
        {active ? (
          <img src={active} alt="Listing" className="h-72 w-full object-cover sm:h-80" />
        ) : (
          <div className="flex h-72 items-center justify-center text-sm text-slate-500 sm:h-80">No image available</div>
        )}
      </div>
      {images.length > 1 && (
        <div className="mt-3 grid grid-cols-5 gap-2">
          {normalizedImages.slice(0, 5).map((img, i) => (
            <button
              type="button"
              key={`${img}-${i}`}
              onClick={() => setIndex(i)}
              className={`overflow-hidden rounded-xl border ${i === index ? 'border-emerald-500' : 'border-slate-200'}`}
            >
              <img src={img} alt={`thumb-${i}`} className="h-14 w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
