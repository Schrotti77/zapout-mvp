export function Container({ 
  children, 
  className = '',
  size = 'md',
  center = true,
  ...props 
}) {
  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    full: 'max-w-full',
  }

  return (
    <div
      className={`
        mx-auto w-full px-4
        ${sizes[size]}
        ${center ? 'flex flex-col items-center' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  )
}

export function Screen({ children, className = '', pad = true }) {
  return (
    <div 
      className={`
        min-h-[100dvh] flex flex-col
        ${pad ? 'px-4 py-6' : ''}
        pb-safe
        ${className}
      `}
    >
      {children}
    </div>
  )
}

export function Section({ children, className = '', title, description }) {
  return (
    <section className={`space-y-4 ${className}`}>
      {(title || description) && (
        <div className="space-y-1">
          {title && (
            <h2 className="text-xl font-semibold text-surface-900 dark:text-surface-100">
              {title}
            </h2>
          )}
          {description && (
            <p className="text-surface-500 dark:text-surface-400">
              {description}
            </p>
          )}
        </div>
      )}
      {children}
    </section>
  )
}

export function Grid({ 
  children, 
  cols = { default: 1, sm: 2, lg: 3 },
  gap = 4,
  className = '' 
}) {
  return (
    <div 
      className={`
        grid grid-cols-${cols.default} 
        sm:grid-cols-${cols.sm || cols.default} 
        lg:grid-cols-${cols.lg || cols.sm || cols.default}
        gap-${gap}
        ${className}
      `}
    >
      {children}
    </div>
  )
}

export function Flex({ 
  children, 
  direction = 'row',
  justify = 'start',
  align = 'center',
  gap = 4,
  className = '' 
}) {
  return (
    <div 
      className={`
        flex flex-${direction}
        justify-${justify}
        items-${align}
        gap-${gap}
        ${className}
      `}
    >
      {children}
    </div>
  )
}

export function Divider({ className = '' }) {
  return (
    <div 
      className={`h-px bg-surface-200 dark:bg-surface-700 ${className}`} 
    />
  )
}

export default Container
