export interface GlossaryTerm {
  term: string;
  definition: string;
  related?: string[];
}

export const GLOSSARY: GlossaryTerm[] = [
  { term: 'Davis-Bacon Act', definition: 'Federal law requiring contractors on federally-funded construction projects to pay workers the locally prevailing wage and fringe benefits.', related: ['Prevailing Wage', 'WH-347'] },
  { term: 'Prevailing Wage', definition: 'The combination of the basic hourly rate and fringe benefits paid to workers in a specific trade in a geographic area, as determined by the U.S. Department of Labor.', related: ['Davis-Bacon Act', 'Wage Determination'] },
  { term: 'WH-347', definition: 'The federal certified payroll report form required by 29 CFR Part 3 for all Davis-Bacon covered projects. Must be submitted weekly.', related: ['Certified Payroll', 'Davis-Bacon Act'] },
  { term: 'Certified Payroll', definition: 'A weekly payroll report submitted under penalty of perjury, certifying that workers were paid the prevailing wage and that deductions are lawful.', related: ['WH-347'] },
  { term: 'CWHSSA', definition: 'Contract Work Hours and Safety Standards Act. Requires overtime at 1.5x the basic rate for all hours over 40 per week on federal contracts over $100,000.', related: ['Overtime', 'Davis-Bacon Act'] },
  { term: 'Wage Determination', definition: 'A DOL-issued schedule of prevailing wage rates for specific trades in a geographic area. Must be incorporated into contract documents.', related: ['Davis-Bacon Act', 'SAM.gov'] },
  { term: 'Journeyworker', definition: 'A fully qualified worker in a specific trade classification who is paid at the full prevailing wage rate.', related: ['Apprentice', 'Classification'] },
  { term: 'Apprentice', definition: 'A worker enrolled in a DOL-registered apprenticeship program. May be paid a percentage of the journeyworker rate per program schedule.', related: ['Journeyworker', 'Apprentice Ratio'] },
  { term: 'Apprentice Ratio', definition: 'The maximum number of apprentices allowed per journeyworker on a job site, as specified in the registered apprenticeship program (typically 1:3 to 1:5).', related: ['Apprentice', 'Journeyworker'] },
  { term: 'Fringe Benefits', definition: 'Contributions to bona fide benefit plans (health, pension, vacation) that can be credited toward the prevailing wage requirement. Can be paid as cash in lieu.', related: ['Prevailing Wage', 'Wage Determination'] },
  { term: 'Deduction Cap', definition: 'Under 29 CFR §3.5, deductions from wages cannot exceed 30% of gross wages (excluding taxes) without DOL approval.', related: ['Certified Payroll'] },
  { term: 'SAM.gov', definition: 'System for Award Management — the federal database where wage determinations are published and contractor registrations are maintained.', related: ['Wage Determination'] },
  { term: 'eCPR', definition: 'Electronic Certified Payroll Report — California\'s online portal (DIR eCPR) for submitting certified payroll electronically for CA public works projects.', related: ['Certified Payroll', 'California A-1-131'] },
  { term: 'DBE', definition: 'Disadvantaged Business Enterprise — a certification program ensuring federal transportation dollars flow to small businesses owned by socially and economically disadvantaged individuals.', related: ['MBE', 'WBE'] },
  { term: '29 CFR Part 3', definition: 'The federal regulation implementing the Copeland Anti-Kickback Act, governing payroll deductions and certified payroll submission requirements.', related: ['Certified Payroll', 'Deduction Cap'] },
  { term: 'IIJA', definition: 'Infrastructure Investment and Jobs Act (2021) — requires Davis-Bacon prevailing wages on all covered infrastructure projects, and IRA apprenticeship requirements for certain tax credits.', related: ['Davis-Bacon Act'] },
];
