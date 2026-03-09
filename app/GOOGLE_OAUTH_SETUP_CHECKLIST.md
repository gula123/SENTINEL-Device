# Google OAuth Fix Checklist (Expo Go)

Project detected from gcloud:
- Project ID: `nodal-descent-482613-e7`
- Account: `gulacsi.gula.norbert@gmail.com`

## What CLI can and cannot do
- `gcloud` can manage Cloud resources and IAM.
- `gcloud` cannot create generic Google Sign-In OAuth credentials for mobile/web apps.
- `gcloud alpha iap oauth-*` is IAP-specific and deprecated, not usable for this app auth flow.

## Create credentials in Google Cloud Console
1. Open `https://console.cloud.google.com/apis/credentials?project=nodal-descent-482613-e7`
2. Click `Create credentials` -> `OAuth client ID`.
3. Create `Web application` client.
4. Create `Android` client.

## Consent screen
1. Open `https://console.cloud.google.com/apis/credentials/consent?project=nodal-descent-482613-e7`
2. Keep publishing status as `Testing`.
3. Add your Google account as `Test user`.

## Values to put into .env
Set these with distinct IDs (do not reuse one ID for all vars):

```dotenv
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<web client id>
EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID=<web client id>
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=<android client id>
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=<ios client id or empty for now>
```

## Android client details you may need
- Android package name for dev build: choose one and keep it stable, for example `com.sentinel.mobile`.
- SHA-1 fingerprint for debug keystore (Windows):

```powershell
keytool -list -v -keystore "$env:USERPROFILE\.android\debug.keystore" -alias androiddebugkey -storepass android -keypass android | findstr "SHA1"
```

## Restart app after env update
```powershell
cd "e:\Code\SENTINEL\SENTINEL-Device\app"
npx expo start -c --android
```

## If Google still shows `Error 400: invalid_request`
- Click `error details` on the Google error page.
- Copy the exact detail line (especially `redirect_uri`, `client_id`, or `origin` mismatch text).
- Fix that exact field in credential config.
