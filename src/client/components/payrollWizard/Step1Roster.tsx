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

export function Step1Roster({ defaultPayrollNumber, defaultWeekEndingDate, onNext }: Props) {
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
