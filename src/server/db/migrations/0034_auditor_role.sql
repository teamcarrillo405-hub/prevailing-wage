-- Auditor role: read-only project member
-- SQLite cannot ALTER CHECK constraints, so the allowed values are enforced
-- at the application layer (Zod + TypeScript). This is a migration marker only.
SELECT 1;
