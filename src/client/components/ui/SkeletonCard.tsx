import { cn } from '../../lib/utils';

function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'bg-gray-200 rounded animate-pulse',
        className
      )}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-surface-card rounded-card shadow-card border border-border-default p-6">
      <Shimmer className="h-5 w-3/4 mb-3" />
      <Shimmer className="h-3.5 w-1/2 mb-4" />
      <div className="flex gap-2 mb-4">
        <Shimmer className="h-5 w-16" />
        <Shimmer className="h-5 w-20" />
      </div>
      <Shimmer className="h-3 w-full mb-2" />
      <Shimmer className="h-3 w-4/5" />
    </div>
  );
}

export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
