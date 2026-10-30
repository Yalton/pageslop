// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'

const state = vi.hoisted(() => ({
  isLoading: true,
  graphProps: null as { width: number; height: number } | null,
  observed: [] as { el: Element; cb: ResizeObserverCallback }[],
}))

vi.mock('@/lib/hooks/useLinks', () => ({
  useLinks: () => ({
    links: state.isLoading
      ? []
      : [{ id: 'l1', url: 'https://example.com', title: 'Example', domain: 'example.com', category: 'Technology', tags: [] }],
    isLoading: state.isLoading,
    deleteLink: vi.fn(),
    undoDelete: vi.fn(),
    mutate: vi.fn(),
  }),
}))

vi.mock('react-force-graph-2d', () => ({
  default: (props: { width: number; height: number }) => {
    state.graphProps = { width: props.width, height: props.height }
    return null
  },
}))

vi.mock('@/components/links/LinkDetail', () => ({ LinkDetail: () => null }))
vi.mock('@/components/graph/GraphControls', () => ({ GraphControls: () => null }))

class FakeResizeObserver {
  constructor(private cb: ResizeObserverCallback) {}
  observe(el: Element) {
    state.observed.push({ el, cb: this.cb })
  }
  disconnect() {}
  unobserve() {}
}
vi.stubGlobal('ResizeObserver', FakeResizeObserver)

afterEach(cleanup)

describe('ForceGraph sizing', () => {
  it('sizes the canvas to its container once loading finishes', async () => {
    const { default: ForceGraph } = await import('@/components/graph/ForceGraph')
    const { rerender } = render(<ForceGraph />)
    expect(state.observed).toHaveLength(0)

    state.isLoading = false
    rerender(<ForceGraph />)
    expect(state.observed).toHaveLength(1)

    const { el, cb } = state.observed[0]
    act(() => {
      cb([{ target: el, contentRect: { width: 1200, height: 852 } } as unknown as ResizeObserverEntry], {} as ResizeObserver)
    })
    expect(state.graphProps).toEqual({ width: 1200, height: 852 })
  })
})
