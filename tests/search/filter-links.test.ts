import { describe, it, expect } from 'vitest'
import { LINK_DEFAULTS } from '../fixtures/link-defaults'
import { filterLinks } from '@/lib/utils/search'
import type { LinkWithTags } from '@/types'

// Test fixture: 5 links with varying titles, descriptions, domains, tags, and categories
const fixtures: LinkWithTags[] = [
  {
    id: '1',
    userId: 'u1',
    url: 'https://github.com/vercel/next.js',
    title: 'React Tutorial',
    description: 'A complete guide to React',
    ogImage: null,
    favicon: null,
    domain: 'github.com',
    status: 'ready',
    category: 'Technology',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...LINK_DEFAULTS,
    tags: [{ id: 't1', userId: 'u1', name: 'javascript', source: 'llm' }],
  },
  {
    id: '2',
    userId: 'u1',
    url: 'https://dev.to/article/typescript-tips',
    title: 'TypeScript Tips',
    description: 'TypeScript best practices',
    ogImage: null,
    favicon: null,
    domain: 'dev.to',
    status: 'ready',
    category: 'Technology',
    createdAt: new Date('2024-01-02'),
    updatedAt: new Date('2024-01-02'),
    ...LINK_DEFAULTS,
    tags: [
      { id: 't2', userId: 'u1', name: 'typescript', source: 'llm' },
      { id: 't3', userId: 'u1', name: 'React', source: 'user' },
    ],
  },
  {
    id: '3',
    userId: 'u1',
    url: 'https://news.ycombinator.com',
    title: 'Hacker News',
    description: 'Tech news aggregator',
    ogImage: null,
    favicon: null,
    domain: 'news.ycombinator.com',
    status: 'ready',
    category: 'News',
    createdAt: new Date('2024-01-03'),
    updatedAt: new Date('2024-01-03'),
    ...LINK_DEFAULTS,
    tags: [],
  },
  {
    id: '4',
    userId: 'u1',
    url: 'https://example.com/shop',
    title: 'Shopping Site',
    description: 'Buy things online',
    ogImage: null,
    favicon: null,
    domain: 'example.com',
    status: 'ready',
    category: 'Shopping',
    createdAt: new Date('2024-01-04'),
    updatedAt: new Date('2024-01-04'),
    ...LINK_DEFAULTS,
    tags: [{ id: 't4', userId: 'u1', name: 'reactive', source: 'llm' }],
  },
  {
    id: '5',
    userId: 'u1',
    url: 'https://docs.example.org/reference',
    title: null,
    description: null,
    ogImage: null,
    favicon: null,
    domain: 'docs.example.org',
    status: 'ready',
    category: null,
    createdAt: new Date('2024-01-05'),
    updatedAt: new Date('2024-01-05'),
    ...LINK_DEFAULTS,
    tags: [],
  },
]

describe('filterLinks', () => {
  it('returns all links when query is empty and tagFilter is null', () => {
    const result = filterLinks(fixtures, '', null)
    expect(result).toHaveLength(5)
  })

  it('filters by title substring (case-insensitive): "react" matches "React Tutorial"', () => {
    const result = filterLinks(fixtures, 'react', null)
    // Should match id:1 (title "React Tutorial") and id:2 (tag "React")
    const ids = result.map((l) => l.id)
    expect(ids).toContain('1')
  })

  it('filters by description substring: "guide" matches link with description "A complete guide..."', () => {
    const result = filterLinks(fixtures, 'guide', null)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('1')
  })

  it('filters by URL substring: "github" matches "https://github.com/..."', () => {
    const result = filterLinks(fixtures, 'github', null)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('1')
  })

  it('filters by domain substring: "dev.to" matches link with domain "dev.to"', () => {
    const result = filterLinks(fixtures, 'dev.to', null)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('2')
  })

  it('filters by tag name substring: "java" matches link tagged "javascript"', () => {
    const result = filterLinks(fixtures, 'java', null)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('1')
  })

  it('returns empty array when no matches', () => {
    const result = filterLinks(fixtures, 'zzznomatch', null)
    expect(result).toHaveLength(0)
  })

  it('tag filter: exact match (case-insensitive) — "react" matches tag "React" but not "reactive"', () => {
    const result = filterLinks(fixtures, '', 'react')
    // Link 2 has tag "React" (exact match), Link 4 has tag "reactive" (should NOT match)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('2')
  })

  it('combined: tag filter AND search query both apply (intersection)', () => {
    // Tag "typescript" is only on link 2, and searching "tips" also matches link 2
    const result = filterLinks(fixtures, 'tips', 'typescript')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('2')
  })

  it('combined: tag filter AND search query — returns empty when no intersection', () => {
    // Tag "typescript" is on link 2, but "hacker" only matches link 3
    const result = filterLinks(fixtures, 'hacker', 'typescript')
    expect(result).toHaveLength(0)
  })
})
