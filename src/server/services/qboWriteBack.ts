// Stub service — real QB API calls require QB_CLIENT_ID + QB_CLIENT_SECRET + per-user OAuth tokens
export interface QboWriteBackResult {
  success: boolean;
  journalEntryId?: string;
  error?: string;
}

export async function writePayrollToQbo(
  projectId: number,
  weekId: number,
  totalLaborCost: number,
  totalFringeCost: number
): Promise<QboWriteBackResult> {
  if (!process.env.QB_CLIENT_ID) {
    return { success: false, error: 'QB_NOT_CONFIGURED' };
  }
  // TODO: implement OAuth token refresh + Journal Entry POST
  return { success: false, error: 'QB_OAUTH_REQUIRED' };
}
