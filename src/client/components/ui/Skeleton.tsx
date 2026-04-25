// src/client/components/ui/Skeleton.tsx
// Named skeleton loading states for 5 key pages.
import { cn } from '../../lib/utils';

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse bg-gray-200 rounded', className)} />
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-4 p-6">
      <SkeletonBlock className="h-8 w-48" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="rounded-xl border p-5 space-y-3">
            <SkeletonBlock className="h-5 w-3/4" />
            <SkeletonBlock className="h-4 w-1/2" />
            <SkeletonBlock className="h-4 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProjectDetailSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <SkeletonBlock className="h-8 w-64" />
      <div className="grid grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <SkeletonBlock key={i} className="h-16" />
        ))}
      </div>
      <SkeletonBlock className="h-48 w-full" />
    </div>
  );
}

export function PayrollListSkeleton() {
  return (
    <div className="space-y-3 p-6">
      <SkeletonBlock className="h-8 w-48" />
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="rounded-xl border p-4 flex justify-between items-center"
        >
          <div className="space-y-2">
            <SkeletonBlock className="h-5 w-40" />
            <SkeletonBlock className="h-4 w-28" />
          </div>
          <SkeletonBlock className="h-8 w-20" />
        </div>
      ))}
    </div>
  );
}

export function WorkersSkeleton() {
  return (
    <div className="space-y-3 p-6">
      <SkeletonBlock className="h-8 w-48" />
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="rounded-xl border p-4 flex gap-4 items-center">
          <SkeletonBlock className="h-10 w-10 rounded-full" />
          <div className="space-y-2 flex-1">
            <SkeletonBlock className="h-5 w-36" />
            <SkeletonBlock className="h-4 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ReportsSkeleton() {
  return (
    <div className="space-y-4 p-6">
      <SkeletonBlock className="h-8 w-48" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border p-5 space-y-3">
            <SkeletonBlock className="h-8 w-8 rounded" />
            <SkeletonBlock className="h-5 w-3/4" />
            <SkeletonBlock className="h-4 w-full" />
            <SkeletonBlock className="h-9 w-28" />
          </div>
        ))}
      </div>
    </div>
  );
}
