import React, { forwardRef } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: React.ReactNode;
  rightElement?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, icon, rightElement, className = '', id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-[15px] font-medium text-slate-800">
            {label}
          </label>
        )}
        <div className="relative rounded-xl shadow-sm">
          {icon && (
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={`w-full rounded-xl bg-white border text-slate-900 text-[16px] placeholder:text-slate-400 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500/20 ${
              icon ? 'pl-11' : 'pl-4'
            } ${rightElement ? 'pr-11' : 'pr-4'} py-3 ${
              error
                ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-200'
                : 'border-slate-300 hover:border-slate-400 focus:border-indigo-600'
            } ${className}`}
            {...props}
          />
          {rightElement && (
            <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center">{rightElement}</div>
          )}
        </div>
        {error && <p className="text-[14px] text-rose-600 mt-1 font-medium">{error}</p>}
        {helperText && !error && <p className="text-[14px] text-slate-500 mt-1">{helperText}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
