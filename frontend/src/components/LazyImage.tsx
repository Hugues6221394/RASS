import React, { useState, useRef, useEffect } from 'react';

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  /** Source URL */
  src: string;
  /** Alt text */
  alt: string;
  /** Responsive widths for srcSet generation (Unsplash URLs only) */
  widths?: number[];
  /** Placeholder type while loading */
  placeholder?: 'shimmer' | 'blur' | 'none';
  /** Root margin for IntersectionObserver */
  rootMargin?: string;
  /** Optional aspect ratio for the container (e.g., "16/9", "4/3", "1/1") */
  aspectRatio?: string;
  /** Photo credit text */
  credit?: string;
}

/** Generate srcSet for Unsplash URLs */
function buildSrcSet(baseUrl: string, widths: number[]): string {
  if (!baseUrl.includes('unsplash.com')) return '';
  const base = baseUrl.split('?')[0];
  return widths
    .map(w => `${base}?w=${w}&q=80&auto=format&fit=crop ${w}w`)
    .join(', ');
}

export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  widths = [400, 800, 1200],
  placeholder = 'shimmer',
  rootMargin = '200px',
  aspectRatio,
  credit,
  className = '',
  style,
  ...rest
}) => {
  const [inView, setInView] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  const srcSet = buildSrcSet(src, widths);

  return (
    <div
      ref={containerRef}
      className={`lazy-image-container ${className}`}
      style={{ aspectRatio, position: 'relative', overflow: 'hidden', ...style }}
    >
      {/* Shimmer placeholder */}
      {placeholder === 'shimmer' && !loaded && !error && (
        <div className="absolute inset-0 skeleton" />
      )}

      {/* Blur placeholder */}
      {placeholder === 'blur' && !loaded && !error && (
        <div
          className="absolute inset-0 bg-gradient-to-br from-[#EDF5F0] to-[#D9EFE4]"
          style={{ filter: 'blur(20px)', transform: 'scale(1.1)' }}
        />
      )}

      {/* Actual image */}
      {inView && !error && (
        <img
          src={src}
          srcSet={srcSet || undefined}
          sizes={srcSet ? '(max-width: 640px) 400px, (max-width: 1024px) 800px, 1200px' : undefined}
          alt={alt}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          className={`w-full h-full object-cover transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          {...rest}
        />
      )}

      {/* Error fallback */}
      {error && (
        <div className="absolute inset-0 bg-gradient-to-br from-[#EDF5F0] to-[#D9EFE4] flex items-center justify-center">
          <span className="text-3xl opacity-50">🌱</span>
        </div>
      )}

      {/* Photo credit */}
      {credit && loaded && (
        <span className="absolute bottom-1 right-2 text-[9px] text-white/60 bg-black/20 px-1.5 py-0.5 rounded">
          {credit}
        </span>
      )}
    </div>
  );
};
