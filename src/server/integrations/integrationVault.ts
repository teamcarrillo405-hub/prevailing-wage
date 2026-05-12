/**
 * Phase 126: Semantic wrapper around the existing AES-256-GCM vault.
 * Adapters and route handlers MUST import encryptCredential/decryptCredential
 * from THIS file — never call native crypto primitives directly here.
 * This file is a pure re-export so the encryption surface stays singular.
 */
export { encryptSsn as encryptCredential, decryptSsn as decryptCredential } from '../services/cryptoService.js';
