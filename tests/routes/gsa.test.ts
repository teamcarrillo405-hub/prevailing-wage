import { describe, it } from 'vitest';

describe('POST /api/gsa/:projectId/rates', () => {
  it.todo('GSA-02: creates gsa_rate record and returns 201');
  it.todo('returns 400 when overheadPct exceeds 200');
  it.todo('returns 401 when unauthenticated');
});

describe('GET /api/gsa/:projectId/rates', () => {
  it.todo('GSA-02: returns saved rate configs for project');
});

describe('PUT /api/gsa/:projectId/rates/:rateId', () => {
  it.todo('GSA-02: updates rate components and returns 200');
});
