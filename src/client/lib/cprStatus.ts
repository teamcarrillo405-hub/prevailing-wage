import type { BadgeVariant } from '../components/ui/Badge';

export interface SubcontractorCertSummary {
  certCount: number;
  isCertified: boolean;
  hasExpiredCert: boolean;
  hasSuspendedCert: boolean;
  hasPendingCert: boolean;
}

export interface Subcontractor {
  id: string;
  projectId: string;
  name: string;
  licenseNumber: string | null;
  contactName: string | null;
  contactEmail: string | null;
  address: string | null;
  // Phase 107 (DBE-07): DBE classification flag
  dbeClassification: 'none' | 'dbe' | 'mbe' | 'wbe' | 'sdvosb';
  createdAt: string;
  // DBE-05: cert summary attached by GET /subcontractors (populated server-side)
  certSummary?: SubcontractorCertSummary;
}

export interface SubcontractorCertification {
  id: string;
  subcontractorId: string;
  certTypes: string; // CSV e.g. "DBE,MBE"
  certifyingAgency: string | null;
  certNumber: string | null;
  naicsCodes: string | null;
  issueDate: string | null;
  expiresDate: string | null;
  reevaluationStatus: 'not_required' | 'pending' | 'cleared' | 'suspended';
  selfCertified: boolean;
  documentPath: string | null;
  // Phase 82 (Gap-2) — SAM.gov verification fields
  uei: string | null;
  cageCode: string | null;
  samRegistrationStatus: string | null;
  samLastVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// Phase 82 (Gap-2) — shape returned by /api/sam-gov/search and /entity/:uei
export interface SamGovEntity {
  entityName: string;
  uei: string | null;
  cage: string | null;
  registrationStatus: string | null;
  registrationDate: string | null;
  expirationDate: string | null;
  physicalAddress: {
    line1: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
  };
  certifications: string[];
  naicsCodes: string[];
}

export interface CprWeek {
  id: string;
  subcontractorId: string;
  weekEndingDate: string;        // YYYY-MM-DD text
  receivedDate: string | null;   // YYYY-MM-DD text, null = not received
  isCompliant: number | null;    // null=unassessed, 0=non-compliant, 1=compliant (THREE-STATE — never coerce to boolean)
  notes: string | null;
  uploadToken: string | null;
  uploadTokenExpiresAt?: string | null;
  uploadedAt: string | null;
  createdAt: string;
}

export type CprStatus = 'overdue' | 'received-compliant' | 'received-non-compliant' | 'not-received';
export type SubcontractorOperationStatus =
  | 'not_invited'
  | 'invited'
  | 'pending'
  | 'submitted'
  | 'rejected'
  | 'corrected'
  | 'approved'
  | 'late'
  | 'non_performance';

export interface SubcontractorOperationInput {
  weekEndingDate: string;
  receivedDate: string | null;
  isCompliant: number | null;
  notes?: string | null;
  uploadToken?: string | null;
  uploadTokenExpiresAt?: string | null;
  uploadedAt?: string | null;
}

export interface SubcontractorOperationState {
  status: SubcontractorOperationStatus;
  label: string;
  badgeVariant: BadgeVariant;
  nextAction: string;
  blocksSubmission: boolean;
}

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

export function getSubcontractorOperationState(row: SubcontractorOperationInput): SubcontractorOperationState {
  const notes = row.notes?.toLowerCase() ?? '';
  if (/\b(non[-\s]?performance|no work|did not work|no payroll)\b/.test(notes)) {
    return {
      status: 'non_performance',
      label: 'Non-performance',
      badgeVariant: 'neutral',
      nextAction: 'Keep the no-work note with the audit packet and confirm no workers need CPR for this week.',
      blocksSubmission: false,
    };
  }

  if (row.receivedDate) {
    if (row.isCompliant === 1) {
      return {
        status: 'approved',
        label: 'Approved',
        badgeVariant: 'compliant',
        nextAction: 'No action needed. This subcontractor CPR is ready for the evidence packet.',
        blocksSubmission: false,
      };
    }
    if (/corrected|resubmitted|fixed/.test(notes)) {
      return {
        status: 'corrected',
        label: 'Corrected',
        badgeVariant: 'warning',
        nextAction: 'Review the corrected CPR and mark it compliant when the revised payroll is acceptable.',
        blocksSubmission: true,
      };
    }
    if (row.uploadedAt) {
      return {
        status: 'submitted',
        label: 'Submitted',
        badgeVariant: 'warning',
        nextAction: 'Review the uploaded CPR and approve or reject it.',
        blocksSubmission: true,
      };
    }
    return {
      status: 'rejected',
      label: 'Rejected',
      badgeVariant: 'violation',
      nextAction: 'Send the subcontractor the correction note and request a revised CPR.',
      blocksSubmission: true,
    };
  }

  if (row.uploadedAt) {
    return {
      status: 'submitted',
      label: 'Submitted',
      badgeVariant: 'warning',
      nextAction: 'Review the uploaded CPR and approve or reject it.',
      blocksSubmission: true,
    };
  }

  const weekMs = new Date(row.weekEndingDate + 'T00:00:00').getTime();
  const daysLate = Math.floor((Date.now() - weekMs) / 86_400_000);
  if (daysLate > 7) {
    return {
      status: 'late',
      label: 'Late',
      badgeVariant: 'warning',
      nextAction: 'Request the missing CPR before certifying or submitting the project package.',
      blocksSubmission: true,
    };
  }

  if (row.uploadToken) {
    const tokenExpired = row.uploadTokenExpiresAt ? new Date(row.uploadTokenExpiresAt).getTime() < Date.now() : false;
    return {
      status: tokenExpired ? 'pending' : 'invited',
      label: tokenExpired ? 'Pending' : 'Invited',
      badgeVariant: 'neutral',
      nextAction: tokenExpired
        ? 'The upload link may be expired. Create a fresh request before the subcontractor submits CPR.'
        : 'Wait for upload or resend the upload link if the subcontractor cannot find it.',
      blocksSubmission: true,
    };
  }

  return {
    status: 'not_invited',
    label: 'Not invited',
    badgeVariant: 'neutral',
    nextAction: 'Add a contact email and create the first upload request for this subcontractor.',
    blocksSubmission: true,
  };
}
