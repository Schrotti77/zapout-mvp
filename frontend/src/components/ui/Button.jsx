import { forwardRef } from 'react';
import Loader from './Loader';

const variants = {
  primary: `
    bg-primary-500 text-white shadow-lg shadow-primary-500/25
    hover:bg-primary-600 hover:shadow-primary-500/30
    active:bg-primary-700 active:shadow-none active:scale-[0.98]
    disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
  `,
  secondary: `
    bg-surface-100 dark:bg-surface-800 text-surface-900 dark:text-surface-100
    border border-surface-200 dark:border-surface-700
    hover:bg-surface-200 dark:hover:bg-surface-700
    active:scale-[0.98]
    disabled:opacity-50 disabled:cursor-not-allowed
  `,
  ghost: `
    bg-transparent text-surface-600 dark:text-surface-400
    hover:bg-surface-100 dark:hover:bg-surface-800
    active:scale-[0.98]
  `,
  danger: `
    bg-error-500 text-white shadow-lg shadow-error-500/25
    hover:bg-error-600 hover:shadow-error-500/30
    active:bg-error-700 active:shadow-none active:scale-[0.98]
    disabled:opacity-50 disabled:cursor-not-allowed
  `,
  success: `
    bg-success-500 text-white shadow-lg shadow-success-500/25
    hover:bg-success-600 hover:shadow-success-500/30
    active:bg-success-700 active:shadow-none active:scale-[0.98]
    disabled:opacity-50 disabled:cursor-not-allowed
  `,
};

const sizes = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2.5 text-base',
  lg: 'px-6 py-3 text-lg',
  icon: 'p-2.5',
};

export const Button = forwardRef(function Button(
  {
    children,
    variant = 'primary',
    size = 'md',
    className = '',
    disabled = false,
    loading = false,
    icon: Icon,
    ...props
  },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center gap-2
        font-medium rounded-xl
        transition-all duration-200 ease-out
        focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2
        ${variants[variant]}
        ${sizes[size]}
        ${className}
      `}
      {...props}
    >
      {loading ? <Loader size="sm" /> : Icon ? <Icon className="w-5 h-5" /> : null}
      {children}
    </button>
  );
});

export default Button;
