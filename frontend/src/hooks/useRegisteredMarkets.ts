import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';

export interface RegisteredMarketItem {
  id: string;
  name: string;
  province: string;
  district: string;
  sector: string;
  cell?: string | null;
  location?: string | null;
}

export const useRegisteredMarkets = (filters?: { province?: string; district?: string; sector?: string }) => {
  const [markets, setMarkets] = useState<RegisteredMarketItem[]>([]);
  const [loading, setLoading] = useState(true);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (filters?.province) params.set('province', filters.province);
    if (filters?.district) params.set('district', filters.district);
    if (filters?.sector) params.set('sector', filters.sector);
    const raw = params.toString();
    return raw ? `?${raw}` : '';
  }, [filters?.district, filters?.province, filters?.sector]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.get(`/api/catalog/markets${queryString}`)
      .then((response) => {
        if (!active) return;
        setMarkets(Array.isArray(response.data) ? response.data : []);
      })
      .catch(() => {
        if (!active) return;
        setMarkets([]);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [queryString]);

  return {
    markets,
    loading,
  };
};
