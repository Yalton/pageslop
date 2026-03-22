# Deferred Items - Phase 06-graph

## Pre-existing TypeScript Errors (out of scope)

**Found during:** Task 1a (06-02) type check

**Files:**
- `src/lib/db/queries/links.ts` lines 96, 124: `enrichmentSource` typed as `string | null` from Drizzle ORM but `EnrichmentSource` union requires specific string literals — Drizzle inference limitation
- `tests/api/export.test.ts` lines 26, 55, 79, 103: Test fixture objects missing new fields added in later phases (`enrichmentSource`, `enrichmentError`, `uptimeStatus`, `lastStatusCode`, etc.)

**Status:** Pre-existing before 06-02 — no action taken. Not caused by current plan's changes.
