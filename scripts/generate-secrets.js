#!/usr/bin/env node
/**
 * generate-secrets.js
 *
 * Generates cryptographically secure secrets for the prevailing-wage app.
 * Output is ready to paste directly into your .env file.
 *
 * Usage:
 *   node scripts/generate-secrets.js
 *   npm run generate-secrets
 *
 * Run once per environment (local dev, staging, production).
 * Never commit the generated values to source control.
 */

import { randomBytes } from 'crypto';

console.log('# Generated secrets — paste into your .env file');
console.log('# Run this script once per environment. Never commit these values.\n');

const jwtSecret = randomBytes(48).toString('base64url');
const encryptionKey = randomBytes(32).toString('hex');

console.log(`JWT_SECRET=${jwtSecret}`);
console.log(`ENCRYPTION_KEY_V1=${encryptionKey}`);
console.log('\n# WARNING: Rotate these keys carefully.');
console.log('# - Changing JWT_SECRET invalidates all active user sessions.');
console.log('# - Changing ENCRYPTION_KEY_V1 makes all encrypted SSN records unreadable.');
