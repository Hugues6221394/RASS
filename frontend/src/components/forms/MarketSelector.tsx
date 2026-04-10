import { useRegisteredMarkets } from '../../hooks/useRegisteredMarkets';

interface MarketSelectorProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  province?: string;
  district?: string;
  sector?: string;
  helperText?: string;
}

export const MarketSelector = ({
  value,
  onChange,
  label = 'Market',
  province,
  district,
  sector,
  helperText,
}: MarketSelectorProps) => {
  const { markets, loading } = useRegisteredMarkets({ province, district, sector });
  const selectedMarket = markets.find((market) => market.name === value);

  return (
    <label className="block">
      <span className="text-xs font-semibold text-slate-600">{label}</span>
      <select
        className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{loading ? 'Loading markets...' : 'Select market'}</option>
        {markets.map((market) => (
          <option key={market.id} value={market.name}>{market.name}</option>
        ))}
      </select>
      {(selectedMarket || helperText) && (
        <span className="mt-1 block text-xs text-slate-500">
          {selectedMarket ? [selectedMarket.district, selectedMarket.sector, selectedMarket.location].filter(Boolean).join(' • ') : helperText}
        </span>
      )}
    </label>
  );
};
