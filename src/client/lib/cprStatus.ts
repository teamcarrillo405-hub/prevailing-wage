import type { BadgeVariant } from '../components/ui/Badge';

export interface Subcontractor {
  id: string;
  projectId: string;
  name: string;
  licenseNumber: string | null;
  contactName: string | null;
  contactEmail: string | null;
  address: string | null;
  createdAt: string;
}

export interface CprWeek {
  id: string;
  subcontractorId: string;
  weekEndingDate: string;        // YYYY-MM-DD text
  receivedDate: string | null;   // YYYY-MM-DD text, null = not received
  isCompliant: number | null;    // null=unassessed, 0=non-compliant, 1=compliant (THREE-STATE — never coerce to boolean)
  notes: string | null;
  createdAt: string;
}

export type CprStatus = 'overdue' | 'received-compliant' | 'received-non-compliant' | 'not-received';

export function getCprStatus(week: CprWeek): CprStatus {
  if (!week.receivedDate) {
    // Parse with 'T00:00:00' to force local time — prevents UTC midnight offset bug
    const weekMs = new Date(week.weekEndingDate + 'T00:00:00').getTime();
    const daysAgo = Math.floor((Date.now() - weekMs) / 86_400_000);
    return daysAgo > 7 ? 'overdue' : 'not-received';
  }
  // Strict equality — isCompliant === 1 only; 0 and null both = non-compliant
  return week.isCompliant === 1 ? 'received-compliant' : 'received-non-compliant';
}

export const STATUS_BADGE: Record<CprStatus, { variant: BadgeVariant; label: string }> = {
  'received-compliant':     { variant: 'compliant', label: 'Received \u2014 Compliant' },
  'received-non-compliant': { variant: 'violation', label: 'Received \u2014 Non-Compliant' },
  'not-received':           { variant: 'neutral',   label: 'Not Received' },
  'overdue':                { variant: 'warning',   label: 'Overdue' },
};
