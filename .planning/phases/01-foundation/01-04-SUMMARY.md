---
phase: 01-foundation
plan: "04"
subsystem: ui-shell
tags: [nextjs, react, shadcn, tailwind, next-themes, lucide-react, better-auth]

# Dependency graph
requires:
  - src/lib/auth/client.ts (authClient.signOut)
  - src/lib/auth/server.ts (auth.api.getSession)
  - src/components/ui/* (Button, Sheet, Tooltip, Separator, Dialog, Textarea, Input)
provides:
  - Marketing landing page at /
  - ThemeToggle component (light/dark toggle)
  - Dashboard layout shell with auth guard at /dashboard
  - Sidebar with nav items and logout
  - Mobile FAB for link saving
affects: [01-05, 01-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Marketing page checks session server-side and redirects authenticated users to /dashboard
    - Dashboard layout checks session server-side and redirects unauthenticated users to /login
    - Sidebar responsive: 240px desktop / 64px tablet icons-only with Tooltips / Sheet on mobile
    - MobileFAB hidden at md+ breakpoint, visible only on mobile

key-files:
  created:
    - src/app/page.tsx
    - src/components/layout/ThemeToggle.tsx
    - src/components/layout/Sidebar.tsx
    - src/components/layout/MobileFAB.tsx
    - src/app/(dashboard)/layout.tsx
    - src/app/(dashboard)/dashboard/page.tsx
  modified:
    - src/lib/queue/boss.ts (removed invalid noScheduling option)
    - src/workers/scrape.worker.ts (fixed batchSize -> localConcurrency, typed job handler)

key-decisions:
  - "Dashboard lives at /dashboard (not /) — avoids routing conflict between marketing page and authenticated view"
  - "MobileFAB uses native button element for 56px touch target rather than shadcn Button to control exact sizing"
  - "Sidebar uses three separate aside elements (desktop/tablet/mobile) rather than one with responsive classes — cleaner control over fixed positioning behavior at each breakpoint"

# Metrics
duration: 4min
completed: 2026-03-16
---

# Phase 1 Plan 04: Marketing Landing Page and Dashboard Layout Shell Summary

**Marketing page with hero/CTAs/value props, authenticated dashboard shell with responsive sidebar (240px desktop, 64px tablet, Sheet mobile), logout, theme toggle, and mobile FAB**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-16T06:25:00Z
- **Completed:** 2026-03-16T06:29:00Z
- **Tasks:** 2
- **Files modified:** 6 created, 2 modified

## Accomplishments

- Marketing landing page (`/`) with hero headline "Save links. Skip the busywork.", subheadline, Start Saving Links and Log In CTAs, and three value prop blocks (Instant save, Zero management, Always available). Server-side session check redirects authenticated users to /dashboard.
- ThemeToggle component using next-themes `useTheme`, renders Sun/Moon icons with `text-primary` (violet) color, ghost button with `aria-label="Toggle theme"`.
- Sidebar with all four nav items: All Links (active, enabled), Tags/Graph/Settings (disabled with `opacity-50 cursor-not-allowed`). Log Out button calls `authClient.signOut()` then pushes to `/login`. Responsive: 240px on desktop, collapsed 64px icons-only with Tooltips on tablet, Sheet slide-in on mobile.
- MobileFAB: 56px `size-14` violet round button, `md:hidden`, `fixed bottom-6 right-6`, opens a Dialog with Textarea for URL input, POSTs to `/api/links` on save.
- Dashboard layout (`/dashboard`) with server-side auth guard: `auth.api.getSession` — redirects unauthenticated users to `/login`. Renders Sidebar + main content area with responsive left margins (0 mobile, `ml-16` tablet, `ml-[240px]` desktop).
- Dashboard placeholder page at `/dashboard` with URL input bar (desktop only) and "All Links" heading.

## Task Commits

1. **Task 1: Marketing landing page** - `12fa4f7` (feat)
2. **Task 2: Dashboard layout shell with sidebar, mobile navigation, and FAB** - `f5150f1` (feat)

## Files Created/Modified

- `src/app/page.tsx` — Marketing landing: hero, CTAs (Start Saving Links → /signup, Log In → /login), three value props, ThemeToggle, session redirect
- `src/components/layout/ThemeToggle.tsx` — Ghost button with Sun/Moon icons, useTheme toggle, aria-label="Toggle theme"
- `src/components/layout/Sidebar.tsx` — Full nav with All Links/Tags/Graph/Settings, Log Out, ThemeToggle, three responsive layouts
- `src/components/layout/MobileFAB.tsx` — 56px violet FAB, md:hidden, Dialog with Textarea, POST /api/links
- `src/app/(dashboard)/layout.tsx` — Server auth guard + responsive layout frame (Sidebar + main + MobileFAB)
- `src/app/(dashboard)/dashboard/page.tsx` — Placeholder dashboard with URL input bar and "All Links" heading

## Decisions Made

- Dashboard lives at `/dashboard` rather than `/` — avoids route group conflict where `(dashboard)/page.tsx` and `src/app/page.tsx` both resolve to `/`
- ThemeToggle uses `theme === "dark"` check rather than `resolvedTheme` — simpler logic, `defaultTheme="dark"` ensures correct initial state
- Sidebar implemented as three separate `<aside>` elements for desktop, tablet, and mobile — avoids complex conditional classes on a single element for different fixed-position layouts

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed invalid `noScheduling` option from pg-boss PgBoss constructor**
- **Found during:** Task 1 (TypeScript verification `npx tsc --noEmit`)
- **Issue:** `noScheduling` does not exist in pg-boss v12 `ConstructorOptions` type, causing TS2769 error
- **Fix:** Removed the `noScheduling: true` option from `getBoss()` in `src/lib/queue/boss.ts`
- **Files modified:** `src/lib/queue/boss.ts`
- **Commit:** `12fa4f7` (included in Task 1 commit)

**2. [Rule 1 - Bug] Fixed invalid `teamSize` option and untyped job handler in scrape.worker.ts**
- **Found during:** Task 2 (TypeScript verification)
- **Issue:** `teamSize` does not exist in pg-boss v12 `WorkOptions`, and `job.data` typed incorrectly for batch handler
- **Fix:** Changed `teamSize: 5` to `localConcurrency: 5`, added generic type to `boss.work<T>()`, destructured `([job])` to handle batch array pattern
- **Files modified:** `src/workers/scrape.worker.ts`
- **Commit:** `f5150f1` (included in Task 2 commit)

Both fixes were pre-existing issues from previous plan executions, surfaced by the TypeScript verification step.

## Self-Check: PASSED

All 6 claimed created files verified present on disk. Both task commits (12fa4f7, f5150f1) verified in git log.

---
*Phase: 01-foundation*
*Completed: 2026-03-16*
