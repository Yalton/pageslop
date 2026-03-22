---
phase: 06-graph
plan: 02
subsystem: ui
tags: [react-force-graph-2d, canvas, force-directed-graph, typescript, next-js, dynamic-import]

# Dependency graph
requires:
  - phase: 06-graph
    plan: 01
    provides: graphUtils.ts (GraphNode, GraphLink, GraphData types, buildGraphData, crossLinkNodes, CATEGORY_COLORS, NODE_BASE_RADIUS, NODE_TAG_SCALE), GraphControls.tsx
  - phase: 02-enrichment
    provides: LinkWithTags type, tags data, LinkDetail.tsx component
  - phase: 01-foundation
    provides: useLinks hook, Sidebar.tsx, app router structure
provides:
  - ForceGraph.tsx: canvas-rendered force-directed graph with all interaction handlers
  - GraphView.tsx: SSR-safe dynamic import wrapper for ForceGraph
  - /dashboard/graph route: graph page accessible from sidebar
  - Sidebar Graph nav item enabled with href /dashboard/graph
affects:
  - End-user graph visualization experience

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Render tick counter pattern for highlight state changes without simulation restarts
    - Module-level imageCache Map to avoid image recreation inside canvas paint callbacks
    - ResizeObserver-based container dimension tracking for responsive canvas sizing
    - dynamic() with ssr:false for SSR-safe canvas library integration
    - any casts for react-force-graph-2d callback props (library types incompatible with custom node types)

key-files:
  created:
    - src/components/graph/ForceGraph.tsx
    - src/components/graph/GraphView.tsx
    - src/app/(dashboard)/dashboard/graph/page.tsx
  modified:
    - src/components/layout/Sidebar.tsx

key-decisions:
  - "Highlight state in refs (not state) — avoids re-renders that restart d3 simulation; renderTick counter triggers repaint"
  - "Module-level imageCache Map outside component — favicon images persist across renders and are never recreated inside paintNode"
  - "any casts for ForceGraph2D callback props — react-force-graph-2d's generic node type is incompatible with typed GraphNode without double-cast"
  - "graphData in useMemo keyed on [links, visibleCategories] — simulation only restarts when data actually changes"

patterns-established:
  - "renderTick counter: increment to force re-render for ref-stored UI state without restarting expensive simulations"
  - "SSR-safe canvas: dynamic(() => import('./CanvasComponent'), { ssr: false }) in a 'use client' wrapper"

requirements-completed: [GRPH-01, GRPH-02, GRPH-03]

# Metrics
duration: 3min
completed: 2026-03-22
---

# Phase 6 Plan 02: Graph Rendering Component Summary

**Canvas-rendered force-directed graph at /dashboard/graph with hover highlighting, click-to-detail, drag-to-pin, category filtering, and dark mode — delivered via react-force-graph-2d with SSR-safe dynamic import**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-22T18:47:21Z
- **Completed:** 2026-03-22T18:50:15Z
- **Tasks:** 3 of 3 complete (including human verification)
- **Files modified:** 4

## Accomplishments
- ForceGraph.tsx: 298-line canvas component with custom node painting (category colors, favicon circles, letter initials), hover highlight via crossLinkNodes nodeMap object identity, drag-to-pin (fx/fy), zoom/pan, empty/loading states
- GraphView.tsx: SSR-safe dynamic import wrapper preventing react-force-graph-2d from running server-side
- /dashboard/graph route: server component rendering GraphView
- Sidebar Graph nav item enabled — users can navigate to graph from sidebar
- All 161 tests pass (17 graph utility tests + 144 others), no regressions

## Task Commits

Each task was committed atomically:

1. **Task 1a: ForceGraph canvas rendering component** - `691d937` (feat)
2. **Task 1b: GraphView SSR wrapper, route page, sidebar nav** - `7c07300` (feat)
3. **Task 2: Human verification checkpoint** - approved (no commit — checkpoint only)

## Files Created/Modified
- `src/components/graph/ForceGraph.tsx` - Canvas-rendered force-directed graph with all interaction handlers (298 lines)
- `src/components/graph/GraphView.tsx` - SSR-safe wrapper using next/dynamic with loading state
- `src/app/(dashboard)/dashboard/graph/page.tsx` - Route page at /dashboard/graph
- `src/components/layout/Sidebar.tsx` - Graph nav item enabled with href /dashboard/graph

## Decisions Made
- Highlight state stored in refs (`highlightNodesRef`, `highlightLinksRef`) to avoid triggering React renders that would restart the d3 simulation. A `renderTick` state counter is incremented to trigger the canvas repaint when highlights change.
- Module-level `imageCache = new Map<string, HTMLImageElement>()` outside the component — favicons persist across renders and are never re-created inside `paintNode` (avoids flooding with `new Image()` calls on every animation frame)
- `any` casts for `nodeCanvasObject`, `onNodeClick`, etc. — react-force-graph-2d's generic node type `{ [others: string]: any; id?: ...; x?: ... }` is incompatible with the stricter `GraphNode` without a double-cast through `unknown`. Used `as any` with ESLint suppression comments.
- `graphData` computed in `useMemo([links, visibleCategories])` — simulation only restarts when the actual data changes, not on hover/selection state changes

## Deviations from Plan

### Out-of-Scope Issues Deferred

Pre-existing TypeScript errors in `src/lib/db/queries/links.ts` (Drizzle ORM `enrichmentSource: string` vs `EnrichmentSource` union) and `tests/api/export.test.ts` (fixture objects missing newer fields) were discovered during type check. These are pre-existing and not caused by this plan's changes. Documented in `.planning/phases/06-graph/deferred-items.md`.

None introduced by this plan — executed as written.

---

**Total deviations:** None
**Impact on plan:** Plan executed exactly as specified.

## Issues Encountered
- Shell environment default Node 14 — used `/home/yalt/.nvm/versions/node/v20.19.4/bin/node` as established in prior phases.
- react-force-graph-2d callback prop types are generic objects incompatible with typed `GraphNode` — resolved with `as any` casts (consistent with plan's research Pitfall guidance).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Human verification passed (Task 2 approved) — all GRPH-01/02/03 requirements confirmed working in browser
- Phase 6 (graph) is fully complete — all plans (06-01 and 06-02) delivered
- The graph is the final v1.0 milestone feature; the application is feature-complete for v1.0
- Deferred: pre-existing TypeScript errors in links.ts and export.test.ts (out of scope for this plan)

---
*Phase: 06-graph*
*Completed: 2026-03-22*
