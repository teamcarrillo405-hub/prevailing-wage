import { cn } from '../../lib/utils';

interface RateProvenanceProps {
  baseRate: number | null | undefined;
  fringeRate?: number | null;
  sourceLabel?: string | null;
  modificationLabel?: string | null;
  classificationLabel?: string | null;
  laborType?: string | null;
  override?: boolean;
  compact?: boolean;
  rateLabel?: string;
  missingIsProblem?: boolean;
  className?: string;
}

function fmt(value: number | null | undefined) {
  return `$${Number(value ?? 0).toFixed(2)}`;
}

export function RateProvenance({
  baseRate,
  fringeRate,
  sourceLabel,
  modificationLabel,
  classificationLabel,
  laborType,
  override = false,
  compact = false,
  rateLabel = 'base',
  missingIsProblem = true,
  className,
}: RateProvenanceProps) {
  const missingRate = missingIsProblem && Number(baseRate ?? 0) === 0;
  const source = sourceLabel || 'project wage source';
  const details = [
    classificationLabel,
    laborType ? laborType.replace(/([a-z])([A-Z])/g, '$1 $2') : null,
    modificationLabel,
  ].filter(Boolean);

  return (
    <div className={cn('text-xs text-gray-600', className)}>
      <div className="font-mono">
        {fmt(baseRate)} {rateLabel}{fringeRate !== undefined ? ` + ${fmt(fringeRate)} fringe` : ''}
      </div>
      {missingRate ? (
        <div className="mt-0.5 font-medium text-red-600">
          Needs rate fix: choose a WD trade or add an audited manual rate.
        </div>
      ) : (
        <div className={cn('mt-0.5 text-gray-400', compact && 'text-[11px]')}>
          Source: {source}{details.length > 0 ? ` · ${details.join(' · ')}` : ''}
          {override ? ' · override' : ''}
        </div>
      )}
    </div>
  );
}
