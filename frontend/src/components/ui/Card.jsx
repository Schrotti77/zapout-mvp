export function Card({ children, className = '', hover = false, padding = 'md', ...props }) {
  const paddingSizes = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  };

  return (
    <div
      className={`
        rounded-2xl
        bg-surface-50 dark:bg-surface-800
        border border-surface-200 dark:border-surface-700
        ${paddingSizes[padding]}
        ${
          hover
            ? 'transition-all duration-200 hover:border-primary-500/50 hover:shadow-lg hover:shadow-primary-500/5 hover:-translate-y-0.5 cursor-pointer'
            : ''
        }
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }) {
  return (
    <div className={`pb-3 border-b border-surface-200 dark:border-surface-700 ${className}`}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className = '' }) {
  return (
    <h3 className={`text-lg font-semibold text-surface-900 dark:text-surface-100 ${className}`}>
      {children}
    </h3>
  );
}

export function CardDescription({ children, className = '' }) {
  return (
    <p className={`text-sm text-surface-500 dark:text-surface-400 mt-1 ${className}`}>{children}</p>
  );
}

export function CardContent({ children, className = '' }) {
  return <div className={className}>{children}</div>;
}

export function CardFooter({ children, className = '' }) {
  return (
    <div className={`pt-3 border-t border-surface-200 dark:border-surface-700 mt-3 ${className}`}>
      {children}
    </div>
  );
}

export default Card;
