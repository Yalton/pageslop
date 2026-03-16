---
phase: 01-foundation
plan: 05
subsystem: ui
tags: [react, swr, next.js, tailwind, shadcn, date-fns, sonner]

# Dependency graph
requires:
  - phase: 01-02
    provides: auth system and dashboard layout
  - phase: 01-03
    provides: API routes for /api/links GET/POST and /api/links/[id] DELETE
  - phase: 01-04
    provides: background scraping worker populating link metadata

provides:
  - SWR hook with 2s polling for pending links and optimistic mutations
  - SaveURLInput component with single/multi-line paste and duplicate handling
  - LinkSkeleton shimmer component for pending state
  - LinkCard grid view with OG image fallback, actions menu, delete+undo
  - LinkCardList compact list row with relative timestamp
  - LinkDetail dialog (desktop) and sheet (mobile) with full link info
  - LinkGrid container with view toggle persisted to localStorage
  - Shimmer CSS animation in globals.css respecting prefers-reduced-motion
  - Domain color utility for deterministic hue fallbacks

affects:
  - Phase 2 classification — tag badges already rendered on cards
  - Phase 5 settings — BYOK/preferences UI will be adjacent to this UI
  - Phase 6 graph — link data model fully surfaced in detail view

# Tech tracking
tech-stack:
  added: []
  patterns:
    - SWR dual-hook pattern for conditional polling (main hook + polling hook with null key)
    - Optimistic mutations with mutate(updater, false) then mutate() revalidation
    - DropdownMenuItem onSelect with void-returning handlers (not React.MouseEvent)
    - Domain-to-hue hash for deterministic color fallbacks without configuration

key-files:
  created:
    - src/lib/hooks/useLinks.ts
    - src/components/links/SaveURLInput.tsx
    - src/components/links/LinkSkeleton.tsx
    - src/components/links/LinkCard.tsx
    - src/components/links/LinkCardList.tsx
    - src/components/links/LinkDetail.tsx
    - src/components/links/LinkGrid.tsx
    - src/lib/utils/domain-color.ts
  modified:
    - src/app/(dashboard)/dashboard/page.tsx
    - src/app/globals.css

key-decisions:
  - "SWR dual-hook pattern for polling: main hook with revalidateOnFocus, secondary hook with refreshInterval keyed to null when no pending links — avoids mutating refreshInterval after mount"
  - "DropdownMenuItem onSelect expects Event not React.MouseEvent — handlers use () => void signatures"
  - "LinkDetail renders both Dialog and Sheet simultaneously, showing the correct one via hidden md:grid / md:hidden CSS classes"

patterns-established:
  - "Pattern: Optimistic mutation uses mutate(updater, false) for instant UI, then mutate() to revalidate with server"
  - "Pattern: Toast delete+undo uses 5s duration with action button; undo calls undoDelete to re-prepend link optimistically"
  - "Pattern: Duplicate detection via saveLinks returning duplicate:true flag triggers warning toast with Save Again action"

requirements-completed:
  - LINK-01
  - LINK-02
  - LINK-03
  - LINK-04

# Metrics
duration: 3min
completed: 2026-03-16
---

# Phase 1 Plan 05: Link UI Components Summary

**SWR-powered link dashboard with grid/list views, skeleton shimmer, detail dialog, delete+undo toasts, and duplicate detection — complete end-to-end link save/view/delete flow**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-16T06:37:06Z
- **Completed:** 2026-03-16T06:40:00Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Complete SWR hook with optimistic mutations, 2s polling for pending links, saveLinks/deleteLink/undoDelete API
- Full dashboard with SaveURLInput, skeleton shimmer, grid/list view toggle persisted to localStorage
- LinkCard and LinkCardList with favicon/OG image fallbacks, delete+undo, duplicate warning toasts
- LinkDetail as Dialog (desktop) / Sheet (mobile) with "Visit Link" button and full metadata
- shimmer CSS animation added to globals.css with prefers-reduced-motion support

## Task Commits

Each task was committed atomically:

1. **Task 1: SWR hook, SaveURLInput, and LinkSkeleton components** - `d2cc222` (feat)
2. **Task 2: LinkCard, LinkCardList, LinkDetail, LinkGrid, and dashboard page** - `e5e5821` (feat)

## Files Created/Modified
- `src/lib/hooks/useLinks.ts` - SWR hook with polling, optimistic mutations, save/delete/undo
- `src/components/links/SaveURLInput.tsx` - Desktop URL input with multi-line expansion and duplicate toast
- `src/components/links/LinkSkeleton.tsx` - Shimmer skeleton for grid and list pending states
- `src/components/links/LinkCard.tsx` - Grid card with OG image/fallback, actions menu, delete+undo
- `src/components/links/LinkCardList.tsx` - Compact list row with relative timestamp via date-fns
- `src/components/links/LinkDetail.tsx` - Dialog/Sheet detail view with Visit Link and delete
- `src/components/links/LinkGrid.tsx` - Container with view toggle, localStorage persistence, empty state
- `src/lib/utils/domain-color.ts` - Deterministic hue from domain string
- `src/app/(dashboard)/dashboard/page.tsx` - Replaced placeholder with LinkGrid
- `src/app/globals.css` - Added shimmer keyframe with reduced-motion support

## Decisions Made
- SWR dual-hook polling: secondary hook with null key when no pending links avoids mutating refreshInterval post-mount (SWR v2 pattern)
- DropdownMenuItem onSelect signature is `(event: Event) => void`, not React.MouseEvent — handlers drop the event param
- LinkDetail renders both Dialog and Sheet in the DOM, visibility controlled by CSS classes

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed DropdownMenuItem onSelect type mismatch**
- **Found during:** Task 2 (LinkCard, LinkCardList)
- **Issue:** TypeScript error: `(e: MouseEvent<Element, MouseEvent>) => void` not assignable to `(event: Event) => void` on DropdownMenuItem onSelect prop
- **Fix:** Removed React.MouseEvent parameter from handleDelete and handleVisit; used void-returning signatures
- **Files modified:** src/components/links/LinkCard.tsx, src/components/links/LinkCardList.tsx
- **Verification:** `npx tsc --noEmit` exits 0
- **Committed in:** e5e5821 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Required for TypeScript compilation. Minor handler signature adjustment.

## Issues Encountered
- None beyond the DropdownMenuItem type mismatch documented above.

## User Setup Required
None - no external service configuration required.

## Self-Check: PASSED

All 10 files confirmed present on disk. Commits d2cc222 and e5e5821 confirmed in git log.

## Next Phase Readiness
- Complete dashboard ready for Phase 2 classification features
- Tag badges already rendered on cards (empty array currently) — Phase 2 just needs to populate them
- SWR polling will automatically surface newly scraped metadata without additional UI changes
- No blockers
