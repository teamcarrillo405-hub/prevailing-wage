# CA A-1-131 Widget Calibration — PENDING ROTATION FIX

## Status
Scaffolding only. Not yet fully ported.

## The rotation problem
The DIR A-1-131 official PDF is stored PORTRAIT (612 × 1008) with
`/Rotate=90°`. The viewer displays it landscape. AcroForm widgets do
NOT inherit this rotation — they render in the page's native (portrait)
coordinate space, so placing a widget at (100, 100) makes it appear
sideways on the displayed form.

Proof: `scripts/_rotation-test.mts` (now deleted) placed a widget with
text "ROTATE?" and rendered it — text appeared 90° CCW rotated.

## Possible fixes (not yet implemented)

1. **Widget /R annotation rotation** — pdf-lib's `addToPage` accepts a
   `rotate: Rotation` option. Setting `rotate: degrees(-90)` should make
   the widget render upright. Need to verify this actually works with
   flatten().

2. **Pre-rotate the template** — generate a new landscape-native template
   PDF (1008 × 612, `/Rotate=0`) by baking the CTM rotation into the
   content stream. Widgets would then use landscape coords directly.

3. **Coordinate transform** — place widgets at transformed rectangles:
   portrait_x = ly, portrait_y = lx (approximately). Requires careful
   math and test rendering.

## Empirical findings (2026-04-21)

Tested `addToPage({ rotate: ... })` with three values:
- `rotate: degrees(-90)` → widget invisible / misaligned
- `rotate: degrees(90)` → **widget text renders UPRIGHT on landscape display** ✓
- `rotate: degrees(270)` → widget renders upside down

So option 1 works for TEXT ORIENTATION. But widget POSITION (x, y) is
still in native portrait coords — placing a widget at (x=300, y=500)
did not land where expected on the landscape-rotated display.

## Coordinate transform needed

Given landscape rect (lx, ly, lw, lh) on the 1008×612 display, the
native portrait rect for pdf-lib's `addToPage` is (guess, unverified):

```
x = 612 - (ly + lh)
y = lx
w = lh
h = lw
// plus rotate: degrees(90)
```

Needs verification via a targeted test (place widget at known landscape
position, render, compare). Once verified, port becomes mechanical.

## Status: PARKED

Portrait forms (pw12, ilPdfGenerator, njPdfGenerator, maPdfGenerator,
complianceSummaryPdfGenerator) don't have this rotation complication
and should be ported first. Revisit A-1-131 after those land.

## Files in this directory
- `bg-page1.png`, `bg-page2.png` — 144 DPI renders of the official PDF
- `widgets.json` — empty stub, to be populated after rotation solution
