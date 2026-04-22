// src/client/components/payrollWizard/Step2BulkActions.tsx
import { Button } from '../ui/Button';
import type { RowValues } from './Step2GridRow';

interface Props {
  onApplyStandardWeekAll: () => void;
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
  ficaTax: null, federalIncomeTax: null, stateIncomeTax: null,
};

export function Step2BulkActions({ onApplyStandardWeekAll }: Props) {
  return (
    <div className="flex items-center gap-3 py-3">
      <Button variant="secondary" onClick={onApplyStandardWeekAll}>
        Apply standard week to all (40 hrs Mon-Fri)
      </Button>
    </div>
  );
}
