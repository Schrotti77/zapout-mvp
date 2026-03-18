const variants = {
  success: 'bg-success-500/10 text-success-600 dark:text-success-400 border-success-500/20',
  warning: 'bg-warning-500/10 text-warning-600 dark:text-warning-400 border-warning-500/20',
  error: 'bg-error-500/10 text-error-600 dark:text-error-400 border-error-500/20',
  info: 'bg-primary-500/10 text-primary-600 dark:text-primary-400 border-primary-500/20',
  neutral: 'bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-300 border-surface-200 dark:border-surface-600',
}

const sizes = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
  lg: 'px-3 py-1.5 text-base',
}

export function Badge({ 
  children, 
  variant = 'neutral', 
  size = 'md',
  className = '',
  dot = false 
}) {
  return (
    <span
      className={`
        inline-flex items-center gap-1.5
        rounded-full font-medium
        border
        ${variants[variant]}
        ${sizes[size]}
        ${className}
      `}
    >
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full ${
          variant === 'success' ? 'bg-success-500' :
          variant === 'warning' ? 'bg-warning-500' :
          variant === 'error' ? 'bg-error-500' :
          variant === 'info' ? 'bg-primary-500' :
          'bg-surface-500'
        }`} />
      )}
      {children}
    </span>
  )
}

export default Badge
