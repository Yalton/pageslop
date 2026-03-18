---
phase: 03-search-browse
plan: 02
subsystem: api
tags: [bookmark-import, export, netscape-html, cheerio, pg-boss, import-jobs, settings-page]

# Dependency graph
requires:
  - phase: 02-enrichment
    provides: enrichment pipeline (scraping, tags, classification) that imported bookmarks flow through
  - phase: 03-search-browse/03-01
    provides: dashboard layout and sidebar navigation that Settings page slots into

provides:
  - importJobs DB table (import_jobs with status, totalUrls, processedUrls)
  - parseNetscapeBookmarks — cheerio-based Netscape HTML parser
  - generateNetscapeHTML — Netscape format exporter with HTML-escaping
  - POST /api/import/bookmarks — file upload endpoint, creates links, enqueues scrape jobs
  - GET /api/import/progress — real-time import progress polling
  - GET /api/export/json — full link collection as JSON download
  - GET /api/export/html — Netscape bookmark HTML download
  - Settings page at /dashboard/settings with import/export UI

affects: [future phases needing import/export, any UI referencing settings]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "enqueueScrapeJob accepts optional importJobId — scrape worker increments import counter on completion"
    - "Progress polling via setInterval (3s) with cleanup on completion or unmount"
    - "Import job lifecycle: pending -> processing -> complete via worker atomic counter update"

key-files:
  created:
    - src/lib/utils/parse-bookmarks.ts
    - src/lib/utils/export-html.ts
    - src/app/api/import/bookmarks/route.ts
    - src/app/api/import/progress/route.ts
    - src/app/api/export/json/route.ts
    - src/app/api/export/html/route.ts
    - tests/import/parse-bookmarks.test.ts
    - tests/api/export.test.ts
  modified:
    - src/lib/db/schema.ts
    - src/lib/queue/boss.ts
    - src/workers/scrape.worker.ts
    - src/app/(dashboard)/dashboard/settings/page.tsx

key-decisions:
  - "importJobs table uses integer columns for totalUrls/processedUrls — requires adding integer to drizzle-orm/pg-core import"
  - "enqueueScrapeJob signature extended with optional importJobId — backward compatible, existing callers pass nothing"
  - "Worker uses SQL expression (processedUrls + 1) for atomic increment — prevents race conditions on concurrent scrape jobs"
  - "Import job marked complete only after SCRAPE completes (not enrich) — provides faster progress feedback while enrichment continues in background"
  - "Settings page uses 'use client' with setInterval polling — no server components needed, progress state is ephemeral"

patterns-established:
  - "Progress tracking via job ID: create job record before enqueuing work, worker updates counter atomically"
  - "Export routes return Response with Content-Disposition attachment header for browser download trigger"
  - "File upload via FormData multipart POST — Next.js App Router route handles req.formData()"

requirements-completed: [LINK-05, LINK-06]

# Metrics
duration: 25min
completed: 2026-03-17
---

# Phase 3 Plan 02: Import/Export Summary

**Netscape bookmark HTML import with enrichment pipeline integration, progress tracking via import_jobs table, and JSON/HTML export routes — with Settings page UI featuring drag-and-drop upload and live progress counter**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-03-17T19:50:00Z
- **Completed:** 2026-03-17T19:59:30Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments

- Browser bookmark import via file upload (Chrome/Firefox/Safari Netscape HTML format)
- Import progress tracked in DB with atomic SQL increment; worker marks job complete when all URLs processed
- Export JSON and HTML routes with Content-Disposition download headers
- Settings page with drag-and-drop zone, upload feedback, and progress counter polling every 3s

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema migration, parser, export utils, API routes (TDD)** - `ee7052e` (feat)
2. **Task 2: Settings page UI and worker progress tracking** - `a6cc92b` (feat)

## Files Created/Modified

- `src/lib/db/schema.ts` - Added `integer` import and `importJobs` table
- `src/lib/utils/parse-bookmarks.ts` - Netscape HTML parser using cheerio, validates URLs, extracts add_date
- `src/lib/utils/export-html.ts` - Netscape HTML generator with HTML-escaping and ADD_DATE in seconds
- `src/lib/queue/boss.ts` - Extended `enqueueScrapeJob` with optional `importJobId` parameter
- `src/app/api/import/bookmarks/route.ts` - POST file upload, parse, dedup, insert links, enqueue scrape jobs
- `src/app/api/import/progress/route.ts` - GET import job status/counts by jobId
- `src/app/api/export/json/route.ts` - GET full link collection as JSON download
- `src/app/api/export/html/route.ts` - GET links as Netscape bookmark HTML download
- `src/workers/scrape.worker.ts` - Added importJobId handling: atomic processedUrls increment, status complete on finish
- `src/app/(dashboard)/dashboard/settings/page.tsx` - Settings page with import zone + export buttons
- `tests/import/parse-bookmarks.test.ts` - 9 tests for parseNetscapeBookmarks
- `tests/api/export.test.ts` - 10 tests for generateNetscapeHTML, export/json, export/html routes

## Decisions Made

- `importJobs` uses `integer` for URL counts — required adding `integer` to drizzle-orm/pg-core import (it was missing from schema.ts)
- `enqueueScrapeJob` extended with optional `importJobId` — backward compatible, all existing callers unaffected
- Worker uses `sql\`${importJobs.processedUrls} + 1\`` for atomic increment to avoid race conditions with concurrent scrape jobs
- Import job marked complete after scrape (not enrich) — faster feedback; enrichment continues silently in background
- Settings page uses `setInterval` polling at 3s interval with cleanup on completion — keeps state ephemeral, no server push needed

## Deviations from Plan

None — plan executed exactly as written. The local PostgreSQL was not running; started a Docker container (postgres:16) to apply the schema migration via `db:push`. This is an infrastructure-only setup step, not a code deviation.

## Issues Encountered

- Local PostgreSQL was not running (Docker container not started). Started `pageslop-postgres` Docker container to enable `db:push`. No code changes needed.

## User Setup Required

None — no external service configuration required beyond existing DB setup.

## Next Phase Readiness

- Import/export infrastructure complete and tested
- Settings page routed at `/dashboard/settings` and visible in sidebar navigation
- `importJobs` table in DB ready for production use once DB is running
- Scrape worker ready to track import progress — deploy worker with updated code

---
*Phase: 03-search-browse*
*Completed: 2026-03-17*
