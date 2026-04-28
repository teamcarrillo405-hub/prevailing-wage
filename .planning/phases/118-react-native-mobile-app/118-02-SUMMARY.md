# 118-02 — Navigation, Screens, and Shared Components

**Status:** COMPLETE  
**Date:** 2026-04-27  
**TypeScript:** 0 errors

## Tasks Completed

| Task | File | Description |
|------|------|-------------|
| 118-02-01 | `src/navigation/AppNavigator.tsx` | Bottom tabs + stack navigator with auth gate |
| 118-02-02 | `src/screens/ProjectsScreen.tsx` | Project list, pull-to-refresh, navigate to detail |
| 118-02-03 | `src/screens/ProjectDetailScreen.tsx` | Project detail: location, description, contract amount |
| 118-02-04 | `src/screens/WorkersScreen.tsx` | Worker list with live search filter |
| 118-02-05 | `src/screens/FieldScreen.tsx` | GPS clock-in/out with live elapsed timer, persisted via SecureStore |
| 118-02-06 | `src/screens/PhotoUploadScreen.tsx` | Camera capture + multipart upload + photo grid |
| 118-02-07 | `src/screens/MoreScreen.tsx` | User profile display and sign-out |
| 118-02-08 | `src/components/StatusBadge.tsx` | Color-coded status pill |
| 118-02-08 | `src/components/LoadingSpinner.tsx` | Full-screen activity indicator |
| 118-02-08 | `src/components/ErrorMessage.tsx` | Error display with retry |
| 118-02-09 | `App.tsx` | Wired QueryClient + GestureHandlerRootView + AuthProvider + AppNavigator |
| 118-02-10 | `.env.example` | EXPO_PUBLIC_API_URL template |

## Architecture Decisions

- **React Query v5** for all data fetching with per-query caching and refetch
- **SecureStore** persists active punch across restarts — clock-out survives app kill
- **Auth gate in navigator** — unauthenticated users land on Login stack; no screen flicker
- `Platform` import removed from FieldScreen (unused) — kept strict TS compliance
- `fontVariant: ['tabular-nums']` on elapsed timer for stable digit widths

## Navigation Structure

```
AppNavigator
  ├── (unauthenticated) Stack > LoginScreen
  └── (authenticated) BottomTabs
        ├── Field     → FieldScreen
        ├── Projects  → Stack > ProjectsScreen → ProjectDetailScreen
        ├── Workers   → WorkersScreen
        └── More      → MoreScreen
```

## Next Steps (118-03+)

- Offline queue for punches when no network (SQLite + sync worker)
- Push notifications (FCM + APNS) for compliance alerts
- Biometric authentication gate on app foreground
- Deep linking for project-specific URLs
- Detox E2E test suite for clock-in flow
