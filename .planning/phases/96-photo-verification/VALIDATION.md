# Phase 96 — Photo Verification: Validation Checklist

## Automated Checks

```bash
cd /c/Users/glcar/prevailing-wage

# 1. TypeScript compiles clean
npx tsc --noEmit 2>&1 | grep -c "error TS" || echo "0 errors"

# 2. Migration file exists
ls src/server/db/migrations/0035_photo_verification.sql

# 3. Schema exports both new tables
grep -c "projectPhotos\|contractorSignatures" src/server/db/schema.ts

# 4. Signatures route file exists
ls src/server/routes/signatures.ts

# 5. Signatures router mounted in index.ts
grep "signatureRouter\|signatures" src/server/index.ts

# 6. SignaturePad and PhotoGallery components exist
ls src/client/components/ui/SignaturePad.tsx
ls src/client/components/ui/PhotoGallery.tsx

# 7. ProjectDetailPage imports both components
grep "SignaturePad\|PhotoGallery" src/client/pages/ProjectDetailPage.tsx
```

## Functional Verification (Manual — run dev server)

```bash
npm run dev  # server on :4099, Vite on :5173
```

### Signature Pad
- [ ] Navigate to any project detail page
- [ ] "Contractor Signature" card visible below wage determinations
- [ ] Drawing on canvas with mouse produces visible strokes
- [ ] "Clear" button wipes canvas
- [ ] "Save Signature" POSTs to /api/projects/:id/signature — Network tab shows 201
- [ ] After save, signature image renders as `<img>` below canvas
- [ ] Reloading page still shows saved signature (persisted)
- [ ] "Remove Signature" deletes it — image disappears

### Photo Gallery
- [ ] "Site Photos" card visible on project detail page
- [ ] "Upload Site Photo" button opens file picker with camera option on mobile
- [ ] Uploading a JPEG triggers POST /api/projects/:id/photos — Network tab shows 201
- [ ] Thumbnail appears in grid after upload
- [ ] JPEG with GPS EXIF: coordinates appear below thumbnail (e.g. "37.7749, -122.4194")
- [ ] JPEG without GPS EXIF: no coordinates shown (no crash)
- [ ] PNG upload: uploads successfully, no coordinates shown
- [ ] "Remove" on a photo deletes it from grid

## Requirements Traceability

| Requirement | Component | Status |
|-------------|-----------|--------|
| MOB-19: Contractor digital signature capture | SignaturePad.tsx | Validate above |
| MOB-20: Site photo gallery + EXIF geotag display | PhotoGallery.tsx | Validate above |
