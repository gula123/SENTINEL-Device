param(
  [switch]$Reset
)

$ErrorActionPreference = "Stop"

Set-Location "e:\Code\GURUL\GURUL-Device\app"

$sdkRoot = "$env:LOCALAPPDATA\Android\Sdk"
$emulatorExe = Join-Path $sdkRoot "emulator\emulator.exe"
$adbExe = Join-Path $sdkRoot "platform-tools\adb.exe"

if (!(Test-Path $emulatorExe)) {
  throw "Android emulator binary not found at $emulatorExe"
}

if (!(Test-Path $adbExe)) {
  throw "adb not found at $adbExe"
}

$avds = & $emulatorExe -list-avds
if (-not $avds) {
  throw "No AVD found. Create one in Android Studio Device Manager first."
}

$avdName = if ($avds -contains "Pixel_9") {
  "Pixel_9"
} elseif ($avds -contains "Medium_Phone_API_36.1") {
  "Medium_Phone_API_36.1"
} else {
  $avds[0]
}

if ($Reset) {
  Write-Host "Reset mode: shutting down running emulators..."
  $emulatorSerials = (& $adbExe devices | Select-String "^emulator-\d+\s+device") | ForEach-Object {
    ($_ -split "\s+")[0]
  }

  foreach ($serial in $emulatorSerials) {
    & $adbExe -s $serial emu kill | Out-Null
  }

  Start-Sleep -Seconds 2
}

$runningEmulator = & $adbExe devices | Select-String "emulator-\d+\s+device"
if (-not $runningEmulator) {
  Write-Host "Starting AVD: $avdName"
  Start-Process -FilePath $emulatorExe -ArgumentList @(
    "-avd", $avdName,
    "-gpu", "swiftshader_indirect",
    "-no-snapshot",
    "-no-snapshot-load",
    "-no-snapshot-save",
    "-no-boot-anim"
  ) | Out-Null

  & $adbExe wait-for-device | Out-Null

  $booted = $false
  for ($i = 0; $i -lt 60; $i++) {
    $status = (& $adbExe shell getprop sys.boot_completed).Trim()
    if ($status -eq "1") {
      $booted = $true
      break
    }
    Start-Sleep -Seconds 2
  }

  if (-not $booted) {
    throw "Emulator did not finish booting in time."
  }
}

$env:EXPO_PUBLIC_API_TARGET = "emulator"

Write-Host "Setting ADB reverse for Expo and backend ports..."
& $adbExe reverse tcp:8081 tcp:8081 | Out-Null
& $adbExe reverse tcp:19000 tcp:19000 | Out-Null
& $adbExe reverse tcp:19001 tcp:19001 | Out-Null
& $adbExe reverse tcp:8080 tcp:8080 | Out-Null

Write-Host "Launching Expo in emulator mode..."
npx expo start -c --android --go --localhost
