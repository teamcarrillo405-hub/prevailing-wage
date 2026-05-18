import { describe, expect, it } from 'vitest';
import supertest from 'supertest';
import { app } from '../../src/server/index.js';

describe('POST /api/contact', () => {
  it('returns 200 { success: true } for a valid payload', async () => {
    const res = await supertest(app).post('/api/contact').send({
      name: 'Maria Gonzalez',
      email: 'maria@example.com',
      message: 'This is a test message that is long enough.',
      subject: 'Test inquiry',
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
  });

  it('returns 422 VALIDATION_ERROR when email is missing', async () => {
    const res = await supertest(app).post('/api/contact').send({
      name: 'Maria Gonzalez',
      message: 'This is a test message that is long enough.',
    });

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('VALIDATION_ERROR');
    expect(res.body.issues).toBeDefined();
  });

  it('returns 422 VALIDATION_ERROR when message is too short (< 10 chars)', async () => {
    const res = await supertest(app).post('/api/contact').send({
      name: 'Maria Gonzalez',
      email: 'maria@example.com',
      message: 'short',
    });

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('VALIDATION_ERROR');
    expect(res.body.issues).toBeDefined();
  });
});
