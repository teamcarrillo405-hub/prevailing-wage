// src/client/components/payrollWizard/Step2BulkActions.tsx
import { Button } from '../ui/Button';
import type { RowValues } from './Step2GridRow';

export interface StateToggles {
  caDt: boolean;
  caFringe: boolean;
  caFica: boolean;
  ilNonPw: boolean;
  maFields: boolean;
  njDeductions: boolean;
}

interface Props {
  onApplyStandardWeekAll: () => void;
  projectState: string;
  toggles: StateToggles;
  onToggle: (key: keyof StateToggles) => void;
}

// Mon-Fri 8 ST, all else 0. Used by per-row and apply-all buttons.
// Extras (CA fringe disag / IL / MA / NJ) set to null — unchanged by "Standard week".
export const STANDARD_WEEK: RowValues = {
  monSt: 8, tueSt: 8, wedSt: 8, thuSt: 8, friSt: 8, satSt: 0, sunSt: 0,
  monOt: 0, tueOt: 0, wedOt: 0, thuOt: 0, friOt: 0, satOt: 0, sunOt: 0,
  monDt: 0, tueDt: 0, wedDt: 0, thuDt: 0, friDt: 0, satDt: 0, sunDt: 0,
  fringeHealthWelfare: null, fringePension: null, fringeVacation: null, fringeTraining: null,
  nonPwHours: null,
  checkNumber: null, allOtherHours: null, totalWeekGrossWages: null,
  ficaTax: null, federalIncomeTax: null, stateIncomeTax: null, sdiTax: null,
};

function ToggleChip({ active, onClick, label, title }: { active: boolean; onClick: () => void; label: string; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`text-xs px-3 py-1 rounded-full border transition-colors ${
        active
          ? 'bg-brand-gold text-nav-dark border-brand-gold'
          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
      }`}
    >
      {active ? '− ' : '+ '}{label}
    </button>
  );
}

export function Step2BulkActions({ onApplyStandardWeekAll, projectState, toggles, onToggle }: Props) {
  const s = projectState.toUpperCase();
  return (
    <div className="flex flex-wrap items-center gap-3 py-3">
      <Button
        variant="secondary"
        onClick={onApplyStandardWeekAll}
        title="Fills all workers with 8 hours Mon–Fri (40h straight time, no OT)"
      >
        Apply standard week to all (40 hrs Mon-Fri)
      </Button>
      {(s === 'CA' || s === 'IL' || s === 'MA' || s === 'NJ') && (
        <span className="text-xs text-gray-500 whitespace-nowrap">State columns:</span>
      )}
      {s === 'CA' && (
        <>
          <ToggleChip
            active={toggles.caDt}
            onClick={() => onToggle('caDt')}
            label="CA double-time columns"
            title="Show daily double-time columns — required for CA Labor Code §510 (hours over 12/day or 8/day on 7th day)"
          />
          <ToggleChip
            active={toggles.caFringe}
            onClick={() => onToggle('caFringe')}
            label="CA fringe disaggregation"
            title="Show fringe benefit disaggregation — required if paying fringe components separately (H&W, Pension, Vacation, Training)"
          />
          <ToggleChip
            active={toggles.caFica}
            onClick={() => onToggle('caFica')}
            label="CA deductions (FICA, FIT, SIT)"
            title="Show tax withholding columns — FICA, Federal/State income tax, SDI"
          />
        </>
      )}
      {s === 'IL' && (
        <ToggleChip
          active={toggles.ilNonPw}
          onClick={() => onToggle('ilNonPw')}
          label="IL non-PW hours"
          title="Show non-prevailing-wage hours — for IL projects mixing public and private work"
        />
      )}
      {s === 'MA' && (
        <ToggleChip
          active={toggles.maFields}
          onClick={() => onToggle('maFields')}
          label="MA fields (check #, all-other hours)"
          title="Show MA-required fields — check number, all-other hours, total gross wages"
        />
      )}
      {s === 'NJ' && (
        <ToggleChip
          active={toggles.njDeductions}
          onClick={() => onToggle('njDeductions')}
          label="NJ deductions (FICA, FIT, SIT)"
          title="Show NJ deduction columns — FICA, Federal/State income tax"
        />
      )}
    </div>
  );
}
