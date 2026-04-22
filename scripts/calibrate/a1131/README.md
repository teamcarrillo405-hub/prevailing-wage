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

## Recommended next step
Prototype option 1 (cheapest). If pdf-lib's `addToPage({rotate: ...})`
works with flatten, the port becomes straightforward: add widget with
`rotate: degrees(-90)` and coordinates in landscape space stay as-is.

If option 1 doesn't work, fall back to option 2 (pre-rotate template).

## Files in this directory
- `bg-page1.png`, `bg-page2.png` — 144 DPI renders of the official PDF
- `widgets.json` — empty stub, to be populated after rotation solution
