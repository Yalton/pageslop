---
phase: 02-enrichment
plan: 01
subsystem: database, enrichment
tags: [drizzle, postgres, tdd, vitest, nlp, classification, tagging]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: Drizzle schema, tags/linkTags tables, raw_content bodyText, types/index.ts

provides:
  - category column on links table (Drizzle schema + migration)
  - unique constraint on linkTags (linkId, tagId)
  - CATEGORIES constant and Category type exported from src/types/index.ts
  - LinkWithTags interface extending Link with tags array
  - enrich() entry point returning {tags, description, category} for any input
  - extractKeywords() frequency-based NLP keyword extraction
  - categorize() signal-scoring classification across 10 categories
  - buildTags() combining keywords and domain hints into 2-4 tags
  - extractDescription() first-paragraph heuristic with 150-char truncation
  - getDomainHints() domain-aware tag injection for 40+ known domains
  - 24 enrichment unit tests covering all exported functions

affects:
  - 02-02 (enrichment worker — calls enrich() to populate links)
  - 02-03 (UI editing — LinkWithTags type, category field on Link)
  - 02-04 (backfill job — uses enrich() for retroactive enrichment)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - TDD Red-Green: write failing tests before implementation, commit each phase
    - Pure function enrichment: all classify/describe/domain-hints functions are stateless
    - Signal scoring categorization: compare text against per-category keyword sets
    - Domain hint injection: known domains contribute guaranteed tags to supplement NLP

key-files:
  created:
    - src/lib/enrichment/classify.ts
    - src/lib/enrichment/describe.ts
    - src/lib/enrichment/domain-hints.ts
    - tests/enrichment/classify.test.ts
    - drizzle/0000_clean_justice.sql
  modified:
    - src/lib/db/schema.ts
    - src/types/index.ts
    - tests/api/links.test.ts
    - tests/api/links/[id].test.ts

key-decisions:
  - "extractKeywords uses frequency-based scoring — no TF-IDF, simpler and sufficient for 5000-char bodyText"
  - "categorize scores via substring matching across signal lists — O(categories * signals) is fine for 10 categories"
  - "buildTags: domain hints injected first (higher signal), keywords fill remainder up to 4 total"
  - "getDomainHints supports subdomain matching via .endsWith() — docs.github.com maps to github.com hints"
  - "db:push used instead of db:migrate — database already had prior tables, push applied delta without full recreate"

patterns-established:
  - "Enrichment module: three-file split (classify.ts, describe.ts, domain-hints.ts) — separation of concerns"
  - "enrich(opts) orchestrates all three: buildTags + extractDescription + categorize"
  - "Tests import from @/ alias paths, matching vitest.config.ts resolve alias"

requirements-completed: [CLSF-01, CLSF-02, CLSF-03]

# Metrics
duration: 5min
completed: 2026-03-17
---

# Phase 2 Plan 1: Enrichment Schema and Core Module Summary

**Rule-based NLP enrichment module (classify/describe/domain-hints) with Drizzle category column migration and 24 green TDD tests**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-17T16:55:34Z
- **Completed:** 2026-03-17T17:01:00Z
- **Tasks:** 2
- **Files modified:** 9 (created 8, modified 4)

## Accomplishments
- Added `category` column to `links` table and unique constraint on `linkTags (linkId, tagId)` via Drizzle schema + db:push
- CATEGORIES constant (11 values), Category type, and LinkWithTags interface added to types/index.ts
- TDD-built enrichment module: `enrich()` returns `{tags, description, category}` for any input with domain/title/bodyText
- 24 enrichment unit tests passing (all in tests/enrichment/classify.test.ts, 53 total tests green)

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema migration and type updates** - `6c02b19` (feat)
2. **Task 2: RED phase — failing enrichment tests** - `6ee953c` (test)
3. **Task 2: GREEN phase — enrichment implementation** - `168e3ff` (feat)

_Note: TDD task split into test + feat commits per TDD protocol_

## Files Created/Modified
- `src/lib/db/schema.ts` - Added category column to links, unique constraint to linkTags
- `src/types/index.ts` - CATEGORIES constant, Category type, category field on Link, LinkWithTags interface
- `src/lib/enrichment/classify.ts` - STOP_WORDS, extractKeywords(), CATEGORY_SIGNALS, categorize(), buildTags(), enrich()
- `src/lib/enrichment/describe.ts` - extractDescription() first-paragraph heuristic with sentence-boundary truncation
- `src/lib/enrichment/domain-hints.ts` - DOMAIN_HINTS map (40+ entries), getDomainHints() with subdomain support
- `tests/enrichment/classify.test.ts` - 24 unit tests covering all exported functions
- `drizzle/0000_clean_justice.sql` - Full schema migration SQL (includes category column + unique constraint)
- `tests/api/links.test.ts` - Fixed mock Link objects to include category field
- `tests/api/links/[id].test.ts` - Fixed mock Link objects to include category field

## Decisions Made
- Used `db:push` instead of `db:migrate` — the database already had tables from prior development; push applied only the delta (category column + linkTags unique constraint) without failing on existing tables
- `extractKeywords` uses simple frequency scoring, not TF-IDF — sufficient for 5000-char bodyText with minimal complexity
- Domain hints are injected first in `buildTags` (higher signal than NLP keywords), filling up to 4 total tags
- `categorize` uses substring matching against per-category signal lists — fast, no dependencies, works offline

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed test mock objects missing category field**
- **Found during:** Task 1 (schema migration and type updates)
- **Issue:** Adding `category: string | null` to Link interface broke 3 test files with TypeScript error TS2345 — mock objects didn't include the new field
- **Fix:** Added `category: null` to all mock Link objects in tests/api/links.test.ts and tests/api/links/[id].test.ts
- **Files modified:** tests/api/links.test.ts, tests/api/links/[id].test.ts
- **Verification:** `npx tsc --noEmit` passes cleanly after fix
- **Committed in:** 6c02b19 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - type error caused by planned schema change)
**Impact on plan:** Necessary correctness fix — test mocks must match updated interface. No scope creep.

## Issues Encountered
- `db:migrate` failed because database already had all tables from prior development iterations. Switched to `db:push` which computes the diff and applies only new columns/constraints. This is the correct approach for an active development database.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `enrich()` function ready to be called from background worker (Phase 2 Plan 2)
- `LinkWithTags` type ready for UI components (Phase 2 Plan 3)
- `CATEGORIES` constant available for dropdown/filter UI
- All enrichment logic is pure functions — easy to test in isolation and chain from pg-boss worker

---
*Phase: 02-enrichment*
*Completed: 2026-03-17*
