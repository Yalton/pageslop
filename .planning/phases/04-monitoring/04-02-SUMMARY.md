---
phase: 04-monitoring
plan: 02
subsystem: api, infra
tags: [pg-boss, monitoring, cron, worker, uptime]

# Dependency graph
requires:
  - phase: 04-monitoring/04-01
    provides: checkUrl, updateUptimeStatus, listLinksForMonitor

provides:
  - POST /api/links/[id]/check manual recheck endpoint
  - enqueueMonitorJob function in boss.ts
  - monitor-sweep cron registered at 02:00 UTC (24-hour cycle)
  - monitor-sweep handler that fans out per-link monitor jobs with staggered startAfter
  - per-link monitor handler in worker that calls checkUrl and updates uptime status

affects: [05-ui-polish, deployment]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "pg-boss boss.schedule for cron registration (upserts on restart — safe to call every time)"
    - "Staggered startAfter fan-out: 10s delay per 100-link batch to avoid thundering herd"
    - "Worker inlines DB logic directly rather than importing @/ aliased modules"

key-files:
  created:
    - src/app/api/links/[id]/check/route.ts
    - tests/api/monitor.test.ts
  modified:
    - src/lib/queue/boss.ts
    - src/workers/scrape.worker.ts

key-decisions:
  - "monitor-sweep fans out per-link jobs using staggered startAfter (10s per 100 links) to avoid thundering herd on large link counts"
  - "Worker inlines uptime status update logic (no import of @/ aliased uptime.ts) — consistent with existing worker pattern for enrich handler"
  - "monitor handler uses SQL CASE expression for uptimeStatus flip at consecutiveFailures >= 2 — same two-consecutive-failure rule as Plan 01"

patterns-established:
  - "TDD pattern: RED commit (failing tests) before GREEN commit (implementation)"
  - "Ownership check pattern: getLinkWithTags(session.user.id, id) returns null for unowned/missing links"

requirements-completed: [MNTR-01, MNTR-02]

# Metrics
duration: 5min
completed: 2026-03-19
---

# Phase 04 Plan 02: Worker Integration and Check-Now API Summary

**pg-boss monitor-sweep cron (24h at 02:00 UTC) with per-link fan-out and POST /api/links/[id]/check manual recheck endpoint**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-19T00:07:37Z
- **Completed:** 2026-03-19T00:12:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- `enqueueMonitorJob` function added to boss.ts following existing enqueue pattern
- POST /api/links/[id]/check route with auth, ownership check, and monitor job enqueue
- Worker registers monitor-sweep 24-hour cron via boss.schedule (upserted on each restart)
- monitor-sweep handler fans out per-link monitor jobs with 10s staggered startAfter per 100 links
- Per-link monitor handler calls checkUrl and inlines two-consecutive-failure uptime logic
- 4 new API tests pass; all 119 tests across full suite pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Check-now API route with tests (RED)** - `54b6b8a` (test)
2. **Task 1: Check-now API route with tests (GREEN)** - `8fc5553` (feat)
3. **Task 2: Worker monitor-sweep cron and per-link monitor handler** - `f122b5a` (feat)

**Plan metadata:** (docs commit — see below)

_Note: TDD tasks have multiple commits (test RED -> feat GREEN)_

## Files Created/Modified
- `src/app/api/links/[id]/check/route.ts` - Manual recheck endpoint (POST, auth + ownership + enqueue)
- `tests/api/monitor.test.ts` - API tests: 401/404/200 cases, enqueueMonitorJob call verification
- `src/lib/queue/boss.ts` - Added enqueueMonitorJob (monitor queue, retryLimit=1, expireInSeconds=30)
- `src/workers/scrape.worker.ts` - Added checkUrl import, monitor-sweep/monitor queue creation, cron schedule, sweep handler, monitor handler

## Decisions Made
- monitor-sweep fans out per-link jobs using staggered startAfter (10s per 100 links) to avoid thundering herd on large link counts
- Worker inlines uptime status update logic directly (no @/ alias import) — consistent with existing enrich handler pattern
- monitor handler uses SQL CASE expression for uptimeStatus flip at consecutiveFailures >= 2 — same two-consecutive-failure rule as Plan 01

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all implementation matched plan specifications.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Full monitoring pipeline is operational: cron -> sweep -> per-link check -> DB update
- Manual recheck endpoint is available for UI integration (Phase 05)
- No blockers

---
*Phase: 04-monitoring*
*Completed: 2026-03-19*

## Self-Check: PASSED

- src/app/api/links/[id]/check/route.ts: FOUND
- tests/api/monitor.test.ts: FOUND
- .planning/phases/04-monitoring/04-02-SUMMARY.md: FOUND
- Commit 54b6b8a (RED tests): FOUND
- Commit 8fc5553 (GREEN implementation): FOUND
- Commit f122b5a (worker handlers): FOUND
