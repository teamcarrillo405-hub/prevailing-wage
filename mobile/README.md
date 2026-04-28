# Prevailing Wage — Field Mobile App

React Native (Expo) app for field clock-in, project browsing, worker lookup, and photo capture.

## Requirements

- Node 18+
- Expo CLI: `npm install -g expo-cli` (or use `npx expo`)
- iOS Simulator (Xcode 16+) or Android Emulator (Android Studio Hedgehog+)
- Physical device with Expo Go for quick testing

## Setup

1. Install dependencies:
   ```bash
   cd mobile
   npm install
   ```

2. Configure environment:
   ```bash
   cp .env.example .env.local
   # Edit .env.local and set EXPO_PUBLIC_API_URL to your backend URL
   ```

3. Start the dev server:
   ```bash
   npx expo start
   ```
   - Press `i` for iOS simulator
   - Press `a` for Android emulator
   - Scan the QR code with Expo Go on a physical device

## Environment Variables

| Variable | Description |
|---|---|
| `EXPO_PUBLIC_API_URL` | Base URL of the prevailing-wage backend API (e.g. `https://your-app.onrender.com`) |

## Project Structure

```
mobile/
  App.tsx                          # Root — QueryClient + AuthProvider + AppNavigator
  src/
    lib/
      api.ts                       # Axios client with Bearer token from SecureStore
    context/
      AuthContext.tsx              # Auth state, login/logout, MFA support
    navigation/
      AppNavigator.tsx             # Bottom tabs + stack navigator, auth gate
    screens/
      LoginScreen.tsx              # Email/password + TOTP MFA
      FieldScreen.tsx              # GPS clock-in / clock-out with live timer
      ProjectsScreen.tsx           # Project list with pull-to-refresh
      ProjectDetailScreen.tsx      # Project detail view
      WorkersScreen.tsx            # Worker list with search
      MoreScreen.tsx               # Profile and sign-out
      PhotoUploadScreen.tsx        # Camera capture + photo grid
    components/
      StatusBadge.tsx              # Colored status pill
      LoadingSpinner.tsx           # Centered activity indicator
      ErrorMessage.tsx             # Error display with retry button
```

## Features

- **GPS Clock-In/Out** — Records latitude/longitude on each punch via expo-location
- **Persistent punch state** — Active punch survives app restarts via expo-secure-store
- **Project browsing** — Pull-to-refresh list, tap to view detail
- **Worker search** — Live filter by name
- **Photo capture** — Camera access via expo-image-picker, multipart upload
- **Biometric-ready auth** — SecureStore token persistence with MFA support
- **Offline-tolerant** — React Query caches data for stale reads

## Key Dependencies

- `expo` ~54 / `react-native` 0.81
- `@react-navigation/native` + `bottom-tabs` + `stack`
- `@tanstack/react-query` v5
- `expo-location`, `expo-secure-store`, `expo-image-picker`
- `react-native-gesture-handler`, `react-native-screens`
