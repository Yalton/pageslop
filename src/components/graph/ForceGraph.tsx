'use client'

import { useRef, useCallback, useState, useMemo, useEffect } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import { useLinks } from '@/lib/hooks/useLinks'
import { LinkDetail } from '@/components/links/LinkDetail'
import { GraphControls } from './GraphControls'
import {
  buildGraphData,
  crossLinkNodes,
  CATEGORY_COLORS,
  NODE_BASE_RADIUS,
  NODE_TAG_SCALE,
  type GraphNode,
  type GraphLink,
} from './graphUtils'
import type { LinkWithTags, Link } from '@/types'
import { PageSpinner } from '@/components/ui/spinner'

// Module-level image cache — never recreate inside paintNode
const imageCache = new Map<string, HTMLImageElement>()

function getImage(src: string): HTMLImageElement | null {
  if (!src) return null
  const cached = imageCache.get(src)
  if (cached) return cached
  const img = new Image()
  img.onload = () => imageCache.set(src, img)
  img.src = src
  return null
}

export default function ForceGraph() {
  const { links, isLoading, deleteLink, undoDelete, mutate } = useLinks()

  const [visibleCategories, setVisibleCategories] = useState<Set<string>>(new Set())
  const [selectedLink, setSelectedLink] = useState<LinkWithTags | null>(null)
  const [hoverNode, setHoverNode] = useState<GraphNode | null>(null)
  // Render tick to force re-render when highlight refs change (avoids restarting simulation)
  const [renderTick, setRenderTick] = useState(0)

  const highlightNodesRef = useRef<Set<GraphNode>>(new Set())
  const highlightLinksRef = useRef<Set<GraphLink>>(new Set())

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphRef = useRef<any>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })

  // Track container dimensions via ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        const { width, height } = entry.contentRect
        setDimensions({ width: Math.max(width, 100), height: Math.max(height, 100) })
      }
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  // Dark mode detection
  const isDark = useMemo(() => {
    if (typeof document === 'undefined') return false
    return document.documentElement.classList.contains('dark')
  }, [])

  // Graph data — keyed on [links, visibleCategories] to avoid simulation restarts
  const graphData = useMemo(() => {
    const data = buildGraphData(links, visibleCategories)
    crossLinkNodes(data)
    return data
  }, [links, visibleCategories])

  const handleNodeHover = useCallback(
    (node: GraphNode | null) => {
      const newHighlightNodes = new Set<GraphNode>()
      const newHighlightLinks = new Set<GraphLink>()

      if (node) {
        newHighlightNodes.add(node)
        if (node.neighbors) {
          for (const neighbor of node.neighbors) {
            newHighlightNodes.add(neighbor)
          }
        }
        if (node.connectedLinks) {
          for (const link of node.connectedLinks) {
            newHighlightLinks.add(link)
          }
        }
      }

      highlightNodesRef.current = newHighlightNodes
      highlightLinksRef.current = newHighlightLinks
      setHoverNode(node)
      setRenderTick((t) => t + 1)
    },
    [],
  )

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedLink(node.link)
  }, [])

  const handleNodeDragEnd = useCallback((node: GraphNode & { x?: number; y?: number; fx?: number; fy?: number }) => {
    // Pin node in place after drag
    node.fx = node.x
    node.fy = node.y
  }, [])

  const onEngineStop = useCallback(() => {
    graphRef.current?.zoomToFit(400, 80)
  }, [])

  const onToggleCategory = useCallback((cat: string) => {
    setVisibleCategories((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) {
        next.delete(cat)
      } else {
        next.add(cat)
      }
      return next
    })
  }, [])

  const paintNode = useCallback(
    (node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const { x, y } = node as GraphNode & { x: number; y: number }
      const highlights = highlightNodesRef.current
      const r = NODE_BASE_RADIUS + node.link.tags.length * NODE_TAG_SCALE

      let color = CATEGORY_COLORS[node.link.category ?? 'Other'] ?? '#6b7280'

      // Dim non-highlighted nodes when a hover is active
      if (highlights.size > 0 && !highlights.has(node)) {
        color = color + '44'
      }

      ctx.beginPath()
      ctx.arc(x, y, r, 0, 2 * Math.PI)
      ctx.fillStyle = color
      ctx.fill()

      // Favicon rendering (only at sufficient zoom)
      if (globalScale > 0.5 && node.link.favicon) {
        const img = getImage(node.link.favicon)
        if (img) {
          ctx.save()
          ctx.beginPath()
          ctx.arc(x, y, r - 1, 0, 2 * Math.PI)
          ctx.clip()
          ctx.drawImage(img, x - r + 1, y - r + 1, (r - 1) * 2, (r - 1) * 2)
          ctx.restore()
        } else {
          // Favicon not loaded yet — draw letter initial
          const domain = node.link.domain || node.link.url
          const initial = domain.charAt(0).toUpperCase()
          ctx.fillStyle = '#ffffff'
          ctx.font = `bold ${Math.max(r, 4)}px sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(initial, x, y)
        }
      } else if (!node.link.favicon) {
        // No favicon — draw letter initial
        const domain = node.link.domain || node.link.url
        const initial = domain.charAt(0).toUpperCase()
        ctx.fillStyle = '#ffffff'
        ctx.font = `bold ${Math.max(r, 4)}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(initial, x, y)
      }

      // Hover label
      if (hoverNode === node) {
        const label = (node.link.title || node.link.url).slice(0, 40)
        const fontSize = 12 / globalScale
        ctx.font = `${fontSize}px sans-serif`
        ctx.fillStyle = '#ffffff'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.fillText(label, x, y + r + 2 / globalScale)
      }
    },
    [hoverNode, renderTick],
  )

  const nodePointerAreaPaint = useCallback(
    (node: GraphNode, color: string, ctx: CanvasRenderingContext2D) => {
      const { x, y } = node as GraphNode & { x: number; y: number }
      const r = NODE_BASE_RADIUS + node.link.tags.length * NODE_TAG_SCALE + 2
      ctx.beginPath()
      ctx.arc(x, y, r, 0, 2 * Math.PI)
      ctx.fillStyle = color
      ctx.fill()
    },
    [],
  )

  const linkWidth = useCallback(
    (link: GraphLink) => {
      const highlights = highlightLinksRef.current
      if (highlights.size === 0 || highlights.has(link)) {
        return Math.min(1 + link.sharedTagCount, 4)
      }
      return 0.3
    },
    [renderTick],
  )

  const linkColor = useCallback(
    (link: GraphLink) => {
      const highlights = highlightLinksRef.current
      if (highlights.size === 0 || highlights.has(link)) {
        return 'rgba(150,150,150,0.6)'
      }
      return 'rgba(150,150,150,0.05)'
    },
    [renderTick],
  )

  if (isLoading) {
    return <PageSpinner label="Loading graph" className="h-full" />
  }

  if (links.length === 0) {
    return (
      <div className="flex flex-col h-full w-full items-center justify-center text-muted-foreground">
        No links yet. Save some links to see your connection graph.
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full w-full">
      <GraphControls
        visibleCategories={visibleCategories}
        onToggleCategory={onToggleCategory}
        totalNodes={graphData.nodes.length}
        totalEdges={graphData.links.length}
      />

      <div ref={containerRef} className="flex-1 overflow-hidden">
        <ForceGraph2D
          ref={graphRef}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          graphData={graphData as any}
          nodeId="id"
          width={dimensions.width}
          height={dimensions.height}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          nodeCanvasObject={paintNode as any}
          nodeCanvasObjectMode={() => 'replace'}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          nodePointerAreaPaint={nodePointerAreaPaint as any}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          linkWidth={linkWidth as any}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          linkColor={linkColor as any}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onNodeClick={handleNodeClick as any}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onNodeHover={handleNodeHover as any}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onNodeDragEnd={handleNodeDragEnd as any}
          warmupTicks={100}
          cooldownTicks={300}
          d3AlphaDecay={0.02}
          d3VelocityDecay={0.4}
          onEngineStop={onEngineStop}
          enableNodeDrag
          enableZoomInteraction
          minZoom={0.1}
          maxZoom={8}
          backgroundColor={isDark ? '#09090b' : '#ffffff'}
        />
      </div>

      <LinkDetail
        link={selectedLink}
        open={!!selectedLink}
        onClose={() => setSelectedLink(null)}
        onDelete={deleteLink}
        onUndoDelete={undoDelete}
        onMutate={mutate}
      />
    </div>
  )
}
