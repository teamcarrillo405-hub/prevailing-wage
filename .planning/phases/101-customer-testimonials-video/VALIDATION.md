# Phase 101 Validation — Customer Testimonials + Video

## Requirements Covered
- TRUST-05: 3 contractor quotes with photos (avatars) on /testimonials
- TRUST-06: YouTube video embed + PDF case study download link

## Manual Checks

### 1. Route resolves
- [ ] Visit http://localhost:5173/testimonials — page loads without 404
- [ ] Visible as anonymous user (no login required)
- [ ] Visible while logged in (not blocked by PublicRoute redirect)

### 2. Testimonials content
- [ ] 3 quote cards visible with initials avatars
- [ ] Each card shows: quote text, name, company, project
- [ ] Gold quote decoration visible on each card

### 3. Video embed
- [ ] YouTube iframe is rendered
- [ ] iframe has allowFullScreen attribute
- [ ] TODO comment present indicating real video ID needed

### 4. PDF / Case Study
- [ ] "Download PDF Case Study" link visible
- [ ] Clicking link navigates to /case-studies/hcc (existing page)

### 5. Navigation
- [ ] LandingPage footer includes "Testimonials" link pointing to /testimonials
- [ ] Page nav has "HCC Prevailing Wage" gold logo linking to /

## Automated Check
```bash
cd /c/Users/glcar/prevailing-wage && npx tsc --noEmit 2>&1 | grep -v "workers.ts" | grep -c "error" || echo "0 new errors"
```
Expected: 0 new errors beyond the known workers.ts implicit-any pre-existing errors.
