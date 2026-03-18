import { forwardRef } from 'react';

export const Input = forwardRef(function Input(
  { label, error, icon: Icon, className = '', containerClassName = '', ...props },
  ref
) {
  return (
    <div className={`space-y-1.5 ${containerClassName}`}>
      {label && (
        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400">
            <Icon className="w-5 h-5" />
          </div>
        )}
        <input
          ref={ref}
          className={`
            w-full rounded-xl
            bg-surface-50 dark:bg-surface-900
            border border-surface-200 dark:border-surface-700
            text-surface-900 dark:text-surface-100
            placeholder:text-surface-400
            px-4 py-2.5
            ${Icon ? 'pl-11' : ''}
            transition-all duration-200
            hover:border-surface-300 dark:hover:border-surface-600
            focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20
            disabled:opacity-50 disabled:cursor-not-allowed
            ${error ? 'border-error-500 focus:border-error-500 focus:ring-error-500/20' : ''}
            ${className}
          `}
          {...props}
        />
      </div>
      {error && <p className="text-sm text-error-500">{error}</p>}
    </div>
  );
});

export default Input;
