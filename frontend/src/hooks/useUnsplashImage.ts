import { useState, useEffect, useRef } from 'react';
import { fetchUnsplashImage, AGRI_IMAGES } from '../api/unsplash';

interface UseImageOptions {
  fallbackKey?: keyof typeof AGRI_IMAGES;
  width?: number;
  orientation?: 'landscape' | 'portrait' | 'squarish';
  enabled?: boolean;
}

/** Hook to fetch an Unsplash image with caching and fallback */
export function useUnsplashImage(query: string, options: UseImageOptions = {}) {
  const { fallbackKey, width = 1200, orientation = 'landscape', enabled = true } = options;
  const fallback = fallbackKey ? AGRI_IMAGES[fallbackKey] : null;

  const [url, setUrl] = useState(fallback?.url || '');
  const [alt, setAlt] = useState(fallback?.alt || query);
  const [credit, setCredit] = useState('');
  const [loading, setLoading] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!enabled || !query) return;

    let cancelled = false;
    setLoading(true);

    fetchUnsplashImage(query, { width, orientation }).then(result => {
      if (cancelled || !mounted.current) return;
      if (result) {
        setUrl(result.url);
        setAlt(result.alt);
        setCredit(`Photo by ${result.credit}`);
      }
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [query, width, orientation, enabled]);

  return { url, alt, credit, loading };
}

/** Hook for lazy loading images via IntersectionObserver */
export function useLazyImage(src: string, options?: IntersectionObserverInit) {
  const [loaded, setLoaded] = useState(false);
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px', ...options }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [options]);

  useEffect(() => {
    if (!inView || !src) return;
    const img = new Image();
    img.onload = () => setLoaded(true);
    img.src = src;
  }, [inView, src]);

  return { ref, inView, loaded, currentSrc: loaded ? src : '' };
}
