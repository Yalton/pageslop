---
phase: 04-monitoring
verified: 2026-03-19T20:40:00Z
status: passed
score: 8/8 must-haves verified
human_verification:
  - test: "Uptime dot visible in both grid and list views"
    expected: "Gray dot next to domain/favicon for unchecked links; green for live; red for down"
    why_human: "Visual rendering cannot be verified by grep/static analysis"
  - test: "Tooltip on dot hover shows correct status info"
    expected: "Tooltip shows 'Last checked X ago — 200 OK' (or 'Not yet checked' for new links)"
    why_human: "Tooltip interaction and text formatting requires browser execution"
  - test: "Check now button loading state"
    expected: "Button shows spinner + 'Checking...' text during POST, reverts after 3s"
    why_human: "Async UI state transitions require browser execution"
  - test: "SWR revalidation after check completes"
    expected: "Dot color updates without page refresh after worker processes the job"
    why_human: "End-to-end worker -> DB -> SWR -> UI update requires live environment"
---

# Phase 4: Monitoring Verification Report

**Phase Goal:** Users can see at a glance which of their saved links are still live
**Verified:** 2026-03-19T20:40:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Success Criteria (from ROADMAP.md)

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Each link card shows a green or red dot indicating whether the page was reachable on the last check | VERIFIED | `UptimeDot` renders `bg-green-500`/`bg-red-500`/`bg-muted-foreground/40` based on `UptimeStatus`; integrated into `LinkCard.tsx` line 91 and `LinkCardList.tsx` line 63 |
| 2 | Uptime status updates automatically on a schedule without any user action | VERIFIED | `boss.schedule('monitor-sweep', '0 2 * * *', {}, { tz: 'UTC' })` in worker line 67; sweep fans out per-link monitor jobs; worker applies atomic SQL uptime updates |

**Score:** 2/2 success criteria verified (8/8 must-have truths verified across all plans)

### Observable Truths — Plan 01 (MNTR-01)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `checkUrl()` returns up=true and status code for 2xx/3xx responses | VERIFIED | `src/lib/monitor/check-url.ts` line 35: `return { statusCode: response.status, up: response.status < 400 }`; 2 passing tests confirm |
| 2 | `checkUrl()` returns up=false for 4xx/5xx responses | VERIFIED | Same logic; test `503 HEAD response` and `both HEAD and GET return 404` pass |
| 3 | `checkUrl()` returns up=false and statusCode=null on timeout/network error | VERIFIED | Catch block at line 37-39; 2 tests (AbortError, network error) pass |
| 4 | `checkUrl()` falls back to GET when HEAD returns 4xx (broadened from 405-only) | VERIFIED | Lines 13-16: `if (result.statusCode !== null && result.statusCode >= 400 && result.statusCode < 500)`; 405 test and 404 test pass |
| 5 | `updateUptimeStatus()` sets `uptimeStatus='down'` only after 2 consecutive failures | VERIFIED | `uptime.ts` line 36: SQL `CASE WHEN ${links.consecutiveFailures} + 1 >= 2 THEN 'down'`; 3 uptime tests confirm |
| 6 | `updateUptimeStatus()` resets `consecutiveFailures=0` and sets `'up'` on success | VERIFIED | `uptime.ts` lines 22-26; test `success after being down` passes |
| 7 | Links table has 4 uptime columns | VERIFIED | `schema.ts` lines 68-71: `uptimeStatus`, `lastStatusCode`, `lastCheckedAt`, `consecutiveFailures` |
| 8 | `Link` interface and `UptimeStatus` type include all uptime fields | VERIFIED | `types/index.ts` lines 2, 33-36: `UptimeStatus` exported; `Link` interface includes all 4 fields |

### Observable Truths — Plan 02 (MNTR-01, MNTR-02)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Worker registers `monitor-sweep` cron at startup (24-hour cycle, 02:00 UTC) | VERIFIED | `scrape.worker.ts` line 67: `boss.schedule('monitor-sweep', '0 2 * * *', {}, { tz: 'UTC' })` |
| 2 | `monitor-sweep` handler fans out individual monitor jobs with staggered startAfter | VERIFIED | Lines 199-232: 100-link batches, `startAfterSeconds = batchIndex * 10` |
| 3 | monitor handler calls `checkUrl` then updates uptime status per link | VERIFIED | Lines 235-277: `checkUrl(link.url)` call at line 250; inline SQL update for both success and failure paths |
| 4 | `POST /api/links/[id]/check` returns 200 with `{ queued: true }` for valid owned link | VERIFIED | `route.ts` line 22; 2 tests confirm |
| 5 | `POST /api/links/[id]/check` returns 401 for unauthenticated request | VERIFIED | `route.ts` line 11; test passes |
| 6 | `POST /api/links/[id]/check` returns 404 for link not owned by user | VERIFIED | `route.ts` lines 16-18; test passes |

### Observable Truths — Plan 03 (MNTR-02)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Each link card (grid view) shows a status dot next to the domain name | VERIFIED | `LinkCard.tsx` line 91: `<UptimeDot status={link.uptimeStatus} .../>` inside the favicon+domain flex row |
| 2 | Each link card (list view) shows a status dot next to the favicon | VERIFIED | `LinkCardList.tsx` line 63: `<UptimeDot .../>` between Avatar and title span |
| 3 | Detail view shows status dot, last checked timestamp, and Check now button | VERIFIED | `LinkDetail.tsx` lines 129-141: UptimeDot + conditional timestamp text + Button |
| 4 | Clicking Check now POSTs to check API and shows loading state | VERIFIED | `handleCheckNow` lines 50-55: `fetch('/api/links/${link.id}/check', { method: 'POST' })`, `setChecking(true/false)` |
| 5 | After check, SWR revalidation updates the UI | VERIFIED | `handleCheckNow` line 53: `onMutate()` called immediately after POST |

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `src/lib/monitor/check-url.ts` | VERIFIED | 41 lines, exports `checkUrl`, uses AbortController + HEAD/GET fallback |
| `src/lib/monitor/uptime.ts` | VERIFIED | 41 lines, exports `updateUptimeStatus`, atomic SQL CASE expression |
| `tests/monitor/check-url.test.ts` | VERIFIED | 107 lines (min 40), 8 tests all passing |
| `tests/monitor/uptime-logic.test.ts` | VERIFIED | 97 lines (min 40), 7 tests all passing |
| `src/app/api/links/[id]/check/route.ts` | VERIFIED | 24 lines, exports `POST`, auth + ownership + enqueue |
| `tests/api/monitor.test.ts` | VERIFIED | 133 lines (min 30), 4 tests all passing |
| `src/components/links/UptimeDot.tsx` | VERIFIED | 60 lines (min 20), exports `UptimeDot`, 3 color states + tooltip |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/lib/monitor/uptime.ts` | `src/lib/db/schema.ts` | Drizzle `.update(links)` | VERIFIED | Lines 20, 31: `.update(links).set({...}).where(eq(links.id, linkId))` |
| `src/lib/monitor/check-url.ts` | fetch API | HEAD request with AbortController | VERIFIED | `attemptRequest(url, 'HEAD')` line 10; fetch called with `method: 'HEAD'` |
| `src/workers/scrape.worker.ts` | `src/lib/monitor/check-url.ts` | import checkUrl | VERIFIED | Line 3: `import { checkUrl } from '../lib/monitor/check-url'` |
| `src/workers/scrape.worker.ts` | uptime update logic | inlined SQL (not import of uptime.ts) | VERIFIED | Lines 252-274: inline `db.update(schema.links)` with same CASE expression as uptime.ts — intentional deviation documented in SUMMARY |
| `src/app/api/links/[id]/check/route.ts` | `src/lib/queue/boss.ts` | `enqueueMonitorJob` call | VERIFIED | Line 4: import; line 20: call |
| `src/workers/scrape.worker.ts` | pg-boss schedule API | `boss.schedule('monitor-sweep', cron)` | VERIFIED | Line 67 |
| `src/components/links/LinkCard.tsx` | `src/components/links/UptimeDot.tsx` | `<UptimeDot` in domain row | VERIFIED | Line 15: import; line 91: `<UptimeDot status={link.uptimeStatus} .../>` |
| `src/components/links/LinkCardList.tsx` | `src/components/links/UptimeDot.tsx` | `<UptimeDot` after favicon | VERIFIED | Line 16: import; line 63: `<UptimeDot .../>` |
| `src/components/links/LinkDetail.tsx` | `/api/links/[id]/check` | fetch POST for manual recheck | VERIFIED | Line 52: `fetch('/api/links/${link.id}/check', { method: 'POST' })` |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| MNTR-01 | 04-01, 04-02 | System pings saved links on a schedule to check availability | SATISFIED | `boss.schedule('monitor-sweep', '0 2 * * *')` + sweep handler fans out monitor jobs + `checkUrl` + uptime SQL updates |
| MNTR-02 | 04-02, 04-03 | Each link displays a green/red uptime indicator | SATISFIED | `UptimeDot` component with `bg-green-500`/`bg-red-500`/`bg-muted-foreground/40` integrated into LinkCard, LinkCardList, LinkDetail |

No orphaned requirements found. REQUIREMENTS.md traceability table maps exactly MNTR-01 and MNTR-02 to Phase 4.

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| None found | — | — | — |

No TODO, FIXME, placeholder returns, empty handlers, or console-only implementations found in phase deliverables.

Notable: `handleCheckNow` in `LinkDetail.tsx` uses `setTimeout(() => setChecking(false), 3000)` as a deliberate UX delay (not a stub) — gives the pg-boss worker time to process before spinner clears. This is intentional.

### Human Verification Required

Phase 03 plan included a `checkpoint:human-verify` task. The SUMMARY documents it passed. However, the following items cannot be verified by static analysis and should be confirmed:

#### 1. Dot Renders in Both Views

**Test:** Navigate to `/dashboard`, toggle between grid and list views
**Expected:** Every link card shows a small colored dot (gray for new/unchecked, green for live, red for down)
**Why human:** CSS class application and visual rendering cannot be verified statically

#### 2. Tooltip on Hover

**Test:** Hover over a dot in grid or list view
**Expected:** Tooltip appears showing "Not yet checked" (for new links) or "Last checked X ago — 200 OK" (after a check)
**Why human:** Tooltip trigger interaction requires browser execution

#### 3. Check Now Button Loading State

**Test:** Open a link detail, click "Check now"
**Expected:** Button switches to spinner + "Checking..." text, then reverts after ~3 seconds
**Why human:** React state transitions (`checking` useState) require browser rendering

#### 4. Post-Check Status Update

**Test:** Click "Check now", wait ~5s (worker must process), close and reopen detail
**Expected:** Status dot updates from gray to green (or red), "Checked X seconds ago" appears
**Why human:** Requires live worker process + database + SWR revalidation chain

Note: The SUMMARY documents that human verification was completed and passed on 2026-03-19 during plan 04-03 execution. These items are listed here for completeness — re-verification can be skipped unless regressions are suspected.

### Test Suite Summary

| Suite | Tests | Result |
|-------|-------|--------|
| `tests/monitor/check-url.test.ts` | 8/8 | All pass |
| `tests/monitor/uptime-logic.test.ts` | 7/7 | All pass |
| `tests/api/monitor.test.ts` | 4/4 | All pass |
| Full suite | 120/120 | All pass — no regressions |

---

_Verified: 2026-03-19T20:40:00Z_
_Verifier: Claude (gsd-verifier)_
