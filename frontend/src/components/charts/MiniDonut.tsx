interface Slice {
  label: string;
  value: number;
  color: string;
}

export const MiniDonut = ({ slices, size = 120, thickness = 16, title }: { slices: Slice[]; size?: number; thickness?: number; title?: string }) => {
  const total = slices.reduce((s, sl) => s + sl.value, 0);
  if (total === 0) return null;

  const r = (size - thickness) / 2;
  const circumference = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-3">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="drop-shadow-sm">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={thickness} />
        {slices.map((sl, i) => {
          const pct = sl.value / total;
          const dash = pct * circumference;
          const gap = circumference - dash;
          const current = offset;
          offset += dash;
          return (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={sl.color}
              strokeWidth={thickness}
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={-current}
              strokeLinecap="round"
              className="transition-all duration-500"
              style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
            />
          );
        })}
        <text x="50%" y="50%" textAnchor="middle" dy="0.35em" className="fill-slate-900 text-xl font-black">{total}</text>
      </svg>
      {title && <p className="text-xs font-semibold text-slate-600">{title}</p>}
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1">
        {slices.map((sl, i) => (
          <div key={i} className="flex items-center gap-1.5 text-[10px] text-slate-600">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: sl.color }} />
            {sl.label} ({sl.value})
          </div>
        ))}
      </div>
    </div>
  );
};
