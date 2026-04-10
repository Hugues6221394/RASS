import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'outline' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const variantClass: Record<Variant, string> = {
  primary:
    'bg-emerald-700 text-white hover:bg-emerald-800 shadow-[0_10px_24px_rgba(6,95,70,0.25)]',
  secondary:
    'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200',
  outline:
    'bg-white text-slate-700 border border-slate-300 hover:border-emerald-300 hover:text-emerald-700',
  danger: 'bg-rose-600 text-white hover:bg-rose-700',
};

const sizeClass: Record<Size, string> = {
  sm: 'h-9 px-3 text-xs',
  md: 'h-11 px-4 text-sm',
  lg: 'h-12 px-5 text-sm',
};

export const Button = ({
  variant = 'primary',
  size = 'md',
  leftIcon,
  rightIcon,
  className = '',
  children,
  ...props
}: ButtonProps) => (
  <button
    {...props}
    className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all disabled:opacity-60 disabled:cursor-not-allowed ${variantClass[variant]} ${sizeClass[size]} ${className}`}
  >
    {leftIcon}
    <span>{children}</span>
    {rightIcon}
  </button>
);

