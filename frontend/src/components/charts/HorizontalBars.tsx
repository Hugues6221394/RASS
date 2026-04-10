interface Bar {
  label: string;
  value: number;
  color?: string;
  sub?: string;
}

export const HorizontalBars = ({ bars, title, unit = '' }: { bars: Bar[]; title?: string; unit?: string }) => {
  const max = Math.max(...bars.map((b) => b.value), 1);
  return (
    <div>
      {title && <p className="mb-3 text-sm font-bold text-slate-800">{title}</p>}
      <div className="space-y-2.5">
        {bars.map((bar, i) => (
          <div key={i}>
            <div className="mb-1 flex items-end justify-between">
              <span className="text-xs font-semibold text-slate-700">{bar.label}</span>
              <span className="text-xs font-bold text-slate-900">{bar.value.toLocaleString()}{unit && ` ${unit}`}</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${Math.max((bar.value / max) * 100, 2)}%`, backgroundColor: bar.color || '#059669' }}
              />
            </div>
            {bar.sub && <p className="mt-0.5 text-[10px] text-slate-500">{bar.sub}</p>}
          </div>
        ))}
      </div>
    </div>
  );
};
