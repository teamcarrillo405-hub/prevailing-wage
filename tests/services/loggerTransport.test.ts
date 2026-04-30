import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';

/**
 * Phase 123-02 SEC-02: Unit tests for buildTransport() in src/server/logger.ts
 *
 * Strategy: Use vi.doMock (not vi.mock) so we can re-register the pino mock
 * AFTER each vi.resetModules() call. vi.mock is hoisted to the top and only
 * fires once; vi.doMock fires synchronously at call time and survives module
 * resets correctly.
 *
 * The module reads env vars at import time (top-level const), so each test must:
 *   1. Set env vars for the desired branch
 *   2. Call vi.resetModules() to clear the module registry
 *   3. Call vi.doMock('pino', ...) to register the mock for the next import
 *   4. Dynamically import the module to pick up the new env state
 */

describe('buildTransport()', () => {
  let savedNodeEnv: string | undefined;
  let savedToken: string | undefined;

  beforeAll(() => {
    savedNodeEnv = process.env.NODE_ENV;
    savedToken = process.env.LOGTAIL_TOKEN;
  });

  afterEach(() => {
    // Restore original env state
    if (savedNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = savedNodeEnv;
    }
    if (savedToken === undefined) {
      delete process.env.LOGTAIL_TOKEN;
    } else {
      process.env.LOGTAIL_TOKEN = savedToken;
    }
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns undefined when NODE_ENV=test (regardless of LOGTAIL_TOKEN)', async () => {
    process.env.NODE_ENV = 'test';
    process.env.LOGTAIL_TOKEN = 'should-be-ignored';
    vi.resetModules();
    vi.doMock('pino', () => ({
      default: Object.assign(
        (..._args: unknown[]) => ({ info: () => {}, warn: () => {}, error: () => {} }),
        { transport: vi.fn((cfg: unknown) => ({ __mockedTransport: true, cfg })) },
      ),
    }));
    const { buildTransport } = await import('../../src/server/logger.js');
    expect(buildTransport()).toBeUndefined();
  });

  it('returns @logtail/pino transport when NODE_ENV=production and LOGTAIL_TOKEN is set', async () => {
    process.env.NODE_ENV = 'production';
    process.env.LOGTAIL_TOKEN = 'real-token';
    vi.resetModules();
    vi.doMock('pino', () => ({
      default: Object.assign(
        (..._args: unknown[]) => ({ info: () => {}, warn: () => {}, error: () => {} }),
        { transport: vi.fn((cfg: unknown) => ({ __mockedTransport: true, cfg })) },
      ),
    }));
    const { buildTransport } = await import('../../src/server/logger.js');
    const result = buildTransport() as { cfg: { target: string; options: { sourceToken?: string } } } | undefined;
    expect(result?.cfg?.target).toBe('@logtail/pino');
    expect(result?.cfg?.options?.sourceToken).toBe('real-token');
  });

  it('returns pino-pretty transport when NODE_ENV=development and no LOGTAIL_TOKEN', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.LOGTAIL_TOKEN;
    vi.resetModules();
    vi.doMock('pino', () => ({
      default: Object.assign(
        (..._args: unknown[]) => ({ info: () => {}, warn: () => {}, error: () => {} }),
        { transport: vi.fn((cfg: unknown) => ({ __mockedTransport: true, cfg })) },
      ),
    }));
    const { buildTransport } = await import('../../src/server/logger.js');
    const result = buildTransport() as { cfg: { target: string } } | undefined;
    expect(result?.cfg?.target).toBe('pino-pretty');
  });

  it('returns undefined when NODE_ENV=production and no LOGTAIL_TOKEN (raw stdout for Render)', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.LOGTAIL_TOKEN;
    vi.resetModules();
    vi.doMock('pino', () => ({
      default: Object.assign(
        (..._args: unknown[]) => ({ info: () => {}, warn: () => {}, error: () => {} }),
        { transport: vi.fn((cfg: unknown) => ({ __mockedTransport: true, cfg })) },
      ),
    }));
    const { buildTransport } = await import('../../src/server/logger.js');
    expect(buildTransport()).toBeUndefined();
  });
});
