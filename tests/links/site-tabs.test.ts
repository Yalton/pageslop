import { describe, it, expect } from 'vitest'
import { LINK_DEFAULTS } from '../fixtures/link-defaults'
import { groupLinksBySite, siteFavicons, siteTabs, SITE_TAB_LIMIT } from '@/lib/utils/site-tabs'
import type { FacetOption } from '@/lib/utils/link-view'
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

const opt = (value: string, count: number): FacetOption => ({ value, count })
const values = (options: FacetOption[]) => options.map((o) => o.value)

describe('siteTabs', () => {
  const options = [opt('a.com', 9), opt('b.com', 5), opt('c.com', 3), opt('d.com', 1)]

  it('shows the first `limit` sites as tabs and the rest as overflow', () => {
    const { tabs, overflow } = siteTabs(options, null, 2)
    expect(values(tabs)).toEqual(['a.com', 'b.com'])
    expect(values(overflow)).toEqual(['c.com', 'd.com'])
  })

  it('has no overflow when every site fits', () => {
    const { tabs, overflow } = siteTabs(options, null, 10)
    expect(values(tabs)).toEqual(['a.com', 'b.com', 'c.com', 'd.com'])
    expect(overflow).toEqual([])
  })

  it('keeps a selected overflow site visible as the last tab', () => {
    const { tabs, overflow } = siteTabs(options, 'd.com', 2)
    expect(values(tabs)).toEqual(['a.com', 'd.com'])
    expect(values(overflow)).toEqual(['b.com', 'c.com'])
  })

  it('leaves the order alone when the selected site is already a tab', () => {
    const { tabs, overflow } = siteTabs(options, 'b.com', 2)
    expect(values(tabs)).toEqual(['a.com', 'b.com'])
    expect(values(overflow)).toEqual(['c.com', 'd.com'])
  })

  it('shows a selected site no link has with count 0', () => {
    const { tabs } = siteTabs(options, 'gone.com', 2)
    expect(tabs).toEqual([opt('a.com', 9), opt('gone.com', 0)])
  })

  it('handles a limit of 1 with an overflow selection', () => {
    const { tabs, overflow } = siteTabs(options, 'c.com', 1)
    expect(values(tabs)).toEqual(['c.com'])
    expect(values(overflow)).toEqual(['a.com', 'b.com', 'd.com'])
  })

  it('returns nothing for no sites', () => {
    expect(siteTabs([], null)).toEqual({ tabs: [], overflow: [] })
  })

  it('defaults to SITE_TAB_LIMIT tabs', () => {
    const many = Array.from({ length: SITE_TAB_LIMIT + 3 }, (_, i) => opt(`s${i}.com`, 100 - i))
    const { tabs, overflow } = siteTabs(many, null)
    expect(tabs).toHaveLength(SITE_TAB_LIMIT)
    expect(overflow).toHaveLength(3)
  })
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
