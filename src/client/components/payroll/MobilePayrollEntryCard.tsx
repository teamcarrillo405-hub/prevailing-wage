import React, { useState, useCallback } from 'react';
import { Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';

// ─── Types ────────────────────────────────────────────────────────────────────

type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface MobilePayrollEntry {
  id: string;
  workerId: string;
  payrollWeekId: string;
  classificationId: string;
  monSt: number;
  tueSt: number;
  wedSt: number;
  thuSt: number;
  friSt: number;
  satSt: number;
  sunSt: number;
  monOt: number;
  tueOt: number;
  wedOt: number;
  thuOt: number;
  friOt: number;
  satOt: number;
  sunOt: number;
  baseRateSnapshot: number;
  fringeRateSnapshot: number;
  grossWages: number | null;
  deductions: number | null;
  netPay: number | null;
  subcontractorId: string | null;
}

export interface MobilePayrollWorker {
  id: string;
  name: string;
  classifications: Array<{ id: string; tradeDescription: string; laborType: string }>;
}

export interface MobilePayrollEntryCardProps {
  entry: MobilePayrollEntry;
  worker: MobilePayrollWorker;
  tradeDescription: string;
  onUpdateHours: (
    entryId: string,
    day: DayKey,
    type: 'st' | 'ot',
    value: number,
  ) => void;
  onDelete: (entryId: string) => void;
  isEditing: boolean;
  canEdit: boolean;
}

// ─── Day metadata ─────────────────────────────────────────────────────────────

const DAYS: Array<{ key: DayKey; label: string }> = [
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
  { key: 'sat', label: 'Sat' },
  { key: 'sun', label: 'Sun' },
];

function getDaySt(entry: MobilePayrollEntry, day: DayKey): number {
  return entry[`${day}St` as keyof MobilePayrollEntry] as number ?? 0;
}

function getDayOt(entry: MobilePayrollEntry, day: DayKey): number {
  return entry[`${day}Ot` as keyof MobilePayrollEntry] as number ?? 0;
}

function getDayTotal(entry: MobilePayrollEntry, day: DayKey): number {
  return getDaySt(entry, day) + getDayOt(entry, day);
}

function computeGrossWages(entry: MobilePayrollEntry): number {
  const totalSt =
    entry.monSt + entry.tueSt + entry.wedSt + entry.thuSt +
    entry.friSt + entry.satSt + entry.sunSt;
  const totalOt =
    entry.monOt + entry.tueOt + entry.wedOt + entry.thuOt +
    entry.friOt + entry.satOt + entry.sunOt;
  const totalHours = totalSt + totalOt;

  const base = entry.baseRateSnapshot;
  const fringe = entry.fringeRateSnapshot;

  // Standard Davis-Bacon: straight time + half premium for OT + fringe on all hours
  return totalSt * base + totalOt * (base * 1.5) + totalHours * fringe;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MobilePayrollEntryCard({
  entry,
  worker,
  tradeDescription,
  onUpdateHours,
  onDelete,
  canEdit,
}: MobilePayrollEntryCardProps) {
  // Default to first day that already has hours; fall back to 'mon'
  const [selectedDay, setSelectedDay] = useState<DayKey>(() => {
    return (
      DAYS.find(({ key }) => getDayTotal(entry, key) > 0)?.key ?? 'mon'
    );
  });

  // Local numeric input state so we don't call onUpdateHours on every keystroke
  const [localSt, setLocalSt] = useState<string>(
    () => String(getDaySt(entry, selectedDay) || ''),
  );
  const [localOt, setLocalOt] = useState<string>(
    () => String(getDayOt(entry, selectedDay) || ''),
  );

  // When the user picks a different day, sync local state from entry
  const handleSelectDay = useCallback(
    (day: DayKey) => {
      setSelectedDay(day);
      setLocalSt(String(getDaySt(entry, day) || ''));
      setLocalOt(String(getDayOt(entry, day) || ''));
    },
    [entry],
  );

  // Commit on blur
  const handleStBlur = useCallback(() => {
    const val = parseFloat(localSt) || 0;
    onUpdateHours(entry.id, selectedDay, 'st', val);
  }, [localSt, entry.id, selectedDay, onUpdateHours]);

  const handleOtBlur = useCallback(() => {
    const val = parseFloat(localOt) || 0;
    onUpdateHours(entry.id, selectedDay, 'ot', val);
  }, [localOt, entry.id, selectedDay, onUpdateHours]);

  const totalSt =
    entry.monSt + entry.tueSt + entry.wedSt + entry.thuSt +
    entry.friSt + entry.satSt + entry.sunSt;
  const totalOt =
    entry.monOt + entry.tueOt + entry.wedOt + entry.thuOt +
    entry.friOt + entry.satOt + entry.sunOt;
  const totalHours = totalSt + totalOt;
  const liveGross = computeGrossWages(entry);

  return (
    <div className="bg-surface-card border border-border-default rounded-card shadow-card p-4">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <p className="font-headline text-base font-semibold text-gray-900 truncate">
            {worker.name}
          </p>
          <p className="font-body text-xs text-gray-500 mt-0.5 truncate">
            {tradeDescription}
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <span className="font-body text-xs text-gray-600">
              Base: <span className="font-semibold">${entry.baseRateSnapshot.toFixed(2)}</span>
            </span>
            <span className="font-body text-xs text-gray-600">
              Fringe: <span className="font-semibold">${entry.fringeRateSnapshot.toFixed(2)}</span>
            </span>
            <Badge variant={totalHours > 0 ? 'compliant' : 'neutral'}>
              {totalHours}h total
            </Badge>
          </div>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => onDelete(entry.id)}
            aria-label="Delete payroll entry"
            className={cn(
              'min-h-[44px] min-w-[44px] flex items-center justify-center rounded-sm',
              'text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors',
              'focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-gold',
            )}
          >
            <Trash2 size={18} />
          </button>
        )}
      </div>

      {/* ── Day pills ──────────────────────────────────────────────── */}
      <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1" role="tablist" aria-label="Select day">
        {DAYS.map(({ key, label }) => {
          const dayTotal = getDayTotal(entry, key);
          const isActive = selectedDay === key;
          const hasHours = dayTotal > 0;

          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => handleSelectDay(key)}
              className={cn(
                'flex-none flex flex-col items-center min-h-[52px] min-w-[44px] px-2 py-1.5 rounded-sm text-xs font-semibold',
                'transition-colors border focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-gold',
                isActive
                  ? 'border-brand-gold text-brand-gold bg-brand-gold/10'
                  : hasHours
                    ? 'border-gray-300 text-gray-700 bg-white'
                    : 'border-gray-200 text-gray-400 bg-gray-50',
              )}
            >
              <span className="font-body">{label}</span>
              {hasHours ? (
                <span className={cn(
                  'mt-0.5 text-[10px] font-bold',
                  isActive ? 'text-brand-gold' : 'text-gray-500',
                )}>
                  {dayTotal}h
                </span>
              ) : (
                <span className="mt-0.5 text-[10px] text-gray-300">—</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Day detail: ST / OT inputs ────────────────────────────── */}
      {canEdit ? (
        <div className="grid grid-cols-2 gap-3 mb-3">
          <Input
            label="Straight time (hrs)"
            type="number"
            min={0}
            step={0.25}
            value={localSt}
            onChange={e => setLocalSt(e.target.value)}
            onBlur={handleStBlur}
            className="text-base font-body text-center"
            aria-label={`${DAYS.find(d => d.key === selectedDay)?.label} straight time hours`}
          />
          <Input
            label="Overtime (hrs)"
            type="number"
            min={0}
            step={0.25}
            value={localOt}
            onChange={e => setLocalOt(e.target.value)}
            onBlur={handleOtBlur}
            className="text-base font-body text-center"
            aria-label={`${DAYS.find(d => d.key === selectedDay)?.label} overtime hours`}
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="rounded-sm border border-gray-200 bg-gray-50 px-3 py-2">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Straight time</p>
            <p className="font-body text-base font-semibold text-gray-700">
              {getDaySt(entry, selectedDay)}h
            </p>
          </div>
          <div className="rounded-sm border border-gray-200 bg-gray-50 px-3 py-2">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Overtime</p>
            <p className="font-body text-base font-semibold text-gray-700">
              {getDayOt(entry, selectedDay)}h
            </p>
          </div>
        </div>
      )}

      {/* ── Footer: gross wages ───────────────────────────────────── */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <span className="font-body text-xs text-gray-500">Est. gross wages</span>
        <span className="font-body text-sm font-semibold text-gray-900">
          ${liveGross.toFixed(2)}
        </span>
      </div>
    </div>
  );
}
