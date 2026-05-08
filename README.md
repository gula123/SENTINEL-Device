# GURUL-Device

Implementation plan: [MOBILE_APP_IMPLEMENTATION_PLAN.md](MOBILE_APP_IMPLEMENTATION_PLAN.md)
Smoke checklist: [MOBILE_SMOKE_TEST_CHECKLIST.md](MOBILE_SMOKE_TEST_CHECKLIST.md)

## Mobile app workspace

- App path: `app/`
- Install dependencies: `cd app && npm install`
- Start Expo: `npm run start`
- Run Android: `npm run android`
- Run iOS (macOS only): `npm run ios`
- PR quality scripts:
  - `npm run test`
  - `npm run coverage`
  - `npm run typecheck`

## Mobile PR quality gate contract

- Workflow: `.github/workflows/pull-request-device-quality-gate.yml`
- Required status-check job name: `device-quality-gate`
- Stricter scoped thresholds are enforced for:  
  `RootNavigator.tsx`, `services/api/client.ts`, `services/auth/authApi.ts`, `services/auth/nativeGoogleSession.ts`, `config/env.ts`
- Staged global thresholds are explicitly configured in `app/package.json` for the broader mobile auth/provider/login scope while the suite grows.
- Emulator/device smoke validation is intentionally **not** part of the required PR gate; keep it in manual/scheduled smoke workflows until proven stable.
- Branch protection is a manual GitHub setting: after this workflow exists, enable `device-quality-gate` as a required status check in repository branch protection rules.

## Environment variables (app/.env)

- `EXPO_PUBLIC_API_URL` (example: `http://10.0.2.2:8080/api` for Android emulator)
- `EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
