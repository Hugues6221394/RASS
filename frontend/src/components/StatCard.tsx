import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  helper?: string;
  icon?: React.ReactNode;
  trend?: { value: number; label?: string };
  color?: 'green' | 'blue' | 'orange' | 'purple' | 'gold' | 'cyan' | 'red';
  loading?: boolean;
  onClick?: () => void;
}

const palettes: Record<string, { icon: string; iconBg: string; dot: string }> = {
  green:  { icon: 'text-emerald-700',  iconBg: 'bg-emerald-50  ring-1 ring-emerald-200',  dot: 'bg-emerald-500'  },
  blue:   { icon: 'text-blue-700',     iconBg: 'bg-blue-50     ring-1 ring-blue-200',     dot: 'bg-blue-500'     },
  orange: { icon: 'text-amber-700',    iconBg: 'bg-amber-50    ring-1 ring-amber-200',    dot: 'bg-amber-500'    },
  purple: { icon: 'text-purple-700',   iconBg: 'bg-purple-50   ring-1 ring-purple-200',   dot: 'bg-purple-500'   },
  gold:   { icon: 'text-yellow-700',   iconBg: 'bg-yellow-50   ring-1 ring-yellow-200',   dot: 'bg-yellow-500'   },
  cyan:   { icon: 'text-cyan-700',     iconBg: 'bg-cyan-50     ring-1 ring-cyan-200',     dot: 'bg-cyan-500'     },
  red:    { icon: 'text-red-700',      iconBg: 'bg-red-50      ring-1 ring-red-200',      dot: 'bg-red-500'      },
};

export const StatCard: React.FC<StatCardProps> = ({
  label, value, helper, icon, trend, color = 'green', loading = false, onClick,
}) => {
  const p = palettes[color] || palettes.green;

  return (
    <div
      className={`glass-panel p-6 rounded-[2rem] flex flex-col gap-4 transition-all duration-300 ${
        onClick ? 'cursor-pointer hover:scale-[1.02] hover:shadow-xl hover:bg-white/80 active:scale-[0.98]' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            {label}
          </p>
          {loading ? (
            <div className="h-9 w-24 bg-slate-100 animate-pulse rounded-lg" />
          ) : (
            <p className="text-3xl font-black text-slate-900 tracking-tight">
              {value}
            </p>
          )}
          {helper && !loading && (
            <p className="text-xs font-medium text-slate-500">{helper}</p>
          )}
        </div>
        {icon && (
          <div className={`p-3 rounded-2xl ${p.iconBg} shadow-sm`}>
            <div className={`${p.icon} [&>svg]:w-6 [&>svg]:h-6`}>{icon}</div>
          </div>
        )}
      </div>

      {trend !== undefined && !loading && (
        <div className="flex items-center gap-2 pt-4 border-t border-slate-100">
          <div className={`flex items-center px-2 py-1 rounded-full text-[10px] font-black ${
            trend.value > 0 ? 'bg-emerald-50 text-emerald-600' : trend.value < 0 ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-500'
          }`}>
            {trend.value > 0 ? '↑' : trend.value < 0 ? '↓' : '•'} {Math.abs(trend.value)}%
          </div>
          {trend.label && (
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{trend.label}</span>
          )}
        </div>
      )}
    </div>
  );
};
