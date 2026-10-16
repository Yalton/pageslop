import { describe, it, expect } from 'vitest'
import { LINK_DEFAULTS } from '../fixtures/link-defaults'
import {
  buildGraphData,
  countCategories,
  crossLinkNodes,
  CATEGORY_COLORS,
  NODE_BASE_RADIUS,
  NODE_TAG_SCALE,
  clamp01,
  lerp,
  easeInOutCubic,
  stepDim,
  nodeAlpha,
  linkAlpha,
  dimmedLinkWidth,
  withAlpha,
  DIMMED_NODE_ALPHA,
  DIMMED_LINK_ALPHA,
  HIGHLIGHT_LINK_ALPHA,
  DIMMED_LINK_WIDTH,
  type GraphNode,
  type GraphLink,
  type GraphData,
} from '@/components/graph/graphUtils'
import { CATEGORIES, type LinkWithTags, type Tag } from '@/types'

// Helper to create a minimal LinkWithTags
function makeLink(
  id: string,
  tags: string[],
  category: string | null = 'Technology',
): LinkWithTags {
  return {
    id,
    userId: 'user-1',
    url: `https://example.com/${id}`,
    title: `Title ${id}`,
    description: null,
    ogImage: null,
    favicon: null,
    domain: 'example.com',
    status: 'ready',
    category,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...LINK_DEFAULTS,
    tags: tags.map((name, i) => ({
      id: `tag-${id}-${i}`,
      userId: 'user-1',
      name,
      source: 'rule' as const,
    })),
  }
}

describe('CATEGORY_COLORS', () => {
  it('has an entry for every CATEGORIES value', () => {
    for (const cat of CATEGORIES) {
      expect(CATEGORY_COLORS).toHaveProperty(cat)
      expect(typeof CATEGORY_COLORS[cat]).toBe('string')
    }
  })

  it('has an entry for Other', () => {
    expect(CATEGORY_COLORS).toHaveProperty('Other')
  })
})

describe('NODE_BASE_RADIUS and NODE_TAG_SCALE', () => {
  it('exports NODE_BASE_RADIUS as 5', () => {
    expect(NODE_BASE_RADIUS).toBe(5)
  })

  it('exports NODE_TAG_SCALE as 0.4', () => {
    expect(NODE_TAG_SCALE).toBe(0.4)
  })
})

describe('buildGraphData', () => {
  it('produces correct node count from 3 links', () => {
    const links = [
      makeLink('a', ['javascript', 'react']),
      makeLink('b', ['javascript', 'vue']),
      makeLink('c', ['python', 'django']),
    ]
    const result = buildGraphData(links, new Set())
    expect(result.nodes).toHaveLength(3)
  })

  it('produces deduplicated edges when 2 links share 2 tags', () => {
    const links = [
      makeLink('a', ['javascript', 'react']),
      makeLink('b', ['javascript', 'react']),
    ]
    const result = buildGraphData(links, new Set())
    // Should produce exactly 1 edge with sharedTagCount=2
    expect(result.links).toHaveLength(1)
    expect(result.links[0].sharedTagCount).toBe(2)
  })

  it('produces edges referencing correct node IDs', () => {
    const links = [
      makeLink('a', ['javascript']),
      makeLink('b', ['javascript']),
    ]
    const result = buildGraphData(links, new Set())
    expect(result.links).toHaveLength(1)
    const edge = result.links[0]
    const ids = [edge.source, edge.target].sort()
    expect(ids).toEqual(['a', 'b'].sort())
  })

  it('leaves out stash links hidden from All Links, and their edges', () => {
    const links = [
      makeLink('saved', ['javascript']),
      { ...makeLink('kept', ['javascript']), source: 'stash' as const, stashState: 'kept' as const },
      { ...makeLink('inbox', ['javascript']), source: 'stash' as const, stashState: 'inbox' as const },
      { ...makeLink('read', ['javascript']), source: 'stash' as const, stashState: 'read' as const },
      { ...makeLink('archived', ['javascript']), source: 'stash' as const, stashState: 'archived' as const },
    ]
    const result = buildGraphData(links, new Set())
    expect(result.nodes.map((n) => n.id)).toEqual(['saved', 'kept'])
    expect(result.links).toHaveLength(1)
  })

  it('produces zero edges when no links share tags', () => {
    const links = [
      makeLink('a', ['javascript']),
      makeLink('b', ['python']),
      makeLink('c', ['rust']),
    ]
    const result = buildGraphData(links, new Set())
    expect(result.nodes).toHaveLength(3)
    expect(result.links).toHaveLength(0)
  })

  it('correctly counts sharedTagCount for 3 links sharing 1 tag', () => {
    const links = [
      makeLink('a', ['javascript', 'react']),
      makeLink('b', ['javascript', 'vue']),
      makeLink('c', ['javascript', 'angular']),
    ]
    const result = buildGraphData(links, new Set())
    // 3 links all share 'javascript', so we get 3 edges: a-b, a-c, b-c
    expect(result.links).toHaveLength(3)
    for (const edge of result.links) {
      expect(edge.sharedTagCount).toBe(1)
    }
  })

  it('excludes filtered-out categories and their edges', () => {
    const links = [
      makeLink('a', ['javascript'], 'Technology'),
      makeLink('b', ['javascript'], 'News'),
      makeLink('c', ['javascript'], 'Technology'),
    ]
    // Show only Technology — should exclude link 'b'
    const result = buildGraphData(links, new Set(['Technology']))
    expect(result.nodes).toHaveLength(2)
    const nodeIds = result.nodes.map((n) => n.id)
    expect(nodeIds).toContain('a')
    expect(nodeIds).toContain('c')
    expect(nodeIds).not.toContain('b')
    // Edge between a and c should exist (both share 'javascript' and both Tech)
    expect(result.links).toHaveLength(1)
  })

  it('returns all nodes when visibleCategories is empty (show all)', () => {
    const links = [
      makeLink('a', ['javascript'], 'Technology'),
      makeLink('b', ['javascript'], 'News'),
      makeLink('c', ['python'], 'Education'),
    ]
    const result = buildGraphData(links, new Set())
    expect(result.nodes).toHaveLength(3)
  })

  it('handles links with no tags (no edges created for tagless links)', () => {
    const links = [makeLink('a', []), makeLink('b', [])]
    const result = buildGraphData(links, new Set())
    expect(result.nodes).toHaveLength(2)
    expect(result.links).toHaveLength(0)
  })
})

describe('crossLinkNodes', () => {
  it('resolves string source/target IDs to actual GraphNode objects in neighbors', () => {
    const links = [
      makeLink('a', ['javascript']),
      makeLink('b', ['javascript']),
    ]
    const data = buildGraphData(links, new Set())
    // Before d3 runs: source/target are still string IDs
    expect(typeof data.links[0].source).toBe('string')
    expect(typeof data.links[0].target).toBe('string')

    crossLinkNodes(data)

    const nodeA = data.nodes.find((n) => n.id === 'a')!
    const nodeB = data.nodes.find((n) => n.id === 'b')!

    // neighbors should be actual GraphNode objects, not strings
    expect(nodeA.neighbors).toBeDefined()
    expect(nodeA.neighbors!.length).toBe(1)
    expect(typeof nodeA.neighbors![0]).toBe('object')
    expect(nodeA.neighbors![0].id).toBe('b')

    expect(nodeB.neighbors).toBeDefined()
    expect(nodeB.neighbors!.length).toBe(1)
    expect(typeof nodeB.neighbors![0]).toBe('object')
    expect(nodeB.neighbors![0].id).toBe('a')
  })

  it('populates connectedLinks on each node', () => {
    const links = [
      makeLink('a', ['javascript']),
      makeLink('b', ['javascript']),
    ]
    const data = buildGraphData(links, new Set())
    crossLinkNodes(data)

    const nodeA = data.nodes.find((n) => n.id === 'a')!
    const nodeB = data.nodes.find((n) => n.id === 'b')!

    expect(nodeA.connectedLinks).toBeDefined()
    expect(nodeA.connectedLinks!.length).toBe(1)
    expect(nodeB.connectedLinks).toBeDefined()
    expect(nodeB.connectedLinks!.length).toBe(1)
  })

  it('is safe to call BEFORE d3 initialization (string IDs only)', () => {
    const links = [
      makeLink('x', ['tag1']),
      makeLink('y', ['tag1']),
      makeLink('z', ['tag1', 'tag2']),
    ]
    const data = buildGraphData(links, new Set())
    // Ensure all sources/targets are strings before calling crossLinkNodes
    for (const link of data.links) {
      expect(typeof link.source).toBe('string')
      expect(typeof link.target).toBe('string')
    }
    // Should not throw
    expect(() => crossLinkNodes(data)).not.toThrow()
    // Each node should have neighbors
    for (const node of data.nodes) {
      expect(node.neighbors).toBeDefined()
      expect(Array.isArray(node.neighbors)).toBe(true)
    }
  })

  it('handles nodes with no connections gracefully', () => {
    const links = [makeLink('a', ['tag1']), makeLink('b', ['tag2'])]
    const data = buildGraphData(links, new Set())
    crossLinkNodes(data)

    for (const node of data.nodes) {
      expect(node.neighbors).toBeDefined()
      expect(node.neighbors!.length).toBe(0)
      expect(node.connectedLinks).toBeDefined()
      expect(node.connectedLinks!.length).toBe(0)
    }
  })
})

describe('Performance', () => {
  it('buildGraphData with 5000 nodes completes in under 500ms', () => {
    const tagPool = Array.from({ length: 50 }, (_, i) => `tag-${i}`)

    const largeLinks: LinkWithTags[] = Array.from({ length: 5000 }, (_, i) => {
      // each link gets 3-4 random tags from the pool
      const count = 3 + (i % 2) // alternates between 3 and 4
      const tags: string[] = []
      for (let j = 0; j < count; j++) {
        tags.push(tagPool[(i * 7 + j * 13) % tagPool.length])
      }
      // deduplicate
      const uniqueTags = [...new Set(tags)]
      return makeLink(`link-${i}`, uniqueTags, CATEGORIES[i % CATEGORIES.length])
    })

    // Take the fastest of several runs: load from other test workers only
    // adds time, so the minimum tracks the code's own cost (about 60ms
    // alone), while a real slowdown still raises every run.
    let elapsed = Infinity
    for (let run = 0; run < 5; run++) {
      const start = performance.now()
      buildGraphData(largeLinks, new Set())
      elapsed = Math.min(elapsed, performance.now() - start)
    }

    expect(elapsed).toBeLessThan(500)
  })
})

describe('hover fade helpers', () => {
  it('clamp01 bounds values to 0..1', () => {
    expect(clamp01(-0.5)).toBe(0)
    expect(clamp01(0.4)).toBe(0.4)
    expect(clamp01(2)).toBe(1)
  })

  it('lerp interpolates between two values', () => {
    expect(lerp(10, 20, 0)).toBe(10)
    expect(lerp(10, 20, 0.5)).toBe(15)
    expect(lerp(10, 20, 1)).toBe(20)
  })

  it('easeInOutCubic hits endpoints and midpoint and is monotonic', () => {
    expect(easeInOutCubic(0)).toBe(0)
    expect(easeInOutCubic(1)).toBe(1)
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5)
    expect(easeInOutCubic(0.25)).toBeLessThan(0.25)
    expect(easeInOutCubic(0.75)).toBeGreaterThan(0.75)
    expect(easeInOutCubic(-1)).toBe(0)
    expect(easeInOutCubic(2)).toBe(1)
  })

  it('stepDim moves toward the target at 1/duration per ms without overshoot', () => {
    expect(stepDim(0, 1, 100, 200)).toBeCloseTo(0.5)
    expect(stepDim(1, 0, 100, 200)).toBeCloseTo(0.5)
    expect(stepDim(0.9, 1, 100, 200)).toBe(1)
    expect(stepDim(0.1, 0, 100, 200)).toBe(0)
    expect(stepDim(0.3, 0.3, 100, 200)).toBe(0.3)
  })

  it('stepDim jumps straight to target when duration is zero', () => {
    expect(stepDim(0, 1, 16, 0)).toBe(1)
  })

  it('dimmed node alpha, link alpha and link width interpolate from dim factor', () => {
    expect(nodeAlpha(0)).toBe(1)
    expect(nodeAlpha(1)).toBeCloseTo(DIMMED_NODE_ALPHA)
    expect(linkAlpha(0)).toBeCloseTo(HIGHLIGHT_LINK_ALPHA)
    expect(linkAlpha(1)).toBeCloseTo(DIMMED_LINK_ALPHA)
    expect(dimmedLinkWidth(3, 0)).toBe(3)
    expect(dimmedLinkWidth(3, 1)).toBeCloseTo(DIMMED_LINK_WIDTH)
    expect(dimmedLinkWidth(3, 0.5)).toBeCloseTo((3 + DIMMED_LINK_WIDTH) / 2)
  })

  it('withAlpha appends a two-digit hex alpha to a 6-digit hex color', () => {
    expect(withAlpha('#3b82f6', 1)).toBe('#3b82f6ff')
    expect(withAlpha('#3b82f6', 0)).toBe('#3b82f600')
    expect(withAlpha('#3b82f6', 0.2667)).toBe('#3b82f644')
  })
})

describe('countCategories', () => {
  it('counts links per category and skips uncategorized ones', () => {
    const counts = countCategories([
      makeLink('a', [], 'Technology'),
      makeLink('b', [], 'Technology'),
      makeLink('c', [], 'Entertainment'),
      makeLink('d', [], null),
    ])
    expect(Object.fromEntries(counts)).toEqual({ Technology: 2, Entertainment: 1 })
  })

  it('leaves out links All Links does not show', () => {
    const stashed = { ...makeLink('s', [], 'News'), stashState: 'inbox' } as LinkWithTags
    expect(countCategories([stashed]).has('News')).toBe(false)
  })
})
