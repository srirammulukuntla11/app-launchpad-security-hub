import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'brand' | 'success' | 'warning' | 'danger' | 'neutral' | 'outline' | 'purple' | 'teal';
  size?: 'sm' | 'md';
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  dot = false,
  className = '',
  ...props
}) => {
  const baseStyles = 'inline-flex items-center font-medium rounded-full transition-colors';

  const variants = {
    brand: 'bg-indigo-50 text-indigo-700 border border-indigo-200/80',
    purple: 'bg-purple-50 text-purple-700 border border-purple-200/80',
    teal: 'bg-teal-50 text-teal-700 border border-teal-200/80',
    success: 'bg-emerald-50 text-emerald-700 border border-emerald-200/80',
    warning: 'bg-amber-50 text-amber-800 border border-amber-200/80',
    danger: 'bg-rose-50 text-rose-700 border border-rose-200/80',
    neutral: 'bg-slate-100 text-slate-700 border border-slate-200',
    outline: 'bg-white text-slate-600 border border-slate-200',
  };

  const sizes = {
    sm: 'text-[13px] px-2.5 py-0.5 gap-1.5',
    md: 'text-[14px] px-3 py-1 gap-2',
  };

  const dotColors = {
    brand: 'bg-indigo-500',
    purple: 'bg-purple-500',
    teal: 'bg-teal-500',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-rose-500',
    neutral: 'bg-slate-400',
    outline: 'bg-slate-400',
  };

  return (
    <span className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {dot && <span className={`w-2 h-2 rounded-full ${dotColors[variant]}`} />}
      {children}
    </span>
  );
};

export default Badge;
