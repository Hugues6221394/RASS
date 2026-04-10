import type { ReactNode } from 'react';

type ColorScheme = 'emerald' | 'blue' | 'amber' | 'rose' | 'violet' | 'sky' | 'teal' | 'orange';

const colorMap: Record<ColorScheme, { bg: string; icon: string; text: string; sub: string; ring: string }> = {
  emerald: { bg: 'from-emerald-500 to-emerald-700', icon: 'bg-white/20', text: 'text-white', sub: 'text-emerald-100', ring: 'ring-emerald-400/30' },
  blue:    { bg: 'from-blue-500 to-blue-700', icon: 'bg-white/20', text: 'text-white', sub: 'text-blue-100', ring: 'ring-blue-400/30' },
  amber:   { bg: 'from-amber-400 to-amber-600', icon: 'bg-white/20', text: 'text-white', sub: 'text-amber-50', ring: 'ring-amber-300/30' },
  rose:    { bg: 'from-rose-500 to-rose-700', icon: 'bg-white/20', text: 'text-white', sub: 'text-rose-100', ring: 'ring-rose-400/30' },
  violet:  { bg: 'from-violet-500 to-violet-700', icon: 'bg-white/20', text: 'text-white', sub: 'text-violet-100', ring: 'ring-violet-400/30' },
  sky:     { bg: 'from-sky-400 to-sky-600', icon: 'bg-white/20', text: 'text-white', sub: 'text-sky-50', ring: 'ring-sky-300/30' },
  teal:    { bg: 'from-teal-500 to-teal-700', icon: 'bg-white/20', text: 'text-white', sub: 'text-teal-100', ring: 'ring-teal-400/30' },
  orange:  { bg: 'from-orange-400 to-orange-600', icon: 'bg-white/20', text: 'text-white', sub: 'text-orange-50', ring: 'ring-orange-300/30' },
};

interface KpiBannerProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color?: ColorScheme;
  trend?: { value: string; up: boolean } | null;
  onClick?: () => void;
  sparkline?: number[];
}

export const KpiBanner = ({ icon, label, value, sub, color = 'emerald', trend, onClick, sparkline }: KpiBannerProps) => {
  const c = colorMap[color];
  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${c.bg} p-5 shadow-lg ring-1 ${c.ring} transition-all duration-200 ${onClick ? 'cursor-pointer hover:scale-[1.02] hover:shadow-xl active:scale-[0.98] text-left w-full' : ''}`}
      onClick={onClick}
      type={onClick ? 'button' : undefined}
    >
      {/* decorative circle */}
      <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/[0.06]" />
      <div className="pointer-events-none absolute -right-2 -bottom-8 h-20 w-20 rounded-full bg-white/[0.04]" />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${c.sub}`}>{label}</p>
          <p className={`mt-1.5 text-3xl font-black tracking-tight ${c.text}`}>{typeof value === 'number' ? value.toLocaleString() : value}</p>
          {sub && <p className={`mt-1 text-xs ${c.sub}`}>{sub}</p>}
          {trend && (
            <div className={`mt-2 inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold ${c.text}`}>
              <span>{trend.up ? '↑' : '↓'}</span>
              <span>{trend.value}</span>
            </div>
          )}
        </div>
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${c.icon} backdrop-blur-sm`}>
          {icon}
        </div>
      </div>

      {sparkline && sparkline.length > 1 && (
        <div className="mt-3 flex h-8 items-end gap-[2px]">
          {sparkline.map((v, i) => {
            const max = Math.max(...sparkline, 1);
            const pct = Math.max((v / max) * 100, 4);
            return <div key={i} className="flex-1 rounded-t bg-white/20" style={{ height: `${pct}%` }} />;
          })}
        </div>
      )}
    </Tag>
  );
};
