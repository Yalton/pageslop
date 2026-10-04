import { describe, it, expect } from 'vitest'
import { groupByDomain } from '@/lib/utils/group-links'
import type { LinkWithTags } from '@/types'

const makeLink = (
  id: string,
  url: string,
  domain: string | null,
  stashedAt: Date | null = null
): LinkWithTags => ({
  id,
  userId: 'u1',
  url,
  title: `Link ${id}`,
  description: null,
  ogImage: null,
  favicon: null,
  domain,
  status: 'ready',
  category: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  enrichmentSource: null,
  enrichmentError: null,
  uptimeStatus: 'unchecked',
  lastStatusCode: null,
  lastCheckedAt: null,
  consecutiveFailures: 0,
  source: 'stash',
  stashState: 'inbox',
  stashedAt,
  tags: [],
})

describe('groupByDomain', () => {
  it('returns an empty Map for empty input', () => {
    expect(groupByDomain([]).size).toBe(0)
  })

  it('groups links by their domain field', () => {
    const result = groupByDomain([
      makeLink('1', 'https://a.com/1', 'a.com'),
      makeLink('2', 'https://b.com/2', 'b.com'),
      makeLink('3', 'https://a.com/3', 'a.com'),
    ])
    expect(result.get('a.com')?.map((l) => l.id).sort()).toEqual(['1', '3'])
    expect(result.get('b.com')?.map((l) => l.id)).toEqual(['2'])
  })

  it('falls back to the URL hostname without www. when domain is null', () => {
    const result = groupByDomain([
      makeLink('1', 'https://www.example.com/x', null),
      makeLink('2', 'https://example.com/y', 'example.com'),
      makeLink('3', 'https://docs.rs/z', null),
    ])
    expect(result.get('example.com')?.map((l) => l.id).sort()).toEqual(['1', '2'])
    expect(result.get('docs.rs')?.map((l) => l.id)).toEqual(['3'])
  })

  it('puts unparseable URLs with a null domain under "other"', () => {
    const result = groupByDomain([makeLink('1', 'not a url', null)])
    expect([...result.keys()]).toEqual(['other'])
  })

  it('orders groups by size descending, then by domain name', () => {
    const result = groupByDomain([
      makeLink('1', 'https://zeta.com/1', 'zeta.com'),
      makeLink('2', 'https://beta.com/2', 'beta.com'),
      makeLink('3', 'https://alpha.com/3', 'alpha.com'),
      makeLink('4', 'https://zeta.com/4', 'zeta.com'),
      makeLink('5', 'https://zeta.com/5', 'zeta.com'),
      makeLink('6', 'https://beta.com/6', 'beta.com'),
    ])
    expect([...result.keys()]).toEqual(['zeta.com', 'beta.com', 'alpha.com'])
  })

  it('orders links within a group by stashedAt descending, nulls last', () => {
    const result = groupByDomain([
      makeLink('old', 'https://a.com/old', 'a.com', new Date('2026-09-01T00:00:00Z')),
      makeLink('none', 'https://a.com/none', 'a.com', null),
      makeLink('new', 'https://a.com/new', 'a.com', new Date('2026-10-01T00:00:00Z')),
      makeLink('mid', 'https://a.com/mid', 'a.com', new Date('2026-09-15T00:00:00Z')),
    ])
    expect(result.get('a.com')?.map((l) => l.id)).toEqual(['new', 'mid', 'old', 'none'])
  })

  it('does not mutate the input array', () => {
    const input = [
      makeLink('1', 'https://a.com/1', 'a.com', new Date('2026-09-01T00:00:00Z')),
      makeLink('2', 'https://a.com/2', 'a.com', new Date('2026-10-01T00:00:00Z')),
    ]
    groupByDomain(input)
    expect(input.map((l) => l.id)).toEqual(['1', '2'])
  })
})
