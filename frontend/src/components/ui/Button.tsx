import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'destructive' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  icon,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-medium transition-all duration-150 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-[0.99]';

  const variants = {
    primary:
      'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white shadow-sm shadow-indigo-200/60 border border-indigo-600',
    secondary:
      'bg-white hover:bg-slate-50 text-slate-800 shadow-sm border border-slate-200 hover:border-slate-300',
    outline:
      'bg-transparent hover:bg-slate-100 text-slate-700 border border-slate-300 hover:border-slate-400',
    destructive:
      'bg-rose-600 hover:bg-rose-700 text-white shadow-sm shadow-rose-200/50 border border-rose-600',
    ghost:
      'bg-transparent hover:bg-slate-100 text-slate-600 hover:text-slate-900',
  };

  const sizes = {
    sm: 'text-[14px] px-3 py-1.5 gap-1.5 rounded-md',
    md: 'text-[15px] font-medium px-4 py-2 gap-2 rounded-lg',
    lg: 'text-[16px] font-semibold px-5 py-2.5 gap-2.5 rounded-lg',
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      <span>{children}</span>
    </button>
  );
};

export default Button;
