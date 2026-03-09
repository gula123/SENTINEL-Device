param(
  [switch]$InstallClient
)

$ErrorActionPreference = "Stop"

Set-Location "e:\Code\SENTINEL\SENTINEL-Device\app"

$adb = Get-Command adb -ErrorAction SilentlyContinue
if (-not $adb) {
  throw "ADB not found. Install Android Platform Tools and ensure adb is on PATH."
}

Write-Host "Starting ADB server..."
adb start-server | Out-Null

$deviceLines = adb devices | Select-String "\sdevice$"
if (-not $deviceLines) {
  throw "No authorized Android device found. Connect phone via USB and allow USB debugging."
}

if ($InstallClient) {
  Write-Host "Installing/refreshing native dev client on connected device..."
  $env:EXPO_PUBLIC_API_TARGET = "device"
  npx expo run:android --device
}

Write-Host "Setting USB reverse for Metro (8081) and backend API (8080)..."
adb reverse tcp:8081 tcp:8081 | Out-Null
adb reverse tcp:8080 tcp:8080 | Out-Null

$env:EXPO_PUBLIC_API_URL = "http://localhost:8080/api"
$env:EXPO_PUBLIC_API_TARGET = "device"

Write-Host "Launching Expo dev server for dev client over localhost..."
npx expo start -c --dev-client --localhost
