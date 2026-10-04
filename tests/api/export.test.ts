import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LINK_DEFAULTS } from '../fixtures/link-defaults'
// Load the routes up front, outside any test's timeout. vi.mock is hoisted,
// so they still get the mocks, and the tests' dynamic imports hit the cache.
import '@/app/api/export/json/route'
import '@/app/api/export/html/route'
import type { LinkWithTags } from '@/types'

// ---- generateNetscapeHTML tests ----

describe('generateNetscapeHTML', () => {
  it('produces output starting with DOCTYPE NETSCAPE-Bookmark-file-1', async () => {
    const { generateNetscapeHTML } = await import('@/lib/utils/export-html')
    const result = generateNetscapeHTML([])
    expect(result).toMatch(/^<!DOCTYPE NETSCAPE-Bookmark-file-1>/)
  })

  it('produces valid but empty bookmark structure for empty links array', async () => {
    const { generateNetscapeHTML } = await import('@/lib/utils/export-html')
    const result = generateNetscapeHTML([])
    expect(result).toContain('<!DOCTYPE NETSCAPE-Bookmark-file-1>')
    expect(result).toContain('<DL>')
    expect(result).toContain('</DL>')
    expect(result).not.toContain('<DT><A')
  })

  it('each link becomes a DT>A element with HREF and ADD_DATE', async () => {
    const { generateNetscapeHTML } = await import('@/lib/utils/export-html')
    const createdAt = new Date('2024-01-01T00:00:00.000Z')
    const links: LinkWithTags[] = [
      {
        id: '1',
        userId: 'u1',
        url: 'https://example.com',
        title: 'Example',
        description: null,
        ogImage: null,
        favicon: null,
        domain: 'example.com',
        status: 'ready',
        category: null,
        createdAt,
        updatedAt: createdAt,
        ...LINK_DEFAULTS,
        tags: [],
      },
    ]

    const result = generateNetscapeHTML(links)
    expect(result).toContain('<DT><A HREF="https://example.com"')
    expect(result).toContain('ADD_DATE="')
    expect(result).toContain('>Example</A>')
  })

  it('ADD_DATE is Unix timestamp in seconds (createdAt / 1000)', async () => {
    const { generateNetscapeHTML } = await import('@/lib/utils/export-html')
    const createdAt = new Date('2024-01-01T00:00:00.000Z') // 1704067200000 ms
    const expectedUnix = Math.floor(createdAt.getTime() / 1000) // 1704067200

    const links: LinkWithTags[] = [
      {
        id: '1',
        userId: 'u1',
        url: 'https://example.com',
        title: 'Example',
        description: null,
        ogImage: null,
        favicon: null,
        domain: 'example.com',
        status: 'ready',
        category: null,
        createdAt,
        updatedAt: createdAt,
        ...LINK_DEFAULTS,
        tags: [],
      },
    ]

    const result = generateNetscapeHTML(links)
    expect(result).toContain(`ADD_DATE="${expectedUnix}"`)
  })

  it('HTML-escapes titles containing special characters (&, <, >)', async () => {
    const { generateNetscapeHTML } = await import('@/lib/utils/export-html')
    const links: LinkWithTags[] = [
      {
        id: '1',
        userId: 'u1',
        url: 'https://example.com',
        title: 'Cats & Dogs <Fun> "Quotes"',
        description: null,
        ogImage: null,
        favicon: null,
        domain: 'example.com',
        status: 'ready',
        category: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...LINK_DEFAULTS,
        tags: [],
      },
    ]

    const result = generateNetscapeHTML(links)
    expect(result).toContain('Cats &amp; Dogs &lt;Fun&gt; &quot;Quotes&quot;')
  })

  it('uses URL as title fallback when title is null', async () => {
    const { generateNetscapeHTML } = await import('@/lib/utils/export-html')
    const links: LinkWithTags[] = [
      {
        id: '1',
        userId: 'u1',
        url: 'https://example.com',
        title: null,
        description: null,
        ogImage: null,
        favicon: null,
        domain: 'example.com',
        status: 'ready',
        category: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...LINK_DEFAULTS,
        tags: [],
      },
    ]

    const result = generateNetscapeHTML(links)
    expect(result).toContain('>https://example.com</A>')
  })
})

// ---- Export JSON serialization tests ----

vi.mock('@/lib/db/queries/links', () => ({
  listLinksWithTags: vi.fn(),
}))

vi.mock('@/lib/auth/server', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}))

vi.mock('next/headers', () => ({
  headers: vi.fn(() => new Headers()),
}))

describe('GET /api/export/json', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    const { auth } = await import('@/lib/auth/server')
    vi.mocked(auth.api.getSession).mockResolvedValueOnce(null)

    const { GET } = await import('@/app/api/export/json/route')
    const req = new Request('http://localhost/api/export/json')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('serializes all expected fields: url, title, description, tags, category, createdAt, updatedAt', async () => {
    const { auth } = await import('@/lib/auth/server')
    const { listLinksWithTags } = await import('@/lib/db/queries/links')

    vi.mocked(auth.api.getSession).mockResolvedValueOnce({
      user: { id: 'user-1' },
      session: {} as any,
    } as any)

    const mockLink: LinkWithTags = {
      id: 'link-1',
      userId: 'user-1',
      url: 'https://example.com',
      title: 'Example',
      description: 'A sample site',
      ogImage: null,
      favicon: null,
      domain: 'example.com',
      status: 'ready',
      category: 'Technology',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-02'),
      ...LINK_DEFAULTS,
      tags: [{ id: 'tag-1', userId: 'user-1', name: 'react', source: 'user' }],
    }

    vi.mocked(listLinksWithTags).mockResolvedValueOnce([mockLink])

    const { GET } = await import('@/app/api/export/json/route')
    const req = new Request('http://localhost/api/export/json')
    const res = await GET(req)
    expect(res.status).toBe(200)

    const contentDisposition = res.headers.get('Content-Disposition')
    expect(contentDisposition).toMatch(/attachment; filename="pageslop-export-\d+\.json"/)

    const body = await res.text()
    const parsed = JSON.parse(body)
    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed[0].url).toBe('https://example.com')
    expect(parsed[0].title).toBe('Example')
    expect(parsed[0].description).toBe('A sample site')
    expect(parsed[0].category).toBe('Technology')
    expect(parsed[0].tags).toHaveLength(1)
    expect(parsed[0].tags[0].name).toBe('react')
    expect(parsed[0].createdAt).toBeDefined()
    expect(parsed[0].updatedAt).toBeDefined()
  })
})

describe('GET /api/export/html', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    const { auth } = await import('@/lib/auth/server')
    vi.mocked(auth.api.getSession).mockResolvedValueOnce(null)

    const { GET } = await import('@/app/api/export/html/route')
    const req = new Request('http://localhost/api/export/html')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('returns Netscape HTML with correct Content-Disposition header', async () => {
    const { auth } = await import('@/lib/auth/server')
    const { listLinksWithTags } = await import('@/lib/db/queries/links')

    vi.mocked(auth.api.getSession).mockResolvedValueOnce({
      user: { id: 'user-1' },
      session: {} as any,
    } as any)

    vi.mocked(listLinksWithTags).mockResolvedValueOnce([])

    const { GET } = await import('@/app/api/export/html/route')
    const req = new Request('http://localhost/api/export/html')
    const res = await GET(req)
    expect(res.status).toBe(200)

    const contentDisposition = res.headers.get('Content-Disposition')
    expect(contentDisposition).toMatch(/attachment; filename="pageslop-bookmarks-\d+\.html"/)

    const body = await res.text()
    expect(body).toContain('<!DOCTYPE NETSCAPE-Bookmark-file-1>')
  })
})
