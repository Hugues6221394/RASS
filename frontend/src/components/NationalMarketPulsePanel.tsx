import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { Card } from './ui/Card';
import { useTranslation } from 'react-i18next';

export const NationalMarketPulsePanel = ({ title = 'National market pulse' }: { title?: string }) => {
  const { t } = useTranslation();
  const [latestPrices, setLatestPrices] = useState<any[]>([]);
  const [nationalStats, setNationalStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const [pricesRes, nationalRes] = await Promise.all([
        api.get('/api/marketprices/latest').catch(() => ({ data: [] })),
        api.get('/api/aiinsights/national-stats').catch(() => ({ data: null })),
      ]);
      if (!mounted) return;
      setLatestPrices(Array.isArray(pricesRes.data) ? pricesRes.data : []);
      setNationalStats(nationalRes.data || null);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const cropRows = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    latestPrices.forEach((p: any) => {
       const crop = String(p.crop || t('shared.unknown', 'Unknown'));
      const price = Number(p.pricePerKg || 0);
      if (!map.has(crop)) map.set(crop, { total: 0, count: 0 });
      const row = map.get(crop)!;
      row.total += price;
      row.count += 1;
    });
    return Array.from(map.entries())
      .map(([crop, v]) => ({ crop, avgPrice: v.count ? Math.round(v.total / v.count) : 0 }))
      .sort((a, b) => b.avgPrice - a.avgPrice)
      .slice(0, 6);
  }, [latestPrices]);

  const marketRows = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    latestPrices.forEach((p: any) => {
       const market = String(p.market || t('shared.unknown', 'Unknown'));
      const price = Number(p.pricePerKg || 0);
      if (!map.has(market)) map.set(market, { total: 0, count: 0 });
      const row = map.get(market)!;
      row.total += price;
      row.count += 1;
    });
    return Array.from(map.entries())
      .map(([market, v]) => ({ market, avgPrice: v.count ? Math.round(v.total / v.count) : 0 }))
      .sort((a, b) => b.avgPrice - a.avgPrice)
      .slice(0, 6);
  }, [latestPrices]);

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-black text-slate-900">{title}</h3>
        <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-700">
          {t('national_market.live_market_intelligence', 'Live market intelligence')}
        </span>
      </div>

      {loading ? (
        <p className="mt-3 text-sm text-slate-500">{t('national_market.loading', 'Loading market intelligence...')}</p>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs text-slate-500">{t('national_market.tracked_pairs', 'Tracked crop-market pairs')}</p>
              <p className="text-xl font-black text-slate-900">{latestPrices.length}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs text-slate-500">{t('national_market.food_security_index', 'National food security index')}</p>
              <p className="text-xl font-black text-slate-900">{Number(nationalStats?.foodSecurityIndex ?? 0).toFixed(1)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs text-slate-500">{t('national_market.price_alert_crops', 'Price alert crops')}</p>
              <p className="text-xl font-black text-amber-700">{Array.isArray(nationalStats?.priceAlertCrops) ? nationalStats.priceAlertCrops.length : 0}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs font-black uppercase tracking-wider text-slate-500">{t('national_market.top_markets', 'Top markets by average price')}</p>
              <div className="mt-2 space-y-1.5">
                {marketRows.length ? marketRows.map((m) => (
                  <div key={m.market} className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-slate-700">{m.market}</span>
                    <span className="font-black text-slate-900">{m.avgPrice.toLocaleString()} RWF/kg</span>
                  </div>
                )) : <p className="text-sm text-slate-500">{t('national_market.no_market_records', 'No market records yet.')}</p>}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs font-black uppercase tracking-wider text-slate-500">{t('national_market.top_crops', 'Top crops by average price')}</p>
              <div className="mt-2 space-y-1.5">
                {cropRows.length ? cropRows.map((c) => (
                  <div key={c.crop} className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-slate-700">{c.crop}</span>
                    <span className="font-black text-slate-900">{c.avgPrice.toLocaleString()} RWF/kg</span>
                  </div>
                )) : <p className="text-sm text-slate-500">{t('national_market.no_crop_records', 'No crop records yet.')}</p>}
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};
