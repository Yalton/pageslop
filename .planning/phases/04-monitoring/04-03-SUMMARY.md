---
phase: 04-monitoring
plan: 03
subsystem: ui
tags: [react, swr, uptime, tooltip, shadcn, tailwind, vitest]

# Dependency graph
requires:
  - phase: 04-monitoring/04-01
    provides: checkUrl, updateUptimeStatus, UptimeStatus type, schema fields (uptimeStatus, lastStatusCode, lastCheckedAt)
  - phase: 04-monitoring/04-02
    provides: POST /api/links/[id]/check endpoint, monitor-sweep worker handler
provides:
  - UptimeDot component (gray/green/red status dot with tooltip)
  - Uptime dot integrated into LinkCard (grid view)
  - Uptime dot integrated into LinkCardList (list view)
  - Detail view with UptimeDot, last-checked timestamp, and Check now button
  - Manual recheck flow: POST /api/links/[id]/check + SWR revalidation
  - checkLink helper added to useLinks hook
affects: [05-llm, 06-polish]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - UptimeDot is a pure presentational component — receives status/timestamp/statusCode as props, no data fetching
    - Tooltip wraps dot via TooltipProvider > Tooltip > TooltipTrigger (asChild) + TooltipContent
    - Check now triggers POST then calls onMutate() immediately + 3s spinner for worker processing time
    - checkUrl falls back from HEAD to GET on any 4xx, not just 405

key-files:
  created:
    - src/components/links/UptimeDot.tsx
  modified:
    - src/components/links/LinkCard.tsx
    - src/components/links/LinkCardList.tsx
    - src/components/links/LinkDetail.tsx
    - src/lib/hooks/useLinks.ts
    - src/lib/monitor/check-url.ts
    - src/app/(auth)/login/page.tsx
    - src/components/layout/ThemeToggle.tsx
    - tests/monitor/check-url.test.ts

key-decisions:
  - "check-url fallback broadened to any 4xx HEAD response (not just 405) — some servers return 404 for HEAD but work with GET"
  - "Login redirect: remove callbackURL and push directly to /dashboard after sign-in"
  - "ThemeToggle uses mounted state to avoid hydration mismatch on server render"

patterns-established:
  - "UptimeDot pattern: small rounded status dot, color-coded by UptimeStatus, wrapped in Tooltip"
  - "Check now pattern: POST to /api/links/[id]/check, immediately call onMutate(), hold spinner for 3s worker processing window"

requirements-completed: [MNTR-02]

# Metrics
duration: ~20min
completed: 2026-03-19
---

# Phase 4 Plan 03: Uptime Monitoring UI Summary

**Green/red/gray UptimeDot component with tooltip integrated into all link views (grid, list, detail) plus a working Check now button that enqueues monitor jobs via pg-boss**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-03-19T00:10:54Z
- **Completed:** 2026-03-19T15:35:00Z
- **Tasks:** 2 (1 auto + 1 checkpoint:human-verify)
- **Files modified:** 8

## Accomplishments

- UptimeDot component renders three states: gray (unchecked), green (up), red (down) with tooltip showing relative time and HTTP status code label
- UptimeDot integrated into LinkCard (grid view, next to domain text) and LinkCardList (list view, after favicon)
- LinkDetail shows UptimeDot, last-checked relative timestamp, and Check now button with loading/spinner state
- Check now button POSTs to `/api/links/[id]/check`, triggers SWR revalidation, and holds spinner for 3s to allow worker processing
- check-url broadened to fall back from HEAD to GET on any 4xx response (not just 405) — improves false-negative avoidance
- Human verification passed: dots visible in grid and list views, tooltip works, Check now flow confirmed end-to-end

## Task Commits

Each task was committed atomically:

1. **Task 1: UptimeDot component and integration** - `c75a920` (feat)
2. **Post-checkpoint fix: broaden HEAD->GET fallback to all 4xx, update tests** - `003b7e0` (fix)
3. **Misc fixes: login redirect, ThemeToggle hydration** - `b30ff8e` (fix)
4. **Package lock update** - `37b5550` (chore)

**Plan metadata:** _(docs commit follows)_

## Files Created/Modified

- `src/components/links/UptimeDot.tsx` - Status dot component with Tooltip, color map, status code labels
- `src/components/links/LinkCard.tsx` - Added UptimeDot next to domain text in grid card
- `src/components/links/LinkCardList.tsx` - Added UptimeDot after favicon in list row
- `src/components/links/LinkDetail.tsx` - Added status row with UptimeDot, timestamp, Check now button
- `src/lib/hooks/useLinks.ts` - Added checkLink helper for consistent hook API
- `src/lib/monitor/check-url.ts` - Broadened GET fallback from 405-only to any 4xx
- `src/app/(auth)/login/page.tsx` - Fixed redirect to /dashboard after sign-in
- `src/components/layout/ThemeToggle.tsx` - Added mounted state to prevent hydration mismatch
- `tests/monitor/check-url.test.ts` - Updated 404 test for new fallback behavior, added true-404 test

## Decisions Made

- Broadened check-url fallback: HEAD returning any 4xx now retries with GET, since many servers return 404 for HEAD but serve content normally on GET. Previous 405-only fallback was too narrow.
- Login page removes `callbackURL: '/'` option and redirects directly to `/dashboard` — avoids a double-redirect through the marketing page.
- ThemeToggle uses a `mounted` state gate to render a blank span on the server, matching the client's pre-hydration state and eliminating the hydration mismatch warning.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test suite failure after post-checkpoint behavioral change to check-url.ts**
- **Found during:** Wrap-up (after human verification checkpoint)
- **Issue:** check-url.ts was modified post-checkpoint to fall back on any 4xx (not just 405), but the test for a 404 HEAD response still expected `{ statusCode: 404, up: false }` — with the new code, a second fetch call is made (GET) and the mock only had one response queued, so it returned null.
- **Fix:** Updated the 404 HEAD test to mock both calls and verify the fallback. Added a separate "true 404" test where both HEAD and GET return 404.
- **Files modified:** tests/monitor/check-url.test.ts
- **Verification:** 120/120 tests pass
- **Committed in:** 003b7e0

**2. [Rule 1 - Bug] Login page redirected to / instead of /dashboard**
- **Found during:** Human verification
- **Issue:** After sign-in, the login page called `router.push('/')` which lands on the marketing page instead of the app.
- **Fix:** Changed redirect target to `/dashboard` and removed `callbackURL: '/'` option from signIn.email call.
- **Files modified:** src/app/(auth)/login/page.tsx
- **Committed in:** b30ff8e

**3. [Rule 1 - Bug] ThemeToggle hydration mismatch**
- **Found during:** Human verification
- **Issue:** ThemeToggle renders `<Sun>` or `<Moon>` based on `theme` from next-themes, but on the server `theme` is undefined, causing a React hydration mismatch.
- **Fix:** Added `mounted` state initialized to false, set to true via useEffect. Render a placeholder `<span>` until mounted.
- **Files modified:** src/components/layout/ThemeToggle.tsx
- **Committed in:** b30ff8e

---

**Total deviations:** 3 auto-fixed (all Rule 1 - Bug)
**Impact on plan:** All fixes necessary for correctness. The check-url and login redirect were discovered during or immediately after human verification. No scope creep.

## Issues Encountered

- The post-checkpoint fix to check-url.ts (broadening GET fallback) introduced a test failure that needed updating before the summary could be created. Fixed by updating the test to match the intentional new behavior.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 4 monitoring is complete: schema, core logic, API, worker sweep, and UI indicators all wired up.
- MNTR-01 (schedule pings) and MNTR-02 (uptime indicator) requirements both complete.
- Phase 5 (LLM/BYOK) is next — no blockers from Phase 4.

## Self-Check: PASSED

- FOUND: src/components/links/UptimeDot.tsx
- FOUND: src/lib/monitor/check-url.ts
- FOUND: .planning/phases/04-monitoring/04-03-SUMMARY.md
- FOUND: c75a920 (feat: UptimeDot integration)
- FOUND: 003b7e0 (fix: check-url fallback)
- FOUND: b30ff8e (fix: login redirect + ThemeToggle)
- Tests: 120/120 passing

---
*Phase: 04-monitoring*
*Completed: 2026-03-19*
