import { useEffect, useMemo } from 'react';
import { useRwandaAdministrativeData } from '../../hooks/useRwandaAdministrativeData';
import type { RwandaLocationParts } from '../../utils/rwandaLocation';

interface RwandaLocationFieldsProps {
  value: RwandaLocationParts;
  onChange: (next: RwandaLocationParts) => void;
  showCell?: boolean;
  showDetail?: boolean;
  detailLabel?: string;
  detailPlaceholder?: string;
  detailRequired?: boolean;
  disabled?: boolean;
  className?: string;
}

const selectClassName = 'h-11 w-full rounded-xl border border-slate-300 px-3 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100';
const inputClassName = 'h-11 w-full rounded-xl border border-slate-300 px-3 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100';

export const RwandaLocationFields = ({
  value,
  onChange,
  showCell = true,
  showDetail = false,
  detailLabel = 'Location details',
  detailPlaceholder = 'Landmark, village, or facility name',
  detailRequired = false,
  disabled = false,
  className = '',
}: RwandaLocationFieldsProps) => {
  const { loading, provinces, findProvinceByDistrict, getDistricts, getSectors } = useRwandaAdministrativeData();

  const inferredProvince = useMemo(() => {
    if (value.province) return value.province;
    if (!value.district) return '';
    return findProvinceByDistrict(value.district);
  }, [findProvinceByDistrict, value.district, value.province]);

  useEffect(() => {
    if (!value.province && inferredProvince) {
      onChange({ ...value, province: inferredProvince });
    }
  }, [inferredProvince, onChange, value]);

  const selectedProvince = value.province || inferredProvince;
  const districtOptions = getDistricts(selectedProvince);
  const sectorOptions = getSectors(value.district);

  return (
    <div className={`grid grid-cols-1 gap-3 md:grid-cols-2 ${className}`.trim()}>
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold text-slate-600">Province</span>
        <select
          className={selectClassName}
          value={selectedProvince}
          onChange={(event) => onChange({ ...value, province: event.target.value, district: '', sector: '', cell: '' })}
          disabled={disabled || loading}
          required
        >
          <option value="">{loading ? 'Loading provinces...' : 'Select province'}</option>
          {provinces.map((province) => (
            <option key={province} value={province}>{province}</option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold text-slate-600">District</span>
        <select
          className={selectClassName}
          value={value.district}
          onChange={(event) => onChange({ ...value, district: event.target.value, sector: '', cell: '' })}
          disabled={disabled || !selectedProvince}
          required
        >
          <option value="">Select district</option>
          {districtOptions.map((district) => (
            <option key={district} value={district}>{district}</option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold text-slate-600">Sector</span>
        <select
          className={selectClassName}
          value={value.sector}
          onChange={(event) => onChange({ ...value, sector: event.target.value, cell: '' })}
          disabled={disabled || !value.district}
          required
        >
          <option value="">Select sector</option>
          {sectorOptions.map((sector) => (
            <option key={sector} value={sector}>{sector}</option>
          ))}
        </select>
      </label>

      {showCell && (
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-slate-600">Cell (optional)</span>
          <input
            className={inputClassName}
            value={value.cell}
            onChange={(event) => onChange({ ...value, cell: event.target.value })}
            placeholder="Enter cell"
            disabled={disabled}
          />
        </label>
      )}

      {showDetail && (
        <label className="block md:col-span-2">
          <span className="mb-1.5 block text-xs font-semibold text-slate-600">{detailLabel}</span>
          <input
            className={inputClassName}
            value={value.detail}
            onChange={(event) => onChange({ ...value, detail: event.target.value })}
            placeholder={detailPlaceholder}
            disabled={disabled}
            required={detailRequired}
          />
        </label>
      )}
    </div>
  );
};
