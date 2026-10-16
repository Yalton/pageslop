import { describe, it, expect, vi, beforeEach } from 'vitest'
// Load the route up front, outside any test's timeout. vi.mock is hoisted,
// so it still gets the mocks, and the tests' dynamic imports hit the cache.
import '@/app/api/mcp/route'

vi.mock('@/lib/auth/api-token', () => ({
  authenticateBearer: vi.fn(),
}))

vi.mock('@/lib/db/queries/links', () => ({
  listLinksPage: vi.fn(),
  getLinkWithTags: vi.fn(),
  insertLink: vi.fn(),
  findDuplicate: vi.fn(),
}))

vi.mock('@/lib/db/queries/tags', () => ({
  listTagsWithCount: vi.fn(),
}))

vi.mock('@/lib/queue/boss', () => ({
  enqueueScrapeJob: vi.fn(),
}))

import { encodeCursor } from '@/lib/links/cursor'
import type { LinkWithTags } from '@/types'

const ALL_SCOPES = ['stash', 'links:read', 'links:write']

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

const API_LINK = {
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
  tags: ['rust'],
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-02T00:00:00.000Z',
}

let rpcId = 0

/** A JSON-RPC POST to /api/mcp as a Streamable HTTP client sends it. */
function rpc(method: string, params: unknown = {}, token: string | null = 'ps_valid') {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
    'mcp-protocol-version': '2025-06-18',
  }
  if (token) headers.authorization = `Bearer ${token}`
  return new Request('http://localhost/api/mcp', {
    method: 'POST',
    headers,
    body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method, params }),
  })
}

async function setup(auth: { userId: string; scopes: string[] } | null = { userId: 'user-1', scopes: ALL_SCOPES }) {
  const { authenticateBearer } = await import('@/lib/auth/api-token')
  const links = await import('@/lib/db/queries/links')
  const tags = await import('@/lib/db/queries/tags')
  const { enqueueScrapeJob } = await import('@/lib/queue/boss')
  vi.mocked(authenticateBearer).mockResolvedValue(auth as never)
  vi.mocked(links.listLinksPage).mockResolvedValue({ links: [], nextCursor: null })
  vi.mocked(tags.listTagsWithCount).mockResolvedValue([])
  vi.mocked(enqueueScrapeJob).mockResolvedValue(undefined)
  const route = await import('@/app/api/mcp/route')

  /** Call a tool and return the JSON-RPC result. */
  async function call(name: string, args: Record<string, unknown> = {}) {
    const res = await route.POST(rpc('tools/call', { name, arguments: args }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.error).toBeUndefined()
    return body.result as { isError?: boolean; content: { type: string; text: string }[]; structuredContent?: Record<string, unknown> }
  }

  return { route, links, tags, enqueueScrapeJob, call }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

describe('auth', () => {
  it('returns 401 JSON with WWW-Authenticate when the token is missing or invalid', async () => {
    const { route, links } = await setup(null)
    const res = await route.POST(rpc('tools/call', { name: 'search_links', arguments: {} }, null))
    expect(res.status).toBe(401)
    expect(res.headers.get('www-authenticate')).toMatch(/^Bearer/)
    expect(await res.json()).toEqual({ error: expect.any(String) })
    expect(links.listLinksPage).not.toHaveBeenCalled()
  })

  it('rejects GET and DELETE with 405 (stateless server, no SSE stream or sessions)', async () => {
    const { route } = await setup()
    const get = await route.GET()
    expect(get.status).toBe(405)
    expect(get.headers.get('allow')).toBe('POST')
    const del = await route.DELETE()
    expect(del.status).toBe(405)
  })
})

describe('protocol', () => {
  it('answers initialize with the server name and tools capability', async () => {
    const { route } = await setup()
    const res = await route.POST(
      rpc('initialize', {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'test', version: '0' },
      }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.result.serverInfo.name).toBe('pageslop')
    expect(body.result.capabilities.tools).toBeDefined()
  })

  it('lists the four tools', async () => {
    const { route } = await setup()
    const res = await route.POST(rpc('tools/list'))
    const body = await res.json()
    const names = body.result.tools.map((t: { name: string }) => t.name).sort()
    expect(names).toEqual(['get_link', 'list_tags', 'save_link', 'search_links'])
  })

  it('lists tools even for a token without link scopes', async () => {
    const { route } = await setup({ userId: 'user-1', scopes: ['stash'] })
    const res = await route.POST(rpc('tools/list'))
    expect(res.status).toBe(200)
    expect((await res.json()).result.tools).toHaveLength(4)
  })
})

describe('scope enforcement', () => {
  it.each(['search_links', 'get_link', 'list_tags'])('%s requires links:read', async (name) => {
    const { call, links, tags } = await setup({ userId: 'user-1', scopes: ['stash', 'links:write'] })
    const result = await call(name, name === 'get_link' ? { id: 'link-1' } : {})
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('links:read')
    expect(links.listLinksPage).not.toHaveBeenCalled()
    expect(links.getLinkWithTags).not.toHaveBeenCalled()
    expect(tags.listTagsWithCount).not.toHaveBeenCalled()
  })

  it('save_link requires links:write', async () => {
    const { call, links, enqueueScrapeJob } = await setup({ userId: 'user-1', scopes: ['links:read'] })
    const result = await call('save_link', { url: 'https://a.com' })
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('links:write')
    expect(links.findDuplicate).not.toHaveBeenCalled()
    expect(links.insertLink).not.toHaveBeenCalled()
    expect(enqueueScrapeJob).not.toHaveBeenCalled()
  })
})

describe('search_links', () => {
  it("searches the token owner's links with default limit 20", async () => {
    const { call, links } = await setup()
    vi.mocked(links.listLinksPage).mockResolvedValue({ links: [link()], nextCursor: 'next' })
    const result = await call('search_links')
    expect(result.isError).toBeFalsy()
    expect(links.listLinksPage).toHaveBeenCalledWith('user-1', {
      q: undefined,
      tag: undefined,
      domain: undefined,
      limit: 20,
      cursor: null,
    })
    expect(JSON.parse(result.content[0].text)).toEqual({ links: [API_LINK], nextCursor: 'next' })
    expect(result.structuredContent).toEqual({ links: [API_LINK], nextCursor: 'next' })
  })

  it('passes q, normalised tag and domain, limit and decoded cursor', async () => {
    const { call, links } = await setup()
    const cursor = { createdAt: '2026-10-01 00:00:00.123456', id: 'link-9' }
    await call('search_links', {
      q: ' rust ',
      tag: 'Rust',
      domain: 'WWW.GitHub.com',
      limit: 5,
      cursor: encodeCursor(cursor),
    })
    expect(links.listLinksPage).toHaveBeenCalledWith('user-1', {
      q: 'rust',
      tag: 'rust',
      domain: 'github.com',
      limit: 5,
      cursor,
    })
  })

  it('returns a tool error for a bad cursor', async () => {
    const { call, links } = await setup()
    const result = await call('search_links', { cursor: 'garbage' })
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('cursor')
    expect(links.listLinksPage).not.toHaveBeenCalled()
  })

  it('rejects an out-of-range limit', async () => {
    const { route, links } = await setup()
    const res = await route.POST(rpc('tools/call', { name: 'search_links', arguments: { limit: 1000 } }))
    const body = await res.json()
    // Input validation failures come back as a tool error or a JSON-RPC error.
    expect(body.result?.isError === true || body.error !== undefined).toBe(true)
    expect(links.listLinksPage).not.toHaveBeenCalled()
  })

  it('returns a tool error when the query fails', async () => {
    const { call, links } = await setup()
    vi.mocked(links.listLinksPage).mockRejectedValue(new Error('db down'))
    const result = await call('search_links')
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toBe('Failed to search links')
  })
})

describe('get_link', () => {
  it("returns the token owner's link", async () => {
    const { call, links } = await setup()
    vi.mocked(links.getLinkWithTags).mockResolvedValue(link())
    const result = await call('get_link', { id: 'link-1' })
    expect(links.getLinkWithTags).toHaveBeenCalledWith('user-1', 'link-1')
    expect(result.structuredContent).toEqual({ link: API_LINK })
  })

  it("returns not found for a missing or another user's link", async () => {
    const { call, links } = await setup({ userId: 'user-2', scopes: ALL_SCOPES })
    vi.mocked(links.getLinkWithTags).mockResolvedValue(null)
    const result = await call('get_link', { id: 'link-1' })
    expect(links.getLinkWithTags).toHaveBeenCalledWith('user-2', 'link-1')
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('not found')
  })
})

describe('list_tags', () => {
  it("lists the token owner's tags with counts", async () => {
    const { call, tags } = await setup()
    vi.mocked(tags.listTagsWithCount).mockResolvedValue([{ name: 'rust', count: 3 }])
    const result = await call('list_tags')
    expect(tags.listTagsWithCount).toHaveBeenCalledWith('user-1')
    expect(result.structuredContent).toEqual({ tags: [{ name: 'rust', count: 3 }] })
  })
})

describe('save_link', () => {
  it('saves a new link for the token owner and enqueues a scrape', async () => {
    const { call, links, enqueueScrapeJob } = await setup()
    vi.mocked(links.findDuplicate).mockResolvedValue(null as never)
    vi.mocked(links.insertLink).mockResolvedValue(link({ status: 'pending', tags: undefined }) as never)
    const result = await call('save_link', { url: 'https://example.com/', title: 'Example' })
    expect(links.findDuplicate).toHaveBeenCalledWith('user-1', 'https://example.com/')
    expect(links.insertLink).toHaveBeenCalledWith('user-1', 'https://example.com/', { title: 'Example' })
    expect(enqueueScrapeJob).toHaveBeenCalledWith('link-1', 'https://example.com/')
    expect(result.structuredContent).toEqual({
      link: { ...API_LINK, status: 'pending', tags: [] },
      duplicate: false,
    })
  })

  it('returns the existing link for a duplicate without inserting', async () => {
    const { call, links, enqueueScrapeJob } = await setup()
    vi.mocked(links.findDuplicate).mockResolvedValue(link({ tags: undefined }) as never)
    vi.mocked(links.getLinkWithTags).mockResolvedValue(link())
    const result = await call('save_link', { url: 'https://example.com' })
    expect(links.getLinkWithTags).toHaveBeenCalledWith('user-1', 'link-1')
    expect(links.insertLink).not.toHaveBeenCalled()
    expect(enqueueScrapeJob).not.toHaveBeenCalled()
    expect(result.structuredContent).toEqual({ link: API_LINK, duplicate: true })
  })

  it.each(['ftp://a.com', 'javascript:alert(1)', 'not a url'])('rejects non-http url %s', async (url) => {
    const { call, links } = await setup()
    const result = await call('save_link', { url })
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('http')
    expect(links.insertLink).not.toHaveBeenCalled()
  })

  it('still reports success when enqueueing the scrape fails', async () => {
    const { call, links, enqueueScrapeJob } = await setup()
    vi.mocked(links.findDuplicate).mockResolvedValue(null as never)
    vi.mocked(links.insertLink).mockResolvedValue(link({ tags: undefined }) as never)
    vi.mocked(enqueueScrapeJob).mockRejectedValue(new Error('queue down'))
    const result = await call('save_link', { url: 'https://example.com/' })
    expect(result.isError).toBeFalsy()
    expect(result.structuredContent?.duplicate).toBe(false)
  })

  it('returns a tool error when saving fails', async () => {
    const { call, links } = await setup()
    vi.mocked(links.findDuplicate).mockRejectedValue(new Error('db down'))
    const result = await call('save_link', { url: 'https://example.com/' })
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toBe('Failed to save link')
  })
})
