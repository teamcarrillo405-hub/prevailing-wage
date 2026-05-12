process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-32-chars-minimum-okay';
if (!process.env.CORS_ORIGIN) {
  process.env.CORS_ORIGIN = 'http://localhost:4200';
}
delete process.env.INVITE_CODE;

import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';

const ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:4200';

async function registerAgent(email: string) {
  const agent = request.agent(app);
  const res = await agent
    .post('/api/auth/register')
    .set('Origin', ORIGIN)
    .set('X-Forwarded-For', '10.42.68.1')
    .send({
      email,
      password: 'securePassword1',
      companyName: 'Rio Mesa Builders',
      hccMembershipNumber: 'HCC-20481',
    });
  expect(res.status).toBe(201);
  return agent;
}

describe('onboarding routes', () => {
  it('saves an HCC member contractor profile and returns recommended next steps', async () => {
    const agent = await registerAgent(`onboarding-${Date.now()}@example.com`);

    const res = await agent
      .put('/api/onboarding')
      .set('Origin', ORIGIN)
      .send({
        companyName: 'Rio Mesa Builders',
        hccMembershipNumber: 'HCC-20481',
        contractorRole: 'general_contractor',
        companySize: '11_50',
        primaryStates: ['CA', 'TX'],
        workTypes: ['federal_davis_bacon', 'dot'],
        payrollProvider: 'quickbooks',
        accountingProvider: 'quickbooks',
        projectManagementProvider: 'procore',
        averageWeeklyWorkers: 18,
        usesSubcontractors: true,
        usesApprentices: true,
        fieldTrackingNeeded: true,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.completedAt).toBeTruthy();
    expect(res.body.data.recommendedNextSteps).toContain('Connect QuickBooks to import employees and time records');
    expect(res.body.data.recommendedNextSteps).toContain('Connect Procore to import project time entries');

    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.data.user).toMatchObject({
      companyName: 'Rio Mesa Builders',
      hccMembershipNumber: 'HCC-20481',
    });
    expect(me.body.data.user.onboardingCompletedAt).toBeTruthy();
  });
});

