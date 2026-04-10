interface BadgeProps {
  text: string;
  tone?: 'success' | 'warning' | 'info' | 'neutral';
  className?: string;
}

const toneClass = {
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  info: 'bg-blue-50 text-blue-700 border-blue-200',
  neutral: 'bg-slate-50 text-slate-700 border-slate-200',
};

export const Badge = ({ text, tone = 'neutral', className = '' }: BadgeProps) => (
  <span
    className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${toneClass[tone]} ${className}`}
  >
    {text}
  </span>
);

