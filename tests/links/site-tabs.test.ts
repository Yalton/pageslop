import { describe, it, expect } from 'vitest'
import { LINK_DEFAULTS } from '../fixtures/link-defaults'
import { groupLinksBySite, siteFavicons } from '@/lib/utils/site-tabs'
import type { LinkWithTags } from '@/types'

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

describe('siteFavicons', () => {
  it('maps each site to the first favicon one of its links has', () => {
    const map = siteFavicons([
      makeLink('1', { domain: 'a.com', favicon: null }),
      makeLink('2', { domain: 'a.com', favicon: 'https://a.com/f.ico' }),
      makeLink('3', { domain: 'a.com', favicon: 'https://a.com/other.ico' }),
      makeLink('4', { domain: 'b.com', favicon: null }),
    ])
    expect(map.get('a.com')).toBe('https://a.com/f.ico')
    expect(map.has('b.com')).toBe(false)
  })

  it('uses the URL hostname when domain is missing', () => {
    const map = siteFavicons([makeLink('1', { domain: null, url: 'https://www.x.org/p', favicon: 'f' })])
    expect(map.get('x.org')).toBe('f')
  })
})

describe('groupLinksBySite', () => {
  const links = [
    makeLink('1', { domain: 'b.com' }),
    makeLink('2', { domain: 'a.com' }),
    makeLink('3', { domain: 'b.com' }),
    makeLink('4', { domain: 'c.com' }),
    makeLink('5', { domain: 'a.com' }),
    makeLink('6', { domain: 'b.com' }),
  ]
  const shape = (groups: Map<string, LinkWithTags[]>) =>
    [...groups].map(([site, items]) => [site, items.map((l) => l.id)])

  it('orders sites by link count, then name, and keeps the given link order inside each', () => {
    expect(shape(groupLinksBySite(links, 'newest'))).toEqual([
      ['b.com', ['1', '3', '6']],
      ['a.com', ['2', '5']],
      ['c.com', ['4']],
    ])
  })

  it('orders sites A–Z when sorting by website', () => {
    expect(shape(groupLinksBySite(links, 'domain'))).toEqual([
      ['a.com', ['2', '5']],
      ['b.com', ['1', '3', '6']],
      ['c.com', ['4']],
    ])
  })

  it('returns an empty map for no links', () => {
    expect(groupLinksBySite([], 'newest').size).toBe(0)
  })
})
