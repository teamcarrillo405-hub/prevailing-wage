import { describe, it } from 'vitest';

describe('requireAuth middleware', () => {
  it.todo('passes request when valid pw_session cookie present');
  it.todo('returns 401 when no cookie present');
  it.todo('returns 401 when JWT is expired');
  it.todo('returns 401 when JWT signature is invalid');
  it.todo('attaches req.user with userId and email on success');
});

describe('optionalAuth middleware', () => {
  it.todo('attaches req.user when valid cookie present');
  it.todo('calls next() without error when no cookie present');
});
