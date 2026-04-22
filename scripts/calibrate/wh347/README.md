# WH-347 Widget Calibration

Visual drag/resize tool for aligning AcroForm widgets on the WH-347 template.

## Workflow

```bash
# 1. Start the calibration server
npm run wh347:calibrate

# 2. Open in browser
http://localhost:4199

# 3. Drag / resize widgets, click "Save", click "Rebuild Template"

# 4. Verify with a test fill
npx tsx scripts/test-fill-wh347.mts
# Open data/wh347-filled-test.pdf
```

## UI controls

- **Click a widget** to select it. Its name and metadata appear in the side panel.
- **Drag the body** of a selected widget to move it.
- **Drag the green corner handle** to resize.
- **Arrow keys** nudge the selected widget by 1 point. **Shift+arrow** by 5 points.
- **Numeric inputs** in the side panel for precise values.
- **Apply X+W to column** — propagates the selected widget's `x` and `w` to all
  other widgets with the same `col` and `kind` (e.g. every worker row's
  `entryNo` span field). This is the fastest way to fix column-wide issues.
- **Apply Y to row** — sets all widgets in the selected widget's row + kind to
  the same `y` baseline.
- **Add Widget** (left panel) — type a name (the dropdown autocompletes with
  every name the generator recognizes), pick type + page, click ➕. A new
  widget appears at screen center; drag it where you want. The name determines
  what data fills it — see the catalog below.
- **Filter** input narrows which widgets are shown (e.g. `w1_` for row 1 only,
  `cert_` for compliance checkboxes).
- **Page 1 / Page 2 tabs** switch pages.
- **Save** writes `widgets.json` to disk.
- **Rebuild Template** runs `scripts/build-wh347-template.mts` which produces
  `assets/wh347-fillable-template.pdf`.

## The name catalog — what goes in which box

The widget **name** is the contract between your calibration and the generator.
Place a box with one of these names and the matching data fills it.

### Page 1 header

| name | fills with |
|---|---|
| `header_projectName` | Project Name |
| `header_projectContractNo` | Project No / Contract No |
| `header_payrollNumber` | Certified Payroll No |
| `header_contractorName` | Prime Contractor / Subcontractor Business Name |
| `header_projectLocation` | Project Location |
| `header_wageDeterminationNo` | Wage Determination No |
| `header_weekEndingDate` | Week Ending Date |
| `header_contractorAddress` | Business Address |
| `cb_final` | checked if `isFinal` |
| `cb_prime` | checked if prime contractor |
| `cb_sub` | checked if subcontractor |

### Page 1 worker grid — per row (replace `N` with 1–8)

| name | fills with |
|---|---|
| `wN_entryNo` | entry number |
| `wN_lastName` | worker last name |
| `wN_firstName` | worker first name |
| `wN_middle` | middle initial |
| `wN_ident` | identifying no (SSN last 4 or internal ID) |
| `wN_labor` | `J` (journeyworker) or `RA` (registered apprentice) |
| `wN_classification` | labor classification |
| `wN_{mon,tue,wed,thu,fri,sat,sun}St` | straight-time hours that day |
| `wN_{mon,tue,wed,thu,fri,sat,sun}Ot` | overtime hours that day |
| `wN_totalHours` | grand total hours (ST+OT, single box) |
| `wN_totalHoursSt` | total ST hours (use with `totalHoursOt` for split box) |
| `wN_totalHoursOt` | total OT hours |
| `wN_baseRate` | hourly wage rate (single box) |
| `wN_baseRateSt` | hourly wage rate, ST sub-box |
| `wN_baseRateOt` | hourly wage rate, OT sub-box (same value, for split layout) |
| `wN_fringe` / `wN_fringeSt` / `wN_fringeOt` | fringe credit |
| `wN_inLieu` / `wN_inLieuSt` / `wN_inLieuOt` | payment in lieu of fringe |
| `wN_grossProject` | gross wages — this project |
| `wN_grossAll` | gross wages — all projects |
| `wN_taxWithheld` | federal tax withheld |
| `wN_fica` | FICA |
| `wN_otherDeduct` | other deductions |
| `wN_totalDeduct` | total deductions |
| `wN_netPay` | net pay |

### Page 2 (Statement of Compliance)

| name | fills with |
|---|---|
| `p2_projectName`, `p2_projectContractNo`, `p2_payrollNo`, `p2_contractorName`, `p2_projectLocation`, `p2_weekEndingDate` | same header data as page 1 |
| `p2_certifyingOfficial` | "{Official Name}, {Title}" |
| `cert_properPayment`, `cert_accuratePayroll`, `cert_workPerformed`, `cert_apprentices`, `cert_fringeBenefits`, `cert_deductions` | compliance checkboxes |
| `sig_officialName` | official name |
| `sig_date` | signature date |
| `sig_phone` | phone number |
| `sig_email` | email (if filled) |

### If you want to split a single-box column into ST + OT sub-boxes

1. Click the existing single box (e.g. `w1_baseRate`).
2. Resize it to just the top half (ST region).
3. Rename it — actually, don't rename in-place. Instead:
   - Leave the existing box alone OR delete it.
   - Use **Add Widget** with name `w1_baseRateSt` for the top.
   - Use **Add Widget** with name `w1_baseRateOt` for the bottom.
4. The generator writes the same base-rate value into both. Repeat for rows 2–8.

## Files

| file | purpose |
|---|---|
| `widgets.json` | source of truth — widget list with positions, shared groups |
| `bg-page1.png` / `bg-page2.png` | background rendered from `assets/wh347-official-2025.pdf` |
| `server.mts` | Express server (port 4199) that serves the UI + save endpoint |
| `index.html` | the calibration UI (vanilla JS, no build step) |
| `extract-widgets.mts` | one-time bootstrapper — regenerates widgets.json from hardcoded defaults |

## Coordinate system

Everything in `widgets.json` is PDF points, bottom-left origin (standard pdf-lib).
`x`, `y` = bottom-left corner of the widget; `w`, `h` = width and height.
The UI flips Y internally for display but stores values in PDF coordinates.

## Widget groupings

Grid widgets (the 8 worker rows) carry `col`, `row`, and `kind` tags so that
"Apply X+W to column" and "Apply Y to row" can propagate changes efficiently:

- `kind: "span"` — full-row-height cells (name, classification, rates, net pay)
- `kind: "st"` / `"ot"` — sub-row hour cells
- `kind: "individual"` — headers, checkboxes, signature block — no group

## If widgets.json gets corrupted

Regenerate from hardcoded defaults:

```bash
npx tsx scripts/calibrate/extract-widgets.mts
```
