import { describe, it, expect } from 'vitest'
import { filterAllLinksView, isArchived, isVisibleInAllLinks } from '@/lib/utils/all-links-filter'
import type { LinkWithTags, StashState } from '@/types'

function makeLink(id: string, stashState: StashState | null): LinkWithTags {
  return {
    id,
    userId: 'u1',
    url: `https://example.com/${id}`,
    title: id,
    description: null,
    ogImage: null,
    favicon: null,
    domain: 'example.com',
    status: 'ready',
    category: null,
    source: stashState ? 'stash' : 'manual',
    stashState,
    stashedAt: stashState ? new Date('2026-01-01T00:00:00Z') : null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    tags: [],
  } as unknown as LinkWithTags
}

describe('isVisibleInAllLinks', () => {
  it('hides inbox and read', () => {
    expect(isVisibleInAllLinks({ stashState: 'inbox' })).toBe(false)
    expect(isVisibleInAllLinks({ stashState: 'read' })).toBe(false)
  })

  it('shows kept, archived and non-stash links', () => {
    expect(isVisibleInAllLinks({ stashState: 'kept' })).toBe(true)
    expect(isVisibleInAllLinks({ stashState: 'archived' })).toBe(true)
    expect(isVisibleInAllLinks({ stashState: null })).toBe(true)
  })
})

describe('filterAllLinksView', () => {
  it('keeps order and drops inbox/read links', () => {
    const links = [
      makeLink('manual', null),
      makeLink('inbox', 'inbox'),
      makeLink('kept', 'kept'),
      makeLink('read', 'read'),
      makeLink('archived', 'archived'),
    ]
    expect(filterAllLinksView(links).map((l) => l.id)).toEqual(['manual', 'kept', 'archived'])
  })

  it('returns an empty array when everything is in the inbox', () => {
    expect(filterAllLinksView([makeLink('a', 'inbox')])).toEqual([])
  })
})

describe('isArchived', () => {
  it('is true only for archived', () => {
    expect(isArchived({ stashState: 'archived' })).toBe(true)
    expect(isArchived({ stashState: 'kept' })).toBe(false)
    expect(isArchived({ stashState: null })).toBe(false)
  })
})
