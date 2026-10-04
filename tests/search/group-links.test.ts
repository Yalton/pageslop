import { describe, it, expect } from 'vitest'
import { LINK_DEFAULTS } from '../fixtures/link-defaults'
import { groupLinks } from '@/lib/utils/group-links'
import type { LinkWithTags } from '@/types'

// Reuse similar fixtures focused on categories
const makeLink = (
  id: string,
  category: string | null,
  tags: { id: string; userId: string; name: string; source: 'user' | 'rule' | 'llm' }[] = []
): LinkWithTags => ({
  id,
  userId: 'u1',
  url: `https://example.com/${id}`,
  title: `Link ${id}`,
  description: null,
  ogImage: null,
  favicon: null,
  domain: 'example.com',
  status: 'ready',
  category,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  ...LINK_DEFAULTS,
  tags,
})

describe('groupLinks', () => {
  it('groups links by category field', () => {
    const links = [
      makeLink('1', 'Technology'),
      makeLink('2', 'Technology'),
      makeLink('3', 'News'),
    ]
    const result = groupLinks(links)
    expect(result.get('Technology')).toHaveLength(2)
    expect(result.get('News')).toHaveLength(1)
  })

  it('links with null category go into "Uncategorized" group', () => {
    const links = [makeLink('1', null), makeLink('2', 'Technology')]
    const result = groupLinks(links)
    expect(result.has('Uncategorized')).toBe(true)
    expect(result.get('Uncategorized')).toHaveLength(1)
    expect(result.get('Uncategorized')![0].id).toBe('1')
  })

  it('returns Map with category keys sorted alphabetically, "Uncategorized" last', () => {
    const links = [
      makeLink('1', null),
      makeLink('2', 'Technology'),
      makeLink('3', 'News'),
      makeLink('4', 'Education'),
    ]
    const result = groupLinks(links)
    const keys = [...result.keys()]
    // Alphabetical order for named categories, Uncategorized at the end
    expect(keys[keys.length - 1]).toBe('Uncategorized')
    const namedKeys = keys.slice(0, -1)
    expect(namedKeys).toEqual([...namedKeys].sort())
  })

  it('empty input returns empty Map', () => {
    const result = groupLinks([])
    expect(result.size).toBe(0)
  })

  it('categories with zero links after filtering are excluded (only non-empty groups returned)', () => {
    // This test verifies that groupLinks only includes categories that have links in the input
    const links = [makeLink('1', 'Technology')]
    const result = groupLinks(links)
    expect(result.size).toBe(1)
    expect(result.has('Technology')).toBe(true)
    expect(result.has('News')).toBe(false)
  })
})
