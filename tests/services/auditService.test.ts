import { describe, it, expect, beforeAll } from 'vitest';

// Set env vars before any module with startup assertions
beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long-xx';
  process.env.NODE_ENV = 'test';
});

// Dynamic imports AFTER env setup to avoid cryptoService process.exit
const { diffObjects, insertAuditLog } = await import('../../src/server/services/auditService.js');
const { getDb } = await import('../../src/server/db/index.js');
const { auditLogs } = await import('../../src/server/db/schema.js');
const { eq } = await import('drizzle-orm');

describe('diffObjects', () => {
  it('returns changed fields only', () => {
    const result = diffObjects({ a: 1, b: 2 }, { a: 1, b: 3 });
    expect(result).toEqual({ before: { b: 2 }, after: { b: 3 } });
  });

  it('returns null when no changes', () => {
    const result = diffObjects({ a: 1 }, { a: 1 });
    expect(result).toBeNull();
  });

  it('omits updatedAt and createdAt by default', () => {
    const result = diffObjects(
      { a: 1, updatedAt: 'old', created_at: 'old' },
      { a: 2, updatedAt: 'new', created_at: 'new' }
    );
    expect(result).toEqual({ before: { a: 1 }, after: { a: 2 } });
  });
});

describe('insertAuditLog', () => {
  it('inserts a row readable from the DB', async () => {
    const db = getDb();
    await insertAuditLog({
      userId: null,
      userEmail: 'test@example.com',
      ipAddress: '127.0.0.1',
      projectId: null,
      entityType: 'worker',
      entityId: 'w-123',
      action: 'worker.created',
      snapshot: { name: 'Alice', trade: 'Carpenter' },
    });
    const rows = await db.select().from(auditLogs).where(eq(auditLogs.entityId, 'w-123'));
    expect(rows.length).toBe(1);
    expect(rows[0].action).toBe('worker.created');
    expect(rows[0].userEmail).toBe('test@example.com');
  });

  it('redacts ssnEncrypted in snapshot', async () => {
    const db = getDb();
    await insertAuditLog({
      userId: null,
      userEmail: null,
      ipAddress: null,
      projectId: null,
      entityType: 'worker',
      entityId: 'w-redact-snap',
      action: 'worker.created',
      snapshot: { name: 'Bob', ssnEncrypted: '{"v":1,"ct":"abc"}' },
    });
    const rows = await db.select().from(auditLogs).where(eq(auditLogs.entityId, 'w-redact-snap'));
    const snap = JSON.parse(rows[0].snapshot!);
    expect(snap.ssnEncrypted).toBe('[REDACTED]');
  });

  it('preserves null ssnEncrypted as null in snapshot', async () => {
    const db = getDb();
    await insertAuditLog({
      userId: null,
      userEmail: null,
      ipAddress: null,
      projectId: null,
      entityType: 'worker',
      entityId: 'w-redact-null',
      action: 'worker.created',
      snapshot: { name: 'Carol', ssnEncrypted: null },
    });
    const rows = await db.select().from(auditLogs).where(eq(auditLogs.entityId, 'w-redact-null'));
    const snap = JSON.parse(rows[0].snapshot!);
    expect(snap.ssnEncrypted).toBeNull();
  });

  it('adds hasFullSsn: true to meta when ssnEncrypted is non-null', async () => {
    const db = getDb();
    await insertAuditLog({
      userId: null,
      userEmail: null,
      ipAddress: null,
      projectId: null,
      entityType: 'worker',
      entityId: 'w-hasfull',
      action: 'worker.created',
      snapshot: { name: 'Dave', ssnEncrypted: '{"v":1}' },
      meta: { source: 'test' },
    });
    const rows = await db.select().from(auditLogs).where(eq(auditLogs.entityId, 'w-hasfull'));
    const meta = JSON.parse(rows[0].meta!);
    expect(meta.hasFullSsn).toBe(true);
    expect(meta.source).toBe('test');
  });

  it('redacts ssnEncrypted in diff before/after', async () => {
    const db = getDb();
    await insertAuditLog({
      userId: null,
      userEmail: null,
      ipAddress: null,
      projectId: null,
      entityType: 'worker',
      entityId: 'w-redact-diff',
      action: 'worker.updated',
      diff: { before: { ssnEncrypted: '{"v":1}', name: 'Old' }, after: { ssnEncrypted: '{"v":2}', name: 'New' } },
    });
    const rows = await db.select().from(auditLogs).where(eq(auditLogs.entityId, 'w-redact-diff'));
    const diff = JSON.parse(rows[0].diff!);
    expect(diff.before.ssnEncrypted).toBe('[REDACTED]');
    expect(diff.after.ssnEncrypted).toBe('[REDACTED]');
    expect(diff.before.name).toBe('Old');
    expect(diff.after.name).toBe('New');
  });
});

describe('module exports', () => {
  it('does not export updateAuditLog or deleteAuditLog', async () => {
    const mod = await import('../../src/server/services/auditService.js');
    expect('updateAuditLog' in mod).toBe(false);
    expect('deleteAuditLog' in mod).toBe(false);
  });
});
