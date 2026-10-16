import { describe, it, expect } from 'vitest'
import { DEFAULT_LINK_VIEW } from '@/lib/utils/link-view'
import { VIEW_ENTER_MS, shouldAnimateView, viewTransitionKey } from '@/lib/utils/view-transition'

describe('viewTransitionKey', () => {
  it('is stable across field order', () => {
    expect(viewTransitionKey({ a: '1', b: 'x' })).toBe(viewTransitionKey({ b: 'x', a: '1' }))
  })

  it('treats null, undefined, false and empty as off', () => {
    expect(viewTransitionKey({ sort: 'newest', domain: null, untagged: false, tag: undefined, category: '' })).toBe(
      viewTransitionKey({ sort: 'newest' }),
    )
  })

  it('changes when any view field changes', () => {
    const base = { ...DEFAULT_LINK_VIEW, tag: null, mode: 'grid' }
    const key = viewTransitionKey(base)
    expect(viewTransitionKey({ ...base, sort: 'title' })).not.toBe(key)
    expect(viewTransitionKey({ ...base, domain: 'github.com' })).not.toBe(key)
    expect(viewTransitionKey({ ...base, category: 'Docs' })).not.toBe(key)
    expect(viewTransitionKey({ ...base, untagged: true })).not.toBe(key)
    expect(viewTransitionKey({ ...base, described: true })).not.toBe(key)
    expect(viewTransitionKey({ ...base, tag: 'rust' })).not.toBe(key)
    expect(viewTransitionKey({ ...base, mode: 'list' })).not.toBe(key)
  })

  it('picks up fields it was not written for', () => {
    expect(viewTransitionKey({ sort: 'newest', status: 'dead' })).not.toBe(viewTransitionKey({ sort: 'newest' }))
  })

  it('does not collide when values move between fields', () => {
    expect(viewTransitionKey({ domain: 'a', category: null })).not.toBe(viewTransitionKey({ domain: null, category: 'a' }))
  })
})

describe('shouldAnimateView', () => {
  it('skips the first render', () => {
    expect(shouldAnimateView(null, 'sort=newest', false)).toBe(false)
  })

  it('skips when the key is unchanged (data-only updates)', () => {
    expect(shouldAnimateView('sort=newest', 'sort=newest', false)).toBe(false)
  })

  it('animates on a view change', () => {
    expect(shouldAnimateView('sort=newest', 'sort=title', false)).toBe(true)
  })

  it('never animates with reduced motion', () => {
    expect(shouldAnimateView('sort=newest', 'sort=title', true)).toBe(false)
  })
})

describe('VIEW_ENTER_MS', () => {
  it('stays in the 150-250ms range', () => {
    expect(VIEW_ENTER_MS).toBeGreaterThanOrEqual(150)
    expect(VIEW_ENTER_MS).toBeLessThanOrEqual(250)
  })
})
