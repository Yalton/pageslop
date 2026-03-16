---
phase: 01-foundation
plan: 03
subsystem: api
tags: [drizzle, pg-boss, cheerio, nextjs, postgresql, vitest, worker]

# Dependency graph
requires:
  - phase: 01-foundation (plan 01)
    provides: DB schema (links, rawContent tables), Drizzle client, worker-client, types
  - phase: 01-foundation (plan 02)
    provides: auth.api.getSession server-side auth check

provides:
  - POST /api/links: accepts URLs, inserts pending link, enqueues scrape job, returns 202
  - GET /api/links: returns user's links ordered newest-first
  - DELETE /api/links/[id]: user-scoped delete with 404 handling
  - src/lib/db/queries/links.ts: insertLink, findDuplicate, listLinks, deleteLink, updateLinkMetadata, insertRawContent
  - src/lib/scraper/cheerio.ts: scrapeUrl with OG extraction, 8s timeout, relative favicon resolution, body text
  - src/lib/queue/boss.ts: pg-boss singleton with enqueueScrapeJob (retryLimit:2)
  - src/workers/scrape.worker.ts: long-running worker updating links to ready/error, storing rawContent for Phase 2
  - src/lib/links/parse-urls.ts: testable URL validation helper
  - 17 unit tests covering all LINK-01 through LINK-04 requirements

affects:
  - Phase 2 (classification): rawContent stored per scrape — bodyText field ready for LLM input
  - Phase 3 (UI): GET /api/links and status field drive SWR polling and skeleton shimmer
  - Phase 5 (worker hosting): scrape.worker.ts needs separate process (Render Background Worker / Railway)

# Tech tracking
tech-stack:
  added:
    - pg-boss v12.14.0 (Postgres-backed job queue, replaces Redis+BullMQ)
    - cheerio v1.2.0 (HTML parsing + OG metadata extraction)
  patterns:
    - Async save pipeline: insert-pending → enqueue → return 202 → worker scrapes asynchronously
    - User-scoped queries: every query includes userId in WHERE clause
    - Worker uses direct connection (DATABASE_URL_DIRECT), not pooler — pg-boss LISTEN/NOTIFY requires it
    - pg-boss v12 WorkHandler receives Job[] array; use localConcurrency instead of deprecated teamSize

key-files:
  created:
    - src/lib/db/queries/links.ts
    - src/lib/scraper/cheerio.ts
    - src/lib/queue/boss.ts
    - src/app/api/links/route.ts
    - src/app/api/links/[id]/route.ts
    - src/workers/scrape.worker.ts
    - src/lib/links/parse-urls.ts
    - tests/scraper/cheerio.test.ts
    - tests/api/links.test.ts
    - tests/api/links/[id].test.ts
  modified: []

key-decisions:
  - "pg-boss v12 uses named export {PgBoss} not default export — import changed accordingly"
  - "pg-boss v12 WorkHandler receives Job[] array; localConcurrency:5 replaces deprecated teamSize:5"
  - "Extract parseUrls helper to src/lib/links/parse-urls.ts for testability — keeps route handler slim"
  - "Worker uses relative imports (../lib/) not @/ alias — runs as standalone Node process via tsx, not Next.js bundler"
  - "vitest v4.1 requires Node 20+; Node 18 lacks node:util styleText — run tests via Node 20 path"

patterns-established:
  - "Async Save Pipeline: POST returns 202 immediately after insert+enqueue — never block on scraping"
  - "User scope enforcement: all queries filter by userId — prevents cross-user data access"
  - "rawContent stored in separate table: links table stays lean, rawContent can be dropped post-processing"
  - "Duplicate detection: findDuplicate check before insert; force:true bypasses; returns duplicate:true flag"
  - "pg-boss direct connection: worker must use DATABASE_URL_DIRECT for LISTEN/NOTIFY compatibility"

requirements-completed: [LINK-01, LINK-02, LINK-03, LINK-04]

# Metrics
duration: 9min
completed: 2026-03-16
---

# Phase 1 Plan 03: Link Save API, Cheerio Scraper, and pg-boss Worker Summary

**Async link ingestion pipeline: POST /api/links returns 202 immediately, Cheerio scraper extracts OG metadata via pg-boss worker, duplicate detection with force override, user-scoped DELETE, 17 unit tests passing**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-16T06:24:41Z
- **Completed:** 2026-03-16T06:33:00Z
- **Tasks:** 3
- **Files modified:** 10 created

## Accomplishments
- Complete async link ingestion pipeline: save API returns 202 immediately, scraping happens in background via pg-boss worker
- Cheerio scraper extracts og:title, og:description, og:image, favicon (with relative URL resolution), and body text for Phase 2 classification
- All LINK-01 through LINK-04 requirements verified: duplicate detection, force override, user-scoped delete, 202 immediate response
- 17 unit tests passing across scraper, API, and delete handler

## Task Commits

Each task was committed atomically:

1. **Task 1: Link queries, scraper, and pg-boss queue** - `90ff1ef` (feat)
2. **Task 2: API route handlers and scrape worker** - `d65982d` (feat)
3. **Task 3: API and scraper unit tests** - `a8c739e` (test)

## Files Created/Modified
- `src/lib/db/queries/links.ts` - insertLink, findDuplicate, listLinks, deleteLink, updateLinkMetadata, insertRawContent; all user-scoped
- `src/lib/scraper/cheerio.ts` - scrapeUrl with OG extraction, 8s AbortSignal timeout, relative favicon resolution, 5000-char body text
- `src/lib/queue/boss.ts` - pg-boss singleton getBoss + enqueueScrapeJob with retryLimit:2, retryDelay:5
- `src/app/api/links/route.ts` - POST (202, URL validation, duplicate check, force override) + GET (user's links)
- `src/app/api/links/[id]/route.ts` - DELETE with user-scoped query, 404 on not found
- `src/workers/scrape.worker.ts` - pg-boss worker with localConcurrency:5, updates status to ready/error, stores rawContent
- `src/lib/links/parse-urls.ts` - parseUrls helper extracted for testability
- `tests/scraper/cheerio.test.ts` - 5 scraper tests (OG, title fallback, favicon resolution, body text, timeout)
- `tests/api/links.test.ts` - 9 tests (URL parsing, 202, duplicate detection, force save, invalid URL)
- `tests/api/links/[id].test.ts` - 3 tests (delete, user scope, type enforcement)

## Decisions Made
- **pg-boss v12 API changes:** Named import `{PgBoss}`, `WorkHandler` receives `Job[]` array, `localConcurrency` replaces `teamSize` — all plan examples assumed older pg-boss API
- **parseUrls extracted:** URL parsing logic moved to `src/lib/links/parse-urls.ts` to enable unit testing without mocking the entire Next.js request cycle
- **Worker relative imports:** Worker uses `../lib/` paths (not `@/`) because it runs as standalone Node process via tsx, not through Next.js bundler
- **Node 20 required for tests:** Vitest v4.1 requires Node 20 (`node:util styleText`); tests run via `/Users/yalt/.nvm/versions/node/v20.20.1/bin/node`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pg-boss default export import**
- **Found during:** Task 1 (pg-boss queue setup)
- **Issue:** Plan used `import PgBoss from 'pg-boss'` but pg-boss v12 has no default export
- **Fix:** Changed to named import `import { PgBoss } from 'pg-boss'`
- **Files modified:** src/lib/queue/boss.ts
- **Verification:** `npx tsc --noEmit` passes
- **Committed in:** 90ff1ef (Task 1 commit)

**2. [Rule 1 - Bug] Fixed pg-boss ConstructorOptions — noScheduling not valid**
- **Found during:** Task 1 (pg-boss queue setup)
- **Issue:** `noScheduling` is not a valid `ConstructorOptions` property in pg-boss v12
- **Fix:** Removed `noScheduling: true` option (linter auto-applied fix)
- **Files modified:** src/lib/queue/boss.ts
- **Verification:** `npx tsc --noEmit` passes
- **Committed in:** 90ff1ef (Task 1 commit)

**3. [Rule 1 - Bug] Fixed pg-boss v12 worker API — teamSize and WorkHandler signature**
- **Found during:** Task 2 (scrape worker process)
- **Issue:** `teamSize` is not a valid WorkOptions property; WorkHandler receives `Job[]` array not a single job; linter changed to `localConcurrency`
- **Fix:** Worker handler destructures `[job]` from jobs array with `localConcurrency: 5`
- **Files modified:** src/workers/scrape.worker.ts
- **Verification:** `npx tsc --noEmit` passes
- **Committed in:** d65982d (Task 2 commit)

**4. [Rule 1 - Bug] Fixed vi.clearAllMocks() for test isolation**
- **Found during:** Task 3 (API tests)
- **Issue:** Mock call counts from "duplicate detection" test leaked into "force save" test
- **Fix:** Added `afterEach(() => vi.clearAllMocks())` in the describe block
- **Files modified:** tests/api/links.test.ts
- **Verification:** All 17 tests pass
- **Committed in:** a8c739e (Task 3 commit)

---

**Total deviations:** 4 auto-fixed (4 Rule 1 bugs — all from pg-boss v12 API differences vs plan examples)
**Impact on plan:** All fixes were API version corrections. No scope changes. Plan intent fully preserved.

## Issues Encountered
- Vitest v4.1 requires Node 20+; local environment has Node 18 as default. Tests must be run via `/Users/yalt/.nvm/versions/node/v20.20.1/bin/node` path. This should be documented for the team.

## Next Phase Readiness
- Link ingestion pipeline complete: save, scrape, and delete all working
- rawContent table populated during scrape — Phase 2 classification can read bodyText directly
- GET /api/links + status field ready for Phase 3 SWR polling / skeleton shimmer
- Worker process (scrape.worker.ts) needs separate deployment target (Render Background Worker or Railway) — not tracked here, documented as open question in STATE.md

---
*Phase: 01-foundation*
*Completed: 2026-03-16*

## Self-Check: PASSED

All 9 files created and present. All 3 task commits verified:
- `90ff1ef` feat(01-03): link queries module, scraper, and pg-boss queue setup
- `d65982d` feat(01-03): API route handlers and scrape worker process
- `a8c739e` test(01-03): API and scraper unit tests — all 17 passing
