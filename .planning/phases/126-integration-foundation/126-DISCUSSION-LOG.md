# Phase 126: Integration Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-11
**Phase:** 126-integration-foundation
**Areas discussed:** DB table strategy, IntegrationsPage file-ERP cards

---

## DB Table Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| New generic table alongside procore_tokens | Add integration_connections + integration_sync_runs. Keep procore_tokens as-is. | ✓ |
| Extend procore_tokens into generic table | Rename/alter procore_tokens with erp_type column. Cleaner long-term but requires migration on live data. | |
| Per-ERP tables | procore_tokens, sage_connections, vista_connections each separate. Simple but no shared query pattern. | |

**User's choice:** New generic table alongside procore_tokens
**Notes:** Backward compatibility with existing QBO + Procore flows is the priority. Long-term unification deferred beyond v9.0.

---

## IntegrationsPage — File ERP Cards (Sage 300 + Vista)

| Option | Description | Selected |
|--------|-------------|----------|
| File Exchange badge + path config inline | Card shows "File Exchange" badge. Import/export paths editable inline. "Import Now" button. Clear label explaining file-based nature. | ✓ |
| OAuth-style card with Configure instead of Connect | Same connected/not-connected pattern but "Configure" opens modal. Consistent layout but may imply live connection. | |
| Separate "Manual Integrations" section | Split page into Live Connections and File Exchanges sections. | |

**User's choice:** File Exchange badge + path config inline
**Notes:** Single-section page layout retained (no split). "File Exchange" badge differentiates without visual restructuring. Inline path config reduces friction vs. modal.

---

## Claude's Discretion

- Minimal sync status display format on IntegrationsPage cards (last-sync timestamp + error badge)
- Error/success toast wording
- "Import Now" button disabled state while sync in-flight

## Deferred Ideas

- Visual split of page into "Live" vs "File" sections — rejected; badge differentiation is sufficient
- chokidar file watcher for auto-import — deferred to v10.0
- Unifying procore_tokens + integration_connections — deferred beyond v9.0
