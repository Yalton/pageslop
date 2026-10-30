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
  DIM_FADE_MS,
  easeInOutCubic,
  stepDim,
  nodeAlpha,
  linkAlpha,
  dimmedLinkWidth,
  withAlpha,
  countCategories,
  createCentringForce,
  FIT_PADDING,
  FIT_DURATION_MS,
  type GraphNode,
  type GraphLink,
} from './graphUtils'
import type { LinkWithTags, Link } from '@/types'
import { PageSpinner } from '@/components/ui/spinner'
import { publicImageUrl } from '@/lib/utils/private-host'

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

  // Hover fade: linear progress 0..1 (eased at paint time), its target, and the rAF handle
  const dimRef = useRef(0)
  const dimTargetRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  // While true the canvas must keep repainting even if the simulation has stopped
  const [fading, setFading] = useState(false)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphRef = useRef<any>(null)

  // Callback ref, not useRef: the container only mounts once loading finishes,
  // so a mount-only effect would never see it
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })

  // Track container dimensions via ResizeObserver
  useEffect(() => {
    if (!container) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        const { width, height } = entry.contentRect
        setDimensions({ width: Math.max(width, 100), height: Math.max(height, 100) })
      }
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [container])

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

  const categoryCounts = useMemo(() => countCategories(links), [links])

  // Advance the dim factor toward its target each frame; clear highlights once faded out
  const startFade = useCallback(() => {
    if (rafRef.current !== null) return
    setFading(true)
    let last = performance.now()
    const tick = (now: number) => {
      dimRef.current = stepDim(dimRef.current, dimTargetRef.current, now - last, DIM_FADE_MS)
      last = now
      if (dimRef.current === dimTargetRef.current) {
        rafRef.current = null
        if (dimTargetRef.current === 0) {
          highlightNodesRef.current = new Set()
          highlightLinksRef.current = new Set()
        }
        setFading(false)
        setRenderTick((t) => t + 1)
        return
      }
      graphRef.current?.refresh?.()
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [])

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

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

      // On hover-out keep the previous highlight sets so they can fade out
      if (node) {
        highlightNodesRef.current = newHighlightNodes
        highlightLinksRef.current = newHighlightLinks
      }
      dimTargetRef.current = node ? 1 : 0
      setHoverNode(node)
      setRenderTick((t) => t + 1)
      startFade()
    },
    [startFade],
  )

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedLink(node.link)
  }, [])

  const handleNodeDragEnd = useCallback((node: GraphNode & { x?: number; y?: number; fx?: number; fy?: number }) => {
    // Pin node in place after drag
    node.fx = node.x
    node.fy = node.y
  }, [])

  // Fit once after the first settle; later stops must not reset the user's zoom/pan
  const hasFitRef = useRef(false)
  const onEngineStop = useCallback(() => {
    if (hasFitRef.current) return
    hasFitRef.current = true
    graphRef.current?.zoomToFit(FIT_DURATION_MS, FIT_PADDING)
  }, [])

  // Weak centring force keeps unconnected nodes near the cluster
  const hasData = !isLoading && links.length > 0
  useEffect(() => {
    if (hasData) graphRef.current?.d3Force?.('centring', createCentringForce())
  }, [hasData])

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

      // Dim non-highlighted nodes by the eased fade factor
      if (highlights.size > 0 && !highlights.has(node)) {
        color = withAlpha(color, nodeAlpha(easeInOutCubic(dimRef.current)))
      }

      ctx.beginPath()
      ctx.arc(x, y, r, 0, 2 * Math.PI)
      ctx.fillStyle = color
      ctx.fill()

      // Favicon rendering (only at sufficient zoom)
      const favicon = publicImageUrl(node.link.favicon)
      if (globalScale > 0.5 && favicon) {
        const img = getImage(favicon)
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
      } else if (!favicon) {
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
      const fullWidth = Math.min(1 + link.sharedTagCount, 4)
      if (highlights.size === 0 || highlights.has(link)) return fullWidth
      return dimmedLinkWidth(fullWidth, easeInOutCubic(dimRef.current))
    },
    [renderTick],
  )

  const linkColor = useCallback(
    (link: GraphLink) => {
      const highlights = highlightLinksRef.current
      if (highlights.size === 0 || highlights.has(link)) {
        return 'rgba(150,150,150,0.6)'
      }
      return `rgba(150,150,150,${linkAlpha(easeInOutCubic(dimRef.current))})`
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
        categoryCounts={categoryCounts}
        totalNodes={graphData.nodes.length}
        totalEdges={graphData.links.length}
      />

      <div ref={setContainer} className="flex-1 overflow-hidden">
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
          autoPauseRedraw={!fading}
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
