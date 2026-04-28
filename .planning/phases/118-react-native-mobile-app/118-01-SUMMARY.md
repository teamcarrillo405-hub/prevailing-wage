# Phase 118-01 Summary — Mobile Auth Token Endpoint + Expo Scaffold

## Date
2026-04-27

## Tasks Completed

### 118-01-01 — GET /api/auth/token endpoint
Added to `src/server/routes/auth.ts` after the `/me` route. The endpoint is protected by `requireAuth` middleware, reads `req.cookies.pw_session`, and returns `{ token }`. Also added a named export `router` (`export { authRouter as router }`) so the test file can import it with destructuring without breaking the existing default export.

### 118-01-02 — Expo project created
Ran `npx create-expo-app mobile --template blank-typescript` from the repo root. The `mobile/` directory was confirmed absent before running.

### 118-01-03 — Mobile dependencies installed
Installed the following in `mobile/` with `--legacy-peer-deps`:
- `expo-secure-store`, `expo-location`, `expo-camera`, `expo-image-picker`
- `@react-navigation/native`, `@react-navigation/bottom-tabs`, `@react-navigation/stack`
- `react-native-screens`, `react-native-safe-area-context`, `react-native-gesture-handler`
- `@tanstack/react-query`, `axios`

### 118-01-04 — mobile/src/lib/api.ts
Created Axios instance with `EXPO_PUBLIC_API_URL` base URL (defaults to `http://localhost:4099`). Request interceptor attaches Bearer token from SecureStore. Response interceptor clears token on 401. Exports `saveToken`, `clearToken`, `getToken` helpers.

### 118-01-05 — mobile/src/context/AuthContext.tsx
React context providing `user`, `loading`, `login`, and `logout`. On mount, calls `/api/auth/me` to restore session. `login()` posts credentials, calls `/api/auth/token` for the JWT, stores it in SecureStore, then fetches the user profile. `logout()` calls `/api/auth/logout` and clears the stored token.

### 118-01-06 — mobile/src/screens/LoginScreen.tsx
Login form with email, password, and optional 6-digit MFA code field. MFA field appears after server returns `requiresMfa: true`. Styled with `#0A1628` brand color and borderRadius/padding consistent with the web app design.

### 118-01-07 — mobile/app.json updated
- `name` set to `Prevailing Wage`
- `slug` set to `prevailing-wage-mobile`
- `ios.bundleIdentifier` set to `com.hcc.prevailingwage`
- `android.package` set to `com.hcc.prevailingwage`
- `expo.plugins` added for `expo-secure-store` and `expo-location` (with location permission string)

### 118-01-08 — Vitest test for GET /api/auth/token
Created `src/server/routes/__tests__/auth-token.test.ts`. Uses `vi.mock` to stub `requireAuth` (bypasses JWT validation) and dynamically imports the router after mocking. Two cases: token present returns 200 with token value; no cookie returns 401.

## Test Results
- Targeted test: 2/2 passed
- Full suite: 840 tests passed, 42 todo, 7 skipped, 0 failures

## Files Changed / Created
- `src/server/routes/auth.ts` — added `/token` route and named `router` export
- `src/server/routes/__tests__/auth-token.test.ts` — new Vitest test file
- `mobile/` — new Expo project (scaffolded by create-expo-app)
- `mobile/app.json` — updated with app identity and plugins
- `mobile/src/lib/api.ts` — Axios client with SecureStore Bearer auth
- `mobile/src/context/AuthContext.tsx` — React auth context
- `mobile/src/screens/LoginScreen.tsx` — login UI with MFA support
