import { useMemo, useState } from 'react';
import { useCropCatalog } from '../../hooks/useCropCatalog';

interface CropSelectorProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  allowCustom?: boolean;
  helperText?: string;
  includePending?: boolean;
}

const selectClassName = 'mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm';
const inputClassName = 'mt-2 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm';

export const CropSelector = ({
  value,
  onChange,
  label = 'Crop',
  allowCustom = true,
  helperText,
  includePending = false,
}: CropSelectorProps) => {
  const { crops, loading } = useCropCatalog(includePending);
  const cropNames = useMemo(() => crops.map((crop) => crop.name), [crops]);
  const [customMode, setCustomMode] = useState(false);

  // Determine what the select should show
  const isCustomValue = customMode || (value !== '' && !cropNames.includes(value));
  const selectValue = isCustomValue ? '__custom__' : value;

  return (
    <label className="block">
      <span className="text-xs font-semibold text-slate-600">{label}</span>
      <select
        className={selectClassName}
        value={selectValue}
        onChange={(event) => {
          if (event.target.value === '__custom__') {
            setCustomMode(true);
            onChange('');
          } else {
            setCustomMode(false);
            onChange(event.target.value);
          }
        }}
      >
        <option value="">{loading ? 'Loading crops...' : 'Select crop'}</option>
        {cropNames.map((name) => (
          <option key={name} value={name}>{name}</option>
        ))}
        {allowCustom && <option value="__custom__">+ Add new crop…</option>}
      </select>
      {allowCustom && isCustomValue && (
        <input
          className={inputClassName}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Type new crop name (e.g. Sorghum)"
          autoFocus
        />
      )}
      {helperText && <span className="mt-1 block text-xs text-slate-500">{helperText}</span>}
    </label>
  );
};
