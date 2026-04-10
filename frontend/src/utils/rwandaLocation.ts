export interface RwandaLocationParts {
  province: string;
  district: string;
  sector: string;
  cell: string;
  detail: string;
}

export const emptyRwandaLocation = (): RwandaLocationParts => ({
  province: '',
  district: '',
  sector: '',
  cell: '',
  detail: '',
});

const provinceAliases: Record<string, string> = {
  kigali: 'Kigali City',
  'kigali city': 'Kigali City',
  northern: 'Northern',
  southern: 'Southern',
  eastern: 'Eastern',
  western: 'Western',
};

export const normalizeProvinceName = (value?: string | null) => {
  const normalized = String(value || '').trim().toLowerCase();
  return provinceAliases[normalized] || String(value || '').trim();
};

export const buildLocationText = (parts: Partial<RwandaLocationParts>) => {
  const path = [parts.province, parts.district, parts.sector, parts.cell]
    .map((segment) => String(segment || '').trim())
    .filter(Boolean)
    .join(' / ');
  const detail = String(parts.detail || '').trim();
  if (!path) return detail;
  return detail ? `${path} - ${detail}` : path;
};

export const parseLocationText = (raw?: string | null): RwandaLocationParts => {
  const value = String(raw || '').trim();
  if (!value) return emptyRwandaLocation();

  const [pathPart, ...detailParts] = value.split(' - ');
  const detail = detailParts.join(' - ').trim();
  const pathSegments = pathPart
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (pathSegments.length >= 3) {
    return {
      province: normalizeProvinceName(pathSegments[0]),
      district: pathSegments[1] || '',
      sector: pathSegments[2] || '',
      cell: pathSegments[3] || '',
      detail,
    };
  }

  return {
    ...emptyRwandaLocation(),
    detail: value,
  };
};
