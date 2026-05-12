/**
 * Phase 126: Stub ERP worker serializer.
 * SEC-01 contract: NO SSN, NO 9-digit numeric sequences in any ERP-bound payload.
 * Use explicit inclusion lists ONLY — spread operator on worker rows is forbidden
 * in this file and all future Phase 127+ adapter serializers.
 */
export interface WorkerRowForErp {
  id: string;
  name?: string | null;
  ssnEncrypted?: string | null;  // INPUT only — must NEVER appear in output
  ssnLast4?: string | null;       // INPUT only — must NEVER appear in output
  tradeClassification?: string | null;
  baseRateSnapshot?: string | null;
  phone?: string | null;          // INPUT only — must NEVER appear in output (could contain 9-digit pattern)
}

export interface ErpWorkerPayload {
  id: string;
  name: string | null;
  tradeClassification: string | null;
  baseRateSnapshot: string | null;
}

/**
 * Serialize a worker row for outbound ERP push. Phase 127-134 adapters
 * extend this shape but MUST follow the explicit-inclusion-list pattern.
 */
export function serializeWorkerForErp(worker: WorkerRowForErp): ErpWorkerPayload {
  return {
    id: worker.id,
    name: worker.name ?? null,
    tradeClassification: worker.tradeClassification ?? null,
    baseRateSnapshot: worker.baseRateSnapshot ?? null,
  };
}
