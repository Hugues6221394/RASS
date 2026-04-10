import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { normalizeProvinceName } from '../utils/rwandaLocation';

export type RwandaAdministrativeHierarchy = Record<string, Record<string, string[]>>;

let cachedHierarchy: RwandaAdministrativeHierarchy | null = null;
let inflightHierarchyPromise: Promise<RwandaAdministrativeHierarchy> | null = null;

const fetchHierarchy = async (): Promise<RwandaAdministrativeHierarchy> => {
  if (cachedHierarchy) return cachedHierarchy;
  if (!inflightHierarchyPromise) {
    inflightHierarchyPromise = api.get('/api/reference/admin-hierarchy')
      .then((response) => {
        const data = response.data && typeof response.data === 'object' ? response.data : {};
        cachedHierarchy = data as RwandaAdministrativeHierarchy;
        return cachedHierarchy;
      })
      .catch(() => ({} as RwandaAdministrativeHierarchy))
      .finally(() => {
        inflightHierarchyPromise = null;
      });
  }
  return inflightHierarchyPromise;
};

export const useRwandaAdministrativeData = () => {
  const [hierarchy, setHierarchy] = useState<RwandaAdministrativeHierarchy>(cachedHierarchy || {});
  const [loading, setLoading] = useState(!cachedHierarchy);

  useEffect(() => {
    let active = true;
    if (cachedHierarchy) {
      setHierarchy(cachedHierarchy);
      setLoading(false);
      return () => {
        active = false;
      };
    }

    fetchHierarchy().then((data) => {
      if (!active) return;
      setHierarchy(data);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, []);

  const provinces = useMemo(() => Object.keys(hierarchy).sort((a, b) => a.localeCompare(b)), [hierarchy]);

  const findProvinceByDistrict = (district?: string | null) => {
    const trimmedDistrict = String(district || '').trim().toLowerCase();
    if (!trimmedDistrict) return '';
    return provinces.find((province) =>
      Object.keys(hierarchy[province] || {}).some((candidate) => candidate.toLowerCase() === trimmedDistrict),
    ) || '';
  };

  const getDistricts = (province?: string | null) => {
    const normalizedProvince = normalizeProvinceName(province);
    return Object.keys(hierarchy[normalizedProvince] || {}).sort((a, b) => a.localeCompare(b));
  };

  const getSectors = (district?: string | null) => {
    const trimmedDistrict = String(district || '').trim().toLowerCase();
    if (!trimmedDistrict) return [] as string[];
    for (const province of provinces) {
      const districtEntry = Object.entries(hierarchy[province] || {}).find(([name]) => name.toLowerCase() === trimmedDistrict);
      if (districtEntry) {
        return [...districtEntry[1]].sort((a, b) => a.localeCompare(b));
      }
    }
    return [] as string[];
  };

  return {
    hierarchy,
    loading,
    provinces,
    findProvinceByDistrict,
    getDistricts,
    getSectors,
  };
};
