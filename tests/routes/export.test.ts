import { describe, it, expect } from 'vitest';

describe('GET /api/export/a1131/:weekId - CAL-02', () => {
  it('should return 400 for non-CA project', async () => {
    // Seed a federal project, create week, request A-1-131
    // Expect 400 with error message about CA-only
    expect(true).toBe(false); // RED stub
  });

  it('should return PDF for CA project', async () => {
    // Seed a CA project with cslbLicense, create week + entries
    // GET /api/export/a1131/:weekId
    // Expect 200, Content-Type: application/pdf
    expect(true).toBe(false); // RED stub
  });

  it('should return 403 for unauthorized access', async () => {
    expect(true).toBe(false); // RED stub
  });
});
