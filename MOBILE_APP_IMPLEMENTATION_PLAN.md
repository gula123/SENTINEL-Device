# SENTINEL Mobile App Plan (Expo)

Last updated: 2026-03-08
Owner: SENTINEL team
Status: Approved for implementation

## 1) Decisions Locked In

- Platform: React Native with Expo (TypeScript)
- Scope target: Android + iOS from one codebase
- Backend: Reuse existing SENTINEL backend APIs
- V1 includes: Vacation Day + Quick Fill
- Auth: Google login only (no email/password in V1)
- Data behavior: Basic cache and resilient logging flow in mobile app
- UX direction: Yazio-style bottom navigation, mobile-optimized (not 1:1 desktop clone)

## 2) Product Scope (V1)

### Core Screens
- Auth (Google sign-in)
- Home (daily summary + key metrics)
- Food Diary (day-based logs by meal)
- Progress (calendar + high-level trends)
- Settings (limits/profile essentials)

### Core Features
- Food search + add log + edit grams + delete log
- Meal grouping and daily totals
- Vacation day toggle (exclude from metrics where desktop already excludes)
- Quick Fill (calorie-first logic, logs raw nutrient foods)
- Custom food creation
- AI estimate in custom food flow

### Out of Scope for V1 (unless explicitly added later)
- Complex offline queue sync conflict resolution
- Multi-auth providers beyond Google
- Full desktop-density analytics views

## 3) Mobile UX Structure (Yazio-style)

Bottom tabs:
- Home
- Diary
- + (quick actions)
- Progress
- Settings

Quick actions from center +:
- Add Food Log
- Quick Fill Day
- Mark/Unmark Vacation
- Add Custom Food

UX principles:
- Thumb-friendly controls
- Fewer dense tables; card-based summaries
- Keep critical actions within 1-2 taps

## 4) Technical Architecture

### App Stack
- Expo (managed workflow)
- React Navigation (tabs + stack)
- React Query (server state, caching, retries)
- SecureStore for auth token persistence
- Day.js for date handling

### Data/Networking
- Shared API client layer in app
- Environment config for API base URL (dev/prod)
- Request interceptor attaches JWT
- Standardized error mapping for user-safe messages

### Basic Cache/Logging Strategy (V1)
- Read cache with React Query stale-time for key screens
- On add/edit/delete log:
  - Try online request first
  - If transient failure, keep local pending action marker and retry option
- Keep strategy simple (no complex merge engine in V1)

## 5) Backend Compatibility Checklist

- Confirm mobile uses same endpoints as frontend:
  - Auth token verification
  - Food search/custom/logs
  - Nutrition summary
  - Vacation day endpoints
  - Quick Fill nutrient foods available in DB via migration
- Ensure production API base URL and TLS are ready for mobile clients
- Confirm Google OAuth mobile client IDs for Android/iOS are configured

## 6) Implementation Phases

## Phase 0 — Foundation (Project Setup)
- Initialize Expo TypeScript app in this repository
- Add navigation, state/query providers, theme primitives
- Add API client, auth storage, env handling
- Add lint/format baseline and folder structure

Deliverable:
- App boots on Android/iOS simulator/device with tab shell + auth guard

## Phase 1 — Auth + Home + Settings
- Google sign-in flow
- Persist session securely
- Home summary cards from backend
- Settings: daily limits and core profile fields

Deliverable:
- User can sign in and see/update core daily context

## Phase 2 — Food Diary Core
- Diary day selector
- Meal sections with logs
- Search and add food log
- Edit grams and delete logs

Deliverable:
- End-to-end logging flow parity with desktop outcomes

## Phase 3 — Vacation + Quick Fill (included in V1)
- Vacation toggle and synced state
- Vacation-aware UI in diary/home/progress relevant views
- Quick Fill UI with percentage menu + tooltip
- Calorie-first quick fill logic, logging nutrient foods to backend

Deliverable:
- Off-plan day workflow fully usable on mobile

## Phase 4 — Custom Food + AI Estimate
- Custom food creation flow
- AI estimate action with assumptions text
- Error handling for quota/unavailable states

Deliverable:
- Custom food creation accelerated with AI support

## Phase 5 — Progress + QA Hardening
- Calendar and trend summary views
- Loading/empty/error polish
- Basic accessibility pass
- Internal test checklist across Android + iOS

Deliverable:
- V1 release candidate quality

## 7) Folder Blueprint (Target)

- src/app/
  - navigation/
  - screens/
    - auth/
    - home/
    - diary/
    - progress/
    - settings/
  - components/
  - services/
    - api/
    - auth/
    - storage/
  - features/
    - foodLogs/
    - vacation/
    - quickFill/
  - hooks/
  - state/
  - utils/

## 8) Acceptance Criteria for V1

- Sign-in works on real Android and iOS devices (Google only)
- User can perform full diary loop: add, edit, delete food logs
- Vacation day toggle is persisted and reflected in key metrics
- Quick Fill applies selected percentage using calorie-first macro distribution
- App remains functional with basic cached data on intermittent connectivity
- No P0 crash in core flows during smoke testing

## 9) Risks and Mitigations

- OAuth mobile setup complexity
  - Mitigation: configure Android/iOS client IDs early in Phase 1
- API contract drift from web frontend expectations
  - Mitigation: build typed API client and validate endpoint-by-endpoint
- Over-scoping V1
  - Mitigation: keep this document as strict source of scope truth

## 10) Working Rules

- Keep desktop behavior parity at outcome level, not pixel parity
- Prefer simple, testable implementation over advanced abstractions in V1
- Any new scope request should be added to this plan before implementation

---

## Change Log

- 2026-03-08: Initial approved plan created with locked decisions:
  - Expo stack
  - Include Vacation + Quick Fill in V1
  - Google-only login
  - Basic cache logging
- 2026-03-08: Phase 0 foundation started:
  - Expo TypeScript app scaffolded under SENTINEL-Device/app
  - Core dependencies added (navigation, react-query, secure-store, dayjs)
  - Auth-gated root navigation and Yazio-style tab shell created
  - API config/client + secure token storage + auth context bootstrapped
- 2026-03-09: Phase 1 auth started:
  - Implemented Expo Google OAuth flow in mobile login screen
  - Connected Google ID token exchange to backend `/api/auth/google-login`
  - Persisting JWT + user profile in secure storage session context
- 2026-03-09: Home integration started:
  - Added typed mobile nutrition summary API client
  - Added React Query hook for cached daily summary fetch
  - Home screen now renders live calories/macros with loading/error/retry states
- 2026-03-09: Phase 2 diary core started:
  - Added typed food logs API layer (fetch/search/add/update/delete)
  - Added React Query diary hooks with cache invalidation for diary + home summary
  - Implemented mobile Diary screen with date navigation, meal grouping, add food, edit grams, and delete
- 2026-03-09: Vacation + Quick Fill implemented for V1:
  - Added mobile user settings + vacation API services and hooks
  - Added reusable calorie-first quick-fill service using Quick Fill nutrient foods
  - Integrated vacation toggle + quick-fill actions into Diary screen
  - Implemented functional Quick Actions tab for vacation and quick-fill by selected date
- 2026-03-09: Progress + Settings implementation:
  - Progress tab now uses backend calendar-data with month navigation, status legend, and streak metrics
  - Settings tab now supports editing profile, daily limits, and per-day limits including meal calories
  - Added mobile save settings flow to backend `/user-settings`
- 2026-03-09: Custom Food + AI estimate implemented:
  - Added mobile API methods for `/food/custom` and `/food/ai-estimate`
  - Added Diary custom-food panel with AI-assisted per-100g estimate
  - Implemented create-and-log flow for custom foods on selected meal/date
- 2026-03-09: Phase 5 polish pass:
  - Improved loading/error consistency in Home, Progress, and Settings
  - Added small accessibility improvements for key interactive controls
  - Added persistent mobile smoke-test checklist document for release validation
