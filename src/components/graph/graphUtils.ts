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
