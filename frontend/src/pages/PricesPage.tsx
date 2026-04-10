import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useRegisteredMarkets } from '../hooks/useRegisteredMarkets';
import { useRwandaAdministrativeData } from '../hooks/useRwandaAdministrativeData';
import { CropSelector } from '../components/forms/CropSelector';
import { MarketSelector } from '../components/forms/MarketSelector';
import { Activity, CalendarRange, Download, Gavel, MapPin, ShieldCheck, Wheat } from 'lucide-react';
import { useSignalR } from '../context/SignalRContext';

export const PricesPage = () => {
  const queryClient = useQueryClient();
  const { notifications } = useSignalR();
  const { provinces, getDistricts } = useRwandaAdministrativeData();
  const [crop, setCrop] = useState('');
  const [province, setProvince] = useState('');
  const [district, setDistrict] = useState('');
  const [market, setMarket] = useState('');
  const [matrixSortBy, setMatrixSortBy] = useState<'crop' | 'region' | 'seller' | 'market' | 'govMax' | 'gap'>('gap');
  const [matrixSortDir, setMatrixSortDir] = useState<'asc' | 'desc'>('desc');
  const [matrixViolationsOnly, setMatrixViolationsOnly] = useState(false);
  const { markets } = useRegisteredMarkets({ province, district });

  const { data: latestPrices = [], isLoading } = useQuery({
    queryKey: ['latest-market-prices'],
    queryFn: async () => (await api.get('/api/marketprices/latest')).data,
    refetchInterval: 15000,
  });

  const { data: regulations = [] } = useQuery({
    queryKey: ['active-price-regulations'],
    queryFn: async () => (await api.get('/api/reference/price-regulations/active?includeUpcoming=true')).data,
    refetchInterval: 15000,
  });

  const { data: guidance = [] } = useQuery({
    queryKey: ['seasonal-guidance-public'],
    queryFn: async () => (await api.get('/api/reference/seasonal-guidance')).data,
  });

  // Fetch active marketplace listings for seller price comparison
  const { data: listingsResponse = { listings: [] as any[] } } = useQuery({
    queryKey: ['marketplace-listings-prices'],
    queryFn: async () => (await api.get('/api/market-listings?take=200')).data,
    refetchInterval: 15000,
  });
  const listings = Array.isArray((listingsResponse as any)?.listings)
    ? (listingsResponse as any).listings
    : [];

  useEffect(() => {
    const latest = notifications[0];
    const priceRelevant = latest && /price|regulation/i.test(`${latest.title} ${latest.message}`);
    if (priceRelevant) {
      queryClient.invalidateQueries({ queryKey: ['latest-market-prices'] });
      queryClient.invalidateQueries({ queryKey: ['active-price-regulations'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-listings-prices'] });
    }
  }, [notifications, queryClient]);

  const districtOptions = getDistricts(province);
  const normalize = (value: string | null | undefined) => String(value || '').trim().toLowerCase();
  const normalizeToken = (value: string | null | undefined) =>
    normalize(value)
      .replace(/\b(province|district|city|market)\b/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  const looseEqual = (a: string | null | undefined, b: string | null | undefined) => {
    const left = normalizeToken(a);
    const right = normalizeToken(b);
    if (!left || !right) return false;
    return left === right || left.includes(right) || right.includes(left);
  };
  const matchesFilter = (value: string | null | undefined, filterValue: string) => !filterValue || looseEqual(value, filterValue);
  const isEffectiveNow = (entry: any) => {
    const now = Date.now();
    const start = entry?.effectiveFrom ? new Date(entry.effectiveFrom).getTime() : Number.NEGATIVE_INFINITY;
    const end = entry?.effectiveTo ? new Date(entry.effectiveTo).getTime() : Number.POSITIVE_INFINITY;
    return start <= now && now <= end;
  };
  const regulationMatchesScope = (entry: any, rowCrop: string, rowProvince: string, rowDistrict: string, rowMarket: string) => {
    if (!looseEqual(entry.crop, rowCrop)) return false;
    if (entry.market) return looseEqual(entry.market, rowMarket);
    if (entry.district) return looseEqual(entry.district, rowDistrict);
    return looseEqual(entry.region, rowProvince);
  };
  const findBestRegulation = (regs: any[], rowCrop: string, rowProvince: string, rowDistrict: string, rowMarket: string) => {
    const cropRegs = regs.filter((entry) => looseEqual(entry.crop, rowCrop));
    const activeNow = cropRegs.filter(isEffectiveNow);
    const pool = activeNow.length > 0 ? activeNow : cropRegs;
    const scoped = pool
      .map((entry) => {
        if (entry.market && looseEqual(entry.market, rowMarket)) return { entry, score: 4 };
        if (entry.district && looseEqual(entry.district, rowDistrict)) return { entry, score: 3 };
        if (entry.region && looseEqual(entry.region, rowProvince)) return { entry, score: 2 };
        return null;
      })
      .filter(Boolean) as Array<{ entry: any; score: number }>;
    if (scoped.length > 0) return scoped.sort((a, b) => b.score - a.score)[0].entry;
    // Fallback: if crop is regulated anywhere, still surface it so regulated crops are always indicated.
    return pool[0] || null;
  };

  // Group seller listing prices by crop and geography for compliance comparison
  const sellerPricesByCrop = useMemo(() => {
    const map: Record<string, { min: number; max: number; avg: number; count: number; listings: any[] }> = {};
    (Array.isArray(listings) ? listings : []).forEach((l: any) => {
      const c = `${normalize(l.crop)}|${normalize(l.cooperative?.region)}|${normalize(l.cooperative?.district)}|${normalize(l.cooperative?.sector)}`;
      if (!map[c]) map[c] = { min: Number(l.minimumPrice), max: Number(l.minimumPrice), avg: 0, count: 0, listings: [] };
      const price = Number(l.minimumPrice);
      map[c].min = Math.min(map[c].min, price);
      map[c].max = Math.max(map[c].max, price);
      map[c].count++;
      map[c].listings.push(l);
    });
    Object.values(map).forEach(v => { v.avg = Math.round(v.listings.reduce((s, l) => s + Number(l.minimumPrice), 0) / v.count); });
    return map;
  }, [listings]);

  const rows = useMemo(() => {
    // Build rows from market price observations
    const priceRows = (Array.isArray(latestPrices) ? latestPrices : [])
      .filter((price: any) => {
        const matchesCrop = !crop || price.crop === crop;
        const matchesProvince = !province || price.region === province;
        const matchesDistrict = !district || price.district === district;
        const matchesMarket = !market || price.market === market;
        return matchesCrop && matchesProvince && matchesDistrict && matchesMarket;
      })
      .map((price: any) => {
        const regulation = findBestRegulation((regulations as any[]), price.crop, price.region, price.district, price.market);
        const guidanceItem = (guidance as any[]).find((entry) =>
          entry.crop === price.crop && entry.region === price.region,
        );
        const sellerData = sellerPricesByCrop[`${normalize(price.crop)}|${normalize(price.region)}|${normalize(price.district)}|${normalize(price.sector)}`]
          || sellerPricesByCrop[`${normalize(price.crop)}|${normalize(price.region)}|${normalize(price.district)}|`]
          || sellerPricesByCrop[`${normalize(price.crop)}|${normalize(price.region)}||`];
        return { price, regulation, guidanceItem, sellerData };
      });

    // Add seller-only crops/scopes (have listings but no market price observation yet)
    const coveredScopes = new Set(priceRows.map((r: any) => `${normalize(r.price.crop)}|${normalize(r.price.region)}|${normalize(r.price.district)}|${normalize(r.price.sector)}`));
    const sellerOnlyRows = Object.entries(sellerPricesByCrop)
      .filter(([scopeKey, data]) => !coveredScopes.has(scopeKey) && data.listings[0])
      .map(([scopeKey, data]) => {
        const sample = data.listings[0];
        const cropName = sample.crop;
        const rowRegion = sample.cooperative?.region || '';
        const rowDistrict = sample.cooperative?.district || '';
        const rowMarket = sample.cooperative?.sector || '';
        if (!matchesFilter(cropName, crop) || !matchesFilter(rowRegion, province) || !matchesFilter(rowDistrict, district) || !matchesFilter(rowMarket, market)) {
          return null;
        }
        const regulation = findBestRegulation((regulations as any[]), cropName, rowRegion, rowDistrict, rowMarket);
        const guidanceItem = (guidance as any[]).find((entry) => normalize(entry.crop) === normalize(cropName) && normalize(entry.region) === normalize(rowRegion));
        return {
          price: { id: `seller-${scopeKey}`, crop: cropName, market: rowMarket || '—', region: rowRegion || '—', district: rowDistrict || '—', sector: rowMarket || '', pricePerKg: null, observedAt: null, sellerOnly: true },
          regulation,
          guidanceItem,
          sellerData: data,
        };
      })
      .filter(Boolean);

    // Add regulation-only rows so users can inspect moderated prices across locations even before observations/listings arrive
    const coveredRegulations = new Set(
      [...priceRows, ...sellerOnlyRows].map((r: any) => `${normalize(r?.price?.crop)}|${normalize(r?.regulation?.region || r?.price?.region)}|${normalize(r?.regulation?.district || r?.price?.district)}|${normalize(r?.regulation?.market || r?.price?.market)}`),
    );
    const regulationOnlyRows = (regulations as any[])
      .filter((reg) => matchesFilter(reg.crop, crop) && matchesFilter(reg.region, province) && matchesFilter(reg.district, district) && matchesFilter(reg.market, market))
      .filter((reg) => !coveredRegulations.has(`${normalize(reg.crop)}|${normalize(reg.region)}|${normalize(reg.district)}|${normalize(reg.market)}`))
      .map((reg) => ({
        price: {
          id: `reg-${reg.id}`,
          crop: reg.crop,
          market: reg.market || '—',
          region: reg.region || '—',
          district: reg.district || '—',
          sector: '',
          pricePerKg: null,
          observedAt: null,
          regulationOnly: true,
        },
        regulation: reg,
        guidanceItem: (guidance as any[]).find((entry) => normalize(entry.crop) === normalize(reg.crop) && normalize(entry.region) === normalize(reg.region)),
        sellerData: null,
      }));

    return [...priceRows, ...sellerOnlyRows, ...regulationOnlyRows].sort((a: any, b: any) => {
      const cropCompare = String(a.price.crop || '').localeCompare(String(b.price.crop || ''));
      if (cropCompare !== 0) return cropCompare;
      return String(a.price.market || '').localeCompare(String(b.price.market || ''));
    });
  }, [crop, district, guidance, latestPrices, market, province, regulations, sellerPricesByCrop]);

  const coverage = new Set(rows.map((row: any) => row.price.market).filter((m) => m && m !== '—')).size;
  const regulatedRows = rows.filter((row: any) => row.regulation).length;
  const stableRows = rows.filter((row: any) => row.guidanceItem).length;
  const mismatchRows = rows.filter((row: any) => {
    if (!row.regulation) return false;
    const hasObservedMarketPrice = row.price.pricePerKg != null && !row.price.sellerOnly && !row.price.regulationOnly;
    const mp = Number(row.price.pricePerKg || 0);
    const govMax = Number(row.regulation.maxPricePerKg);
    const govMin = row.regulation.minPricePerKg ? Number(row.regulation.minPricePerKg) : null;
    const sellerAvg = row.sellerData?.avg || 0;
    return (hasObservedMarketPrice && (mp > govMax || (govMin != null && mp < govMin))) || (sellerAvg > govMax);
  }).length;

  const regionMatrixRows = useMemo(() => {
    const grouped = new Map<string, any>();
    rows.forEach((row: any) => {
      const rowCrop = String(row.price.crop || '');
      const rowRegion = String(row.regulation?.region || row.price.region || '—');
      const rowDistrict = String(row.regulation?.district || row.price.district || '—');
      const key = `${rowCrop}|${rowRegion}|${rowDistrict}`;
      const current = grouped.get(key) || {
        crop: rowCrop,
        region: rowRegion,
        district: rowDistrict,
        marketAvg: null as number | null,
        sellerAvg: null as number | null,
        govMin: null as number | null,
        govMax: null as number | null,
        hasViolation: false,
        observations: 0,
      };

      const hasObservedMarketPrice = row.price.pricePerKg != null && !row.price.sellerOnly && !row.price.regulationOnly;
      const marketPrice = hasObservedMarketPrice ? Number(row.price.pricePerKg) : null;
      const sellerAvg = row.sellerData?.avg != null ? Number(row.sellerData.avg) : null;
      const govMin = row.regulation?.minPricePerKg != null ? Number(row.regulation.minPricePerKg) : null;
      const govMax = row.regulation?.maxPricePerKg != null ? Number(row.regulation.maxPricePerKg) : null;

      current.marketAvg = marketPrice != null
        ? (current.marketAvg == null ? marketPrice : Math.round((current.marketAvg * current.observations + marketPrice) / (current.observations + 1)))
        : current.marketAvg;
      current.observations += marketPrice != null ? 1 : 0;
      if (sellerAvg != null) current.sellerAvg = sellerAvg;
      if (govMin != null) current.govMin = govMin;
      if (govMax != null) current.govMax = govMax;

      const marketViolation = marketPrice != null && govMax != null && (marketPrice > govMax || (govMin != null && marketPrice < govMin));
      const sellerViolation = sellerAvg != null && govMax != null && sellerAvg > govMax;
      current.hasViolation = current.hasViolation || marketViolation || sellerViolation;
      grouped.set(key, current);
    });

    const list = Array.from(grouped.values()).map((item) => {
      const referenceGov = item.govMax ?? item.govMin;
      const referenceMarket = item.marketAvg;
      const referenceSeller = item.sellerAvg;
      const gapToGov = referenceGov != null && referenceSeller != null ? referenceSeller - referenceGov : null;
      const marketVsSeller = referenceMarket != null && referenceSeller != null ? referenceSeller - referenceMarket : null;
      return { ...item, gapToGov, marketVsSeller };
    });

    const sorted = [...list].sort((a, b) => {
      const dir = matrixSortDir === 'asc' ? 1 : -1;
      const num = (v: number | null) => (v == null ? Number.NEGATIVE_INFINITY : v);
      if (matrixSortBy === 'crop') return dir * String(a.crop).localeCompare(String(b.crop));
      if (matrixSortBy === 'region') return dir * `${a.region}|${a.district}`.localeCompare(`${b.region}|${b.district}`);
      if (matrixSortBy === 'seller') return dir * (num(a.sellerAvg) - num(b.sellerAvg));
      if (matrixSortBy === 'market') return dir * (num(a.marketAvg) - num(b.marketAvg));
      if (matrixSortBy === 'govMax') return dir * (num(a.govMax) - num(b.govMax));
      return dir * (num(a.gapToGov) - num(b.gapToGov));
    });

    return sorted;
  }, [rows, matrixSortBy, matrixSortDir]);

  const visibleMatrixRows = useMemo(
    () => (matrixViolationsOnly ? regionMatrixRows.filter((r) => r.hasViolation) : regionMatrixRows),
    [matrixViolationsOnly, regionMatrixRows],
  );

  const downloadMatrixCsv = () => {
    const headers = ['Crop', 'Region', 'District', 'GovMin', 'GovMax', 'SellerAvg', 'MarketAvg', 'SellerGovGap', 'State'];
    const lines = visibleMatrixRows.map((item: any) => ([
      item.crop,
      item.region,
      item.district,
      item.govMin ?? '',
      item.govMax ?? '',
      item.sellerAvg ?? '',
      item.marketAvg ?? '',
      item.gapToGov ?? '',
      item.hasViolation ? 'Attention' : 'Healthy',
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')));

    const csv = [headers.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `RASS_price_matrix_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f4f9f4_0%,#ffffff_38%,#f8fafc_100%)]">
      <section className="border-b border-emerald-100 bg-[radial-gradient(circle_at_top_left,#d1fae5_0%,rgba(209,250,229,0.45)_22%,transparent_52%),linear-gradient(135deg,#065f46_0%,#0f766e_52%,#166534_100%)] px-4 pb-14 pt-24 text-white sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr] lg:items-end">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100">
                <ShieldCheck className="h-4 w-4" /> Government Price Guidance
              </div>
              <h1 className="max-w-4xl text-4xl font-black tracking-tight sm:text-5xl">National price comparison: Government vs Seller vs Market</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-emerald-50/90 sm:text-base">
                Compare government-regulated prices with actual seller listing prices and market agent observations. Quickly identify mismatches, violations, and price discrepancies across all crops and regions.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <p className="text-xs uppercase tracking-[0.18em] text-emerald-100">Markets</p>
                <p className="mt-2 text-3xl font-black">{coverage}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <p className="text-xs uppercase tracking-[0.18em] text-emerald-100">Regulated</p>
                <p className="mt-2 text-3xl font-black">{regulatedRows}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <p className="text-xs uppercase tracking-[0.18em] text-emerald-100">Stable Windows</p>
                <p className="mt-2 text-3xl font-black">{stableRows}</p>
              </div>
              <div className={`rounded-3xl border p-4 backdrop-blur ${mismatchRows > 0 ? 'border-red-300/30 bg-red-400/20' : 'border-white/10 bg-white/10'}`}>
                <p className="text-xs uppercase tracking-[0.18em] text-emerald-100">Mismatches</p>
                <p className="mt-2 text-3xl font-black">{mismatchRows}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto -mt-8 max-w-7xl px-4 pb-16 sm:px-6">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-4">
            <CropSelector value={crop} onChange={setCrop} label="Crop filter" allowCustom={false} />
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Province</span>
              <select className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm" value={province} onChange={(e) => { setProvince(e.target.value); setDistrict(''); setMarket(''); }}>
                <option value="">All provinces</option>
                {provinces.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">District</span>
              <select className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm" value={district} onChange={(e) => { setDistrict(e.target.value); setMarket(''); }} disabled={!province}>
                <option value="">All districts</option>
                {districtOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <MarketSelector value={market} onChange={setMarket} label="Market" province={province} district={district} />
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-slate-900">Price comparison board</h2>
                <p className="mt-1 text-sm text-slate-500">Compare market prices, government regulations, and seller listing prices. Rows highlighted in red indicate price mismatches or regulation violations.</p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700">
                <Activity className="h-4 w-4" /> {rows.length} visible rows
              </div>
            </div>

            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.18em] text-slate-500">
                    <th className="pb-3 pr-4">Crop</th>
                    <th className="pb-3 pr-4">Market</th>
                    <th className="pb-3 pr-4">District</th>
                    <th className="pb-3 pr-4">Market Price</th>
                    <th className="pb-3 pr-4">Gov. Regulated</th>
                    <th className="pb-3 pr-4">Seller Listing</th>
                    <th className="pb-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ price, regulation, guidanceItem, sellerData }: any) => {
                    const hasObservedMarketPrice = price.pricePerKg != null && !price.sellerOnly && !price.regulationOnly;
                    const marketPrice = Number(price.pricePerKg || 0);
                    const govMax = regulation ? Number(regulation.maxPricePerKg) : null;
                    const govMin = regulation?.minPricePerKg ? Number(regulation.minPricePerKg) : null;
                    const sellerAvg = sellerData?.avg || 0;
                    const exceedsGov = hasObservedMarketPrice && govMax != null && marketPrice > govMax;
                    const belowGov = hasObservedMarketPrice && govMin != null && marketPrice < govMin;
                    const sellerExceedsGov = govMax != null && sellerAvg > govMax;
                    const hasMismatch = exceedsGov || belowGov || sellerExceedsGov;
                    return (
                    <tr key={price.id} className={`border-b border-slate-100 align-top ${hasMismatch ? 'bg-red-50/40' : ''}`}>
                      <td className="py-4 pr-4 font-semibold text-slate-900">{price.crop}</td>
                      <td className="py-4 pr-4">
                        <p className="font-medium text-slate-800">{price.market}</p>
                        <p className="text-xs text-slate-500">{price.region}</p>
                      </td>
                      <td className="py-4 pr-4 text-slate-700">{[price.district, price.sector, price.cell].filter(Boolean).join(' • ') || '—'}</td>
                      <td className="py-4 pr-4">
                        {hasObservedMarketPrice ? (
                          <>
                            <p className={`font-semibold ${exceedsGov || belowGov ? 'text-red-600' : 'text-emerald-700'}`}>{marketPrice.toLocaleString()} RWF/kg</p>
                            <p className="text-xs text-slate-500">Observed {price.observedAt ? new Date(price.observedAt).toLocaleDateString() : '—'}</p>
                          </>
                        ) : (
                          <>
                            <p className="font-semibold text-slate-500">No observation yet</p>
                            <p className="text-xs text-slate-500">Awaiting market agent submission</p>
                          </>
                        )}
                      </td>
                      <td className="py-4 pr-4">
                        {regulation ? (
                          <>
                            <p className="font-semibold text-blue-700">
                              {govMin != null ? `${govMin.toLocaleString()} – ` : ''}
                              {(govMax ?? 0).toLocaleString()} RWF/kg
                            </p>
                            <p className="text-xs text-slate-500">Until {new Date(regulation.effectiveTo).toLocaleDateString()}</p>
                          </>
                        ) : (
                          <p className="text-slate-400 text-xs">No regulation</p>
                        )}
                      </td>
                      <td className="py-4 pr-4">
                        {sellerData ? (
                          <>
                            <p className={`font-semibold ${sellerExceedsGov ? 'text-red-600' : 'text-amber-700'}`}>
                              {sellerAvg.toLocaleString()} RWF/kg
                            </p>
                            <p className="text-xs text-slate-500">
                              {sellerData.count} listing{sellerData.count > 1 ? 's' : ''} • Range: {sellerData.min.toLocaleString()}–{sellerData.max.toLocaleString()}
                            </p>
                          </>
                        ) : (
                          <p className="text-slate-400 text-xs">No active listings</p>
                        )}
                      </td>
                      <td className="py-4">
                        {hasMismatch ? (
                          <div className="space-y-1">
                            {(exceedsGov || belowGov) && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                                Market {exceedsGov ? 'above' : 'below'} gov. range
                              </span>
                            )}
                            {sellerExceedsGov && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                Seller price exceeds gov. max
                              </span>
                            )}
                          </div>
                        ) : regulation ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Compliant
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                            Unregulated
                          </span>
                        )}
                        {guidanceItem && (
                          <p className="mt-1 text-[10px] text-slate-500">
                            Trend: <span className={`font-bold ${guidanceItem.expectedTrend === 'Rise' ? 'text-red-600' : guidanceItem.expectedTrend === 'Fall' ? 'text-amber-600' : 'text-emerald-600'}`}>{guidanceItem.expectedTrend === 'Rise' ? '↑' : guidanceItem.expectedTrend === 'Fall' ? '↓' : '→'} {guidanceItem.expectedTrend}</span>
                          </p>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
              {!isLoading && rows.length === 0 && <p className="py-8 text-center text-sm text-slate-500">No price records match the selected filters yet.</p>}
            </div>

            {/* Legend */}
            <div className="mt-4 flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
              <span className="font-bold text-slate-700">Legend:</span>
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Compliant</span>
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Market price violates regulation</span>
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Seller listing exceeds gov. max</span>
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-slate-400" /> No regulation set</span>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-slate-900">Crop × Region matrix</h2>
                  <p className="text-sm text-slate-500">Compare moderated prices for the same crop across regions and districts.</p>
                </div>
                <div className="flex gap-2">
                  <label className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-2 text-xs font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={matrixViolationsOnly}
                      onChange={(e) => setMatrixViolationsOnly(e.target.checked)}
                    />
                    Violations only
                  </label>
                  <select
                    value={matrixSortBy}
                    onChange={(e) => setMatrixSortBy(e.target.value as any)}
                    className="h-9 rounded-lg border border-slate-300 px-2 text-xs font-semibold text-slate-700"
                  >
                    <option value="gap">Sort: Seller-Gov gap</option>
                    <option value="crop">Sort: Crop</option>
                    <option value="region">Sort: Region</option>
                    <option value="seller">Sort: Seller avg</option>
                    <option value="market">Sort: Market avg</option>
                    <option value="govMax">Sort: Gov max</option>
                  </select>
                  <button
                    onClick={() => setMatrixSortDir((p) => (p === 'asc' ? 'desc' : 'asc'))}
                    className="h-9 rounded-lg border border-slate-300 px-3 text-xs font-bold text-slate-700"
                  >
                    {matrixSortDir === 'asc' ? 'Asc' : 'Desc'}
                  </button>
                  <button
                    onClick={downloadMatrixCsv}
                    className="inline-flex h-9 items-center gap-1 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white hover:bg-emerald-700"
                  >
                    <Download className="h-3.5 w-3.5" /> CSV
                  </button>
                </div>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-[10px] uppercase tracking-[0.16em] text-slate-500">
                      <th className="pb-2 pr-3">Crop</th>
                      <th className="pb-2 pr-3">Region</th>
                      <th className="pb-2 pr-3">District</th>
                      <th className="pb-2 pr-3">Gov range</th>
                      <th className="pb-2 pr-3">Seller avg</th>
                      <th className="pb-2 pr-3">Market avg</th>
                      <th className="pb-2 pr-3">Gap (Seller-Gov)</th>
                      <th className="pb-2">State</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleMatrixRows.slice(0, 60).map((item: any) => (
                      <tr key={`${item.crop}-${item.region}-${item.district}`} className="border-b border-slate-100">
                        <td className="py-2 pr-3 font-semibold text-slate-900">{item.crop}</td>
                        <td className="py-2 pr-3 text-slate-700">{item.region}</td>
                        <td className="py-2 pr-3 text-slate-700">{item.district}</td>
                        <td className="py-2 pr-3 text-blue-700">
                          {item.govMax != null ? `${item.govMin != null ? `${Number(item.govMin).toLocaleString()}–` : ''}${Number(item.govMax).toLocaleString()}` : 'Seller-only (no active gov range)'}
                        </td>
                        <td className="py-2 pr-3 text-amber-700">{item.sellerAvg != null ? `${Number(item.sellerAvg).toLocaleString()} RWF` : '—'}</td>
                        <td className="py-2 pr-3 text-emerald-700">{item.marketAvg != null ? `${Number(item.marketAvg).toLocaleString()} RWF` : '—'}</td>
                        <td className={`py-2 pr-3 font-semibold ${item.gapToGov == null ? 'text-slate-400' : item.gapToGov > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                          {item.gapToGov == null ? '—' : `${item.gapToGov > 0 ? '+' : ''}${Number(item.gapToGov).toLocaleString()} RWF`}
                        </td>
                        <td className="py-2">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${item.hasViolation ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {item.hasViolation ? 'Attention' : 'Healthy'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!isLoading && visibleMatrixRows.length === 0 && (
                  <p className="py-4 text-center text-xs text-slate-500">No matrix data yet for selected filters.</p>
                )}
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700"><Gavel className="h-5 w-5" /></div>
                <div>
                  <h2 className="text-lg font-black text-slate-900">How to read this page</h2>
                  <p className="text-sm text-slate-500">Government moderation and market evidence side by side.</p>
                </div>
              </div>
              <ul className="mt-4 space-y-3 text-sm text-slate-600">
                <li className="rounded-2xl bg-slate-50 px-4 py-3"><strong>Market Price</strong> — the newest observed market price submitted by registered market agents.</li>
                <li className="rounded-2xl bg-blue-50 px-4 py-3"><strong>Gov. Regulated</strong> — government-set price boundaries (min–max range). Blue indicates an active regulation.</li>
                <li className="rounded-2xl bg-amber-50 px-4 py-3"><strong>Seller Listing</strong> — average price from marketplace listings by cooperatives/sellers. Compare with government range to spot mismatches.</li>
                <li className="rounded-2xl bg-red-50 px-4 py-3"><strong>Status</strong> — shows compliance. Red rows indicate the market or seller price violates the government-regulated range. Report violations to authorities.</li>
              </ul>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-amber-50 p-3 text-amber-700"><CalendarRange className="h-5 w-5" /></div>
                <div>
                  <h2 className="text-lg font-black text-slate-900">Published stability guidance</h2>
                  <p className="text-sm text-slate-500">Latest guidance by crop and province.</p>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {(guidance as any[]).slice(0, 6).map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-200 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Wheat className="h-4 w-4 text-emerald-600" />
                      <p className="font-semibold text-slate-900">{item.crop}</p>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{item.region} • Season {item.season}</p>
                    <p className="mt-2 text-sm text-slate-700">{item.recommendationForFarmers || item.notes || 'No additional farmer note published.'}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-sky-50 p-3 text-sky-700"><MapPin className="h-5 w-5" /></div>
                <div>
                  <h2 className="text-lg font-black text-slate-900">Registered markets</h2>
                  <p className="text-sm text-slate-500">National market registry managed by government.</p>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {markets.slice(0, 6).map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-200 px-4 py-3">
                    <p className="font-semibold text-slate-900">{item.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{[item.district, item.sector, item.cell, item.province].filter(Boolean).join(' • ')}</p>
                    {item.location && <p className="mt-2 text-sm text-slate-700">{item.location}</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
