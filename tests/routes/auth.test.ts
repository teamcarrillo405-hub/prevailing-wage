import { describe, it } from 'vitest';

describe('POST /api/auth/register', () => {
  it.todo('creates a new user and returns 201 with pw_session cookie');
  it.todo('returns 409 when email already registered');
  it.todo('returns 400 when password is fewer than 8 characters');
  it.todo('returns 400 when email is invalid');
});

describe('POST /api/auth/login', () => {
  it.todo('returns 200 with pw_session cookie on valid credentials');
  it.todo('returns 401 on wrong password');
  it.todo('returns 404 when email not found');
});

describe('POST /api/auth/logout', () => {
  it.todo('clears pw_session cookie and returns 200');
});

describe('GET /api/auth/me', () => {
  it.todo('returns current user when authenticated');
  it.todo('returns 401 when not authenticated');
});
