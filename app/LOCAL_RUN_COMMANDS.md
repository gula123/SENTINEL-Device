# Local Run Commands (Emulator + Google Login)

## 1) Start backend (terminal 1)
```powershell
cd "e:\Code\SENTINEL\SENTINEL-Backend"
$env:SPRING_PROFILES_ACTIVE="local"
./mvnw spring-boot:run
```

## 2) Start app on Android emulator (terminal 2)
```powershell
cd "e:\Code\SENTINEL\SENTINEL-Device\app"
npm run android
```

## 3) If Expo/Google screen is blank or broken (GPU issue)
```powershell
& "C:\Users\gulac\AppData\Local\Android\Sdk\platform-tools\adb.exe" emu kill
& "C:\Users\gulac\AppData\Local\Android\Sdk\emulator\emulator.exe" -avd Pixel_9 -gpu swiftshader_indirect -no-snapshot -no-snapshot-load -no-snapshot-save
cd "e:\Code\SENTINEL\SENTINEL-Device\app"
npx expo start -c --android
```

## 4) Optional: list available AVD names
```powershell
& "C:\Users\gulac\AppData\Local\Android\Sdk\emulator\emulator.exe" -list-avds
```

## 5) Full native build (required for Google Sign-In)
```powershell
cd "e:\Code\SENTINEL\SENTINEL-Device\app"
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME = "C:\Users\gulac\AppData\Local\Android\Sdk"
$env:ANDROID_SDK_ROOT = "C:\Users\gulac\AppData\Local\Android\Sdk"
npx expo run:android
```

## 6) For Web
```
npx expo start --web
```

## 7) Android bundle
```
$env:JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"; $env:ANDROID_HOME="C:\Users\gulac\AppData\Local\Android\Sdk"; $env:EXPO_PUBLIC_API_URL="https://api.gulasensei.hu/api"; cd "e:\Code\SENTINEL\SENTINEL-Device\app\android"; .\gradlew.bat :app:assembleRelease :app:bundleRelease

```

## 8) If Google login shows DEVELOPER_ERROR (Android)
```powershell
cd "e:\Code\SENTINEL\SENTINEL-Device\app\android"
$env:JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME="C:\Users\gulac\AppData\Local\Android\Sdk"
$env:ANDROID_SDK_ROOT="C:\Users\gulac\AppData\Local\Android\Sdk"
.\gradlew.bat :app:signingReport
```

Expected for local debug:
- Package: hu.gurul.health.app
- Keystore: C:\Users\gulac\.android\debug.keystore

If signingReport shows a different keystore/SHA1 than Google Console Android OAuth client,
Google Sign-In will fail with DEVELOPER_ERROR.