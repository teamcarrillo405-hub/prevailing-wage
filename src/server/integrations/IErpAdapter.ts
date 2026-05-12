/**
 * Phase 126: Shared adapter contract for all v9.0 ERP integrations.
 * Implemented by procoreAdapter.ts (Phase 127), sage300Adapter.ts (Phase 130),
 * vistaAdapter.ts (Phase 132). DO NOT change this signature without updating
 * all three adapters in lock-step.
 */
export interface SyncResult {
  recordsSynced: number;
  errors: string[];
}

export interface IErpAdapter {
  pullWorkers(connectionId: string): Promise<SyncResult>;
  pullTimesheets(connectionId: string, since: Date): Promise<SyncResult>;
  pushComplianceStatus(connectionId: string, weekId: string): Promise<SyncResult>;
}
