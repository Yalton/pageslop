import { LinkWithTags, CATEGORIES } from '@/types'
import { isVisibleInAllLinks } from '@/lib/utils/all-links-filter'

export interface GraphNode {
  id: string
  link: LinkWithTags
  neighbors?: GraphNode[]
  connectedLinks?: GraphLink[]
}

export interface GraphLink {
  source: string
  target: string
  sharedTagCount: number
}

export interface GraphData {
  nodes: GraphNode[]
  links: GraphLink[]
}

export const CATEGORY_COLORS: Record<string, string> = {
  Technology: '#3b82f6',
  News: '#ef4444',
  Reference: '#8b5cf6',
  Entertainment: '#f59e0b',
  Shopping: '#ec4899',
  Social: '#06b6d4',
  Education: '#10b981',
  Finance: '#84cc16',
  Health: '#f97316',
  Creative: '#a855f7',
  Other: '#6b7280',
} satisfies Record<(typeof CATEGORIES)[number], string>

export const NODE_BASE_RADIUS = 5
export const NODE_TAG_SCALE = 0.4

// Hover fade: dim factor 0 = nothing dimmed, 1 = fully dimmed
export const DIM_FADE_MS = 200
export const DIMMED_NODE_ALPHA = 0x44 / 255
export const HIGHLIGHT_LINK_ALPHA = 0.6
export const DIMMED_LINK_ALPHA = 0.05
export const DIMMED_LINK_WIDTH = 0.3

export function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v))
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function easeInOutCubic(t: number): number {
  const x = clamp01(t)
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
}

/** Moves the linear dim progress toward target by dtMs/durationMs, never overshooting. */
export function stepDim(current: number, target: number, dtMs: number, durationMs: number): number {
  if (durationMs <= 0) return target
  const step = dtMs / durationMs
  return current < target ? Math.min(target, current + step) : Math.max(target, current - step)
}

/** Alpha of a non-highlighted node for an eased dim factor. */
export function nodeAlpha(dim: number): number {
  return lerp(1, DIMMED_NODE_ALPHA, dim)
}

/** Alpha of a non-highlighted link for an eased dim factor. */
export function linkAlpha(dim: number): number {
  return lerp(HIGHLIGHT_LINK_ALPHA, DIMMED_LINK_ALPHA, dim)
}

/** Width of a non-highlighted link for an eased dim factor. */
export function dimmedLinkWidth(fullWidth: number, dim: number): number {
  return lerp(fullWidth, DIMMED_LINK_WIDTH, dim)
}

/** Appends a 2-digit hex alpha to a #rrggbb color. */
export function withAlpha(hex: string, alpha: number): string {
  return hex + Math.round(clamp01(alpha) * 255).toString(16).padStart(2, '0')
}

/**
 * Links per category among the links the graph can show, for the legend.
 * Uncategorized links are not counted: no legend chip can filter to them.
 */
export function countCategories(links: LinkWithTags[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const link of links) {
    if (!isVisibleInAllLinks(link) || link.category === null) continue
    counts.set(link.category, (counts.get(link.category) ?? 0) + 1)
  }
  return counts
}

/**
 * Builds the graph data (nodes and edges) from a list of LinkWithTags.
 *
 * - An empty `visibleCategories` set means "show all" categories.
 * - Two nodes share an edge if they have at least one tag name in common.
 * - sharedTagCount reflects the total number of shared tag names between two nodes.
 */
export function buildGraphData(
  links: LinkWithTags[],
  visibleCategories: Set<string>,
): GraphData {
  // Same links as All Links, then by visible categories (empty set = show all)
  const shownLinks = links.filter(isVisibleInAllLinks)
  const filteredLinks =
    visibleCategories.size === 0
      ? shownLinks
      : shownLinks.filter((link) =>
          link.category !== null && visibleCategories.has(link.category),
        )

  // Build GraphNode list
  const nodes: GraphNode[] = filteredLinks.map((link) => ({
    id: link.id,
    link,
  }))

  // Build a tag->linkIds index for edge computation
  // Map from tag name -> array of node IDs that have that tag
  const tagToNodeIds = new Map<string, string[]>()
  for (const link of filteredLinks) {
    for (const tag of link.tags) {
      const existing = tagToNodeIds.get(tag.name)
      if (existing) {
        existing.push(link.id)
      } else {
        tagToNodeIds.set(tag.name, [link.id])
      }
    }
  }

  // Build edges using sorted-pair key to ensure deduplication
  // Key: "idA|||idB" where idA < idB lexicographically
  // Cap large tag clusters to avoid O(n^2) explosion for extremely common tags
  // (tags shared by > MAX_CLUSTER nodes generate too many edges to be useful anyway)
  const MAX_CLUSTER_SIZE = 50
  const edgeMap = new Map<string, number>()

  for (const nodeIds of tagToNodeIds.values()) {
    if (nodeIds.length < 2) continue
    // Limit cluster size to prevent O(n^2) blow-up
    const clusterSize = Math.min(nodeIds.length, MAX_CLUSTER_SIZE)
    for (let i = 0; i < clusterSize; i++) {
      for (let j = i + 1; j < clusterSize; j++) {
        const a = nodeIds[i]
        const b = nodeIds[j]
        const key = a < b ? `${a}|||${b}` : `${b}|||${a}`
        edgeMap.set(key, (edgeMap.get(key) ?? 0) + 1)
      }
    }
  }

  const graphLinks: GraphLink[] = []
  for (const [key, sharedTagCount] of edgeMap.entries()) {
    const [source, target] = key.split('|||')
    graphLinks.push({ source, target, sharedTagCount })
  }

  return { nodes, links: graphLinks }
}

/**
 * Populates `neighbors` and `connectedLinks` on each GraphNode.
 *
 * CRITICAL: This function must be called BEFORE d3 initialization, while
 * GraphLink.source and GraphLink.target are still plain string IDs.
 * It builds a nodeMap keyed by node.id and resolves string IDs to
 * actual GraphNode references — safe to use in useMemo pre-d3.
 */
export function crossLinkNodes(data: GraphData): void {
  const nodeMap = new Map<string, GraphNode>()
  for (const node of data.nodes) {
    node.neighbors = []
    node.connectedLinks = []
    nodeMap.set(node.id, node)
  }

  for (const link of data.links) {
    // source and target are string IDs at this point (pre-d3)
    const sourceId = link.source as string
    const targetId = link.target as string

    const sourceNode = nodeMap.get(sourceId)
    const targetNode = nodeMap.get(targetId)

    if (sourceNode && targetNode) {
      sourceNode.neighbors!.push(targetNode)
      targetNode.neighbors!.push(sourceNode)
      sourceNode.connectedLinks!.push(link)
      targetNode.connectedLinks!.push(link)
    }
  }
}

// Initial fit: padding (px) for zoomToFit and its animation duration
export const FIT_PADDING = 60
export const FIT_DURATION_MS = 400
// Weak centring pull so unconnected nodes stay near the cluster
export const ISOLATED_PULL = 0.08
export const CONNECTED_PULL = 0.005

export interface PullNode {
  x?: number
  y?: number
  vx?: number
  vy?: number
  neighbors?: unknown[]
}

/** Pull strength toward the centre: isolated nodes (no neighbours) get a stronger pull. */
export function pullStrength(node: PullNode): number {
  return node.neighbors && node.neighbors.length > 0 ? CONNECTED_PULL : ISOLATED_PULL
}

/**
 * d3-force compatible force pulling every node toward the origin.
 * Implemented locally (a force is just `(alpha) => void` + `initialize`) so we
 * do not depend on the transitive d3-force-3d package.
 */
export function createCentringForce() {
  let nodes: PullNode[] = []
  const force = (alpha: number) => {
    for (const node of nodes) {
      const k = pullStrength(node) * alpha
      node.vx = (node.vx ?? 0) - (node.x ?? 0) * k
      node.vy = (node.vy ?? 0) - (node.y ?? 0) * k
    }
  }
  force.initialize = (n: PullNode[]) => {
    nodes = n
  }
  return force
}
