import { describe, it, expect } from 'vitest'
import { LINK_DEFAULTS } from '../fixtures/link-defaults'
import {
  activeFilterChips,
  activeFilterCount,
  applyLinkView,
  categoryOptions,
  domainOptions,
  hasActiveLinkFilters,
  linkViewQuery,
  parseLinkView,
  sortLinks,
  emptyFilterMessage,
  facetFromSelect,
  facetItems,
  facetToSelect,
  linkViewHref,
  ANY_FACET,
  CLEAR_ALL_FILTERS,
  CLEAR_FACETS,
  DEFAULT_LINK_VIEW,
  statusOptions,
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
      status: null,
    })
  })

  it('reads and validates status', () => {
    expect(parseLinkView(new URLSearchParams('status=down')).status).toBe('down')
    expect(parseLinkView(new URLSearchParams('status=up')).status).toBe('up')
    expect(parseLinkView(new URLSearchParams('status=unchecked')).status).toBe('unchecked')
    expect(parseLinkView(new URLSearchParams('status=bogus')).status).toBeNull()
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
    // id descending, matching the server's ORDER BY created_at DESC, id DESC
    expect(ids(sortLinks([s, t], 'newest'))).toEqual(['t', 's'])
    expect(ids(sortLinks([t, s], 'newest'))).toEqual(['t', 's'])
    expect(ids(sortLinks([t, s], 'oldest'))).toEqual(['s', 't'])
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
    expect(ids(applyLinkView([gh, yt, nodomain], { ...DEFAULT_LINK_VIEW, domain: 'github.com' }))).toEqual(['nd', 'gh'])
  })

  it('filters by category', () => {
    expect(ids(applyLinkView([gh, yt], { ...DEFAULT_LINK_VIEW, category: 'Video' }))).toEqual(['yt'])
  })

  it('filters untagged and described links', () => {
    expect(ids(applyLinkView([gh, yt, nodomain], { ...DEFAULT_LINK_VIEW, untagged: true }))).toEqual(['yt', 'nd'])
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

describe('linkViewHref', () => {
  it('returns the bare path when no params remain', () => {
    expect(linkViewHref('/dashboard', new URLSearchParams('tag=go'), { tag: null })).toBe('/dashboard')
  })

  it('keeps other params when a tag is set', () => {
    expect(linkViewHref('/dashboard/archived', new URLSearchParams('sort=title&domain=a.com'), { tag: 'go' })).toBe(
      '/dashboard/archived?sort=title&domain=a.com&tag=go',
    )
  })

  it('clears facets but keeps sort and tag with CLEAR_FACETS', () => {
    const current = new URLSearchParams('sort=oldest&tag=go&domain=a.com&category=Dev&untagged=1&described=1')
    expect(linkViewHref('/dashboard', current, CLEAR_FACETS)).toBe('/dashboard?sort=oldest&tag=go')
  })

  it('clears facets and tag but keeps sort with CLEAR_ALL_FILTERS', () => {
    const current = new URLSearchParams('sort=oldest&tag=go&domain=a.com&untagged=1')
    expect(linkViewHref('/dashboard', current, CLEAR_ALL_FILTERS)).toBe('/dashboard?sort=oldest')
  })
})

describe('activeFilterCount', () => {
  it('is 0 for the default view, ignoring sort', () => {
    expect(activeFilterCount({ ...DEFAULT_LINK_VIEW, sort: 'title' })).toBe(0)
  })
  it('counts each active filter once', () => {
    expect(activeFilterCount({ ...DEFAULT_LINK_VIEW, domain: 'a.com', untagged: true, status: 'down' })).toBe(3)
  })
})

describe('emptyFilterMessage', () => {
  it('is null when nothing filters', () => {
    expect(emptyFilterMessage('  ', null, { ...DEFAULT_LINK_VIEW, sort: 'title' })).toBeNull()
  })

  it('names search, tag and every active facet', () => {
    const view = { sort: 'newest' as const, domain: 'github.com', category: 'Dev', untagged: true, described: true, status: 'down' as const }
    expect(emptyFilterMessage(' rust ', 'go', view)).toBe(
      'No links matching "rust", tagged "go", from github.com, in Dev, without tags, with a description, that are dead',
    )
  })

  it('mentions facets when only facets are active', () => {
    expect(emptyFilterMessage('', null, { ...DEFAULT_LINK_VIEW, domain: 'a.com' })).toBe('No links from a.com')
  })
})

describe('facet select helpers', () => {
  it('maps null to the any value and back', () => {
    expect(facetToSelect(null)).toBe(ANY_FACET)
    expect(facetToSelect('a.com')).toBe('a.com')
    expect(facetFromSelect(ANY_FACET)).toBeNull()
    expect(facetFromSelect('a.com')).toBe('a.com')
  })

  it('adds a selected value missing from the options first, with count 0', () => {
    const options = [{ value: 'b.com', count: 2 }]
    expect(facetItems(options, 'gone.com')).toEqual([{ value: 'gone.com', count: 0 }, ...options])
  })

  it('leaves options alone when the selection is present or empty', () => {
    const options = [{ value: 'b.com', count: 2 }]
    expect(facetItems(options, 'b.com')).toBe(options)
    expect(facetItems(options, null)).toBe(options)
  })
})

describe('status filter', () => {
  const up = makeLink('u', { uptimeStatus: 'up' })
  const down1 = makeLink('d1', { uptimeStatus: 'down' })
  const down2 = makeLink('d2', { uptimeStatus: 'down', domain: 'other.com' })
  const unchecked = makeLink('n', { uptimeStatus: 'unchecked' })
  const all = [up, down1, down2, unchecked]

  it('filters to dead, up or unchecked links', () => {
    const ids = (status: 'down' | 'up' | 'unchecked') =>
      applyLinkView(all, { ...DEFAULT_LINK_VIEW, status }).map((l) => l.id).sort()
    expect(ids('down')).toEqual(['d1', 'd2'])
    expect(ids('up')).toEqual(['u'])
    expect(ids('unchecked')).toEqual(['n'])
  })

  it('combines with other filters', () => {
    const out = applyLinkView(all, { ...DEFAULT_LINK_VIEW, status: 'down', domain: 'other.com' })
    expect(out.map((l) => l.id)).toEqual(['d2'])
  })

  it('counts statuses, always listing dead first', () => {
    expect(statusOptions(all)).toEqual([
      { value: 'down', count: 2 },
      { value: 'up', count: 1 },
      { value: 'unchecked', count: 1 },
    ])
    expect(statusOptions([up])).toEqual([
      { value: 'down', count: 0 },
      { value: 'up', count: 1 },
      { value: 'unchecked', count: 0 },
    ])
  })

  it('is an active filter, round-trips the query and is cleared by clear-all', () => {
    expect(hasActiveLinkFilters({ ...DEFAULT_LINK_VIEW, status: 'down' })).toBe(true)
    const q = linkViewQuery(new URLSearchParams(), { status: 'down' })
    expect(q).toBe('status=down')
    expect(linkViewQuery(new URLSearchParams(q), CLEAR_FACETS)).toBe('')
    expect(linkViewQuery(new URLSearchParams(q), CLEAR_ALL_FILTERS)).toBe('')
  })

  it('names the status in the empty message', () => {
    expect(emptyFilterMessage('', null, { ...DEFAULT_LINK_VIEW, status: 'down' })).toBe('No links that are dead')
    expect(emptyFilterMessage('', null, { ...DEFAULT_LINK_VIEW, status: 'unchecked' })).toBe('No links that are unchecked')
  })
})

describe('activeFilterChips', () => {
  it('is empty when nothing filters', () => {
    expect(activeFilterChips({ ...DEFAULT_LINK_VIEW, sort: 'title' }, null)).toEqual([])
  })

  it('lists one chip per active filter, tag first', () => {
    const view = { ...DEFAULT_LINK_VIEW, domain: 'github.com', category: 'Technology', status: 'down' as const, untagged: true, described: true }
    expect(activeFilterChips(view, 'rust').map((c) => [c.label, c.value])).toEqual([
      ['Tag', 'rust'],
      ['Website', 'github.com'],
      ['Category', 'Technology'],
      ['Status', 'Dead'],
      [null, 'Untagged'],
      [null, 'Has description'],
    ])
  })

  it('removes only its own filter from the URL', () => {
    const current = new URLSearchParams('tag=rust&domain=github.com&status=down&sort=title')
    const [tag, domain, status] = activeFilterChips(parseLinkView(current), current.get('tag'))
    expect(linkViewQuery(current, tag.remove)).toBe('domain=github.com&status=down&sort=title')
    expect(linkViewQuery(current, domain.remove)).toBe('tag=rust&status=down&sort=title')
    expect(linkViewQuery(current, status.remove)).toBe('tag=rust&domain=github.com&sort=title')
  })
})
