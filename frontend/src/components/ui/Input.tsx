import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input = ({ label, className = '', ...props }: InputProps) => (
  <label className="block">
    {label && <span className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</span>}
    <input
      {...props}
      className={`h-11 w-full rounded-xl border border-slate-300 px-3 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 ${className}`}
    />
  </label>
);

