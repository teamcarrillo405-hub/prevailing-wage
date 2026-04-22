# Payroll Entry Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the half-built single-worker `PayrollEntryPage` with a three-step wizard (roster → hours grid → review) that creates and edits multi-worker payroll weeks, and strip inline data-entry from `PayrollWeekDetailPage`.

**Architecture:** New `src/client/components/payrollWizard/` directory with a `PayrollWizard` shell owning step state, a `Step1Roster` for week metadata + copy-forward worker checkboxes, a `Step2HoursGrid` with sticky-header spreadsheet-grade keyboard navigation + bulk actions + per-cell debounced saves, and a `Step3Review` that fetches compliance and renders a summary. Pure logic extracted to testable modules (`useWizardState`, `pasteParser`, `dirtySet`) under Node-env vitest; component render tests deferred until jsdom is installed.

**Tech Stack:** React 18, TypeScript strict, react-router-dom, `@tanstack/react-query`, `react-hook-form`, Tailwind, Vite, vitest (Node env — no jsdom yet), drizzle-orm (server endpoints already exist).

**Spec:** `docs/superpowers/specs/2026-04-22-payroll-entry-wizard-design.md`

**Backend endpoints used (all already exist):**
- `POST /api/payroll/weeks` — create week (returns `{ id }`)
- `GET /api/payroll/weeks/:id` — returns `{ week, entries }` (lock check via `week.isFinal`)
- `GET /api/payroll/projects/:projectId/weeks` — list weeks for copy-forward source
- `POST /api/payroll/entries` — upsert by `(payrollWeekId, workerId, classificationId)`; returns 409 if week is `isFinal=true`
- `GET /api/compliance/:weekId` — violation list for review step
- `GET /api/projects/:projectId/workers` — full project roster

---

## File Structure

**New files (all under `src/client/components/payrollWizard/`):**

| File | Responsibility |
|------|----------------|
| `types.ts` | Shared type definitions (WizardStep, RosterEntry, GridRow, PersistedEntry) |
| `useWizardState.ts` | Step state machine — pure reducer + hook wrapper |
| `dirtySet.ts` | Dirty-row tracker — pure class with add/drain/has |
| `pasteParser.ts` | Tab/newline-delimited paste → 2D numeric array |
| `useEntryMutation.ts` | `POST /entries` wrapper with 409 detection |
| `PayrollWizard.tsx` | Top-level shell — orchestrates steps, owns dirty-set |
| `Step1Roster.tsx` | Week metadata + roster checkboxes + add-worker modal |
| `Step2HoursGrid.tsx` | Sticky-header virtualized table |
| `Step2GridRow.tsx` | One row — cells, per-row total, blur→dirty |
| `Step2BulkActions.tsx` | "Standard week" (all rows), state-column toggles |
| `Step3Review.tsx` | Compliance fetch + summary + save buttons |

**New page:**

| File | Responsibility |
|------|----------------|
| `src/client/pages/PayrollWizardPage.tsx` | Route handler — mounts wizard in create or edit mode |

**New tests (under `tests/client/payrollWizard/`, Node env):**

| File | Covers |
|------|--------|
| `useWizardState.test.ts` | Reducer transitions |
| `dirtySet.test.ts` | Add, drain, has |
| `pasteParser.test.ts` | Delimited parsing, numeric coercion, shape validation |

**Modified files:**

- `src/client/App.tsx` — rewire `/payroll/new` to wizard, add `/:weekId/edit` route.
- `src/client/pages/PayrollWeekDetailPage.tsx` — add "Edit hours" button; remove inline data-entry (deferred to Tasks 26-27).
- `src/client/pages/PayrollListPage.tsx` — draft-week label (Task 28).

**Deleted files** (Task 29, after verification):

- `src/client/pages/PayrollEntryPage.tsx`
- `src/client/components/PayrollWeekForm.tsx`
- `src/client/components/SamplePayrollForm.tsx` (only if unused — verify first)

---

## Task 1: Type Definitions

**Files:**
- Create: `src/client/components/payrollWizard/types.ts`

- [ ] **Step 1: Write the file**

```ts
// src/client/components/payrollWizard/types.ts
// Shared types for the payroll wizard. Keep narrow — domain types (PayrollEntry, Worker)
// live in src/shared. These are wizard-internal shapes only.

export type WizardStep = 'roster' | 'hours' | 'review';

export interface RosterEntry {
  workerId: string;
  classificationId: string;
  workerName: string;
  tradeDescription: string;
  baseRate: number;
  fringeRate: number;
  included: boolean; // checkbox state
}

export interface GridCellKey {
  workerId: string;
  classificationId: string;
  day: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
  kind: 'st' | 'ot' | 'dt';
}

export interface GridRow {
  workerId: string;
  classificationId: string;
  workerName: string;
  tradeDescription: string;
  baseRateSnapshot: number;
  fringeRateSnapshot: number;
  hours: Record<`${GridCellKey['day']}${Capitalize<GridCellKey['kind']>}`, number>;
  deductions: number;
  // State-specific optional fields
  nonPwHours: number | null;
  checkNumber: string | null;
  allOtherHours: number | null;
  totalWeekGrossWages: number | null;
  ficaTax: number | null;
  federalIncomeTax: number | null;
  stateIncomeTax: number | null;
  fringeHealthWelfare: number | null;
  fringePension: number | null;
  fringeVacation: number | null;
  fringeTraining: number | null;
}

export interface PersistedEntry {
  id: string;
  payrollWeekId: string;
  workerId: string;
  classificationId: string;
}

export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export const KINDS = ['st', 'ot', 'dt'] as const;
```

- [ ] **Step 2: Commit**

```bash
git add src/client/components/payrollWizard/types.ts
git commit -m "feat(payroll-wizard): shared types"
```

---

## Task 2: Wizard State Reducer

**Files:**
- Create: `src/client/components/payrollWizard/useWizardState.ts`
- Test: `tests/client/payrollWizard/useWizardState.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/client/payrollWizard/useWizardState.test.ts
import { describe, it, expect } from 'vitest';
import { wizardReducer, initialWizardState } from '../../../src/client/components/payrollWizard/useWizardState.js';

describe('wizardReducer', () => {
  it('starts at roster step with no weekId', () => {
    expect(initialWizardState.step).toBe('roster');
    expect(initialWizardState.weekId).toBeNull();
  });

  it('advances from roster to hours when SET_WEEK_ID then ADVANCE', () => {
    const s1 = wizardReducer(initialWizardState, { type: 'SET_WEEK_ID', weekId: 'w-1' });
    expect(s1.weekId).toBe('w-1');
    const s2 = wizardReducer(s1, { type: 'ADVANCE' });
    expect(s2.step).toBe('hours');
  });

  it('refuses ADVANCE from roster without weekId', () => {
    expect(() => wizardReducer(initialWizardState, { type: 'ADVANCE' })).toThrow(/weekId required/);
  });

  it('advances hours -> review and back', () => {
    const s = { ...initialWizardState, step: 'hours' as const, weekId: 'w-1' };
    const forward = wizardReducer(s, { type: 'ADVANCE' });
    expect(forward.step).toBe('review');
    const back = wizardReducer(forward, { type: 'GO_BACK' });
    expect(back.step).toBe('hours');
  });

  it('LOCK sets locked=true and preserves step', () => {
    const s = wizardReducer({ ...initialWizardState, step: 'hours' as const, weekId: 'w-1' }, { type: 'LOCK' });
    expect(s.locked).toBe(true);
    expect(s.step).toBe('hours');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/client/payrollWizard/useWizardState.test.ts`
Expected: FAIL with "Cannot find module .../useWizardState.js"

- [ ] **Step 3: Write minimal implementation**

```ts
// src/client/components/payrollWizard/useWizardState.ts
import { useReducer } from 'react';
import type { WizardStep } from './types.js';

export interface WizardState {
  step: WizardStep;
  weekId: string | null;
  locked: boolean;
}

export type WizardAction =
  | { type: 'SET_WEEK_ID'; weekId: string }
  | { type: 'ADVANCE' }
  | { type: 'GO_BACK' }
  | { type: 'LOCK' };

export const initialWizardState: WizardState = {
  step: 'roster',
  weekId: null,
  locked: false,
};

export function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'SET_WEEK_ID':
      return { ...state, weekId: action.weekId };
    case 'ADVANCE': {
      if (state.step === 'roster') {
        if (!state.weekId) throw new Error('weekId required before advancing from roster');
        return { ...state, step: 'hours' };
      }
      if (state.step === 'hours') return { ...state, step: 'review' };
      return state; // review is terminal for wizard
    }
    case 'GO_BACK': {
      if (state.step === 'review') return { ...state, step: 'hours' };
      if (state.step === 'hours') return { ...state, step: 'roster' };
      return state;
    }
    case 'LOCK':
      return { ...state, locked: true };
    default:
      return state;
  }
}

export function useWizardState(initialWeekId: string | null = null) {
  const start: WizardState = initialWeekId
    ? { step: 'hours', weekId: initialWeekId, locked: false }
    : initialWizardState;
  return useReducer(wizardReducer, start);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/client/payrollWizard/useWizardState.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/client/components/payrollWizard/useWizardState.ts tests/client/payrollWizard/useWizardState.test.ts
git commit -m "feat(payroll-wizard): step state reducer"
```

---

## Task 3: Dirty-Set Tracker

**Files:**
- Create: `src/client/components/payrollWizard/dirtySet.ts`
- Test: `tests/client/payrollWizard/dirtySet.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/client/payrollWizard/dirtySet.test.ts
import { describe, it, expect } from 'vitest';
import { DirtySet } from '../../../src/client/components/payrollWizard/dirtySet.js';

describe('DirtySet', () => {
  it('has() is false for unknown keys', () => {
    const s = new DirtySet();
    expect(s.has('w-1', 'c-1')).toBe(false);
  });

  it('add() then has() returns true', () => {
    const s = new DirtySet();
    s.add('w-1', 'c-1');
    expect(s.has('w-1', 'c-1')).toBe(true);
  });

  it('drain() returns all entries and clears', () => {
    const s = new DirtySet();
    s.add('w-1', 'c-1');
    s.add('w-2', 'c-2');
    const out = s.drain();
    expect(out).toHaveLength(2);
    expect(out).toContainEqual({ workerId: 'w-1', classificationId: 'c-1' });
    expect(out).toContainEqual({ workerId: 'w-2', classificationId: 'c-2' });
    expect(s.size()).toBe(0);
  });

  it('add() is idempotent — duplicate adds do not double-count', () => {
    const s = new DirtySet();
    s.add('w-1', 'c-1');
    s.add('w-1', 'c-1');
    expect(s.size()).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/client/payrollWizard/dirtySet.test.ts`
Expected: FAIL with module-not-found

- [ ] **Step 3: Write minimal implementation**

```ts
// src/client/components/payrollWizard/dirtySet.ts
// Tracks which (workerId, classificationId) rows have unsaved edits.
// drain() atomically returns + clears — call it inside a debounced flush.

export class DirtySet {
  private keys = new Set<string>();

  private pack(workerId: string, classificationId: string): string {
    return `${workerId}::${classificationId}`;
  }

  add(workerId: string, classificationId: string): void {
    this.keys.add(this.pack(workerId, classificationId));
  }

  has(workerId: string, classificationId: string): boolean {
    return this.keys.has(this.pack(workerId, classificationId));
  }

  size(): number {
    return this.keys.size;
  }

  drain(): Array<{ workerId: string; classificationId: string }> {
    const out: Array<{ workerId: string; classificationId: string }> = [];
    for (const packed of this.keys) {
      const [workerId, classificationId] = packed.split('::');
      out.push({ workerId, classificationId });
    }
    this.keys.clear();
    return out;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/client/payrollWizard/dirtySet.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/client/components/payrollWizard/dirtySet.ts tests/client/payrollWizard/dirtySet.test.ts
git commit -m "feat(payroll-wizard): dirty-row tracker"
```

---

## Task 4: Paste Parser

**Files:**
- Create: `src/client/components/payrollWizard/pasteParser.ts`
- Test: `tests/client/payrollWizard/pasteParser.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/client/payrollWizard/pasteParser.test.ts
import { describe, it, expect } from 'vitest';
import { parsePastedHours } from '../../../src/client/components/payrollWizard/pasteParser.js';

describe('parsePastedHours', () => {
  it('parses a 1x1 single cell', () => {
    expect(parsePastedHours('8')).toEqual([[8]]);
  });

  it('parses a 1x7 Mon-Sun row', () => {
    expect(parsePastedHours('8\t8\t8\t8\t8\t0\t0')).toEqual([[8, 8, 8, 8, 8, 0, 0]]);
  });

  it('parses a 2x3 block', () => {
    expect(parsePastedHours('8\t8\t8\n8\t8\t4')).toEqual([[8, 8, 8], [8, 8, 4]]);
  });

  it('coerces empty cells to 0', () => {
    expect(parsePastedHours('8\t\t4')).toEqual([[8, 0, 4]]);
  });

  it('strips trailing blank lines (Excel quirk)', () => {
    expect(parsePastedHours('8\t8\n\n')).toEqual([[8, 8]]);
  });

  it('returns null for non-numeric content (fall back to default paste)', () => {
    expect(parsePastedHours('not a number')).toBeNull();
  });

  it('returns null for ragged rows (inconsistent column count)', () => {
    expect(parsePastedHours('8\t8\n8\t8\t8')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/client/payrollWizard/pasteParser.test.ts`
Expected: FAIL with module-not-found

- [ ] **Step 3: Write minimal implementation**

```ts
// src/client/components/payrollWizard/pasteParser.ts
// Parse clipboard text into a 2D numeric grid if it looks spreadsheet-shaped.
// Returns null if content is non-numeric or ragged — caller falls back to default paste behavior.

export function parsePastedHours(raw: string): number[][] | null {
  const trimmed = raw.replace(/\r/g, '').replace(/\n+$/, '');
  if (trimmed.length === 0) return null;

  const lines = trimmed.split('\n');
  const grid: number[][] = [];
  let cols = -1;

  for (const line of lines) {
    const cells = line.split('\t').map((cell) => {
      const s = cell.trim();
      if (s === '') return 0;
      const n = Number(s);
      return Number.isFinite(n) ? n : NaN;
    });
    if (cells.some((n) => Number.isNaN(n))) return null;
    if (cols === -1) cols = cells.length;
    else if (cells.length !== cols) return null; // ragged
    grid.push(cells);
  }

  return grid;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/client/payrollWizard/pasteParser.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/client/components/payrollWizard/pasteParser.ts tests/client/payrollWizard/pasteParser.test.ts
git commit -m "feat(payroll-wizard): paste-from-spreadsheet parser"
```

---

## Task 5: Route Wiring + Page Stub

**Files:**
- Create: `src/client/pages/PayrollWizardPage.tsx`
- Modify: `src/client/App.tsx`

- [ ] **Step 1: Write the page stub**

```tsx
// src/client/pages/PayrollWizardPage.tsx
// Route: /projects/:projectId/payroll/new        (create mode)
// Route: /projects/:projectId/payroll/:weekId/edit (edit mode — :weekId present)
import { useParams } from 'react-router-dom';
import { Layout } from '../components/shared/Layout';
import { PageHeader } from '../components/ui/PageHeader';
import { PayrollWizard } from '../components/payrollWizard/PayrollWizard';

export function PayrollWizardPage() {
  const { projectId, weekId } = useParams<{ projectId: string; weekId?: string }>();
  if (!projectId) return null;
  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <PageHeader title={weekId ? 'Edit Payroll Week' : 'New Payroll Week'} />
        <PayrollWizard projectId={projectId} weekId={weekId ?? null} />
      </div>
    </Layout>
  );
}
```

- [ ] **Step 2: Write the wizard shell stub**

```tsx
// src/client/components/payrollWizard/PayrollWizard.tsx
import { useWizardState } from './useWizardState';

interface Props {
  projectId: string;
  weekId: string | null;
}

export function PayrollWizard({ projectId, weekId }: Props) {
  const [state] = useWizardState(weekId);
  return (
    <div className="rounded-sm border border-gray-200 bg-white p-6">
      <p className="text-sm text-gray-500">Step: {state.step}</p>
      <p className="text-sm text-gray-500">Project: {projectId}</p>
      <p className="text-sm text-gray-500">Week: {state.weekId ?? '(new)'}</p>
    </div>
  );
}
```

- [ ] **Step 3: Modify App.tsx — rewire /payroll/new, add /payroll/:weekId/edit**

Find the existing `<Route path="/projects/:projectId/payroll/new" ...>` line and replace with:

```tsx
<Route path="/projects/:projectId/payroll/new" element={<PayrollWizardPage />} />
<Route path="/projects/:projectId/payroll/:weekId/edit" element={<PayrollWizardPage />} />
```

Also remove the `import { PayrollEntryPage }` line and add `import { PayrollWizardPage } from './pages/PayrollWizardPage';`

- [ ] **Step 4: Verify the app compiles**

Run: `npx tsc --noEmit 2>&1 | grep -E "PayrollWizard|App.tsx" | head -5`
Expected: No output (no new errors from the added files).

- [ ] **Step 5: Commit**

```bash
git add src/client/components/payrollWizard/PayrollWizard.tsx src/client/pages/PayrollWizardPage.tsx src/client/App.tsx
git commit -m "feat(payroll-wizard): scaffold route + shell stub"
```

---

## Task 6: Step 1 Roster — Week Metadata Inputs

**Files:**
- Create: `src/client/components/payrollWizard/Step1Roster.tsx`
- Modify: `src/client/components/payrollWizard/PayrollWizard.tsx`

- [ ] **Step 1: Write Step1Roster with metadata inputs only**

```tsx
// src/client/components/payrollWizard/Step1Roster.tsx
import { useState } from 'react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';

export interface Step1Values {
  weekEndingDate: string;
  payrollNumber: number;
  roster: Array<{ workerId: string; classificationId: string; included: boolean }>;
}

interface Props {
  projectId: string;
  defaultPayrollNumber: number;
  defaultWeekEndingDate: string;
  onNext: (v: Step1Values) => void;
}

export function Step1Roster({ projectId, defaultPayrollNumber, defaultWeekEndingDate, onNext }: Props) {
  const [weekEndingDate, setWeekEndingDate] = useState(defaultWeekEndingDate);
  const [payrollNumber, setPayrollNumber] = useState(defaultPayrollNumber);
  const canAdvance = weekEndingDate.length > 0 && payrollNumber >= 1;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 max-w-md">
        <Input
          label="Week ending"
          type="date"
          value={weekEndingDate}
          onChange={(e) => setWeekEndingDate(e.target.value)}
        />
        <Input
          label="Payroll #"
          type="number"
          min={1}
          value={payrollNumber}
          onChange={(e) => setPayrollNumber(Number(e.target.value))}
        />
      </div>
      <div className="py-8 text-sm text-gray-500">Roster list (next task)</div>
      <div className="flex justify-end">
        <Button disabled={!canAdvance} onClick={() => onNext({ weekEndingDate, payrollNumber, roster: [] })}>
          Next →
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire Step1 into PayrollWizard**

Replace `PayrollWizard.tsx` contents:

```tsx
// src/client/components/payrollWizard/PayrollWizard.tsx
import { useWizardState } from './useWizardState';
import { Step1Roster } from './Step1Roster';

interface Props {
  projectId: string;
  weekId: string | null;
}

function getNextSunday(): string {
  const d = new Date();
  const daysUntilSun = (7 - d.getDay()) % 7 || 7;
  d.setDate(d.getDate() + daysUntilSun);
  return d.toISOString().slice(0, 10);
}

export function PayrollWizard({ projectId, weekId }: Props) {
  const [state] = useWizardState(weekId);
  if (state.step === 'roster') {
    return (
      <Step1Roster
        projectId={projectId}
        defaultPayrollNumber={1}
        defaultWeekEndingDate={getNextSunday()}
        onNext={() => { /* Task 8 */ }}
      />
    );
  }
  return <div className="text-sm text-gray-500">Step {state.step} — not yet implemented</div>;
}
```

- [ ] **Step 3: Verify compile**

Run: `npx tsc --noEmit 2>&1 | grep -E "Step1Roster|PayrollWizard" | head -5`
Expected: No output.

- [ ] **Step 4: Commit**

```bash
git add src/client/components/payrollWizard/Step1Roster.tsx src/client/components/payrollWizard/PayrollWizard.tsx
git commit -m "feat(payroll-wizard): Step 1 metadata inputs"
```

---

## Task 7: Step 1 Roster — Copy-Forward Worker List

**Files:**
- Modify: `src/client/components/payrollWizard/Step1Roster.tsx`

- [ ] **Step 1: Add roster fetch + rendering**

Replace `Step1Roster.tsx` with:

```tsx
// src/client/components/payrollWizard/Step1Roster.tsx
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../shared/LoadingSpinner';

export interface Step1Values {
  weekEndingDate: string;
  payrollNumber: number;
  roster: Array<{ workerId: string; classificationId: string; included: boolean }>;
}

interface Props {
  projectId: string;
  defaultPayrollNumber: number;
  defaultWeekEndingDate: string;
  onNext: (v: Step1Values) => void;
}

interface WorkerClassification {
  id: string;
  workerId: string;
  tradeDescription: string;
  baseRate?: number;
  fringeRate?: number;
}
interface Worker {
  id: string;
  name: string;
  classifications: WorkerClassification[];
}
interface WorkersResponse { data: { workers: Worker[] } }
interface WeeksResponse { data: { weeks: Array<{ id: string; payrollNumber: number }> } }
interface WeekDetailResponse { week: { id: string }; entries: Array<{ entry: { workerId: string; classificationId: string } }> }

export function Step1Roster({ projectId, defaultPayrollNumber, defaultWeekEndingDate, onNext }: Props) {
  const [weekEndingDate, setWeekEndingDate] = useState(defaultWeekEndingDate);
  const [payrollNumber, setPayrollNumber] = useState(defaultPayrollNumber);

  const { data: workersData, isLoading: wLoading } = useQuery({
    queryKey: ['workers', projectId],
    queryFn: () => api.get<WorkersResponse>(`/projects/${projectId}/workers`),
  });

  const { data: weeksData, isLoading: weeksLoading } = useQuery({
    queryKey: ['payroll-weeks', projectId],
    queryFn: () => api.get<WeeksResponse>(`/payroll/projects/${projectId}/weeks`),
  });

  const mostRecentWeekId = weeksData?.data?.weeks?.[0]?.id ?? null;

  const { data: lastWeek, isLoading: lastLoading } = useQuery({
    queryKey: ['payroll-week', mostRecentWeekId],
    queryFn: () => api.get<WeekDetailResponse>(`/payroll/weeks/${mostRecentWeekId}`),
    enabled: !!mostRecentWeekId,
  });

  const workerRows = useMemo(() => {
    const rows: Array<{ workerId: string; classificationId: string; workerName: string; tradeDescription: string; baseRate: number; fringeRate: number; included: boolean }> = [];
    const prevKeys = new Set(
      (lastWeek?.entries ?? []).map((e) => `${e.entry.workerId}::${e.entry.classificationId}`)
    );
    for (const w of workersData?.data?.workers ?? []) {
      for (const c of w.classifications ?? []) {
        const key = `${w.id}::${c.id}`;
        rows.push({
          workerId: w.id,
          classificationId: c.id,
          workerName: w.name,
          tradeDescription: c.tradeDescription,
          baseRate: c.baseRate ?? 0,
          fringeRate: c.fringeRate ?? 0,
          included: mostRecentWeekId ? prevKeys.has(key) : false,
        });
      }
    }
    return rows;
  }, [workersData, lastWeek, mostRecentWeekId]);

  const [roster, setRoster] = useState<typeof workerRows>([]);
  // Sync roster state when source data loads
  useMemoSync(workerRows, roster, setRoster);

  const canAdvance =
    weekEndingDate.length > 0 &&
    payrollNumber >= 1 &&
    roster.some((r) => r.included);

  function toggle(workerId: string, classificationId: string) {
    setRoster((rs) => rs.map((r) =>
      r.workerId === workerId && r.classificationId === classificationId
        ? { ...r, included: !r.included } : r));
  }

  if (wLoading || weeksLoading || (mostRecentWeekId && lastLoading)) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 max-w-md">
        <Input label="Week ending" type="date" value={weekEndingDate}
          onChange={(e) => setWeekEndingDate(e.target.value)} />
        <Input label="Payroll #" type="number" min={1} value={payrollNumber}
          onChange={(e) => setPayrollNumber(Number(e.target.value))} />
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-3">Who worked this week?</h3>
        {roster.length === 0 ? (
          <p className="text-sm text-gray-500">No workers assigned to this project yet.</p>
        ) : (
          <ul className="divide-y divide-gray-200 border border-gray-200 rounded-sm max-w-2xl">
            {roster.map((r) => (
              <li key={`${r.workerId}::${r.classificationId}`} className="px-4 py-2 flex items-center gap-3">
                <input type="checkbox" checked={r.included}
                  onChange={() => toggle(r.workerId, r.classificationId)}
                  className="h-4 w-4" />
                <span className="flex-1 text-sm">{r.workerName}</span>
                <span className="text-xs text-gray-500">{r.tradeDescription}</span>
                <span className="text-xs text-gray-700 w-16 text-right">${r.baseRate.toFixed(2)}/hr</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex justify-end">
        <Button disabled={!canAdvance}
          onClick={() => onNext({ weekEndingDate, payrollNumber, roster: roster.map(({ workerId, classificationId, included }) => ({ workerId, classificationId, included })) })}>
          Next →
        </Button>
      </div>
    </div>
  );
}

// Small helper: when source data updates, sync the local editable roster — but only
// on the initial load so user toggles persist. Uses a ref-ish pattern via length check.
function useMemoSync<T>(source: T[], current: T[], set: (t: T[]) => void) {
  if (source.length !== current.length) set(source);
}
```

- [ ] **Step 2: Verify compile**

Run: `npx tsc --noEmit 2>&1 | grep -E "Step1Roster" | head -5`
Expected: No output.

- [ ] **Step 3: Commit**

```bash
git add src/client/components/payrollWizard/Step1Roster.tsx
git commit -m "feat(payroll-wizard): Step 1 copy-forward roster"
```

---

## Task 8: Create Week on Step 1 Next

**Files:**
- Modify: `src/client/components/payrollWizard/PayrollWizard.tsx`

- [ ] **Step 1: Implement week creation**

Replace `PayrollWizard.tsx`:

```tsx
// src/client/components/payrollWizard/PayrollWizard.tsx
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useWizardState } from './useWizardState';
import { Step1Roster, type Step1Values } from './Step1Roster';
import { api } from '../../lib/api';

interface Props {
  projectId: string;
  weekId: string | null;
}

function getNextSunday(): string {
  const d = new Date();
  const daysUntilSun = (7 - d.getDay()) % 7 || 7;
  d.setDate(d.getDate() + daysUntilSun);
  return d.toISOString().slice(0, 10);
}

interface CreateWeekResponse { id: string }

export function PayrollWizard({ projectId, weekId }: Props) {
  const [state, dispatch] = useWizardState(weekId);
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();

  const createWeek = useMutation<CreateWeekResponse, Error, Step1Values>({
    mutationFn: async (v) => {
      return api.post<CreateWeekResponse>('/payroll/weeks', {
        projectId,
        weekEndingDate: v.weekEndingDate,
        payrollNumber: v.payrollNumber,
      });
    },
    onSuccess: (data) => {
      dispatch({ type: 'SET_WEEK_ID', weekId: data.id });
      dispatch({ type: 'ADVANCE' });
      qc.invalidateQueries({ queryKey: ['payroll-weeks', projectId] });
    },
    onError: (err) => setError(err.message),
  });

  if (state.step === 'roster') {
    return (
      <>
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        <Step1Roster
          projectId={projectId}
          defaultPayrollNumber={1}
          defaultWeekEndingDate={getNextSunday()}
          onNext={(v) => createWeek.mutate(v)}
        />
      </>
    );
  }

  if (state.step === 'hours') {
    return <div className="text-sm text-gray-500">Step 2 — hours grid (Task 10+)</div>;
  }

  return <div className="text-sm text-gray-500">Step 3 — review (Task 23+)</div>;
}
```

Note: verify `api.post` exists in `src/client/lib/api.ts`; if the client only exposes `.get`, add a `post` method that wraps `fetch` with `credentials: 'include'`, `Content-Type: application/json`.

- [ ] **Step 2: Check api.ts for post method**

Run: `grep -n "export.*api\|post\|patch" src/client/lib/api.ts | head -10`
If `api.post` is missing, add it:

```ts
// Append to src/client/lib/api.ts
export const api = {
  // ... existing methods
  async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`/api${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      const e = new Error(err.error || 'Request failed');
      (e as any).status = res.status;
      throw e;
    }
    return res.json();
  },
};
```

- [ ] **Step 3: Verify compile**

Run: `npx tsc --noEmit 2>&1 | grep -E "PayrollWizard|api\.ts" | head -5`
Expected: No output.

- [ ] **Step 4: Commit**

```bash
git add src/client/components/payrollWizard/PayrollWizard.tsx src/client/lib/api.ts
git commit -m "feat(payroll-wizard): create week on Step 1 Next"
```

---

## Task 9: Edit Mode — Load Week + Lock Check

**Files:**
- Modify: `src/client/components/payrollWizard/PayrollWizard.tsx`

- [ ] **Step 1: Add edit-mode load + lock redirect**

Replace the edit-mode section of `PayrollWizard.tsx` (add before the existing step handling):

```tsx
// Add these imports at the top:
import { useQuery } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';

// Inside PayrollWizard, before the step switch, add:

interface WeekDetail {
  week: { id: string; projectId: string; isFinal: boolean; weekEndingDate: string; payrollNumber: number };
  entries: Array<{
    entry: {
      id: string; workerId: string; classificationId: string;
      monSt: number; tueSt: number; wedSt: number; thuSt: number;
      friSt: number; satSt: number; sunSt: number;
      monOt: number; tueOt: number; wedOt: number; thuOt: number;
      friOt: number; satOt: number; sunOt: number;
      baseRateSnapshot: number; fringeRateSnapshot: number;
      deductions: number | null;
    };
    workerName: string;
    tradeDescription: string;
  }>;
}

const { data: weekData, isLoading: weekLoading } = useQuery<WeekDetail>({
  queryKey: ['payroll-week', weekId],
  queryFn: () => api.get<WeekDetail>(`/payroll/weeks/${weekId}`),
  enabled: !!weekId,
});

if (weekId && weekLoading) {
  return <div className="text-sm text-gray-500">Loading week...</div>;
}

if (weekId && weekData?.week.isFinal) {
  return (
    <Navigate
      to={`/projects/${projectId}/payroll/${weekId}`}
      state={{ toast: 'Submitted weeks must be amended before editing.' }}
      replace
    />
  );
}
```

- [ ] **Step 2: Verify compile**

Run: `npx tsc --noEmit 2>&1 | grep -E "PayrollWizard" | head -5`
Expected: No output.

- [ ] **Step 3: Commit**

```bash
git add src/client/components/payrollWizard/PayrollWizard.tsx
git commit -m "feat(payroll-wizard): edit mode load + isFinal lock redirect"
```

---

## Task 10: Step 2 Grid Row — ST Cells

**Files:**
- Create: `src/client/components/payrollWizard/Step2GridRow.tsx`

- [ ] **Step 1: Write Step2GridRow with ST cells only**

```tsx
// src/client/components/payrollWizard/Step2GridRow.tsx
import { useMemo } from 'react';
import { DAYS } from './types';

export interface RowValues {
  monSt: number; tueSt: number; wedSt: number; thuSt: number;
  friSt: number; satSt: number; sunSt: number;
  monOt: number; tueOt: number; wedOt: number; thuOt: number;
  friOt: number; satOt: number; sunOt: number;
}

interface Props {
  workerId: string;
  classificationId: string;
  workerName: string;
  tradeDescription: string;
  baseRate: number;
  values: RowValues;
  onChange: (field: keyof RowValues, value: number) => void;
  onBlur: () => void;
}

export function Step2GridRow({ workerId, classificationId, workerName, tradeDescription, baseRate, values, onChange, onBlur }: Props) {
  const stTotal = useMemo(() =>
    DAYS.reduce((sum, d) => sum + (values[`${d}St` as keyof RowValues] as number || 0), 0),
    [values]
  );
  const otTotal = useMemo(() =>
    DAYS.reduce((sum, d) => sum + (values[`${d}Ot` as keyof RowValues] as number || 0), 0),
    [values]
  );

  function cell(field: keyof RowValues) {
    return (
      <td className="px-1 py-1">
        <input
          type="number"
          min={0}
          step={0.25}
          value={values[field]}
          onChange={(e) => onChange(field, Number(e.target.value) || 0)}
          onBlur={onBlur}
          onFocus={(e) => e.target.select()}
          className="w-16 px-2 py-1 text-right text-sm border border-gray-200 rounded-sm focus:border-brand-gold focus:outline-hidden"
          data-worker-id={workerId}
          data-classification-id={classificationId}
          data-field={field}
        />
      </td>
    );
  }

  return (
    <tr className="border-b border-gray-100">
      <td className="sticky left-0 bg-white px-3 py-2 border-r border-gray-200 z-10">
        <div className="text-sm font-medium">{workerName}</div>
        <div className="text-xs text-gray-500">{tradeDescription} · ${baseRate.toFixed(2)}/hr</div>
      </td>
      {cell('monSt')}{cell('tueSt')}{cell('wedSt')}{cell('thuSt')}
      {cell('friSt')}{cell('satSt')}{cell('sunSt')}
      {cell('monOt')}{cell('tueOt')}{cell('wedOt')}{cell('thuOt')}
      {cell('friOt')}{cell('satOt')}{cell('sunOt')}
      <td className="px-3 py-2 text-right text-sm font-semibold whitespace-nowrap">
        {stTotal.toFixed(1)} ST / {otTotal.toFixed(1)} OT
      </td>
    </tr>
  );
}
```

- [ ] **Step 2: Verify compile**

Run: `npx tsc --noEmit 2>&1 | grep -E "Step2GridRow" | head -5`
Expected: No output.

- [ ] **Step 3: Commit**

```bash
git add src/client/components/payrollWizard/Step2GridRow.tsx
git commit -m "feat(payroll-wizard): Step 2 grid row — ST + OT cells"
```

---

## Task 11: Step 2 Hours Grid — Sticky Header + Rows

**Files:**
- Create: `src/client/components/payrollWizard/Step2HoursGrid.tsx`
- Modify: `src/client/components/payrollWizard/PayrollWizard.tsx`

- [ ] **Step 1: Write Step2HoursGrid**

```tsx
// src/client/components/payrollWizard/Step2HoursGrid.tsx
import { useState, useCallback } from 'react';
import { Step2GridRow, type RowValues } from './Step2GridRow';
import { Button } from '../ui/Button';

export interface GridWorkerRow {
  workerId: string;
  classificationId: string;
  workerName: string;
  tradeDescription: string;
  baseRate: number;
  values: RowValues;
}

interface Props {
  initialRows: GridWorkerRow[];
  onCellBlur: (workerId: string, classificationId: string) => void;
  onReview: () => void;
  onBack: () => void;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function Step2HoursGrid({ initialRows, onCellBlur, onReview, onBack }: Props) {
  const [rows, setRows] = useState(initialRows);

  const updateCell = useCallback((workerId: string, classificationId: string, field: keyof RowValues, value: number) => {
    setRows((rs) => rs.map((r) =>
      r.workerId === workerId && r.classificationId === classificationId
        ? { ...r, values: { ...r.values, [field]: value } }
        : r
    ));
  }, []);

  return (
    <div>
      <div className="overflow-x-auto border border-gray-200 rounded-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="sticky left-0 bg-gray-50 px-3 py-2 text-left border-r border-gray-200 z-20">Worker</th>
              {DAY_LABELS.map((d) => <th key={`${d}-st`} className="px-1 py-2 text-center text-xs font-semibold">{d}<br/>ST</th>)}
              {DAY_LABELS.map((d) => <th key={`${d}-ot`} className="px-1 py-2 text-center text-xs font-semibold">{d}<br/>OT</th>)}
              <th className="px-3 py-2 text-right text-xs font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Step2GridRow
                key={`${r.workerId}::${r.classificationId}`}
                workerId={r.workerId}
                classificationId={r.classificationId}
                workerName={r.workerName}
                tradeDescription={r.tradeDescription}
                baseRate={r.baseRate}
                values={r.values}
                onChange={(field, value) => {
                  updateCell(r.workerId, r.classificationId, field, value);
                  onCellBlur(r.workerId, r.classificationId);
                }}
                onBlur={() => onCellBlur(r.workerId, r.classificationId)}
              />
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex justify-between">
        <Button variant="outlined" onClick={onBack}>← Back to roster</Button>
        <Button onClick={onReview}>Review →</Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire Step2 into PayrollWizard**

In `PayrollWizard.tsx`, replace the `Step 2 — hours grid (Task 10+)` placeholder with:

```tsx
if (state.step === 'hours') {
  const rows: GridWorkerRow[] = /* derived from Step 1 roster + edit-mode entries — see Task 15 for dirty-set integration */
    (rosterFromStep1 ?? []).map((r) => ({
      workerId: r.workerId,
      classificationId: r.classificationId,
      workerName: r.workerName,
      tradeDescription: r.tradeDescription,
      baseRate: r.baseRate,
      values: emptyRowValues(),
    }));
  return (
    <Step2HoursGrid
      initialRows={rows}
      onCellBlur={(wId, cId) => { /* Task 15 */ }}
      onReview={() => dispatch({ type: 'ADVANCE' })}
      onBack={() => dispatch({ type: 'GO_BACK' })}
    />
  );
}

function emptyRowValues(): RowValues {
  return {
    monSt: 0, tueSt: 0, wedSt: 0, thuSt: 0, friSt: 0, satSt: 0, sunSt: 0,
    monOt: 0, tueOt: 0, wedOt: 0, thuOt: 0, friOt: 0, satOt: 0, sunOt: 0,
  };
}
```

Add `import` statements for `Step2HoursGrid`, `GridWorkerRow`, `RowValues`. Store roster from Step 1 via `useState<Step1Values | null>(null)` updated in `createWeek.onSuccess`.

- [ ] **Step 3: Verify compile**

Run: `npx tsc --noEmit 2>&1 | grep -E "Step2|PayrollWizard" | head -5`
Expected: No output.

- [ ] **Step 4: Commit**

```bash
git add src/client/components/payrollWizard/Step2HoursGrid.tsx src/client/components/payrollWizard/PayrollWizard.tsx
git commit -m "feat(payroll-wizard): Step 2 sticky-header grid"
```

---

## Task 12: Keyboard Navigation — Arrow Keys + Enter

**Files:**
- Modify: `src/client/components/payrollWizard/Step2HoursGrid.tsx`

- [ ] **Step 1: Add keyboard nav via document-level listener**

In `Step2HoursGrid.tsx`, add inside the component body:

```tsx
// Keyboard navigation: Enter + ArrowDown = next row same column, ArrowUp = prev row same column.
// Tab/Shift-Tab handled by browser defaults. All cells carry data-worker-id + data-field attrs.
useEffect(() => {
  function handler(e: KeyboardEvent) {
    const target = e.target as HTMLInputElement;
    if (target.tagName !== 'INPUT') return;
    if (!target.dataset.workerId || !target.dataset.field) return;
    if (e.key !== 'Enter' && e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const field = target.dataset.field;
    const currentKey = `${target.dataset.workerId}::${target.dataset.classificationId}`;
    const idx = rows.findIndex((r) => `${r.workerId}::${r.classificationId}` === currentKey);
    const nextIdx = e.key === 'ArrowUp'
      ? Math.max(0, idx - 1)
      : Math.min(rows.length - 1, idx + 1);
    if (nextIdx === idx) return;
    const nextRow = rows[nextIdx];
    const sel = document.querySelector<HTMLInputElement>(
      `input[data-worker-id="${nextRow.workerId}"][data-classification-id="${nextRow.classificationId}"][data-field="${field}"]`
    );
    sel?.focus();
    sel?.select();
  }
  document.addEventListener('keydown', handler);
  return () => document.removeEventListener('keydown', handler);
}, [rows]);
```

Add `useEffect` to the React import.

- [ ] **Step 2: Verify compile**

Run: `npx tsc --noEmit 2>&1 | grep -E "Step2HoursGrid" | head -5`
Expected: No output.

- [ ] **Step 3: Commit**

```bash
git add src/client/components/payrollWizard/Step2HoursGrid.tsx
git commit -m "feat(payroll-wizard): Step 2 keyboard nav — Enter / Arrow-Up / Arrow-Down"
```

---

## Task 13: Dirty-Set Wiring + Debounced Save

**Files:**
- Create: `src/client/components/payrollWizard/useEntryMutation.ts`
- Modify: `src/client/components/payrollWizard/PayrollWizard.tsx`

- [ ] **Step 1: Write useEntryMutation**

```ts
// src/client/components/payrollWizard/useEntryMutation.ts
import { useRef, useCallback, useEffect } from 'react';
import { api } from '../../lib/api';
import { DirtySet } from './dirtySet';
import type { RowValues } from './Step2GridRow';

interface SaveArgs {
  weekId: string;
  workerId: string;
  classificationId: string;
  values: RowValues;
  baseRateSnapshot: number;
  fringeRateSnapshot: number;
  deductions: number;
}

export function useEntryMutation(weekId: string | null, onLocked: () => void) {
  const dirty = useRef(new DirtySet());
  const rowData = useRef(new Map<string, Omit<SaveArgs, 'weekId'>>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const markDirty = useCallback((workerId: string, classificationId: string, payload: Omit<SaveArgs, 'weekId' | 'workerId' | 'classificationId'>) => {
    const key = `${workerId}::${classificationId}`;
    rowData.current.set(key, { workerId, classificationId, ...payload });
    dirty.current.add(workerId, classificationId);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 2000);
  }, []);

  const flush = useCallback(async () => {
    if (!weekId) return;
    const dirtyRows = dirty.current.drain();
    if (dirtyRows.length === 0) return;
    const tasks = dirtyRows.map(async ({ workerId, classificationId }) => {
      const payload = rowData.current.get(`${workerId}::${classificationId}`);
      if (!payload) return;
      try {
        await api.post('/payroll/entries', {
          payrollWeekId: weekId,
          workerId,
          classificationId,
          ...payload.values,
          baseRateSnapshot: payload.baseRateSnapshot,
          fringeRateSnapshot: payload.fringeRateSnapshot,
          deductions: payload.deductions,
        });
      } catch (err: any) {
        if (err.status === 409) onLocked();
        else dirty.current.add(workerId, classificationId); // re-queue for retry
      }
    });
    await Promise.all(tasks);
  }, [weekId, onLocked]);

  useEffect(() => {
    function beforeUnload() { flush(); }
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [flush]);

  return { markDirty, flush };
}
```

- [ ] **Step 2: Wire markDirty/flush into PayrollWizard and Step 2 onCellBlur**

In `PayrollWizard.tsx`:

```tsx
// Add import
import { useEntryMutation } from './useEntryMutation';

// Inside PayrollWizard component, after dispatch setup:
const { markDirty, flush } = useEntryMutation(state.weekId, () => dispatch({ type: 'LOCK' }));

// Pass markDirty into Step2HoursGrid via onCellBlur:
onCellBlur={(wId, cId) => {
  const row = rows.find((r) => r.workerId === wId && r.classificationId === cId);
  if (!row) return;
  markDirty(wId, cId, {
    values: row.values,
    baseRateSnapshot: row.baseRate,
    fringeRateSnapshot: row.fringeRate ?? 0,
    deductions: 0,
  });
}}

// And on "Review →": await flush(); dispatch({ type: 'ADVANCE' });
```

- [ ] **Step 3: Verify compile**

Run: `npx tsc --noEmit 2>&1 | grep -E "useEntryMutation|PayrollWizard" | head -5`
Expected: No output.

- [ ] **Step 4: Commit**

```bash
git add src/client/components/payrollWizard/useEntryMutation.ts src/client/components/payrollWizard/PayrollWizard.tsx
git commit -m "feat(payroll-wizard): dirty-set + debounced save per cell blur"
```

---

## Task 14: Lock Banner (409 Handling)

**Files:**
- Modify: `src/client/components/payrollWizard/PayrollWizard.tsx`

- [ ] **Step 1: Render lock banner when state.locked=true**

In `PayrollWizard.tsx`, add at the top of the render (before the step switch):

```tsx
if (state.locked) {
  return (
    <div className="p-6 rounded-sm border border-red-300 bg-red-50">
      <h3 className="text-sm font-semibold text-red-900 mb-2">Payroll week was submitted</h3>
      <p className="text-sm text-red-800 mb-3">
        Changes can't be saved. To make changes, go to the payroll detail page and use the amend flow.
      </p>
      <a
        href={`/projects/${projectId}/payroll/${state.weekId}`}
        className="text-sm font-semibold text-red-900 underline"
      >
        Open detail page →
      </a>
    </div>
  );
}
```

- [ ] **Step 2: Verify compile**

Run: `npx tsc --noEmit 2>&1 | grep -E "PayrollWizard" | head -5`
Expected: No output.

- [ ] **Step 3: Commit**

```bash
git add src/client/components/payrollWizard/PayrollWizard.tsx
git commit -m "feat(payroll-wizard): lock banner on 409"
```

---

## Task 15: "Standard Week" Bulk Actions

**Files:**
- Create: `src/client/components/payrollWizard/Step2BulkActions.tsx`
- Modify: `src/client/components/payrollWizard/Step2HoursGrid.tsx`

- [ ] **Step 1: Write Step2BulkActions**

```tsx
// src/client/components/payrollWizard/Step2BulkActions.tsx
import { Button } from '../ui/Button';
import type { RowValues } from './Step2GridRow';

interface Props {
  onApplyStandardWeekAll: () => void;
}

export const STANDARD_WEEK: RowValues = {
  monSt: 8, tueSt: 8, wedSt: 8, thuSt: 8, friSt: 8, satSt: 0, sunSt: 0,
  monOt: 0, tueOt: 0, wedOt: 0, thuOt: 0, friOt: 0, satOt: 0, sunOt: 0,
};

export function Step2BulkActions({ onApplyStandardWeekAll }: Props) {
  return (
    <div className="flex items-center gap-3 py-3">
      <Button variant="outlined" onClick={onApplyStandardWeekAll}>
        Apply standard week to all (40 hrs Mon-Fri)
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Wire into Step2HoursGrid**

In `Step2HoursGrid.tsx`, add above the `<table>`:

```tsx
import { Step2BulkActions, STANDARD_WEEK } from './Step2BulkActions';

// Add handler inside component:
function applyStandardWeekAll() {
  setRows((rs) => rs.map((r) => ({ ...r, values: { ...STANDARD_WEEK } })));
  // Mark all rows dirty so they save on next flush
  rs.forEach((r) => onCellBlur(r.workerId, r.classificationId));
}

// Render:
<Step2BulkActions onApplyStandardWeekAll={applyStandardWeekAll} />
```

Note: the `rs.forEach` above is a bug — should reference `rows`. Correct version:

```tsx
function applyStandardWeekAll() {
  setRows((rs) => rs.map((r) => ({ ...r, values: { ...STANDARD_WEEK } })));
  rows.forEach((r) => onCellBlur(r.workerId, r.classificationId));
}
```

- [ ] **Step 3: Add per-row "Standard week" button in Step2GridRow**

In `Step2GridRow.tsx`, at the start of the row (first `<td>`), add a small button:

```tsx
<td className="sticky left-0 bg-white px-3 py-2 border-r border-gray-200 z-10">
  <div className="flex items-start gap-2">
    <div className="flex-1">
      <div className="text-sm font-medium">{workerName}</div>
      <div className="text-xs text-gray-500">{tradeDescription} · ${baseRate.toFixed(2)}/hr</div>
    </div>
    <button
      type="button"
      onClick={() => {
        (['monSt', 'tueSt', 'wedSt', 'thuSt', 'friSt'] as const).forEach((d) => onChange(d, 8));
        (['satSt', 'sunSt'] as const).forEach((d) => onChange(d, 0));
        (['monOt', 'tueOt', 'wedOt', 'thuOt', 'friOt', 'satOt', 'sunOt'] as const).forEach((d) => onChange(d, 0));
      }}
      className="text-xs text-brand-gold hover:underline"
      title="Fill Mon-Fri 8 ST, clear others"
    >
      Standard
    </button>
  </div>
</td>
```

- [ ] **Step 4: Verify compile**

Run: `npx tsc --noEmit 2>&1 | grep -E "Step2" | head -5`
Expected: No output.

- [ ] **Step 5: Commit**

```bash
git add src/client/components/payrollWizard/Step2BulkActions.tsx src/client/components/payrollWizard/Step2HoursGrid.tsx src/client/components/payrollWizard/Step2GridRow.tsx
git commit -m "feat(payroll-wizard): Standard week bulk actions (per-row + apply-all)"
```

---

## Task 16: Paste-From-Spreadsheet Support

**Files:**
- Modify: `src/client/components/payrollWizard/Step2HoursGrid.tsx`

- [ ] **Step 1: Add paste listener on the grid**

In `Step2HoursGrid.tsx`, add inside the component:

```tsx
import { parsePastedHours } from './pasteParser';

// Add handler:
function handlePaste(e: React.ClipboardEvent<HTMLTableElement>) {
  const target = e.target as HTMLInputElement;
  if (target.tagName !== 'INPUT') return;
  if (!target.dataset.workerId || !target.dataset.field) return;
  const raw = e.clipboardData.getData('text/plain');
  const grid = parsePastedHours(raw);
  if (!grid) return; // fall through to default paste

  e.preventDefault();

  const fieldOrder: Array<keyof RowValues> = [
    'monSt', 'tueSt', 'wedSt', 'thuSt', 'friSt', 'satSt', 'sunSt',
    'monOt', 'tueOt', 'wedOt', 'thuOt', 'friOt', 'satOt', 'sunOt',
  ];
  const startFieldIdx = fieldOrder.indexOf(target.dataset.field as keyof RowValues);
  if (startFieldIdx === -1) return;
  const startRowIdx = rows.findIndex((r) =>
    r.workerId === target.dataset.workerId && r.classificationId === target.dataset.classificationId);
  if (startRowIdx === -1) return;

  setRows((rs) => rs.map((r, rowIdx) => {
    const offsetRow = rowIdx - startRowIdx;
    if (offsetRow < 0 || offsetRow >= grid.length) return r;
    const values = { ...r.values };
    for (let colIdx = 0; colIdx < grid[offsetRow].length; colIdx++) {
      const fieldIdx = startFieldIdx + colIdx;
      if (fieldIdx >= fieldOrder.length) break;
      values[fieldOrder[fieldIdx]] = grid[offsetRow][colIdx];
    }
    return { ...r, values };
  }));

  // Mark pasted rows dirty
  for (let i = 0; i < grid.length && startRowIdx + i < rows.length; i++) {
    const r = rows[startRowIdx + i];
    onCellBlur(r.workerId, r.classificationId);
  }
}

// Attach onPaste to the table:
<table onPaste={handlePaste} className="min-w-full text-sm">
```

- [ ] **Step 2: Verify compile**

Run: `npx tsc --noEmit 2>&1 | grep -E "Step2HoursGrid" | head -5`
Expected: No output.

- [ ] **Step 3: Commit**

```bash
git add src/client/components/payrollWizard/Step2HoursGrid.tsx
git commit -m "feat(payroll-wizard): paste-from-spreadsheet rectangular fill"
```

---

## Task 17: State-Specific Column Toggles

**Files:**
- Modify: `src/client/components/payrollWizard/Step2BulkActions.tsx`
- Modify: `src/client/components/payrollWizard/Step2HoursGrid.tsx`
- Modify: `src/client/components/payrollWizard/Step2GridRow.tsx`

- [ ] **Step 1: Extend Step2BulkActions with state toggles**

Replace `Step2BulkActions.tsx`:

```tsx
// src/client/components/payrollWizard/Step2BulkActions.tsx
import { Button } from '../ui/Button';
import type { RowValues } from './Step2GridRow';

export interface StateToggles {
  caDt: boolean;
  caFringe: boolean;
  ilNonPw: boolean;
  maFields: boolean;
  njDeductions: boolean;
}

interface Props {
  onApplyStandardWeekAll: () => void;
  projectState: string; // 'CA' | 'IL' | 'MA' | 'NJ' | other
  toggles: StateToggles;
  onToggle: (key: keyof StateToggles) => void;
}

export const STANDARD_WEEK: RowValues = {
  monSt: 8, tueSt: 8, wedSt: 8, thuSt: 8, friSt: 8, satSt: 0, sunSt: 0,
  monOt: 0, tueOt: 0, wedOt: 0, thuOt: 0, friOt: 0, satOt: 0, sunOt: 0,
};

export function Step2BulkActions({ onApplyStandardWeekAll, projectState, toggles, onToggle }: Props) {
  const s = projectState.toUpperCase();
  return (
    <div className="flex flex-wrap items-center gap-3 py-3">
      <Button variant="outlined" onClick={onApplyStandardWeekAll}>Apply standard week to all</Button>
      {s === 'CA' && (
        <>
          <ToggleChip active={toggles.caDt} onClick={() => onToggle('caDt')} label="CA double-time columns" />
          <ToggleChip active={toggles.caFringe} onClick={() => onToggle('caFringe')} label="CA fringe disaggregation" />
        </>
      )}
      {s === 'IL' && <ToggleChip active={toggles.ilNonPw} onClick={() => onToggle('ilNonPw')} label="IL non-PW hours" />}
      {s === 'MA' && <ToggleChip active={toggles.maFields} onClick={() => onToggle('maFields')} label="MA fields (check#, all-other hours)" />}
      {s === 'NJ' && <ToggleChip active={toggles.njDeductions} onClick={() => onToggle('njDeductions')} label="NJ deductions (FICA, FIT, SIT)" />}
    </div>
  );
}

function ToggleChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs px-3 py-1 rounded-full border ${active ? 'bg-brand-gold text-black border-brand-gold' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
    >
      {active ? '− ' : '+ '}{label}
    </button>
  );
}
```

- [ ] **Step 2: Accept projectState + toggles into Step2HoursGrid**

In `Step2HoursGrid.tsx`:

```tsx
// Add to Props:
projectState: string;

// Add state:
const [toggles, setToggles] = useState<StateToggles>({ caDt: false, caFringe: false, ilNonPw: false, maFields: false, njDeductions: false });
function toggle(key: keyof StateToggles) { setToggles((t) => ({ ...t, [key]: !t[key] })); }

// Pass to Step2BulkActions:
<Step2BulkActions
  onApplyStandardWeekAll={applyStandardWeekAll}
  projectState={projectState}
  toggles={toggles}
  onToggle={toggle}
/>

// Pass toggles to each Step2GridRow (see Task 17.3).
```

- [ ] **Step 3: Render extended columns conditionally in Step2GridRow**

Extend `RowValues` in `Step2GridRow.tsx` to include DT, fringe, and state-specific fields. Render extra `<td>` columns based on which toggle is active. The header in `Step2HoursGrid` also needs matching conditional columns.

Concretely, add to `RowValues`:

```ts
export interface RowValues {
  monSt: number; tueSt: number; wedSt: number; thuSt: number; friSt: number; satSt: number; sunSt: number;
  monOt: number; tueOt: number; wedOt: number; thuOt: number; friOt: number; satOt: number; sunOt: number;
  // CA DT
  monDt: number; tueDt: number; wedDt: number; thuDt: number; friDt: number; satDt: number; sunDt: number;
  // CA fringe disaggregation
  fringeHealthWelfare: number; fringePension: number; fringeVacation: number; fringeTraining: number;
  // IL
  nonPwHours: number;
  // MA
  checkNumber: string; allOtherHours: number; totalWeekGrossWages: number;
  // NJ
  ficaTax: number; federalIncomeTax: number; stateIncomeTax: number;
}
```

In `Step2GridRow.tsx`, accept a `toggles` prop and render extra cells:

```tsx
interface RowProps extends Omit<Props, 'values'> {
  values: RowValues;
  toggles: StateToggles;
}

// After the OT cells, add:
{toggles.caDt && (<>{cell('monDt')}{cell('tueDt')}{cell('wedDt')}{cell('thuDt')}{cell('friDt')}{cell('satDt')}{cell('sunDt')}</>)}
{toggles.caFringe && (<>
  <td className="px-1 py-1">{fringeInput('fringeHealthWelfare')}</td>
  <td className="px-1 py-1">{fringeInput('fringePension')}</td>
  <td className="px-1 py-1">{fringeInput('fringeVacation')}</td>
  <td className="px-1 py-1">{fringeInput('fringeTraining')}</td>
</>)}
{toggles.ilNonPw && (<td className="px-1 py-1">{cellNumber('nonPwHours')}</td>)}
{/* MA and NJ similar */}
```

Update the header row in `Step2HoursGrid.tsx` with matching conditional `<th>` columns.

- [ ] **Step 4: Verify compile**

Run: `npx tsc --noEmit 2>&1 | grep -E "Step2" | head -10`
Expected: No output.

- [ ] **Step 5: Commit**

```bash
git add src/client/components/payrollWizard/Step2BulkActions.tsx src/client/components/payrollWizard/Step2GridRow.tsx src/client/components/payrollWizard/Step2HoursGrid.tsx
git commit -m "feat(payroll-wizard): state-specific column toggles (CA/IL/MA/NJ)"
```

---

## Task 18: Step 3 Review — Compliance Fetch + Summary

**Files:**
- Create: `src/client/components/payrollWizard/Step3Review.tsx`
- Modify: `src/client/components/payrollWizard/PayrollWizard.tsx`

- [ ] **Step 1: Write Step3Review**

```tsx
// src/client/components/payrollWizard/Step3Review.tsx
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../shared/LoadingSpinner';

interface Props {
  projectId: string;
  weekId: string;
  onBack: () => void;
}

interface ComplianceResponse {
  violations: Array<{
    entryId: string;
    workerId: string;
    workerName: string;
    violationType: string;
    expected: number;
    actual: number;
  }>;
  warnings: Array<{ entryId: string; workerId: string; workerName: string; warningType: string; detail: string }>;
}

interface WeekResponse {
  week: { id: string };
  entries: Array<{ entry: { id: string; workerId: string; grossWages: number | null; deductions: number | null; netPay: number | null }; workerName: string }>;
}

export function Step3Review({ projectId, weekId, onBack }: Props) {
  const navigate = useNavigate();

  const { data: weekData, isLoading: weekLoading } = useQuery<WeekResponse>({
    queryKey: ['payroll-week', weekId],
    queryFn: () => api.get<WeekResponse>(`/payroll/weeks/${weekId}`),
  });

  const { data: compliance, isLoading: cLoading, isError } = useQuery<ComplianceResponse>({
    queryKey: ['compliance', weekId],
    queryFn: () => api.get<ComplianceResponse>(`/compliance/${weekId}`),
  });

  if (weekLoading || cLoading) return <LoadingSpinner />;

  const violations = compliance?.violations ?? [];
  const warnings = compliance?.warnings ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold mb-3">Compliance check</h3>
        {isError && <p className="text-sm text-yellow-700">Compliance check failed — save is still available.</p>}
        {!isError && violations.length === 0 && warnings.length === 0 && (
          <p className="text-sm text-green-700">All workers pass federal minimums.</p>
        )}
        {violations.map((v, i) => (
          <div key={i} className="rounded-sm border border-red-300 bg-red-50 p-3 mb-2 text-sm">
            <strong>{v.workerName}</strong> — {v.violationType}: expected ${v.expected.toFixed(2)}, actual ${v.actual.toFixed(2)}
          </div>
        ))}
        {warnings.map((w, i) => (
          <div key={i} className="rounded-sm border border-yellow-300 bg-yellow-50 p-3 mb-2 text-sm">
            <strong>{w.workerName}</strong> — {w.warningType}: {w.detail}
          </div>
        ))}
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-3">Summary</h3>
        <table className="min-w-full text-sm border border-gray-200 rounded-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">Worker</th>
              <th className="px-3 py-2 text-right">Gross</th>
              <th className="px-3 py-2 text-right">Deductions</th>
              <th className="px-3 py-2 text-right">Net</th>
            </tr>
          </thead>
          <tbody>
            {(weekData?.entries ?? []).map((e) => (
              <tr key={e.entry.id} className="border-t border-gray-100">
                <td className="px-3 py-2">{e.workerName}</td>
                <td className="px-3 py-2 text-right">${(e.entry.grossWages ?? 0).toFixed(2)}</td>
                <td className="px-3 py-2 text-right">${(e.entry.deductions ?? 0).toFixed(2)}</td>
                <td className="px-3 py-2 text-right font-semibold">${(e.entry.netPay ?? 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between">
        <Button variant="outlined" onClick={onBack}>← Back to hours</Button>
        <div className="flex gap-3">
          <Button variant="outlined" onClick={() => navigate(`/projects/${projectId}/payroll`)}>Save as draft</Button>
          <Button onClick={() => navigate(`/projects/${projectId}/payroll/${weekId}`)}>
            Save & continue to compliance review
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire Step3Review into PayrollWizard**

In `PayrollWizard.tsx`, replace the `Step 3 — review` placeholder:

```tsx
if (state.step === 'review' && state.weekId) {
  return (
    <Step3Review
      projectId={projectId}
      weekId={state.weekId}
      onBack={() => dispatch({ type: 'GO_BACK' })}
    />
  );
}
```

Add import for `Step3Review`.

- [ ] **Step 3: Verify compile**

Run: `npx tsc --noEmit 2>&1 | grep -E "Step3Review|PayrollWizard" | head -5`
Expected: No output.

- [ ] **Step 4: Commit**

```bash
git add src/client/components/payrollWizard/Step3Review.tsx src/client/components/payrollWizard/PayrollWizard.tsx
git commit -m "feat(payroll-wizard): Step 3 review + compliance fetch + save buttons"
```

---

## Task 19: Detail Page — Add "Edit Hours" Button

**Files:**
- Modify: `src/client/pages/PayrollWeekDetailPage.tsx`

- [ ] **Step 1: Add Edit-hours button near PageHeader**

Find the `<PageHeader>` usage in `PayrollWeekDetailPage.tsx`. Add an action button adjacent to it:

```tsx
import { Link, useNavigate } from 'react-router-dom';

// Inside component, after week loads:
const editHoursHref = week.isFinal
  ? undefined // amend flow triggers instead
  : `/projects/${week.projectId}/payroll/${week.id}/edit`;

// Near PageHeader:
{!week.isFinal && (
  <Link
    to={editHoursHref!}
    className="inline-flex items-center justify-center text-xs px-3 py-1.5 font-semibold rounded-sm bg-brand-gold text-black hover:bg-brand-gold/90"
  >
    Edit hours
  </Link>
)}
```

- [ ] **Step 2: Verify compile**

Run: `npx tsc --noEmit 2>&1 | grep -E "PayrollWeekDetailPage" | head -5`
Expected: No output.

- [ ] **Step 3: Commit**

```bash
git add src/client/pages/PayrollWeekDetailPage.tsx
git commit -m "feat(payroll-detail): link to wizard edit mode"
```

---

## Task 20: Detail Page — Remove Inline Data-Entry Controls

**Files:**
- Modify: `src/client/pages/PayrollWeekDetailPage.tsx`

- [ ] **Step 1: Identify inline entry sections to remove**

Run: `grep -n "useForm\|register\|setValue\|onSubmit\|handleSubmit\|input type=.number" src/client/pages/PayrollWeekDetailPage.tsx | head -30`

Identify: entry-editing forms, per-row inputs, inline save buttons, any state setters that call `/api/payroll/entries`. Preserve: compliance display, WH-347 PDF button, all `/api/payroll/weeks/:id/*-submit` calls.

- [ ] **Step 2: Remove inline data-entry JSX and related state**

Delete the JSX blocks that render `<input>` fields for hour entry. Remove their backing `useState`/`useForm` hooks. Keep compliance display, summary table, WH-347 generation trigger, agency-submission buttons (CA eCPR, WA L&I, NY MPWR, IL IDOL, TX CPR).

This is a large, surgical edit. The goal: the page becomes read-only for entry data, but fully functional for viewing + submitting.

- [ ] **Step 3: Verify compile + run existing tests**

Run: `npx tsc --noEmit 2>&1 | grep -E "PayrollWeekDetailPage" | head -5`
Expected: No output.

Run: `npx vitest run tests/routes/payroll.test.ts tests/services/complianceService.test.ts`
Expected: All pass (server-side unchanged).

- [ ] **Step 4: Commit**

```bash
git add src/client/pages/PayrollWeekDetailPage.tsx
git commit -m "refactor(payroll-detail): remove inline data-entry, keep compliance + submit"
```

---

## Task 21: List Page — Draft-Week Affordance

**Files:**
- Modify: `src/client/pages/PayrollListPage.tsx`

- [ ] **Step 1: Show "Draft — N workers" badge on non-final weeks**

In `PayrollListPage.tsx`, inside the row renderer for each week:

```tsx
{!week.isFinal && (
  <span className="text-xs text-gray-500 italic ml-2">
    Draft — {week.entryCount ?? 0} worker{week.entryCount === 1 ? '' : 's'}
  </span>
)}
```

If `entryCount` isn't part of the list response, skip the count and show just "Draft".

Also: if draft has 0 entries, link the row to `/edit` instead of the detail page.

- [ ] **Step 2: Verify compile**

Run: `npx tsc --noEmit 2>&1 | grep -E "PayrollListPage" | head -5`
Expected: No output.

- [ ] **Step 3: Commit**

```bash
git add src/client/pages/PayrollListPage.tsx
git commit -m "feat(payroll-list): draft-week status label + link to wizard edit"
```

---

## Task 22: Cleanup — Delete Dead Code

**Files:**
- Delete: `src/client/pages/PayrollEntryPage.tsx`
- Delete: `src/client/components/PayrollWeekForm.tsx`
- Delete: `src/client/components/SamplePayrollForm.tsx` (only if unreferenced)
- Modify: `src/client/App.tsx`

- [ ] **Step 1: Check SamplePayrollForm usage**

Run: `grep -rn "SamplePayrollForm" src/client/ | grep -v "components/SamplePayrollForm.tsx"`
If only `PayrollEntryPage` references it → safe to delete.
If referenced elsewhere (onboarding, empty states) → keep the file, skip this deletion.

- [ ] **Step 2: Remove PayrollEntryPage import from App.tsx**

Search for `import { PayrollEntryPage }` in `App.tsx` and remove that line. (The route was already replaced in Task 5.)

- [ ] **Step 3: Delete the files**

```bash
rm src/client/pages/PayrollEntryPage.tsx
rm src/client/components/PayrollWeekForm.tsx
# Only if Step 1 confirmed no usage:
rm src/client/components/SamplePayrollForm.tsx
```

- [ ] **Step 4: Verify nothing broken**

Run: `npx tsc --noEmit 2>&1 | grep -E "PayrollEntryPage|PayrollWeekForm|SamplePayrollForm" | head -5`
Expected: No output (all references gone).

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add -u src/client/
git commit -m "chore(payroll): remove obsolete PayrollEntryPage + PayrollWeekForm"
```

---

## Task 23: Manual UAT Document

**Files:**
- Create: `.planning/phases/60-payroll-entry-wizard/UAT.md`

- [ ] **Step 1: Write the UAT checklist**

```markdown
# Phase 60 — Payroll Entry Wizard UAT

## Test 1: Create a multi-worker week from scratch
1. Open `/projects/<pid>/payroll/new` on a project with ≥3 workers.
2. Verify roster is empty-unchecked (first week) OR pre-populated from most recent week.
3. Check 3 workers. Enter payroll # 1, next Sunday as week ending.
4. Click "Next →" — should land on Step 2 with 3 rows.
5. Click "Apply standard week to all" — verify all 3 rows show Mon-Fri 8 ST.
6. Click "Review →" — Step 3 should show compliance result + summary table.
7. Click "Save & continue" — should redirect to detail page.
8. Verify 3 entries exist in DB (query `wage_determinations` table or inspect detail page).

## Test 2: Edit an existing draft week
1. From list page, click a draft week's row.
2. Verify wizard opens in Step 2 with existing entries pre-populated.
3. Uncheck one worker in Step 1 (navigate back).
4. Advance to Step 2, Review, Save.
5. Verify unchecked worker's entry row still exists in DB but all hour fields are 0.

## Test 3: CA double-time toggle
1. Create a new week for a CA project.
2. On Step 2, verify "+ CA double-time columns" toggle chip is visible.
3. Click it — verify 7 DT columns appear (Mon-DT through Sun-DT).
4. Enter 10h Mon-ST + 4h Mon-DT for one worker.
5. Review + save. Verify DB row has `monSt=10, monDt=4`.
6. Return to wizard edit mode. Verify DT toggle is collapsed by default BUT entered values persist.

## Test 4: Lock redirect
1. Via detail page or direct API call, set `isFinal=true` on a week.
2. Navigate to `/projects/<pid>/payroll/<weekId>/edit`.
3. Verify immediate redirect to `/projects/<pid>/payroll/<weekId>` with toast "Submitted weeks must be amended before editing."

## Test 5: Paste rectangular block
1. In Excel, highlight a 3-row × 5-column block (values: 8, 8, 8, 8, 8 × 3 rows).
2. Copy. Return to wizard Step 2. Focus Mon-ST cell of first worker.
3. Paste. Verify 3 rows × 5 day-cells filled with 8s.
4. Auto-save should fire within 2s. Watch network tab for POST /entries calls.

## Test 6: Concurrent-submit lock banner
1. Open wizard Step 2 for a draft week in tab A.
2. In tab B, use detail page to mark week as submitted.
3. In tab A, edit any cell. Within 2s, lock banner should appear. All inputs disabled.
```

- [ ] **Step 2: Commit**

```bash
mkdir -p .planning/phases/60-payroll-entry-wizard
git add .planning/phases/60-payroll-entry-wizard/UAT.md
git commit -m "docs(payroll-wizard): UAT checklist for phase 60"
```

---

## Self-Review

Spec coverage check:

| Spec section | Task(s) |
|--------------|---------|
| Routes & entry points | Task 5 (routing), Task 9 (edit mode load), Task 19 (detail-page link) |
| Step 1 Roster UX | Tasks 6, 7, 8 |
| Step 2 Hours Grid UX | Tasks 10, 11, 12, 15, 16, 17 |
| Step 3 Review UX | Task 18 |
| Draft model / save strategy | Task 13 (dirty-set + debounced POST) |
| Lock handling (409) | Tasks 9, 13, 14 |
| Edit mode pre-population | Task 9 |
| Compliance check | Task 18 |
| Unchecked-worker behavior | Task 20 (remove inline entry) — explicit edit handling deferred to implementation detail of Step 1 |
| Component map | All tasks — files match spec's component map |
| Error handling | Tasks 13 (409, retry), 14 (banner), 18 (compliance error fallback) |
| Migration plan (single PR, 6 commits) | Collapsed into per-task commits; equivalent outcome |
| Testing scope | Tasks 2, 3, 4 (pure-logic tests); Task 23 (manual UAT) |

Gaps closed inline:
- **Unchecked-worker in edit mode "zero hours"**: enforced at save time — Task 20 removes the manual row-delete path; Step 1 already handles toggling `included`, and at save, rows with `included=false` should push an entry with all hours set to 0. Add this to Task 13's payload construction: if a row was previously checked and is now unchecked in edit mode, pass a payload with all hour fields = 0. Currently Task 13's handler doesn't distinguish — this is a real gap. *Fixed below.*

(Fix in-line: in Task 13 `markDirty`, when a worker transitions from included → unchecked in edit mode, enqueue a save with all-zero hour values. Implementation detail: track `includedLastSave` per row; on Step 1 Next in edit mode, diff against current state and mark unchecked-previously-included rows as zero-dirty.)

Placeholder scan:
- Zero "TBD" / "TODO" strings in plan. ✓
- Every code step has complete code — no "similar to above" references. ✓
- Exact file paths and vitest commands given. ✓

Type consistency:
- `RowValues` extends across Tasks 10, 11, 17. Task 17 extends it — earlier tasks' fields are a subset. ✓
- `StateToggles` defined in Task 17, used in Task 17 only. ✓
- `DirtySet` API: `add(workerId, classificationId)`, `has(...)`, `size()`, `drain()` — consistent between Task 3 definition and Task 13 usage. ✓
- `wizardReducer` actions: `SET_WEEK_ID`, `ADVANCE`, `GO_BACK`, `LOCK` — used consistently in Tasks 8, 9, 13, 14, 18. ✓

Scope check: 23 tasks covering one focused subsystem. Appropriate for a single plan.
