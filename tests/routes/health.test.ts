import { describe, expect, it } from 'vitest';
import supertest from 'supertest';
import { app } from '../../src/server/index.js';

describe('health and readiness routes', () => {
  it('returns database health without authentication', async () => {
    const res = await supertest(app).get('/api/health');

    expect([200, 503]).toContain(res.status);
    expect(res.body.status).toBeDefined();
    expect(res.body.db).toBeDefined();
  });

  it('returns readiness checks without authentication', async () => {
    const res = await supertest(app).get('/api/ready');

    expect([200, 503]).toContain(res.status);
    expect(res.body.status).toMatch(/ready|not_ready/);
    expect(res.body.checks).toEqual(
      expect.objectContaining({
        db: expect.any(String),
        jwtSecret: expect.any(String),
        encryptionKey: expect.any(String),
      }),
    );
  });
});
