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
