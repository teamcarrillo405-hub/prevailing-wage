import { describe, it, expect } from 'vitest';

describe('password hashing', () => {
  it.todo('hashPassword produces a valid Argon2id hash');
  it.todo('verifyPassword returns true for correct password');
  it.todo('verifyPassword returns false for wrong password');
  it.todo('hashPassword produces different hashes for same input (salt uniqueness)');
});

describe('createSessionToken', () => {
  it.todo('returns a signed JWT string');
  it.todo('JWT payload contains userId and email');
  it.todo('JWT expires in 7 days');
});
