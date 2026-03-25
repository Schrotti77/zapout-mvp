/**
 * Skeleton - Loading placeholder components
 * Following frontend-dev: Loading, Empty, Error states always required
 */

export function Skeleton({ className = '', variant = 'text' }) {
  const baseClass = 'animate-pulse bg-slate-200 rounded';

  const variants = {
    text: 'h-4 w-full',
    title: 'h-6 w-3/4',
    avatar: 'h-12 w-12 rounded-full',
    card: 'h-32 w-full rounded-xl',
    button: 'h-10 w-24 rounded-lg',
    line: 'h-4 w-full mb-2',
  };

  return <div className={`${baseClass} ${variants[variant] || variant} ${className}`} />;
}

export function SkeletonCard({ className = '' }) {
  return (
    <div className={`bg-white rounded-xl p-4 shadow-sm border border-slate-100 ${className}`}>
      <div className="space-y-3">
        <Skeleton variant="title" />
        <Skeleton variant="text" />
        <Skeleton variant="text" className="w-2/3" />
      </div>
    </div>
  );
}

export function SkeletonList({ count = 3, className = '' }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4, className = '' }) {
  return (
    <div className={`bg-white rounded-xl overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex gap-4 p-4 border-b border-slate-100">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} variant="text" className="flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={rowIdx} className="flex gap-4 p-4 border-b border-slate-50 last:border-0">
          {Array.from({ length: cols }).map((_, colIdx) => (
            <Skeleton key={colIdx} variant="text" className="flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonInline({ className = '' }) {
  return (
    <span className={`animate-pulse inline-block w-20 h-4 bg-slate-200 rounded ${className}`} />
  );
}
