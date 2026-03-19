export interface User { id: string; email: string; }

export interface Project {
  id: string;
  userId: string;
  name: string;
  state: string;
  county: string;
  contractType: 'federal-davis-bacon' | 'state-prevailing' | 'gsa-schedule' | 'private';
  awardDate: string;
  fundingType: 'federal' | 'state' | 'mixed';
  wdIdentifier: string | null;
  wdModNumber: number | null;
  wdLockedAt: string | null;
  status: 'active' | 'closed';
  createdAt: string;
  updatedAt: string;
}

export interface ApiResponse<T> { data?: T; error?: string; }

// ── Phase 2: Wage Data Types ──────────────────────────────────────────────
// Shared between server routes and React client components.
// Both sides import from here — never define these shapes in-file.

export interface WageClassification {
  id: string;
  wageDeterminationId: string;
  tradeCode: string;
  tradeDescription: string;
  laborType: 'journeyworker' | 'foreman' | 'apprentice';
  baseRate: number;
  fringeRate: number;
  totalRate: number;
  createdAt: string;
}

export interface WageDetermination {
  id: string;
  source: 'federal-dol' | 'ca-dir' | 'wa-li' | 'ny-dol' | 'manual';
  wdNumber: string;
  revisionNumber: number;
  state: string;
  county: string | null;
  constructionType: string | null;
  publishDate: string | null;
  isActive: boolean;
  cachedAt: string;
  cacheExpiresAt: string;
  createdAt: string;
  updatedAt: string;
  classifications?: WageClassification[];
}
