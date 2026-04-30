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
    <div className="space-y-4 p-6">
      <SkeletonBlock className="h-9 w-56" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[1, 2].map((i) => (
          <div key={i} className="rounded-card border border-border-default p-5 space-y-3 bg-surface-card shadow-card">
            <SkeletonBlock className="h-4 w-24 mb-3" />
            <SkeletonBlock className="h-5 w-3/4" />
            <SkeletonBlock className="h-4 w-1/2" />
            <SkeletonBlock className="h-4 w-2/3" />
          </div>
        ))}
      </div>
      <div className="rounded-card border border-border-default p-5 bg-surface-card shadow-card">
        <SkeletonBlock className="h-4 w-40 mb-4" />
        <SkeletonBlock className="h-32 w-full" />
      </div>
    </div>
  );
}

export function PayrollListSkeleton() {
  return (
    <div className="space-y-0 p-6">
      <SkeletonBlock className="h-8 w-48 mb-4" />
      <div className="rounded-card border border-border-default bg-surface-card shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border-subtle flex justify-between items-center">
          <SkeletonBlock className="h-5 w-32" />
          <SkeletonBlock className="h-9 w-36" />
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="px-5 py-4 border-b border-border-subtle last:border-b-0 flex justify-between items-center">
            <div className="space-y-2">
              <SkeletonBlock className="h-5 w-44" />
              <SkeletonBlock className="h-3.5 w-28" />
            </div>
            <div className="flex items-center gap-3">
              <SkeletonBlock className="h-5 w-20 rounded-sm" />
              <SkeletonBlock className="h-4 w-4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function WorkersSkeleton() {
  return (
    <div className="space-y-3 p-6">
      <SkeletonBlock className="h-8 w-48 mb-2" />
      <div className="flex gap-2 mb-4">
        {[1, 2, 3].map(i => <SkeletonBlock key={i} className="h-7 w-24 rounded-full" />)}
      </div>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="rounded-card border border-border-default p-4 flex gap-3 items-start bg-surface-card shadow-card">
          <SkeletonBlock className="h-10 w-10 rounded-full shrink-0" />
          <div className="space-y-2 flex-1">
            <div className="flex gap-2 items-center">
              <SkeletonBlock className="h-4 w-36" />
              <SkeletonBlock className="h-5 w-20 rounded-sm" />
            </div>
            <SkeletonBlock className="h-3 w-24" />
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
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="rounded-card border border-border-default p-5 space-y-3 bg-surface-card shadow-card">
            <SkeletonBlock className="h-10 w-10 rounded-lg" />
            <SkeletonBlock className="h-4 w-3/4" />
            <SkeletonBlock className="h-3 w-full" />
            <SkeletonBlock className="h-3 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function PayrollWeekDetailSkeleton() {
  return (
    <div className="space-y-4 p-6">
      <SkeletonBlock className="h-9 w-64 mb-2" />
      <div className="flex gap-2 mb-4">
        <SkeletonBlock className="h-6 w-20 rounded-sm" />
        <SkeletonBlock className="h-6 w-24 rounded-sm" />
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-card border border-border-default p-4 space-y-2 bg-surface-card shadow-card">
          <div className="flex justify-between">
            <SkeletonBlock className="h-4 w-40" />
            <SkeletonBlock className="h-4 w-24" />
          </div>
          <div className="overflow-x-auto">
            <div className="flex gap-2 min-w-[560px]">
              {[1,2,3,4,5,6,7].map(d => (
                <SkeletonBlock key={d} className="h-8 w-14 rounded" />
              ))}
            </div>
          </div>
        </div>
      ))}
      <div className="fixed bottom-0 left-0 right-0 h-14 bg-surface-card border-t border-border-default" />
    </div>
  );
}

export function IntegrationsSkeleton() {
  return (
    <div className="space-y-6 p-0">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl border border-gray-200 p-6 space-y-4 bg-white">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <SkeletonBlock className="h-5 w-48" />
              <SkeletonBlock className="h-4 w-72" />
            </div>
            <SkeletonBlock className="h-6 w-20 rounded-full" />
          </div>
          <SkeletonBlock className="h-9 w-40" />
        </div>
      ))}
    </div>
  );
}

export function SettingsSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <SkeletonBlock className="h-8 w-40" />
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="space-y-2">
          <SkeletonBlock className="h-4 w-32" />
          <SkeletonBlock className="h-10 w-full rounded-lg" />
        </div>
      ))}
      <SkeletonBlock className="h-10 w-28 rounded-lg" />
    </div>
  );
}
