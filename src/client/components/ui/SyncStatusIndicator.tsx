// src/client/components/ui/SyncStatusIndicator.tsx
// Presentational pill showing sync state in the nav bar.
// Receives SyncStatus as prop (no internal hook call — keeps it testable).
// Returns null when state='idle' (no visual noise when synced and idle).
import type { SyncStatus } from '../../hooks/useSyncStatus';

interface Props {
  status: SyncStatus;
}

export function SyncStatusIndicator({ status }: Props) {
  if (status.state === 'idle') return null;

  if (status.state === 'syncing') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
        <span className="animate-pulse inline-block h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" />
        Syncing...
      </span>
    );
  }

  if (status.state === 'synced') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        <span className="inline-block h-2 w-2 rounded-full bg-green-500" aria-hidden="true" />
        Synced
      </span>
    );
  }

  // state === 'pending'
  const label = `${status.pendingCount} item${status.pendingCount === 1 ? '' : 's'} pending`;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
      <span className="inline-block h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" />
      {label}
    </span>
  );
}
