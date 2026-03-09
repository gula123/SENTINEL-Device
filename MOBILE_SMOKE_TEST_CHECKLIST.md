# SENTINEL Mobile Smoke Test Checklist

Last updated: 2026-03-09

## 1) Environment

- Backend running and reachable from device/emulator
- App `.env` configured:
  - `EXPO_PUBLIC_API_URL`
  - `EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID`
  - `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`
  - `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
  - `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`

## 2) Authentication

- Launch app shows Google login
- Google sign-in succeeds and lands in app tabs
- Restart app keeps session (secure storage)
- Sign out clears session and returns to login

## 3) Home

- Daily summary loads with real values from backend
- Refresh button updates values without crash
- Auth-expired state shows re-login path

## 4) Diary Core

- Date navigation loads day-specific logs
- Search food and add to selected meal
- Edit grams updates calories/macros
- Delete log removes item
- Daily totals update after add/edit/delete

## 5) Vacation + Quick Fill

- Mark date as vacation, then unmark
- Vacation state reflects in Diary and Quick Actions
- Quick Fill buttons disabled on vacation day
- Quick Fill on normal day adds nutrient entries
- Home summary updates after Quick Fill

## 6) Custom Food + AI

- Open custom food panel in Diary
- AI estimate fills per-100g fields
- Create custom food and log grams successfully
- AI error case shows user-safe message

## 7) Progress

- Month navigation works
- Calendar colors/markers render:
  - Green (within limit)
  - Red (over limit)
  - Vacation emoji
- Streak and missed-target values show

## 8) Settings

- Load profile and limits from backend
- Edit daily limits and save
- Edit per-day overall and meal calories, save
- Reopen app and verify saved values persist

## 9) Basic Stability

- No screen-level crash in core flows above
- Loading and error states are readable
- Tap targets remain usable on small device screens
