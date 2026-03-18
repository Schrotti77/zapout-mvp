export function Loader({ size = 'md', className = '' }) {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12',
  }

  return (
    <div className={`inline-flex items-center justify-center ${className}`}>
      <svg
        className={`${sizes[size]} animate-spin text-current`}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    </div>
  )
}

export function Spinner({ size = 'md', className = '' }) {
  return <Loader size={size} className={className} />
}

export function PageLoader({ text = 'Loading...' }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
      <Loader size="lg" className="text-primary-500" />
      <p className="text-surface-500 dark:text-surface-400 animate-pulse">{text}</p>
    </div>
  )
}

export function Skeleton({ className = '' }) {
  return (
    <div 
      className={`
        bg-gradient-to-r from-surface-200 via-surface-100 to-surface-200
        bg-[length:200%_100%] animate-shimmer
        rounded-lg
        ${className}
      `}
    />
  )
}

export function CardSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      </div>
      <Skeleton className="h-20 w-full" />
      <div className="flex gap-2">
        <Skeleton className="h-8 flex-1" />
        <Skeleton className="h-8 flex-1" />
      </div>
    </div>
  )
}

export default Loader
