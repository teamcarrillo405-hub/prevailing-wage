import { describe, it } from 'vitest';

describe('GET /api/union/:projectId/allocation', () => {
  it.todo('UNION-02: returns 200 with UnionAllocationResult for valid projectId');
  it.todo('returns 401 when unauthenticated');
});

describe('POST /api/union/:projectId/trades', () => {
  it.todo('UNION-01: creates union_trade_config and returns 201');
  it.todo('returns 400 when required fields missing');
});

describe('GET /api/union/:projectId/allocation/pdf', () => {
  it.todo('UNION-04: returns application/pdf with Content-Disposition: attachment');
});
