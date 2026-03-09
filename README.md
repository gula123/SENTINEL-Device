# SENTINEL-Device

Implementation plan: [MOBILE_APP_IMPLEMENTATION_PLAN.md](MOBILE_APP_IMPLEMENTATION_PLAN.md)
Smoke checklist: [MOBILE_SMOKE_TEST_CHECKLIST.md](MOBILE_SMOKE_TEST_CHECKLIST.md)

## Mobile app workspace

- App path: `app/`
- Install dependencies: `cd app && npm install`
- Start Expo: `npm run start`
- Run Android: `npm run android`
- Run iOS (macOS only): `npm run ios`

## Environment variables (app/.env)

- `EXPO_PUBLIC_API_URL` (example: `http://10.0.2.2:8080/api` for Android emulator)
- `EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`