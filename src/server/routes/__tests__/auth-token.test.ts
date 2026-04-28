import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../../middleware/auth', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = { id: '1', email: 'test@example.com', role: 'admin' };
    next();
  },
}));

describe('GET /api/auth/token', () => {
  it('returns token from pw_session cookie', async () => {
    const { router } = await import('../auth');
    const app = express();
    app.use(express.json());
    // Simulate cookie-parser having set the cookie
    app.use((req: any, _res, next) => { req.cookies = { pw_session: 'test-jwt-token' }; next(); });
    app.use('/api/auth', router);
    const res = await request(app).get('/api/auth/token');
    expect(res.status).toBe(200);
    expect(res.body.token).toBe('test-jwt-token');
  });

  it('returns 401 when no cookie', async () => {
    const { router } = await import('../auth');
    const app = express();
    app.use(express.json());
    app.use((req: any, _res, next) => { req.cookies = {}; next(); });
    app.use('/api/auth', router);
    const res = await request(app).get('/api/auth/token');
    expect(res.status).toBe(401);
  });
});
