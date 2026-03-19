---
phase: 04-monitoring
plan: 01
subsystem: database
tags: [drizzle-orm, postgres, vitest, tdd, uptime, monitoring]

# Dependency graph
requires:
  - phase: 02-enrichment
    provides: links table schema and Link/LinkWithTags types used as base

provides:
  - checkUrl: HTTP HEAD/GET availability checker with AbortController timeout and 405 fallback
  - updateUptimeStatus: two-consecutive-failure rule with atomic SQL CASE expression
  - listLinksForMonitor: query returning id+url for all ready links across all users
  - links table extended with 4 uptime columns (uptimeStatus, lastStatusCode, lastCheckedAt, consecutiveFailures)
  - UptimeStatus type and Link interface extended with uptime fields

affects:
  - 04-monitoring/04-02 (scheduler/sweep worker that calls these functions)
  - 04-monitoring/04-03 (UI that reads uptime columns from Link type)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - TDD RED-GREEN cycle for pure-ish functions with mocked fetch and db
    - AbortController pattern for fetch timeout (10s window, clearTimeout on both success and error paths)
    - Atomic SQL via drizzle-orm sql template for consecutiveFailures increment and CASE expression for conditional status flip
    - pg-boss mock updated to include named PgBoss export alongside default for v12 compatibility

key-files:
  created:
    - src/lib/monitor/check-url.ts
    - src/lib/monitor/uptime.ts
    - tests/monitor/check-url.test.ts
    - tests/monitor/uptime-logic.test.ts
  modified:
    - src/lib/db/schema.ts
    - src/types/index.ts
    - src/lib/db/queries/links.ts
    - tests/setup.ts

key-decisions:
  - "checkUrl tries HEAD first, falls back to GET on 405 — many servers block HEAD but allow GET"
  - "updateUptimeStatus uses sql template for atomic consecutiveFailures increment — prevents race conditions when multiple workers could check same link"
  - "uptimeStatus CASE expression flips to 'down' at consecutiveFailures >= 2 — avoids false alarms from transient failures"
  - "listLinksForMonitor selects only ready links — skip pending/error links that haven't been scraped yet"

patterns-established:
  - "Monitor functions: pure-ish with injected fetch/db — testable via global mock and vi.mock"
  - "Atomic SQL updates: use drizzle sql template for any counter that may be modified concurrently"

requirements-completed: [MNTR-01]

# Metrics
duration: 3min
completed: 2026-03-19
---

# Phase 4 Plan 01: Schema and Core Monitor Logic Summary

**Native fetch HEAD/GET uptime checker and two-consecutive-failure SQL state machine on extended links table, with 14 TDD tests**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-19T00:02:14Z
- **Completed:** 2026-03-19T00:05:17Z
- **Tasks:** 2 (RED + GREEN)
- **Files modified:** 7

## Accomplishments
- Extended links table with 4 uptime columns and pushed schema to database
- Implemented checkUrl with HEAD/GET fallback and AbortController 10s timeout using native fetch
- Implemented updateUptimeStatus with atomic SQL increment and CASE expression for two-consecutive-failure rule
- Added listLinksForMonitor query returning ready links across all users
- All 14 monitor unit tests pass; 115 total tests pass with no regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema extension, types, test scaffolds, pg-boss mock update (RED)** - `164c870` (test)
2. **Task 2: Implement checkUrl and updateUptimeStatus (GREEN)** - `9ec356d` (feat)

_Note: TDD tasks have two commits (test RED then feat GREEN)_

## Files Created/Modified
- `src/lib/monitor/check-url.ts` - HTTP availability checker: HEAD first, GET fallback on 405, AbortController timeout, catch-all error handler
- `src/lib/monitor/uptime.ts` - Uptime state machine: success resets to up+0 failures, failure atomically increments and flips to down at 2
- `src/lib/db/queries/links.ts` - Added listLinksForMonitor() selecting id+url for status='ready' links
- `src/lib/db/schema.ts` - Added uptimeStatus, lastStatusCode, lastCheckedAt, consecutiveFailures columns to links table
- `src/types/index.ts` - Added UptimeStatus type and 4 uptime fields to Link interface
- `tests/setup.ts` - Updated pg-boss mock to include named PgBoss export + schedule/insert/createQueue methods
- `tests/monitor/check-url.test.ts` - 7 unit tests covering 200, 404, 503, 301 redirect, 405 fallback, timeout, network error
- `tests/monitor/uptime-logic.test.ts` - 7 unit tests covering success reset, failure increment, SQL expression types, consecutive failure logic

## Decisions Made
- checkUrl tries HEAD first to minimize bandwidth, falls back to GET on 405 (servers that block HEAD)
- updateUptimeStatus uses `sql` template for atomic consecutiveFailures increment — avoids race conditions if multiple workers check the same link concurrently
- uptimeStatus CASE expression only flips to 'down' at 2+ consecutive failures — one transient failure does not alert
- listLinksForMonitor selects status='ready' only — pending/error links haven't been enriched yet and shouldn't be monitored

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Node version: shell defaults to Node 14; used `/home/yalt/.nvm/versions/node/v20.19.4/bin/node` to run vitest (consistent with prior phases per STATE.md decisions)

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- checkUrl and updateUptimeStatus are ready for integration into the sweep worker (04-02)
- listLinksForMonitor is ready for the pg-boss scheduled sweep job
- All uptime fields are in the Link type, ready for UI consumption in 04-03

---
*Phase: 04-monitoring*
*Completed: 2026-03-19*
