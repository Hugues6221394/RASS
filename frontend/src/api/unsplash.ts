const UNSPLASH_ACCESS_KEY = import.meta.env.VITE_UNSPLASH_ACCESS_KEY || '';
const CACHE_PREFIX = 'unsplash_cache_';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

interface UnsplashPhoto {
  id: string;
  urls: { raw: string; full: string; regular: string; small: string; thumb: string };
  alt_description: string | null;
  user: { name: string; links: { html: string } };
}

interface CachedResult {
  url: string;
  alt: string;
  credit: string;
  creditUrl: string;
  timestamp: number;
}

function getCached(key: string): CachedResult | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const cached: CachedResult = JSON.parse(raw);
    if (Date.now() - cached.timestamp > CACHE_TTL) {
      localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    return cached;
  } catch {
    return null;
  }
}

function setCache(key: string, result: CachedResult) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(result));
  } catch {
    // Storage full — silently fail
  }
}

/** Build an optimized Unsplash image URL with resize params */
export function unsplashUrl(baseUrl: string, width = 1200, quality = 80): string {
  if (!baseUrl) return '';
  const sep = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${sep}w=${width}&q=${quality}&auto=format&fit=crop`;
}

/** Fetch a single photo from Unsplash by search query */
export async function fetchUnsplashImage(
  query: string,
  options: { width?: number; orientation?: 'landscape' | 'portrait' | 'squarish' } = {}
): Promise<CachedResult | null> {
  const cacheKey = `${query}_${options.orientation || 'landscape'}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  if (!UNSPLASH_ACCESS_KEY) return null;

  try {
    const params = new URLSearchParams({
      query: `${query} rwanda agriculture`,
      per_page: '1',
      orientation: options.orientation || 'landscape',
    });

    const res = await fetch(
      `https://api.unsplash.com/search/photos?${params}`,
      { headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` } }
    );

    if (!res.ok) return null;
    const data = await res.json();
    const photo: UnsplashPhoto | undefined = data.results?.[0];
    if (!photo) return null;

    const result: CachedResult = {
      url: unsplashUrl(photo.urls.raw, options.width || 1200),
      alt: photo.alt_description || query,
      credit: photo.user.name,
      creditUrl: photo.user.links.html,
      timestamp: Date.now(),
    };

    setCache(cacheKey, result);
    return result;
  } catch {
    return null;
  }
}

/** Curated fallback images for agricultural categories (no API call needed) */
export const AGRI_IMAGES: Record<string, { url: string; alt: string }> = {
  hero: {
    url: 'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=1920&q=80&auto=format&fit=crop',
    alt: 'Rwandan agricultural landscape',
  },
  farming: {
    url: 'https://images.unsplash.com/photo-1594498653385-d5172c532c00?w=1200&q=80&auto=format&fit=crop',
    alt: 'Farmer working in field',
  },
  marketplace: {
    url: 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=1200&q=80&auto=format&fit=crop',
    alt: 'Fresh produce at market',
  },
  cooperative: {
    url: 'https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=1200&q=80&auto=format&fit=crop',
    alt: 'Agricultural cooperative',
  },
  transport: {
    url: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1200&q=80&auto=format&fit=crop',
    alt: 'Agricultural transport',
  },
  government: {
    url: 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=1200&q=80&auto=format&fit=crop',
    alt: 'Government oversight and analytics',
  },
  coffee: {
    url: 'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=800&q=80&auto=format&fit=crop',
    alt: 'Coffee beans',
  },
  tea: {
    url: 'https://images.unsplash.com/photo-1556881286-fc6915169721?w=800&q=80&auto=format&fit=crop',
    alt: 'Tea plantation',
  },
  maize: {
    url: 'https://images.unsplash.com/photo-1601593768498-8ad6f76e0e25?w=800&q=80&auto=format&fit=crop',
    alt: 'Maize field',
  },
  beans: {
    url: 'https://images.unsplash.com/photo-1515543904379-3d757afe72e4?w=800&q=80&auto=format&fit=crop',
    alt: 'Beans harvest',
  },
  rice: {
    url: 'https://images.unsplash.com/photo-1536304993881-460e32f50f04?w=800&q=80&auto=format&fit=crop',
    alt: 'Rice paddy',
  },
  banana: {
    url: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=800&q=80&auto=format&fit=crop',
    alt: 'Banana plantation',
  },
  potato: {
    url: 'https://images.unsplash.com/photo-1518977676601-b28d28b74e76?w=800&q=80&auto=format&fit=crop',
    alt: 'Potato harvest',
  },
  forecasting: {
    url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&q=80&auto=format&fit=crop',
    alt: 'Data analytics and forecasting',
  },
};

/** Get a curated image URL for a crop category */
export function getCropImageUrl(crop: string): string {
  if (!crop) return AGRI_IMAGES.farming.url;
  const lower = crop.toLowerCase();
  for (const [key, img] of Object.entries(AGRI_IMAGES)) {
    if (lower.includes(key)) return img.url;
  }
  return AGRI_IMAGES.farming.url;
}
