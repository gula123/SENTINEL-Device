# Copilot Workflow Plan (MVP to Post-MVP)

## Purpose
Capture a lightweight rollout plan for improving Copilot usage without slowing MVP delivery.

## Phase 1: Start Now (Pre-MVP)
Goal: Reduce rework while keeping speed high.

1. Bugfix workflow
- Reproduce issue
- Identify root cause
- Apply minimal patch
- Run quick manual verification checklist
- Report risks and assumptions

2. UI interaction workflow
- Define expected behavior
- Compare behavior to a reference screen in app
- Implement smallest behavior fix
- Validate on real device

3. Release triage workflow
- Separate fatal errors from warnings
- Fix first fatal blocker only
- Re-run target build step
- Record root cause and fix location

## Phase 2: MVP Stabilization
Goal: Add consistency gates before calling work done.

1. Required validation for completed tasks
- Type check passes
- Relevant build command passes
- Manual smoke check for touched flow

2. Required task summary format
- Root cause
- Files changed
- Validation run
- Residual risk / unverified areas

## Phase 3: Post-MVP (Tests Available)
Goal: Increase safe autonomy and regression confidence.

1. Stronger definition of done
- Tests added/updated for changed logic
- Regression checks run in CI
- Clear rollback path for risky changes

2. More autonomous execution
- Copilot handles larger end-to-end tasks
- Human approval gates for high-risk operations

## Minimal Starter Workflows to Productize
1. Bugfix flow (symptom -> root cause -> patch -> verify)
2. UI swipe/gesture flow (expected UX -> compare -> patch -> device validation)
3. Release build failure flow (log triage -> fatal cause -> exact fix -> rerun)

## Notes
- Keep workflows lightweight during MVP.
- Increase strictness as tests and CI coverage mature.
- Treat prompts as inputs, workflows as method, and reusable skills as packaged methods.
