import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';

export interface CropCatalogItem {
  id: string;
  name: string;
  status: string;
  isGovernmentRegistered: boolean;
  requiresGovernmentReview: boolean;
  sourceRole: string;
  createdAt?: string;
  updatedAt?: string;
}

let cachedCrops: CropCatalogItem[] | null = null;
let inflight: Promise<CropCatalogItem[]> | null = null;

const fetchCrops = async (includePending: boolean) => {
  if (!includePending && cachedCrops) return cachedCrops;
  if (!inflight) {
    inflight = api.get(`/api/catalog/crops${includePending ? '?includePending=true' : ''}`)
      .then((response) => Array.isArray(response.data) ? response.data as CropCatalogItem[] : [])
      .catch(() => [] as CropCatalogItem[])
      .finally(() => {
        inflight = null;
      });
  }
  const data = await inflight;
  if (!includePending) cachedCrops = data;
  return data;
};

export const useCropCatalog = (includePending = false) => {
  const [crops, setCrops] = useState<CropCatalogItem[]>(!includePending && cachedCrops ? cachedCrops : []);
  const [loading, setLoading] = useState(!(!includePending && cachedCrops));

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchCrops(includePending).then((data) => {
      if (!active) return;
      setCrops(data);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [includePending]);

  const approvedCrops = useMemo(() => crops.filter((crop) => crop.status === 'Active'), [crops]);

  return {
    crops,
    approvedCrops,
    loading,
    refresh: async () => {
      const data = await fetchCrops(includePending);
      setCrops(data);
    },
  };
};
