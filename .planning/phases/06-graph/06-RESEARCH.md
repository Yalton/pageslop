# Phase 6: Graph - Research

**Researched:** 2026-03-22
**Domain:** WebGL/Canvas force-directed graph visualization in Next.js (App Router)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Nodes are circles showing the link's favicon; node size scales slightly with tag count
- Nodes colored by category (Technology = blue, News = red, etc.) — category color legend in corner
- Force-directed layout algorithm — nodes repel, edges attract connected nodes, natural clustering
- Node labels (title) visible on hover only — keeps graph clean at scale
- Full-page graph view at /dashboard/graph — enable existing disabled "Graph" sidebar nav item
- Clicking a node opens the existing LinkDetail dialog/sheet — same component as dashboard, graph stays visible behind it
- Hovering a node shows tooltip with link title AND highlights all connected edges and neighbor nodes — non-connected nodes dim
- Nodes are draggable — users can reposition nodes, force simulation continues around dragged node
- Standard zoom/pan via mouse wheel and drag on background
- 1 shared tag = 1 edge — any two links sharing at least one tag are connected
- Edge thickness scales with shared tag count (thin = 1 shared tag, thick = 3+ shared tags)
- Isolated nodes (no shared tags) shown at the edges/perimeter of the graph — still clickable
- Category filter only — dropdown/pill bar to show/hide nodes by category, no tag filtering

### Claude's Discretion
- WebGL library choice (e.g., force-graph, sigma.js, cytoscape, d3-force + WebGL renderer)
- Exact category-to-color mapping
- Force simulation parameters (charge, link distance, collision radius)
- Node size scale factor
- Edge opacity and color
- Zoom limits (min/max)
- Graph page layout (controls position, legend placement)
- Empty state when user has no links

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| GRPH-01 | User can view a relational graph showing connections between links based on shared tags/classification | react-force-graph-2d renders nodes + edges from LinkWithTags[] data; edge computation from shared tag sets |
| GRPH-02 | User can click a node in the graph to view link details | onNodeClick prop opens existing LinkDetail component with selected LinkWithTags |
| GRPH-03 | Graph performs smoothly with thousands of nodes (WebGL rendering) | react-force-graph-2d uses Canvas 2D with hardware acceleration; warmupTicks pre-runs simulation; nodePointerAreaPaint enables custom hit detection |
</phase_requirements>

---

## Summary

Phase 6 introduces a full-page force-directed graph where each bookmark is a node and shared tags create edges. The rendering library choice is the most consequential decision — it must handle thousands of nodes without frame rate drops while supporting custom node painting (favicon circles), interactive hover highlighting, draggable nodes, and zoom/pan.

`react-force-graph-2d` (the 2D Canvas variant from the vasturiano/react-force-graph family) is the recommended library. It is a well-maintained, actively updated package (version ~1.29, updated within the last 2 months as of research date) built on d3-force-3d for physics. Canvas 2D is appropriate for this use case: the WebGL (Three.js) 3D variant would be overkill for a 2D graph and adds significant bundle weight, while Canvas 2D holds 60 FPS well into the thousands-of-nodes range when the simulation has cooled. The library ships its own TypeScript definitions and has native support for every locked feature: `nodeCanvasObject` for custom circle+favicon rendering, `onNodeHover`/`onNodeClick` callbacks, neighbor highlighting via cross-linked node/link sets, `onNodeDragEnd` for pinning dragged nodes, and `zoomToFit()` via ref methods.

The graph data transformation (computing edges from `LinkWithTags[]`) is pure JavaScript that runs client-side using `useMemo`. Because the user's entire link collection is already loaded in the `useLinks()` SWR hook, no new API endpoint is needed. Edge computation is O(N×T) where N is link count and T is average tag count — fast enough for thousands of links in a single synchronous pass.

**Primary recommendation:** Use `react-force-graph-2d` with `dynamic(() => import(...), { ssr: false })` in a `'use client'` wrapper, driven by the existing `useLinks()` SWR hook, with edges computed in `useMemo`.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-force-graph-2d | ~1.29.x | 2D Canvas force-directed graph React component | Vasturiano's canonical library; active maintenance; ships TypeScript defs; all required callbacks; Canvas avoids SSR complications of WebGL Three.js |
| d3-force-3d | (peer dep, auto-installed) | Force simulation physics engine | Included as dependency of react-force-graph-2d; exposes `d3Force()` for tuning |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| next/dynamic | (Next.js built-in) | SSR-disable wrapper | Required — react-force-graph-2d accesses `window` at module load; must be dynamically imported with `{ ssr: false }` |
| useRef (React built-in) | — | Access ForceGraphMethods (zoomToFit, d3Force) | Required for imperative graph control |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-force-graph-2d | react-force-graph-3d (Three.js/WebGL) | 3D WebGL holds 60 FPS at higher node counts but adds Three.js bundle weight (~600KB gzipped), requires 3D camera navigation, and has no benefit for 2D layout |
| react-force-graph-2d | sigma.js + graphology | Sigma.js is WebGL-native and excellent for static large graphs; however, React integration is less ergonomic, and the graphology data model adds significant setup for a self-contained feature |
| react-force-graph-2d | cytoscape.js | Uses SVG/Canvas but degrades noticeably above ~10K nodes; less React-idiomatic |
| react-force-graph-2d | D3-force + custom canvas | Maximum control; 3-5x more code to write hover highlighting, zoom, drag; not worth it given the library covers all locked requirements |

**Installation:**
```bash
npm install react-force-graph-2d
```

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/(dashboard)/dashboard/
│   └── graph/
│       └── page.tsx            # Route: /dashboard/graph — thin server component
├── components/graph/
│   ├── GraphView.tsx           # 'use client' wrapper with dynamic import (no SSR)
│   ├── ForceGraph.tsx          # The dynamic-imported component (accesses window)
│   ├── GraphControls.tsx       # Category filter pill bar + legend
│   └── graphUtils.ts           # buildGraphData(), CATEGORY_COLORS map
```

### Pattern 1: SSR-safe Dynamic Import for Canvas Libraries

**What:** react-force-graph-2d references `window` at module load time. Next.js App Router runs component code on the server during SSR, so importing the library directly in a `'use client'` component still crashes.

**When to use:** Any browser-API-dependent library in Next.js App Router.

**Example:**
```typescript
// src/components/graph/GraphView.tsx
'use client'
import dynamic from 'next/dynamic'
import type { GraphData } from './ForceGraph'

// SSR disabled: ForceGraph component must not run on server
const ForceGraph = dynamic(() => import('./ForceGraph'), {
  ssr: false,
  loading: () => <div className="flex-1 flex items-center justify-center text-muted-foreground">Loading graph...</div>,
})

export function GraphView({ data }: { data: GraphData }) {
  return <ForceGraph data={data} />
}
```

```typescript
// src/components/graph/ForceGraph.tsx
'use client'
import { useRef, useCallback, useState } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
// This file is only ever imported via dynamic() — window access is safe
```

### Pattern 2: Graph Data Computation via useMemo

**What:** Transform `LinkWithTags[]` into `{ nodes, links }` format and cross-link neighbors for O(1) hover lookup.

**When to use:** Every render, filtered by active category set.

**Example:**
```typescript
// src/components/graph/graphUtils.ts
import type { LinkWithTags } from '@/types'

export interface GraphNode {
  id: string
  link: LinkWithTags
  // d3 adds: x, y, vx, vy, fx, fy at runtime
  neighbors?: GraphNode[]
  connectedLinks?: GraphLink[]
}

export interface GraphLink {
  source: string  // node id
  target: string  // node id
  sharedTagCount: number
}

export interface GraphData {
  nodes: GraphNode[]
  links: GraphLink[]
}

export function buildGraphData(links: LinkWithTags[], visibleCategories: Set<string>): GraphData {
  const filtered = visibleCategories.size === 0
    ? links
    : links.filter(l => l.category && visibleCategories.has(l.category))

  const nodes: GraphNode[] = filtered.map(l => ({ id: l.id, link: l }))

  // Build tag -> link ID index for edge computation
  const tagToLinks = new Map<string, string[]>()
  for (const link of filtered) {
    for (const tag of link.tags) {
      const name = tag.name.toLowerCase()
      if (!tagToLinks.has(name)) tagToLinks.set(name, [])
      tagToLinks.get(name)!.push(link.id)
    }
  }

  // Build edge set (deduplicated, count shared tags)
  const edgeMap = new Map<string, number>() // "idA|idB" -> sharedTagCount
  for (const [, linkIds] of tagToLinks) {
    for (let i = 0; i < linkIds.length; i++) {
      for (let j = i + 1; j < linkIds.length; j++) {
        const key = [linkIds[i], linkIds[j]].sort().join('|')
        edgeMap.set(key, (edgeMap.get(key) ?? 0) + 1)
      }
    }
  }

  const graphLinks: GraphLink[] = Array.from(edgeMap.entries()).map(([key, count]) => {
    const [source, target] = key.split('|')
    return { source, target, sharedTagCount: count }
  })

  return { nodes, links: graphLinks }
}

// Cross-link nodes/edges after d3 resolves source/target to objects
export function crossLinkNodes(data: GraphData): void {
  data.links.forEach(link => {
    const a = link.source as unknown as GraphNode
    const b = link.target as unknown as GraphNode
    a.neighbors ??= []
    b.neighbors ??= []
    a.connectedLinks ??= []
    b.connectedLinks ??= []
    a.neighbors.push(b)
    b.neighbors.push(a)
    a.connectedLinks.push(link)
    b.connectedLinks.push(link)
  })
}
```

### Pattern 3: Hover Highlight with Node Dimming

**What:** The library's official highlight pattern — maintain `Set<GraphNode>` and `Set<GraphLink>` for highlighted elements, pass dynamic color/width accessors that read those sets.

**Example:**
```typescript
// Source: vasturiano/react-force-graph highlight example
const [highlightNodes, setHighlightNodes] = useState(new Set<GraphNode>())
const [highlightLinks, setHighlightLinks] = useState(new Set<GraphLink>())
const [hoverNode, setHoverNode] = useState<GraphNode | null>(null)

const handleNodeHover = useCallback((node: GraphNode | null) => {
  const newHighlightNodes = new Set<GraphNode>()
  const newHighlightLinks = new Set<GraphLink>()
  if (node) {
    newHighlightNodes.add(node)
    node.neighbors?.forEach(n => newHighlightNodes.add(n))
    node.connectedLinks?.forEach(l => newHighlightLinks.add(l))
  }
  setHighlightNodes(newHighlightNodes)
  setHighlightLinks(newHighlightLinks)
  setHoverNode(node)
}, [])

// Props:
// nodeColor={node => highlightNodes.size === 0 || highlightNodes.has(node) ? CATEGORY_COLORS[node.link.category] : '#cccccc44'}
// linkWidth={link => highlightLinks.has(link) ? Math.max(1, link.sharedTagCount * 1.5) : 0.5}
// linkColor={link => highlightLinks.size === 0 || highlightLinks.has(link) ? 'rgba(150,150,150,0.6)' : 'rgba(150,150,150,0.05)'}
```

### Pattern 4: Custom Node Canvas Rendering (Favicon Circle)

**What:** Draw each node as a colored circle with an optional favicon image. `nodeCanvasObject` is called every frame; image caching is mandatory for performance.

**Example:**
```typescript
// Source: react-force-graph nodeCanvasObject API
const imageCache = new Map<string, HTMLImageElement>()

function getImage(src: string): HTMLImageElement | null {
  if (imageCache.has(src)) return imageCache.get(src)!
  const img = new Image()
  img.src = src
  img.onload = () => imageCache.set(src, img)
  return null // returns null until loaded; next frame will have it
}

const paintNode = useCallback((node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
  const r = NODE_BASE_RADIUS + node.link.tags.length * 0.5
  const color = CATEGORY_COLORS[node.link.category ?? 'Other'] ?? '#888'
  const isHighlighted = highlightNodes.size === 0 || highlightNodes.has(node)

  // Background circle
  ctx.beginPath()
  ctx.arc(node.x!, node.y!, r, 0, 2 * Math.PI)
  ctx.fillStyle = isHighlighted ? color : color + '44'
  ctx.fill()

  // Favicon image (if loaded and node big enough on screen)
  if (globalScale > 0.5 && node.link.favicon) {
    const img = getImage(node.link.favicon)
    if (img) {
      const faviconSize = r * 1.4
      ctx.save()
      ctx.clip() // clip to circle
      ctx.drawImage(img, node.x! - faviconSize / 2, node.y! - faviconSize / 2, faviconSize, faviconSize)
      ctx.restore()
    }
  }

  // Label: show on hover only
  if (hoverNode === node && globalScale > 0.5) {
    const label = node.link.title ?? node.link.url
    ctx.font = `${12 / globalScale}px Sans-Serif`
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.textAlign = 'center'
    ctx.fillText(label, node.x!, node.y! + r + 12 / globalScale)
  }
}, [highlightNodes, hoverNode])
```

### Pattern 5: Pinning Dragged Nodes

**What:** After dragging, fix node position so the force simulation doesn't move it back.

**Example:**
```typescript
// Source: vasturiano/react-force-graph fix-dragged-nodes example
const handleNodeDragEnd = useCallback((node: GraphNode) => {
  node.fx = node.x
  node.fy = node.y
}, [])
```

### Pattern 6: Performance Tuning for Large Graphs

**What:** Pre-run simulation ticks before first render to avoid visible layout thrash on mount. Cool down via `cooldownTicks`.

**Example:**
```typescript
<ForceGraph2D
  warmupTicks={100}          // run 100 simulation ticks before first paint
  cooldownTicks={300}        // stop simulation after 300 ticks post-mount
  onEngineStop={() => graphRef.current?.zoomToFit(400, 80)}
  d3AlphaDecay={0.02}        // slightly slower decay = better layout convergence
  d3VelocityDecay={0.4}      // moderate velocity damping
/>
```

### Anti-Patterns to Avoid

- **Importing react-force-graph-2d at the top of a client component:** Even with `'use client'`, Next.js still runs the module on the server for SSR HTML generation. Always use `next/dynamic` with `{ ssr: false }`.
- **No image cache for favicons:** Calling `new Image()` in `nodeCanvasObject` every frame creates thousands of objects per second and causes GC pressure. Always cache loaded images in a `Map` outside the component.
- **Recreating graphData on every render:** Build nodes/links with `useMemo` keyed on `links`. Passing a new object reference every render restarts the force simulation.
- **Using `setState` in `nodeCanvasObject`:** The canvas paint callback runs 60 times/second. Calling `setState` inside it causes re-render loops. Use refs for highlight state that is read synchronously in the callback.
- **Skipping crossLinkNodes:** Without pre-indexing `node.neighbors` and `node.connectedLinks`, hover highlighting requires O(E) scan per frame — visible performance drop above 1000 edges.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Force layout physics | Custom repulsion/attraction algorithm | d3-force-3d (via react-force-graph-2d peer dep) | Barnes-Hut approximation, link force, many-body, collision — hundreds of edge cases in numerical stability |
| Canvas zoom/pan | Mouse wheel event listener + transform matrix | react-force-graph-2d built-in | Handles touchpad, pinch-to-zoom, min/max zoom clamping, momentum |
| Node drag | Mousedown/mousemove tracking | react-force-graph-2d built-in | Correctly reheat simulation during drag, handle touch events |
| Hit detection on canvas | Manual distance checks per node per click | `nodeCanvasObject` + built-in pointer tracking | Library handles coordinate transforms, scale-aware hit zones |

**Key insight:** The entire physics + rendering + interaction layer is solved by one library. Custom canvas code is only needed for visual styling (colors, favicon rendering, label drawing).

---

## Common Pitfalls

### Pitfall 1: SSR Crash — "window is not defined"
**What goes wrong:** Next.js builds crash or throw at runtime because react-force-graph-2d calls `window.devicePixelRatio` and other browser globals at module import time.
**Why it happens:** App Router SSR executes `'use client'` module code on the server for HTML generation, even though the component won't be interactive.
**How to avoid:** Always import via `dynamic(() => import('./ForceGraph'), { ssr: false })`. The dynamically-imported file can import react-force-graph-2d at the top level safely.
**Warning signs:** Build error mentioning `window`, `document`, or `canvas` in a server context.

### Pitfall 2: Force Simulation Restarts on Every Render
**What goes wrong:** Graph nodes visibly fly around whenever a React state update occurs (e.g., hover state change).
**Why it happens:** Passing a new `graphData` object reference to `ForceGraph2D` triggers d3-force to re-initialize all node positions.
**How to avoid:** Build `graphData` with `useMemo` and only invalidate on `links` array reference change (from SWR). Keep hover highlight state in refs when read only inside canvas callbacks.
**Warning signs:** Nodes jump when hovering; console shows repeated engine restarts.

### Pitfall 3: Canvas Paint Performance with Favicons
**What goes wrong:** Frame rate drops below 30 FPS with 1000+ nodes when favicons are rendered.
**Why it happens:** `new Image()` or `fetch` inside `nodeCanvasObject` creates I/O per frame.
**How to avoid:** Maintain a module-level `Map<string, HTMLImageElement>` cache. Pre-load images on mount by iterating links. Fall back to a colored initial letter if image is not yet cached.
**Warning signs:** Memory usage climbs; DevTools shows many pending image requests per second.

### Pitfall 4: Edge Count Explosion
**What goes wrong:** With many tags per link, shared-tag edge count grows quadratically. 1000 links each with 4 common tags can produce tens of thousands of edges.
**Why it happens:** Each shared tag between N links produces N*(N-1)/2 edges per tag value.
**How to avoid:** The O(N×T) `buildGraphData` algorithm already deduplicates edges using a Map keyed on sorted node pair. Still worth monitoring: if a user has many links all tagged "software", that tag alone produces a dense subgraph. No action needed for now — this is expected behavior (shared tags = edges) and Canvas renders 50K+ edges at acceptable FPS when simulation is cooled.
**Warning signs:** `graphData.links.length` >> `graphData.nodes.length * 5` is normal; >> 100K may warrant a cap or edge sampling.

### Pitfall 5: Hover State in Canvas Callbacks Needs Refs Not State
**What goes wrong:** Node highlight flickers or causes re-renders that restart the simulation.
**Why it happens:** `highlightNodes` is a `Set` that changes reference on hover; if read via closure in `nodeCanvasObject`, the callback captures the old set unless re-created via `useCallback`.
**How to avoid:** Two valid patterns: (a) use `useRef` to store the current highlight set and read `highlightRef.current` inside the callback — zero re-renders; (b) use `useState` but wrap the paint callback in `useCallback` with the set in the dependency array. Pattern (a) avoids simulation restarts entirely.

### Pitfall 6: Next.js Dynamic Import Breaks Ref Methods
**What goes wrong:** `graphRef.current?.zoomToFit()` does nothing or throws.
**Why it happens:** A known issue where dynamic imports wrap the component and the ref doesn't reach the underlying ForceGraph2D instance.
**How to avoid:** Place `const graphRef = useRef()` in the dynamically-imported `ForceGraph.tsx` file itself (the one that directly renders `<ForceGraph2D ref={graphRef} />`), not in the parent wrapper that uses `dynamic()`. Expose needed callbacks (e.g., `onEngineStop` calling `zoomToFit`) from within that file.

---

## Code Examples

### Category Color Map
```typescript
// src/components/graph/graphUtils.ts
// Source: derived from CATEGORIES in src/types/index.ts
import type { Category } from '@/types'

export const CATEGORY_COLORS: Record<string, string> = {
  Technology:   '#3b82f6', // blue-500
  News:         '#ef4444', // red-500
  Reference:    '#8b5cf6', // violet-500
  Entertainment:'#f59e0b', // amber-500
  Shopping:     '#ec4899', // pink-500
  Social:       '#06b6d4', // cyan-500
  Education:    '#10b981', // emerald-500
  Finance:      '#84cc16', // lime-500
  Health:       '#f97316', // orange-500
  Creative:     '#a855f7', // purple-500
  Other:        '#6b7280', // gray-500
}

export const NODE_BASE_RADIUS = 5   // pixels at graph scale
export const NODE_TAG_SCALE = 0.4   // additional radius per tag
```

### ForceGraph2D Integration (core props)
```typescript
// Source: react-force-graph-2d API (vasturiano GitHub)
<ForceGraph2D
  ref={graphRef}
  graphData={graphData}           // { nodes: GraphNode[], links: GraphLink[] }
  nodeId="id"
  linkSource="source"
  linkTarget="target"
  nodeVal={node => NODE_BASE_RADIUS + node.link.tags.length * NODE_TAG_SCALE}
  nodeCanvasObject={paintNode}    // custom circle + favicon
  nodeCanvasObjectMode={() => 'replace'}
  nodePointerAreaPaint={(node, color, ctx) => {
    const r = NODE_BASE_RADIUS + node.link.tags.length * NODE_TAG_SCALE + 2
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI)
    ctx.fill()
  }}
  linkWidth={link => highlightLinks.size === 0 || highlightLinks.has(link)
    ? Math.min(1 + link.sharedTagCount, 4)
    : 0.5
  }
  linkColor={link => highlightLinks.size === 0 || highlightLinks.has(link)
    ? 'rgba(150,150,150,0.6)'
    : 'rgba(150,150,150,0.05)'
  }
  onNodeClick={(node) => setSelectedLink(node.link)}
  onNodeHover={handleNodeHover}
  onNodeDragEnd={handleNodeDragEnd}
  warmupTicks={100}
  cooldownTicks={300}
  onEngineStop={() => graphRef.current?.zoomToFit(400, 80)}
  d3AlphaDecay={0.02}
  d3VelocityDecay={0.4}
  enableNodeDrag
  enableZoomInteraction
  minZoom={0.1}
  maxZoom={8}
/>
```

### Sidebar Nav Update
```typescript
// src/components/layout/Sidebar.tsx — change Graph nav item
{ label: "Graph", icon: Network, href: "/dashboard/graph", disabled: false },
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SVG-based force graphs (d3-force + SVG) | Canvas 2D / WebGL | ~2019-2020 | SVG DOM manipulation can't keep 60 FPS above ~500 nodes; Canvas avoids DOM per-node overhead |
| Manual zoom/pan handlers | Built-in library interaction | ~2020 | No implementation work needed |
| Global d3.js import | Scoped d3-force via react-force-graph | 2022+ | Bundle size reduced; React lifecycle managed by library |
| next/dynamic was Pages Router only | App Router: `'use client'` + `dynamic` inside client component | Next.js 13+ | `{ ssr: false }` must be inside a Client Component, not a Server Component |

**Deprecated/outdated:**
- `nodeLabel` as static string tooltip: Still works but is plain text only; `nodeCanvasObject` is the way for custom hover rendering with dimming behavior
- Setting `nodeThreeObject`: This is the 3D (Three.js) variant prop; 2D uses `nodeCanvasObject`
- `teamSize` / `localConcurrency` pg-boss props: Not relevant here, noted in project history

---

## Open Questions

1. **Graph data endpoint vs. reuse of useLinks()**
   - What we know: `useLinks()` returns `LinkWithTags[]` including all tags — sufficient to compute edges
   - What's unclear: For 5000+ links, the existing `/api/links` response could be 2-5 MB of JSON; this may be slow on first load of the graph page
   - Recommendation: Start by reusing `useLinks()`. If payload size is a concern, add a lean `/api/graph-data` endpoint returning only `{ id, category, tags: string[], favicon }` — but defer this optimization until tested with real data volumes.

2. **Isolated node layout positioning**
   - What we know: The locked decision states "isolated nodes shown at the edges/perimeter" — d3-force naturally clusters connected nodes in the center, pushing isolates outward
   - What's unclear: Whether the default force parameters will reliably place isolates at the perimeter without explicit force overrides
   - Recommendation: Start with default forces. If isolates cluster in the center, apply a radial force `d3Force('radial', d3.forceRadial(...))` targeting nodes with degree 0.

3. **Dark mode canvas rendering**
   - What we know: The project uses `next-themes` for dark/light mode; canvas fills use hardcoded color strings
   - What's unclear: Canvas context has no access to CSS variables
   - Recommendation: Read `document.documentElement.classList.contains('dark')` or use `window.matchMedia('(prefers-color-scheme: dark)')` to select background color. Background can be set via `backgroundColor` prop on `ForceGraph2D`.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.x |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `vitest run tests/` |
| Full suite command | `vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GRPH-01 | `buildGraphData()` computes correct nodes and edges from LinkWithTags[] | unit | `vitest run tests/graph/graph-utils.test.ts -t "buildGraphData"` | ❌ Wave 0 |
| GRPH-01 | `buildGraphData()` deduplicates edges — two links sharing 2 tags produce 1 edge with sharedTagCount=2 | unit | `vitest run tests/graph/graph-utils.test.ts -t "deduplicates"` | ❌ Wave 0 |
| GRPH-01 | Category filter excludes nodes correctly | unit | `vitest run tests/graph/graph-utils.test.ts -t "category filter"` | ❌ Wave 0 |
| GRPH-02 | Node click selects correct link (integration via component state) | manual-only | browser test — `onNodeClick` triggers LinkDetail with correct link | N/A |
| GRPH-03 | 5000-node graph data computation completes in < 500ms | unit (performance) | `vitest run tests/graph/graph-utils.test.ts -t "performance"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `vitest run tests/graph/`
- **Per wave merge:** `vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/graph/graph-utils.test.ts` — covers GRPH-01 (buildGraphData logic), GRPH-03 (performance with large input)
- [ ] No new shared fixtures needed — tests/setup.ts is sufficient (no DB access in graph utils)
- [ ] No new npm install needed for test infrastructure

---

## Sources

### Primary (HIGH confidence)
- `vasturiano/react-force-graph` GitHub — API props, ForceGraphMethods, TypeScript types, official highlight example, fix-dragged-nodes example
- `react-force-graph-2d` TypeScript definitions (unpkg) — ForceGraphMethods, NodeObject, LinkObject, all callback signatures

### Secondary (MEDIUM confidence)
- Next.js official docs — `next/dynamic` with `{ ssr: false }`, App Router client component boundary rules
- react-force-graph GitHub issues — SSR fix pattern (#155), dynamic import ref issue (#324), zoomToFit usage (#231)
- vasturiano highlight example (GitHub) — cross-linking neighbor sets, hover callback implementation

### Tertiary (LOW confidence)
- Performance comparison sources (Canvas vs WebGL threshold) — general guidance; specific benchmarks for this exact use case not verified

---

## Metadata

**Confidence breakdown:**
- Standard stack (react-force-graph-2d): HIGH — official GitHub, npm page, TypeScript definitions confirmed
- Architecture patterns: HIGH — derived from official examples and verified API
- SSR/Next.js integration: HIGH — documented in Next.js official docs and react-force-graph issue tracker
- Performance at 5000 nodes: MEDIUM — Canvas 2D holds well into thousands; exact FPS at 5000 nodes with custom nodeCanvasObject not benchmarked for this specific configuration
- Pitfalls: HIGH — drawn from library issue tracker and established Next.js SSR patterns

**Research date:** 2026-03-22
**Valid until:** 2026-06-22 (stable library; re-check if react-force-graph releases major version)
