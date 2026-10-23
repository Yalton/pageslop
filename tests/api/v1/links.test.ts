import { describe, it, expect, vi, beforeEach } from 'vitest'
// Load the routes up front, outside any test's timeout. vi.mock is hoisted,
// so they still get the mocks, and the tests' dynamic imports hit the cache.
import '@/app/api/v1/links/route'
import '@/app/api/v1/links/[id]/route'

vi.mock('@/lib/auth/api-token', () => ({
  authenticateBearer: vi.fn(),
}))

vi.mock('@/lib/db/queries/links', () => ({
  listLinksPage: vi.fn(),
  getLinkWithTags: vi.fn(),
  insertLink: vi.fn(),
  findDuplicate: vi.fn(),
  updateLinkFields: vi.fn(),
  deleteLink: vi.fn(),
}))

vi.mock('@/lib/queue/boss', () => ({
  enqueueScrapeJob: vi.fn(),
}))

import { encodeCursor } from '@/lib/links/cursor'
import type { LinkWithTags } from '@/types'

const ALL_SCOPES = ['stash', 'links:read', 'links:write', 'links:manage']

function link(overrides: Partial<LinkWithTags> = {}): LinkWithTags {
  return {
    id: 'link-1',
    userId: 'user-1',
    url: 'https://example.com/',
    title: 'Example',
    description: 'An example',
    ogImage: null,
    favicon: null,
    domain: 'example.com',
    status: 'ready',
    category: 'Tech',
    categorySource: 'rule',
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
    updatedAt: new Date('2026-10-02T00:00:00.000Z'),
    enrichmentSource: 'rule',
    enrichmentError: null,
    uptimeStatus: 'up',
    lastStatusCode: 200,
    lastCheckedAt: null,
    consecutiveFailures: 0,
    source: 'manual',
    stashState: null,
    stashedAt: null,
    tags: [{ id: 'tag-1', userId: 'user-1', name: 'rust', source: 'user' }],
    ...overrides,
  }
}

function req(path: string, init: { method?: string; body?: unknown; token?: string | null } = {}) {
  const headers: Record<string, string> = {}
  const token = init.token === undefined ? 'ps_valid' : init.token
  if (token) headers.authorization = `Bearer ${token}`
  if (init.body !== undefined) headers['content-type'] = 'application/json'
  return new Request(`http://localhost${path}`, {
    method: init.method ?? 'GET',
    headers,
    body: init.body === undefined ? undefined : typeof init.body === 'string' ? init.body : JSON.stringify(init.body),
  })
}

async function setup(auth: { userId: string; scopes: string[] } | null = { userId: 'user-1', scopes: ALL_SCOPES }) {
  const { authenticateBearer } = await import('@/lib/auth/api-token')
  const queries = await import('@/lib/db/queries/links')
  const { enqueueScrapeJob } = await import('@/lib/queue/boss')
  vi.mocked(authenticateBearer).mockResolvedValue(auth as never)
  vi.mocked(queries.listLinksPage).mockResolvedValue({ links: [], nextCursor: null })
  vi.mocked(enqueueScrapeJob).mockResolvedValue(undefined)
  const list = await import('@/app/api/v1/links/route')
  const one = await import('@/app/api/v1/links/[id]/route')
  return { list, one, queries, enqueueScrapeJob }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

describe('auth', () => {
  it('returns 401 JSON with WWW-Authenticate when the token is missing or invalid', async () => {
    const { list, queries } = await setup(null)
    const res = await list.GET(req('/api/v1/links', { token: null }))
    expect(res.status).toBe(401)
    expect(res.headers.get('www-authenticate')).toMatch(/^Bearer/)
    expect(await res.json()).toEqual({ error: expect.any(String) })
    expect(queries.listLinksPage).not.toHaveBeenCalled()
  })

  it('returns 403 for a token without links:read on GET', async () => {
    const { list, one, queries } = await setup({ userId: 'user-1', scopes: ['stash'] })
    const res = await list.GET(req('/api/v1/links'))
    expect(res.status).toBe(403)
    expect((await res.json()).error).toContain('links:read')
    const res2 = await one.GET(req('/api/v1/links/link-1'), { params: Promise.resolve({ id: 'link-1' }) })
    expect(res2.status).toBe(403)
    expect(queries.listLinksPage).not.toHaveBeenCalled()
    expect(queries.getLinkWithTags).not.toHaveBeenCalled()
  })

  it('returns 403 for a token without links:write on POST', async () => {
    const { list, queries } = await setup({ userId: 'user-1', scopes: ['links:read'] })
    const res = await list.POST(req('/api/v1/links', { method: 'POST', body: { url: 'https://a.com' } }))
    expect(res.status).toBe(403)
    expect((await res.json()).error).toContain('links:write')
    expect(queries.insertLink).not.toHaveBeenCalled()
  })

  it('checks auth before parsing the body', async () => {
    const { list } = await setup(null)
    const res = await list.POST(req('/api/v1/links', { method: 'POST', body: '{bad', token: null }))
    expect(res.status).toBe(401)
  })
})

describe('GET /api/v1/links', () => {
  it("lists the token owner's links with default limit 50", async () => {
    const { list, queries } = await setup()
    vi.mocked(queries.listLinksPage).mockResolvedValue({ links: [link()], nextCursor: null })
    const res = await list.GET(req('/api/v1/links'))
    expect(res.status).toBe(200)
    expect(queries.listLinksPage).toHaveBeenCalledWith('user-1', {
      q: undefined,
      tag: undefined,
      domain: undefined,
      view: 'saved',
      limit: 50,
      cursor: null,
    })
    expect(await res.json()).toEqual({
      links: [
        {
          id: 'link-1',
          url: 'https://example.com/',
          title: 'Example',
          description: 'An example',
          domain: 'example.com',
          category: 'Tech',
          status: 'ready',
          favicon: null,
          ogImage: null,
          source: 'manual',
          stashState: null,
          stashedAt: null,
          tags: ['rust'],
          createdAt: '2026-10-01T00:00:00.000Z',
          updatedAt: '2026-10-02T00:00:00.000Z',
        },
      ],
      nextCursor: null,
    })
  })

  it('never exposes userId or internal enrichment fields', async () => {
    const { list, queries } = await setup()
    vi.mocked(queries.listLinksPage).mockResolvedValue({ links: [link()], nextCursor: null })
    const text = await (await list.GET(req('/api/v1/links'))).text()
    expect(text).not.toContain('user-1')
    expect(text).not.toContain('enrichment')
  })

  it('passes q, tag, domain, limit and a decoded cursor through', async () => {
    const { list, queries } = await setup()
    const cursor = encodeCursor({ createdAt: '2026-10-01 00:00:00.123456', id: 'link-9' })
    vi.mocked(queries.listLinksPage).mockResolvedValue({ links: [], nextCursor: 'next-abc' })
    const res = await list.GET(
      req(`/api/v1/links?q=rust+book&tag=Rust&domain=www.Example.com&limit=10&cursor=${cursor}`),
    )
    expect(res.status).toBe(200)
    expect(queries.listLinksPage).toHaveBeenCalledWith('user-1', {
      q: 'rust book',
      tag: 'rust',
      domain: 'example.com',
      view: 'saved',
      limit: 10,
      cursor: { createdAt: '2026-10-01 00:00:00.123456', id: 'link-9' },
    })
    expect((await res.json()).nextCursor).toBe('next-abc')
  })

  it('treats empty query params as absent', async () => {
    const { list, queries } = await setup()
    await list.GET(req('/api/v1/links?q=&tag=&domain=&cursor='))
    expect(queries.listLinksPage).toHaveBeenCalledWith('user-1', expect.objectContaining({
      q: undefined, tag: undefined, domain: undefined, cursor: null,
    }))
  })

  it('selects revisit links and rejects unknown views', async () => {
    const { list, queries } = await setup()
    expect((await list.GET(req('/api/v1/links?view=revisit'))).status).toBe(200)
    expect(queries.listLinksPage).toHaveBeenCalledWith('user-1', expect.objectContaining({ view: 'revisit' }))
    expect((await list.GET(req('/api/v1/links?view=unknown'))).status).toBe(400)
  })

  it('accepts limit 200 and rejects limits outside 1..200', async () => {
    const { list, queries } = await setup()
    expect((await list.GET(req('/api/v1/links?limit=200'))).status).toBe(200)
    expect(queries.listLinksPage).toHaveBeenCalledWith('user-1', expect.objectContaining({ limit: 200 }))
    for (const bad of ['0', '201', '-1', 'abc', '1.5']) {
      const res = await list.GET(req(`/api/v1/links?limit=${bad}`))
      expect(res.status, `limit=${bad}`).toBe(400)
      expect(await res.json()).toEqual({ error: expect.stringContaining('limit') })
    }
  })

  it('returns 400 for a malformed cursor', async () => {
    const { list, queries } = await setup()
    vi.mocked(queries.listLinksPage).mockClear()
    const res = await list.GET(req('/api/v1/links?cursor=not-a-cursor'))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: expect.stringContaining('cursor') })
    expect(queries.listLinksPage).not.toHaveBeenCalled()
  })

  it('returns 500 JSON when the query fails', async () => {
    const { list, queries } = await setup()
    vi.mocked(queries.listLinksPage).mockRejectedValue(new Error('db down'))
    const res = await list.GET(req('/api/v1/links'))
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: expect.any(String) })
  })
})

describe('GET /api/v1/links/:id', () => {
  it("returns one of the owner's links", async () => {
    const { one, queries } = await setup()
    vi.mocked(queries.getLinkWithTags).mockResolvedValue(link())
    const res = await one.GET(req('/api/v1/links/link-1'), { params: Promise.resolve({ id: 'link-1' }) })
    expect(res.status).toBe(200)
    expect(queries.getLinkWithTags).toHaveBeenCalledWith('user-1', 'link-1')
    const json = await res.json()
    expect(json.link.id).toBe('link-1')
    expect(json.link.tags).toEqual(['rust'])
  })

  it('returns 404 JSON for an unknown id or another user\'s link', async () => {
    const { one, queries } = await setup()
    vi.mocked(queries.getLinkWithTags).mockResolvedValue(null)
    const res = await one.GET(req('/api/v1/links/nope'), { params: Promise.resolve({ id: 'nope' }) })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Link not found' })
  })
})

describe('POST /api/v1/links', () => {
  function post(body: unknown) {
    return req('/api/v1/links', { method: 'POST', body })
  }

  it('saves a new link, enqueues a scrape, and returns 201', async () => {
    const { list, queries, enqueueScrapeJob } = await setup()
    vi.mocked(queries.findDuplicate).mockResolvedValue(null as never)
    vi.mocked(queries.insertLink).mockResolvedValue({ ...link({ status: 'pending', title: 'Hi' }), tags: undefined } as never)
    const res = await list.POST(post({ url: 'https://Example.com', title: 'Hi' }))
    expect(res.status).toBe(201)
    expect(queries.findDuplicate).toHaveBeenCalledWith('user-1', 'https://Example.com')
    expect(queries.insertLink).toHaveBeenCalledWith('user-1', 'https://Example.com', { title: 'Hi' })
    expect(enqueueScrapeJob).toHaveBeenCalledWith('link-1', 'https://example.com/')
    const json = await res.json()
    expect(json.duplicate).toBe(false)
    expect(json.link).toMatchObject({ id: 'link-1', url: 'https://example.com/', status: 'pending', tags: [] })
  })

  it('returns the existing link with 200 and does not insert or enqueue for a duplicate', async () => {
    const { list, queries, enqueueScrapeJob } = await setup()
    vi.mocked(queries.findDuplicate).mockResolvedValue(link() as never)
    vi.mocked(queries.getLinkWithTags).mockResolvedValue(link())
    const res = await list.POST(post({ url: 'https://example.com' }))
    expect(res.status).toBe(200)
    expect(queries.insertLink).not.toHaveBeenCalled()
    expect(enqueueScrapeJob).not.toHaveBeenCalled()
    const json = await res.json()
    expect(json.duplicate).toBe(true)
    expect(json.link).toMatchObject({ id: 'link-1', tags: ['rust'] })
  })

  it('omits the title option when none is given', async () => {
    const { list, queries } = await setup()
    vi.mocked(queries.findDuplicate).mockResolvedValue(null as never)
    vi.mocked(queries.insertLink).mockResolvedValue(link() as never)
    await list.POST(post({ url: 'https://example.com' }))
    expect(queries.insertLink).toHaveBeenCalledWith('user-1', 'https://example.com', {})
  })

  it('still returns 201 when enqueueing the scrape fails', async () => {
    const { list, queries, enqueueScrapeJob } = await setup()
    vi.mocked(queries.findDuplicate).mockResolvedValue(null as never)
    vi.mocked(queries.insertLink).mockResolvedValue(link() as never)
    vi.mocked(enqueueScrapeJob).mockRejectedValue(new Error('queue down'))
    const res = await list.POST(post({ url: 'https://example.com' }))
    expect(res.status).toBe(201)
  })

  it.each([
    ['not JSON', '{bad'],
    ['missing url', {}],
    ['url not a string', { url: 42 }],
    ['invalid url', { url: 'not a url' }],
    ['unsupported protocol', { url: 'ftp://example.com/file' }],
    ['javascript url', { url: 'javascript:alert(1)' }],
    ['url too long', { url: 'https://example.com/' + 'a'.repeat(2048) }],
    ['title not a string', { url: 'https://example.com', title: 5 }],
    ['title too long', { url: 'https://example.com', title: 'x'.repeat(501) }],
  ])('returns 400 JSON for %s', async (_label, body) => {
    const { list, queries } = await setup()
    const res = await list.POST(post(body))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: expect.any(String) })
    expect(queries.insertLink).not.toHaveBeenCalled()
  })

  it('returns 500 JSON when saving fails', async () => {
    const { list, queries } = await setup()
    vi.mocked(queries.findDuplicate).mockResolvedValue(null as never)
    vi.mocked(queries.insertLink).mockRejectedValue(new Error('db down'))
    const res = await list.POST(post({ url: 'https://example.com' }))
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: expect.any(String) })
  })
})
