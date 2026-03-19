import { describe, it } from 'vitest';

describe('POST /api/projects (create)', () => {
  it.todo('creates project with all required fields and returns 201');
  it.todo('returns 400 when name is missing');
  it.todo('returns 400 when awardDate format is invalid');
  it.todo('returns 400 when fundingType is not federal|state|mixed');
  it.todo('returns 401 when not authenticated');
});

describe('GET /api/projects (list)', () => {
  it.todo('returns only projects belonging to the authenticated user');
  it.todo('returns empty array when user has no projects');
  it.todo('returns 401 when not authenticated');
});

describe('GET /api/projects/:id', () => {
  it.todo('returns project when user owns it');
  it.todo('returns 404 when project not found');
  it.todo('returns 403 when project belongs to different user');
});

describe('PATCH /api/projects/:id (immutable)', () => {
  it.todo('returns 400 when request body contains awardDate');
  it.todo('returns 400 when request body contains fundingType');
  it.todo('returns 400 when request body contains wdIdentifier');
  it.todo('returns 400 when request body contains wdModNumber');
  it.todo('returns 400 when request body contains wdLockedAt');
  it.todo('updates mutable fields (name, status) successfully');
});

describe('DELETE /api/projects/:id', () => {
  it.todo('soft-deletes project by setting status to closed');
  it.todo('returns 404 when project not found');
});
