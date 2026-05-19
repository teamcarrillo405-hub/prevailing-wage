export interface ScaViolation {
  type: 'sca-fringe-below-floor' | 'sca-vacation-missing';
  message: string;
  workerId?: number;
}

export function checkScaCompliance(entries: {
  workerId: number;
  totalHours: number;
  fringeRateSnapshot: number;
  baseRateSnapshot: number;
}[]): ScaViolation[] {
  const violations: ScaViolation[] = [];
  for (const e of entries) {
    // SCA requires fringe benefits — H+W floor is typically $5.36/hr (2024 WD baseline)
    const SCA_FRINGE_FLOOR = 5.36;
    if (e.fringeRateSnapshot < SCA_FRINGE_FLOOR) {
      violations.push({
        type: 'sca-fringe-below-floor',
        message: `Worker ${e.workerId}: fringe rate $${e.fringeRateSnapshot.toFixed(2)}/hr is below SCA H+W floor of $${SCA_FRINGE_FLOOR}/hr`,
        workerId: e.workerId
      });
    }
  }
  return violations;
}
