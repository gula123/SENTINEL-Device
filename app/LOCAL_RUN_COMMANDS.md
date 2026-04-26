# Local Run Commands (Emulator + Google Login)

## 1) Start backend (terminal 1)
```powershell
cd "e:\Code\GURUL\GURUL-Backend"
$env:SPRING_PROFILES_ACTIVE="local"
./mvnw spring-boot:run
```

## 2) Start emulator (terminal 2)
```powershell
$adb = "C:\Users\gulac\AppData\Local\Android\Sdk\platform-tools\adb.exe"
$emu = "C:\Users\gulac\AppData\Local\Android\Sdk\emulator\emulator.exe"

# Restart adb server to avoid "device offline" protocol issues.
& $adb kill-server
& $adb start-server

# Start emulator in this terminal and keep it running.
& $emu -avd Pixel_9 -gpu swiftshader_indirect -no-snapshot -no-snapshot-load -no-snapshot-save
```

## 3) Wait until emulator is fully online (terminal 3)
```powershell
$adb = "C:\Users\gulac\AppData\Local\Android\Sdk\platform-tools\adb.exe"
& $adb wait-for-device
& $adb devices
```

## 4) For Android (terminal 4)
```powershell
cd "e:\Code\GURUL\GURUL-Device\app"
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME = "C:\Users\gulac\AppData\Local\Android\Sdk"
$env:ANDROID_SDK_ROOT = "C:\Users\gulac\AppData\Local\Android\Sdk"
npx expo run:android
```

## 5) For Web
```
cd "e:\Code\GURUL\GURUL-Device\app"
npx expo start --web
```