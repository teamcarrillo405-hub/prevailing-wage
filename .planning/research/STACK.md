# Stack Research

**Domain:** Prevailing wage compliance + report generation additions
**Researched:** 2026-03-19
**Confidence:** HIGH

---

## Context: What Already Exists (Do Not Re-research)

The following are confirmed installed and working. Do not add alternatives or re-evaluate these.

| Technology | Version (package.json) | Status |
|------------|----------------------|--------|
| React 19 + Vite | ^19.2.4 / ^8.0.0 | Installed |
| TailwindCSS v4 | ^4.2.2 | Installed |
| SQLite + Drizzle ORM | ^12.8.0 / ^0.45.1 | Installed |
| pdf-lib | ^1.17.1 | Installed — working for WH-347 overlay AND generated PDFs |
| Recharts 3 | ^3.8.0 | Installed |
| @tanstack/react-query | ^5.91.0 | Installed |
| react-hook-form | ^7.71.2 | Installed |
| zod | ^4.3.6 | Installed |
| papaparse | ^5.5.3 | Installed |
| node-cron | ^4.2.1 | Installed |
| jose + argon2 | ^6.2.2 / ^0.44.0 | Installed |

---

## Recommended Additions

### Supporting Libraries — New Installs

| Library | Version | Purpose | Why This One |
|---------|---------|---------|--------------|
| `clsx` | ^2.1.1 | Conditional className composition for status badge variants | 239B, tree-shakeable, no dependencies. The existing ProjectCard already builds badge classes with inline logic — clsx makes multi-variant compliance badges (compliant / warning / violation) clean without a component library. Alternative `classnames` is larger with no benefit. |
| `tailwind-merge` | ^3.5.0 | Merge Tailwind classes without specificity conflicts | Required when a reusable Badge component accepts a `className` prop override — without twMerge, a caller passing `bg-red-500` won't override the component's `bg-green-500`. v3.x specifically targets Tailwind v4; v2.x targets v3 only. |
| `date-fns` | ^4.1.0 | Week boundary calculations for compliance engine | The compliance engine needs to determine whether OT hours fall within the correct 7-day workweek. Native `Date` arithmetic across DST boundaries is unreliable for week-start/week-end comparisons. `date-fns` v4 is ESM-first (matches project's `"type": "module"`), provides `startOfWeek`, `endOfWeek`, `differenceInDays`, `isWithinInterval`. No runtime timezone support needed for payroll week checks (all local dates). |

### What Is NOT Needed

| Library | Why Not | What to Do Instead |
|---------|---------|-------------------|
| `decimal.js` or `dinero.js` | The existing calculations.ts uses native floats throughout and the pattern is already established. Prevailing wage rates are stored to 2 decimal places; JavaScript float64 is sufficient for multiplication of cent-precision rates by integer hours. Mixing Decimal objects into the existing float-based service layer would create a type boundary problem with no compliance benefit. | Keep native numbers. Round only at the display layer with `toFixed(2)` and `toLocaleString` — which the existing variancePdf.ts already does correctly. |
| `@react-pdf/renderer` or `pdfmake` | pdf-lib is already installed and the team has working patterns for both coordinate overlay (WH-347) and generated PDFs (`PDFDocument.create()` in variancePdf.ts). The Statement of Compliance and fringe summary reports are simple tabular documents — the variancePdf.ts pattern scales to them directly. Adding a second PDF library creates a maintenance split for no capability gain. | Extend the existing pdf-lib `PDFDocument.create()` pattern. Multi-page is supported via `doc.addPage()`. Memory concern only arises at 200+ pages — not applicable here. |
| Any React component library (shadcn, Material UI, Radix, daisyUI, Flowbite) | The project constraint explicitly forbids new UI frameworks. The existing badge pattern in ProjectCard.tsx is 2 lines of inline Tailwind — a reusable `<Badge>` component using `clsx` + `tailwind-merge` is 15 lines and covers all compliance states without a framework dependency. | Build a `src/client/components/shared/Badge.tsx` using clsx + tailwind-merge. |
| `react-table` / `@tanstack/react-table` | Compliance flag lists and pay history tables are read-only, non-sortable displays. Native `<table>` with Tailwind classes is sufficient and already used throughout the app. | Use plain HTML tables with Tailwind. |
| Puppeteer / headless Chrome | Not needed for server-side PDF generation. pdf-lib runs in Node.js without a browser process. Puppeteer adds ~300MB binary download and process management complexity. | Keep pdf-lib. |
| `zod-form-data` or additional validation libraries | zod ^4.3.6 is already installed for all validation needs including compliance rule inputs. | Use existing zod. |

---

## Compliance Engine — No New Libraries Required

The three compliance checks map directly to existing data and utility patterns:

**Under-wage check:** `payrollEntry.grossWage / payrollEntry.totalHours < payrollEntry.snapshotBaseRate` — pure arithmetic on stored values. No library needed.

**CWHSSA OT error check:** `overtimeHours !== Math.max(0, totalHours - 40)` — integer comparison. `date-fns` is only needed if the workweek boundary itself needs verification (i.e., which Sunday-to-Saturday window the hours fall in). If payroll weeks are already week-keyed in the schema, this check is also pure arithmetic.

**Apprentice ratio check:** `apprenticeCount / journeyworkerCount > allowedRatio` — fraction comparison against the registered program's ratio. Pure arithmetic. The ratio itself is a stored project-level config value.

---

## Installation

```bash
# All three additions — production dependencies
npm install clsx@^2.1.1 tailwind-merge@^3.5.0 date-fns@^4.1.0
```

No dev-only dependencies needed. No type packages needed — all three ship their own TypeScript declarations.

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|----------------|-------|
| `tailwind-merge@3.x` | TailwindCSS v4.x | v3.x is specifically for Tailwind v4. Do NOT use tailwind-merge v2.x (that's for Tailwind v3). |
| `date-fns@4.x` | Node.js ESM (`"type": "module"`) | v4 is ESM-first with `.cjs` exports also available. Compatible with the project's ESM setup. |
| `clsx@2.x` | React 19, any bundler | No peer dependencies. |

---

## Patterns for Planner

### Badge component pattern (clsx + tailwind-merge)

Build `src/client/components/shared/Badge.tsx` with variants:
- `compliant` → green background
- `warning` → yellow/gold (brand color #F5C518)
- `violation` → red background
- `pending` → gray background

This replaces the ad-hoc inline span classes in ProjectCard and provides the compliance status badges for the dashboard.

### PDF generation pattern (pdf-lib only)

Statement of Compliance and fringe summary reports follow the same pattern as `variancePdf.ts`:
- `PDFDocument.create()` — not `load()`
- `doc.addPage([612, 792])` for additional pages
- `StandardFonts.Helvetica` + `StandardFonts.HelveticaBold` (already embedded in variancePdf.ts)
- HCC brand constants already defined in variancePdf.ts — move to a shared `pdfBranding.ts` constant file to avoid duplication across new reports

### Compliance service pattern

Build `src/server/services/complianceEngine.ts` as a pure function module (matching the pattern of calculations.ts — no DB imports, pure inputs/outputs). Route handlers call it after fetching payroll data. Returns structured flag arrays with `{ type, workerId, weekKey, message, severity }`.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|------------------------|
| `clsx` | `classnames` | Never for this project — clsx is a direct drop-in that is smaller and faster |
| `tailwind-merge@3` | Custom class deduplication | Never — custom deduplication is brittle against Tailwind's class naming |
| `date-fns@4` | Native Date arithmetic | Acceptable if workweek logic is already handled by the schema (stored week start dates). Add date-fns only if week boundary calculation code needs to be written. |
| pdf-lib (existing) | `@react-pdf/renderer` | If reports required complex HTML-like layouts with auto-wrapping text, tables that paginate automatically, or pixel-perfect CSS rendering. None of these apply here — existing tabular layout in variancePdf.ts handles the use cases. |

---

## Sources

- [npm — tailwind-merge](https://www.npmjs.com/package/tailwind-merge) — verified v3.5.0, Tailwind v4 support confirmed (HIGH confidence)
- [tailwindlabs/tailwindcss discussion #14400](https://github.com/tailwindlabs/tailwindcss/discussions/14400) — tailwind-merge v3 targets Tailwind v4 (MEDIUM confidence)
- [date-fns blog — v4.0 release](https://blog.date-fns.org/v40-with-time-zone-support/) — ESM-first, 34M weekly downloads (HIGH confidence)
- [npm — clsx](https://www.npmjs.com/package/clsx) — 239B, no dependencies (HIGH confidence)
- [pdf-lib GitHub issue #470](https://github.com/Hopding/pdf-lib/issues/470) — memory concern at 200+ pages; not applicable to this project's report sizes (MEDIUM confidence)
- [pdf-lib official docs](https://pdf-lib.js.org/) — `addPage()` is the confirmed multi-page API (HIGH confidence)
- Existing codebase — `calculations.ts`, `variancePdf.ts`, `ProjectCard.tsx` reviewed directly (HIGH confidence)

---

*Stack research for: Prevailing wage compliance + reporting additions (Milestone v2.0)*
*Researched: 2026-03-19*
