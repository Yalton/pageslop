import { describe, it, expect } from 'vitest'
import { LINK_DEFAULTS } from '../fixtures/link-defaults'
import {
  applyLinkView,
  categoryOptions,
  domainOptions,
  hasActiveLinkFilters,
  linkViewQuery,
  parseLinkView,
  sortLinks,
  DEFAULT_LINK_VIEW,
} from '@/lib/utils/link-view'
import type { LinkWithTags } from '@/types'

const tag = (name: string) => ({ id: name, userId: 'u1', name, source: 'user' as const })

const makeLink = (id: string, over: Partial<LinkWithTags> = {}): LinkWithTags => ({
  id,
  userId: 'u1',
  url: `https://example.com/${id}`,
  title: `Link ${id}`,
  description: null,
  ogImage: null,
  favicon: null,
  domain: 'example.com',
  status: 'ready',
  category: null,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
  ...LINK_DEFAULTS,
  tags: [],
  ...over,
})

const ids = (links: LinkWithTags[]) => links.map((l) => l.id)

describe('parseLinkView', () => {
  it('returns defaults for an empty query', () => {
    expect(parseLinkView(new URLSearchParams())).toEqual(DEFAULT_LINK_VIEW)
  })

  it('reads sort and filters from the query', () => {
    const view = parseLinkView(
      new URLSearchParams('sort=title&domain=github.com&category=Dev&untagged=1&described=1'),
    )
    expect(view).toEqual({
      sort: 'title',
      domain: 'github.com',
      category: 'Dev',
      untagged: true,
      described: true,
    })
  })

  it('falls back to newest for an unknown sort', () => {
    expect(parseLinkView(new URLSearchParams('sort=bogus')).sort).toBe('newest')
  })
})

describe('linkViewQuery', () => {
  it('keeps unrelated params such as tag and drops defaults', () => {
    const current = new URLSearchParams('tag=rust&sort=title')
    expect(linkViewQuery(current, { sort: 'newest' })).toBe('tag=rust')
  })

  it('sets and clears values', () => {
    const current = new URLSearchParams('domain=a.com')
    expect(linkViewQuery(current, { domain: null, untagged: true, sort: 'oldest' })).toBe('untagged=1&sort=oldest')
  })

  it('sets a tag patch alongside view params', () => {
    const current = new URLSearchParams('sort=domain')
    expect(linkViewQuery(current, { tag: 'go' })).toBe('sort=domain&tag=go')
    expect(linkViewQuery(new URLSearchParams('sort=domain&tag=go'), { tag: null })).toBe('sort=domain')
  })
})

describe('sortLinks', () => {
  const a = makeLink('a', { title: 'banana', domain: 'zeta.com', createdAt: new Date('2024-01-03T00:00:00Z') })
  const b = makeLink('b', { title: 'Apple', domain: 'alpha.com', createdAt: new Date('2024-01-01T00:00:00Z') })
  const c = makeLink('c', { title: null, url: 'https://cherry.com/x', domain: 'mid.com', createdAt: new Date('2024-01-02T00:00:00Z') })

  it('sorts newest first', () => {
    expect(ids(sortLinks([b, c, a], 'newest'))).toEqual(['a', 'c', 'b'])
  })

  it('sorts oldest first', () => {
    expect(ids(sortLinks([a, c, b], 'oldest'))).toEqual(['b', 'c', 'a'])
  })

  it('sorts by title case-insensitively, falling back to the url', () => {
    expect(ids(sortLinks([a, c, b], 'title'))).toEqual(['b', 'a', 'c'])
  })

  it('sorts by domain then newest within a domain', () => {
    const d = makeLink('d', { domain: 'alpha.com', createdAt: new Date('2024-02-01T00:00:00Z') })
    expect(ids(sortLinks([a, b, c, d], 'domain'))).toEqual(['d', 'b', 'c', 'a'])
  })

  it('accepts ISO strings as dates, as SWR delivers them', () => {
    const x = makeLink('x', { createdAt: '2024-05-01T00:00:00Z' as unknown as Date })
    const y = makeLink('y', { createdAt: '2024-06-01T00:00:00Z' as unknown as Date })
    expect(ids(sortLinks([x, y], 'newest'))).toEqual(['y', 'x'])
  })

  it('orders links saved in the same instant the same way every time', () => {
    const same = new Date('2024-01-01T00:00:00Z')
    const p = makeLink('p', { createdAt: same, stashedAt: new Date('2024-01-01T00:00:03Z') })
    const q = makeLink('q', { createdAt: same, stashedAt: new Date('2024-01-01T00:00:01Z') })
    const r = makeLink('r', { createdAt: same, stashedAt: new Date('2024-01-01T00:00:02Z') })
    expect(ids(sortLinks([q, r, p], 'newest'))).toEqual(['p', 'r', 'q'])
    expect(ids(sortLinks([r, p, q], 'newest'))).toEqual(['p', 'r', 'q'])
    const s = makeLink('s', { createdAt: same })
    const t = makeLink('t', { createdAt: same })
    expect(ids(sortLinks([t, s], 'newest'))).toEqual(ids(sortLinks([s, t], 'newest')))
  })

  it('does not mutate the input', () => {
    const input = [b, a]
    sortLinks(input, 'newest')
    expect(ids(input)).toEqual(['b', 'a'])
  })
})

describe('applyLinkView', () => {
  const gh = makeLink('gh', { domain: 'github.com', category: 'Dev', description: 'code', tags: [tag('x')] })
  const yt = makeLink('yt', { domain: 'youtube.com', category: 'Video', description: '  ' })
  const nodomain = makeLink('nd', { domain: null, url: 'https://www.github.com/y', category: 'Dev' })

  it('filters by domain, using the url hostname when domain is missing', () => {
    expect(ids(applyLinkView([gh, yt, nodomain], { ...DEFAULT_LINK_VIEW, domain: 'github.com' }))).toEqual(['gh', 'nd'])
  })

  it('filters by category', () => {
    expect(ids(applyLinkView([gh, yt], { ...DEFAULT_LINK_VIEW, category: 'Video' }))).toEqual(['yt'])
  })

  it('filters untagged and described links', () => {
    expect(ids(applyLinkView([gh, yt, nodomain], { ...DEFAULT_LINK_VIEW, untagged: true }))).toEqual(['nd', 'yt'])
    expect(ids(applyLinkView([gh, yt, nodomain], { ...DEFAULT_LINK_VIEW, described: true }))).toEqual(['gh'])
  })
})

describe('options and active state', () => {
  const links = [
    makeLink('1', { domain: 'b.com', category: 'Dev' }),
    makeLink('2', { domain: 'a.com', category: 'Dev' }),
    makeLink('3', { domain: 'b.com', category: null }),
  ]

  it('lists domains by count then name', () => {
    expect(domainOptions(links)).toEqual([
      { value: 'b.com', count: 2 },
      { value: 'a.com', count: 1 },
    ])
  })

  it('lists categories alphabetically, skipping null', () => {
    expect(categoryOptions(links)).toEqual([{ value: 'Dev', count: 2 }])
  })

  it('reports whether any filter is active', () => {
    expect(hasActiveLinkFilters(DEFAULT_LINK_VIEW)).toBe(false)
    expect(hasActiveLinkFilters({ ...DEFAULT_LINK_VIEW, sort: 'title' })).toBe(false)
    expect(hasActiveLinkFilters({ ...DEFAULT_LINK_VIEW, untagged: true })).toBe(true)
  })
})
