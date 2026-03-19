---
phase: 02-enrichment
plan: 02
subsystem: api, database, queue
tags: [drizzle, postgres, pg-boss, tdd, vitest, tags, enrichment, worker]

# Dependency graph
requires:
  - phase: 02-enrichment
    plan: 01
    provides: enrich() function, LinkWithTags type, CATEGORIES constant, tags/linkTags schema tables

provides:
  - upsertTag, linkTagToLink, getTagsForLink, deleteLinkTag in src/lib/db/queries/tags.ts
  - listLinksWithTags, getLinkWithTags, updateLinkFields in src/lib/db/queries/links.ts
  - POST /api/links/[id]/tags — add user tags with ownership verification
  - DELETE /api/links/[id]/tags/[tagId] — remove tags from links
  - PATCH /api/links/[id] — update description and category with validation
  - GET /api/links now returns links with tags array (uses listLinksWithTags)
  - Worker: enrich queue handler chained after scrape, backfill on startup
  - enqueueEnrichJob added to boss.ts

affects:
  - 02-03 (UI editing — LinkWithTags type now wired, category/tags API available)
  - 02-04 (backfill — already wired into worker startup)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - TDD Red-Green: failing tests committed first, then implementation
    - Batch tag query: one links query + one tag batch query (no N+1) in listLinksWithTags
    - Route ownership check: inline db.select with AND(id, userId) before mutations
    - Worker enrich chain: boss.send('enrich') called inside scrape handler after rawContent insert
    - Backfill via boss.insert with batches of 50, 100ms delay between batches

key-files:
  created:
    - src/lib/db/queries/tags.ts
    - src/app/api/links/[id]/tags/route.ts
    - src/app/api/links/[id]/tags/[tagId]/route.ts
    - tests/api/links-tags.test.ts
  modified:
    - src/lib/db/queries/links.ts
    - src/app/api/links/route.ts
    - src/app/api/links/[id]/route.ts
    - src/lib/queue/boss.ts
    - src/workers/scrape.worker.ts

key-decisions:
  - "Tag routes import db directly for ownership checks — avoids creating a separate findLink query function just for route middleware"
  - "listLinksWithTags uses two queries (links + batch tag query) not N+1 — inArray on linkTags for all link IDs at once"
  - "Backfill uses boss.insert() with queue name as first argument (pg-boss v12 API) — correct signature is insert(name, jobs[])"
  - "Worker conflict select for tags uses and(userId, name) — correct composite unique constraint match"
  - "Test file mocks @/lib/db/client with module-level variable for mockSelectResult — enables per-test ownership check control"

patterns-established:
  - "Tag operations: upsertTag always normalizes to lowercase.trim() before DB insert"
  - "Ownership check pattern: select from links where id AND userId, 404 if empty array"
  - "PATCH validation: check CATEGORIES.includes() before any DB call"

requirements-completed: [CLSF-01, CLSF-02, CLSF-03, CLSF-04, CLSF-05]

# Metrics
duration: 7min
completed: 2026-03-17
---

# Phase 2 Plan 2: Enrichment Worker Pipeline and Tag API Summary

**Rule-based enrichment chained into scrape worker with pg-boss enrich queue, tag CRUD API routes (POST/DELETE), PATCH link endpoint, and batch tag fetch on GET /api/links — 14 new tests, 67 total green**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-17T17:04:03Z
- **Completed:** 2026-03-17T17:11:00Z
- **Tasks:** 2 (Task 2 split into 3 commits for TDD)
- **Files modified:** 9 (created 4, modified 5)

## Accomplishments
- Scrape worker now chains an enrich job after rawContent insert, plus a startup backfill for un-enriched links
- Tag query module (upsertTag/linkTagToLink/getTagsForLink/deleteLinkTag) uses onConflictDoNothing for idempotency
- POST /api/links/[id]/tags and DELETE /api/links/[id]/tags/[tagId] with proper ownership checks return correct status codes
- PATCH /api/links/[id] validates category against CATEGORIES constant, returns 400 on invalid value
- GET /api/links now uses listLinksWithTags with batch query (one for links, one for all tags) instead of N+1

## Task Commits

Each task was committed atomically:

1. **Task 1: Tag query module, worker enrich handler, and backfill** - `1668126` (feat)
2. **Task 2: RED — failing tests for tag CRUD, PATCH, GET** - `b2bb28a` (test)
3. **Task 2: GREEN — implementation of all routes and queries** - `d36133b` (feat)

_Note: TDD task split into test + feat commits per TDD protocol_

## Files Created/Modified
- `src/lib/db/queries/tags.ts` - upsertTag (normalize + onConflictDoNothing), linkTagToLink, getTagsForLink, deleteLinkTag
- `src/lib/db/queries/links.ts` - Added listLinksWithTags (batch), getLinkWithTags, updateLinkFields
- `src/app/api/links/route.ts` - GET now calls listLinksWithTags instead of listLinks
- `src/app/api/links/[id]/route.ts` - Added PATCH handler for description/category with CATEGORIES validation
- `src/app/api/links/[id]/tags/route.ts` - POST handler: auth, empty name check, ownership check, upsertTag + linkTagToLink
- `src/app/api/links/[id]/tags/[tagId]/route.ts` - DELETE handler: auth, ownership check, deleteLinkTag
- `src/lib/queue/boss.ts` - Added enqueueEnrichJob with retryLimit:2, retryDelay:10, expireInSeconds:120
- `src/workers/scrape.worker.ts` - Enrich queue handler, backfill function, enrich job chained after scrape
- `tests/api/links-tags.test.ts` - 14 tests covering all API behaviors

## Decisions Made
- Tag routes import `db` directly from `@/lib/db/client` for ownership checks rather than adding a `findLink(userId, linkId)` helper to the links query module — inline check is clear and avoids exposing a partial query function
- `listLinksWithTags` fetches links first then batch-fetches all tags using `inArray` — no N+1, one extra query regardless of link count
- Tests mock `@/lib/db/client` at module level with a `mockSelectResult` variable that tests can mutate in `beforeEach` to control ownership check outcomes
- `boss.insert('enrich', jobs[])` — pg-boss v12 insert API requires queue name as first positional argument (discovered during TypeScript compile check)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pg-boss insert() call signature**
- **Found during:** Task 1 (worker backfill implementation)
- **Issue:** Initial backfill used `boss.insert([{name, data, options}])` but pg-boss v12 `insert(name, jobs[])` requires queue name as first arg — TypeScript error TS2554: Expected 2-3 arguments, but got 1
- **Fix:** Changed to `boss.insert('enrich', batch.map(...))` with job fields directly in each entry
- **Files modified:** src/workers/scrape.worker.ts
- **Verification:** `npx tsc --noEmit` passes cleanly
- **Committed in:** 1668126 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed tag conflict select missing name filter in worker**
- **Found during:** Task 1 (enrich handler implementation)
- **Issue:** After upsertTag conflict, the fallback select filtered only by userId — would return wrong tag if user had multiple tags
- **Fix:** Added `and(eq(tags.userId, ...), eq(tags.name, normalizedName))` to the conflict select
- **Files modified:** src/workers/scrape.worker.ts
- **Verification:** TypeScript compiles, correct composite key match
- **Committed in:** 1668126 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - bugs in initial implementation)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered
- Test file initially used `vi.doMock` inside a test to override `@/lib/db/client` — this doesn't work after module cache is established. Rewrote using a module-level `mockSelectResult` variable that the top-level `vi.mock` factory closure captures, allowing per-test mutation via `beforeEach`.
- The `pg` Pool mock in setup.ts (arrow function) works fine with `vi.fn(() => ...)` but only when the module is mocked BEFORE the import resolves. Adding explicit `vi.mock('@/lib/db/client')` in the test file was necessary since tag routes import `db` directly.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Enrichment pipeline fully wired: scrape → enrich → tags/category/description on every link
- Tag CRUD API complete: POST to add, DELETE to remove, both with proper auth and ownership
- PATCH /api/links/[id] ready for UI to use (description and category editing)
- GET /api/links returns LinkWithTags — ready for Phase 2 Plan 3 UI editing components
- Backfill runs automatically on worker start — existing links will be enriched retroactively

---
*Phase: 02-enrichment*
*Completed: 2026-03-17*

## Self-Check: PASSED

All created files verified on disk. All task commits confirmed in git log:
- `1668126` feat(02-02): tag query module, worker enrich handler, and backfill
- `b2bb28a` test(02-02): add failing tests (RED)
- `d36133b` feat(02-02): tag CRUD API routes, PATCH link, and GET with tags
- `10d378b` docs(02-02): complete enrichment pipeline and tag API plan
