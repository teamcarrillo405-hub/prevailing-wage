import { describe, it } from 'vitest';

describe('GET /api/variance/:projectId/report', () => {
  it.todo('VAR-01: returns 200 with VarianceReport when budget exists');
  it.todo('returns 404 when no project_budgets row exists');
  it.todo('returns 401 when unauthenticated');
});

describe('POST /api/variance/:projectId/budget', () => {
  it.todo('VAR-01: creates project_budgets row and returns 201');
  it.todo('returns 400 when workingBudget <= 0');
});

describe('GET /api/variance/:projectId/report/pdf', () => {
  it.todo('VAR-04: returns application/pdf with Content-Disposition: attachment');
  it.todo('returns 404 when no budget configured');
});
