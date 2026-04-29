# Phase 97 — Mobile Nav Redesign: Validation Checklist

## Automated Checks

```bash
cd /c/Users/glcar/prevailing-wage

# 1. TypeScript clean
npx tsc --noEmit 2>&1 | grep -c "error TS" || echo "0 errors"

# 2. BottomTabBar component exists
ls src/client/components/shared/BottomTabBar.tsx

# 3. Layout imports BottomTabBar
grep "BottomTabBar" src/client/components/shared/Layout.tsx

# 4. md:hidden present in BottomTabBar (mobile-only gating)
grep "md:hidden" src/client/components/shared/BottomTabBar.tsx

# 5. Four tabs defined
grep -c "Field\|Payroll\|Projects\|More" src/client/components/shared/BottomTabBar.tsx
```

## Functional Verification (Manual — Chrome DevTools)

```bash
npm run dev
```

Open http://localhost:5173/dashboard

### Desktop (>= 768px)
- [ ] Bottom tab bar NOT visible at 1024px width
- [ ] Top nav unaffected — all links still work

### Mobile Simulation (375px — iPhone SE in DevTools)
- [ ] Fixed bottom bar visible with 4 labeled tabs: Field, Payroll, Projects, More
- [ ] Each tab has an icon above the label
- [ ] Main content not hidden behind bar (has bottom padding)
- [ ] Active tab (current route) shows brand-gold color
- [ ] Inactive tabs show gray text

### Tab Navigation
- [ ] Tapping "Field" navigates to /field
- [ ] Tapping "Payroll" navigates to /dashboard
- [ ] Tapping "Projects" navigates to /reports
- [ ] Tapping "More" navigates to /team

### Swipe Gestures (on a tab route page)
- [ ] Swipe left (right-to-left) on /field → navigates to /dashboard
- [ ] Swipe right (left-to-right) on /dashboard → navigates to /field
- [ ] Swipe left on /team → no navigation (last tab, no next)
- [ ] Short swipe (< 60px) → no navigation triggered

## Requirements Traceability

| Requirement | Implementation | Status |
|-------------|----------------|--------|
| MOB-21: Bottom tab bar for field workers | BottomTabBar.tsx + Layout.tsx | Validate above |
| MOB-21: Visible only on mobile (< 768px) | md:hidden class on nav element | Validate above |
| MOB-21: Swipe gesture routing between tabs | Touch handlers in Layout.tsx | Validate above |
