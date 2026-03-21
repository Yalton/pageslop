# Phase 6: Graph - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Interactive force-directed graph where links are nodes and shared tags create edges. Users can explore how their bookmarks connect, click nodes to view details, and filter by category. Must perform smoothly with thousands of nodes via WebGL rendering. No new link management, no tag editing from the graph, no graph-based recommendations in this phase.

</domain>

<decisions>
## Implementation Decisions

### Graph layout & appearance
- Nodes are circles showing the link's favicon; node size scales slightly with tag count
- Nodes colored by category (Technology = blue, News = red, etc.) — category color legend in corner
- Force-directed layout algorithm — nodes repel, edges attract connected nodes, natural clustering
- Node labels (title) visible on hover only — keeps graph clean at scale
- Full-page graph view at /dashboard/graph — enable existing disabled "Graph" sidebar nav item

### Node interaction & navigation
- Clicking a node opens the existing LinkDetail dialog/sheet — same component as dashboard, graph stays visible behind it
- Hovering a node shows tooltip with link title AND highlights all connected edges and neighbor nodes — non-connected nodes dim
- Nodes are draggable — users can reposition nodes, force simulation continues around dragged node
- Standard zoom/pan via mouse wheel and drag on background

### Edge logic & filtering
- 1 shared tag = 1 edge — any two links sharing at least one tag are connected
- Edge thickness scales with shared tag count (thin = 1 shared tag, thick = 3+ shared tags)
- Isolated nodes (no shared tags) shown at the edges/perimeter of the graph — still clickable
- Category filter only — dropdown/pill bar to show/hide nodes by category, no tag filtering (that's on the dashboard)

### Claude's Discretion
- WebGL library choice (e.g., force-graph, sigma.js, cytoscape, d3-force + WebGL renderer)
- Exact category-to-color mapping
- Force simulation parameters (charge, link distance, collision radius)
- Node size scale factor
- Edge opacity and color
- Zoom limits (min/max)
- Graph page layout (controls position, legend placement)
- Empty state when user has no links

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/layout/Sidebar.tsx`: Has disabled "Graph" nav item with `Network` icon — enable with href `/dashboard/graph`
- `src/components/links/LinkDetail.tsx`: Detail dialog/sheet component — reuse for node click
- `src/lib/hooks/useLinks.ts`: SWR hook returns all `LinkWithTags[]` — graph data source
- `src/lib/db/queries/links.ts`: `listLinksWithTags()` — backend query for graph data
- `src/types/index.ts`: `LinkWithTags`, `Tag`, `CATEGORIES` — all types needed for graph
- `src/lib/utils/domain-color.ts`: `domainToHue` — could inform node colors if needed

### Established Patterns
- SWR for client-side data fetching
- LinkDetail as reusable detail panel (Dialog on desktop, Sheet on mobile)
- Sidebar nav items with active state detection via pathname
- Dashboard pages under `src/app/(dashboard)/dashboard/`

### Integration Points
- New route: `src/app/(dashboard)/dashboard/graph/page.tsx`
- Sidebar: enable "Graph" nav item with `href: '/dashboard/graph'`
- Graph component reads from `useLinks()` or a dedicated graph API endpoint
- Node click triggers `LinkDetail` with the selected link
- Category filter operates on the same `CATEGORIES` array from types

</code_context>

<specifics>
## Specific Ideas

- Hover highlighting (connected edges + neighbors light up, rest dims) is key for exploring relationships
- Force-directed layout naturally clusters related content — shared tags pull nodes together
- Edge thickness as visual weight makes strong connections immediately obvious
- Isolated nodes at the perimeter prevents them from cluttering the connected core

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-graph*
*Context gathered: 2026-03-21*
