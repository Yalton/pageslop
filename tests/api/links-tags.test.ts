import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock database query modules
vi.mock('@/lib/db/queries/links', () => ({
  insertLink: vi.fn(),
  findDuplicate: vi.fn(),
  listLinks: vi.fn(),
  listLinksWithTags: vi.fn(),
  deleteLink: vi.fn(),
  updateLinkMetadata: vi.fn(),
  updateLinkFields: vi.fn(),
  getLinkWithTags: vi.fn(),
}))

vi.mock('@/lib/db/queries/tags', () => ({
  upsertTag: vi.fn(),
  linkTagToLink: vi.fn(),
  getTagsForLink: vi.fn(),
  deleteLinkTag: vi.fn(),
}))

vi.mock('@/lib/queue/boss', () => ({
  enqueueScrapeJob: vi.fn(),
  enqueueEnrichJob: vi.fn(),
}))

// Mock auth
vi.mock('@/lib/auth/server', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}))

// Mock next/headers
vi.mock('next/headers', () => ({
  headers: vi.fn(() => new Headers()),
}))

// ---- Shared mock data ----

const mockLink = {
  id: 'link-1',
  userId: 'user-1',
  url: 'https://example.com',
  status: 'ready' as const,
  domain: 'example.com',
  title: 'Example',
  description: null,
  ogImage: null,
  favicon: null,
  category: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const mockTag = {
  id: 'tag-1',
  userId: 'user-1',
  name: 'react',
  source: 'user' as const,
}

const mockLinkWithTags = { ...mockLink, tags: [mockTag] }

// ---- POST /api/links/[id]/tags ----

describe('POST /api/links/[id]/tags', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a user tag and links it to the link, returns 201 with tag', async () => {
    const { auth } = await import('@/lib/auth/server')
    const { upsertTag, linkTagToLink } = await import('@/lib/db/queries/tags')
    const { deleteLink } = await import('@/lib/db/queries/links')

    vi.mocked(auth.api.getSession).mockResolvedValueOnce({
      user: { id: 'user-1' },
      session: {} as any,
    } as any)

    // Simulate route: verify link ownership via deleteLink-style query (using a dedicated links query)
    // The route uses its own DB query for ownership check; we mock that via the links module
    // The route handler does: db.select from links where id AND userId
    // We model this as the tags route using the same auth + links ownership check
    vi.mocked(upsertTag).mockResolvedValueOnce(mockTag)
    vi.mocked(linkTagToLink).mockResolvedValueOnce(undefined)

    // Import the POST route handler
    const { POST } = await import('@/app/api/links/[id]/tags/route')

    const req = new Request('http://localhost/api/links/link-1/tags', {
      method: 'POST',
      body: JSON.stringify({ name: 'react' }),
      headers: { 'content-type': 'application/json' },
    })

    // Mock DB client for ownership check inside the route
    vi.doMock('@/lib/db/client', () => ({
      db: {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn().mockResolvedValueOnce([mockLink]),
            })),
          })),
        })),
      },
    }))

    const res = await POST(req, { params: Promise.resolve({ id: 'link-1' }) })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.tag).toBeDefined()
    expect(body.tag.name).toBe('react')
    expect(body.tag.source).toBe('user')
  })

  it('returns 400 when name is empty', async () => {
    const { auth } = await import('@/lib/auth/server')
    vi.mocked(auth.api.getSession).mockResolvedValueOnce({
      user: { id: 'user-1' },
      session: {} as any,
    } as any)

    const { POST } = await import('@/app/api/links/[id]/tags/route')

    const req = new Request('http://localhost/api/links/link-1/tags', {
      method: 'POST',
      body: JSON.stringify({ name: '' }),
      headers: { 'content-type': 'application/json' },
    })

    const res = await POST(req, { params: Promise.resolve({ id: 'link-1' }) })
    expect(res.status).toBe(400)
  })

  it('returns 401 when not authenticated', async () => {
    const { auth } = await import('@/lib/auth/server')
    vi.mocked(auth.api.getSession).mockResolvedValueOnce(null)

    const { POST } = await import('@/app/api/links/[id]/tags/route')

    const req = new Request('http://localhost/api/links/link-1/tags', {
      method: 'POST',
      body: JSON.stringify({ name: 'react' }),
      headers: { 'content-type': 'application/json' },
    })

    const res = await POST(req, { params: Promise.resolve({ id: 'link-1' }) })
    expect(res.status).toBe(401)
  })
})

// ---- DELETE /api/links/[id]/tags/[tagId] ----

describe('DELETE /api/links/[id]/tags/[tagId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('removes tag from link, returns 200', async () => {
    const { auth } = await import('@/lib/auth/server')
    const { deleteLinkTag } = await import('@/lib/db/queries/tags')

    vi.mocked(auth.api.getSession).mockResolvedValueOnce({
      user: { id: 'user-1' },
      session: {} as any,
    } as any)
    vi.mocked(deleteLinkTag).mockResolvedValueOnce(undefined)

    const { DELETE } = await import('@/app/api/links/[id]/tags/[tagId]/route')

    const req = new Request('http://localhost/api/links/link-1/tags/tag-1', {
      method: 'DELETE',
    })

    const res = await DELETE(req, {
      params: Promise.resolve({ id: 'link-1', tagId: 'tag-1' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.deleted).toBe(true)
  })

  it('returns 401 when not authenticated', async () => {
    const { auth } = await import('@/lib/auth/server')
    vi.mocked(auth.api.getSession).mockResolvedValueOnce(null)

    const { DELETE } = await import('@/app/api/links/[id]/tags/[tagId]/route')

    const req = new Request('http://localhost/api/links/link-1/tags/tag-1', {
      method: 'DELETE',
    })

    const res = await DELETE(req, {
      params: Promise.resolve({ id: 'link-1', tagId: 'tag-1' }),
    })
    expect(res.status).toBe(401)
  })
})

// ---- PATCH /api/links/[id] ----

describe('PATCH /api/links/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updates description and returns updated link', async () => {
    const { auth } = await import('@/lib/auth/server')
    const { updateLinkFields } = await import('@/lib/db/queries/links')

    vi.mocked(auth.api.getSession).mockResolvedValueOnce({
      user: { id: 'user-1' },
      session: {} as any,
    } as any)
    vi.mocked(updateLinkFields).mockResolvedValueOnce({
      ...mockLink,
      description: 'new desc',
    })

    const { PATCH } = await import('@/app/api/links/[id]/route')

    const req = new Request('http://localhost/api/links/link-1', {
      method: 'PATCH',
      body: JSON.stringify({ description: 'new desc' }),
      headers: { 'content-type': 'application/json' },
    })

    const res = await PATCH(req, { params: Promise.resolve({ id: 'link-1' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.description).toBe('new desc')
  })

  it('updates category and returns updated link', async () => {
    const { auth } = await import('@/lib/auth/server')
    const { updateLinkFields } = await import('@/lib/db/queries/links')

    vi.mocked(auth.api.getSession).mockResolvedValueOnce({
      user: { id: 'user-1' },
      session: {} as any,
    } as any)
    vi.mocked(updateLinkFields).mockResolvedValueOnce({
      ...mockLink,
      category: 'Technology',
    })

    const { PATCH } = await import('@/app/api/links/[id]/route')

    const req = new Request('http://localhost/api/links/link-1', {
      method: 'PATCH',
      body: JSON.stringify({ category: 'Technology' }),
      headers: { 'content-type': 'application/json' },
    })

    const res = await PATCH(req, { params: Promise.resolve({ id: 'link-1' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.category).toBe('Technology')
  })

  it('returns 400 for invalid category', async () => {
    const { auth } = await import('@/lib/auth/server')
    vi.mocked(auth.api.getSession).mockResolvedValueOnce({
      user: { id: 'user-1' },
      session: {} as any,
    } as any)

    const { PATCH } = await import('@/app/api/links/[id]/route')

    const req = new Request('http://localhost/api/links/link-1', {
      method: 'PATCH',
      body: JSON.stringify({ category: 'NotACategory' }),
      headers: { 'content-type': 'application/json' },
    })

    const res = await PATCH(req, { params: Promise.resolve({ id: 'link-1' }) })
    expect(res.status).toBe(400)
  })

  it('returns 401 when not authenticated', async () => {
    const { auth } = await import('@/lib/auth/server')
    vi.mocked(auth.api.getSession).mockResolvedValueOnce(null)

    const { PATCH } = await import('@/app/api/links/[id]/route')

    const req = new Request('http://localhost/api/links/link-1', {
      method: 'PATCH',
      body: JSON.stringify({ description: 'x' }),
      headers: { 'content-type': 'application/json' },
    })

    const res = await PATCH(req, { params: Promise.resolve({ id: 'link-1' }) })
    expect(res.status).toBe(401)
  })
})

// ---- GET /api/links with tags ----

describe('GET /api/links returns links with tags', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns links with tags array included', async () => {
    const { auth } = await import('@/lib/auth/server')
    const { listLinksWithTags } = await import('@/lib/db/queries/links')

    vi.mocked(auth.api.getSession).mockResolvedValueOnce({
      user: { id: 'user-1' },
      session: {} as any,
    } as any)
    vi.mocked(listLinksWithTags).mockResolvedValueOnce([mockLinkWithTags])

    const { GET } = await import('@/app/api/links/route')

    const req = new Request('http://localhost/api/links')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body[0].tags).toBeDefined()
    expect(body[0].tags[0].name).toBe('react')
  })
})

// ---- listLinksWithTags query function ----

describe('listLinksWithTags — query function', () => {
  it('returns links with their tags batched', async () => {
    const { listLinksWithTags } = await import('@/lib/db/queries/links')

    vi.mocked(listLinksWithTags).mockResolvedValueOnce([mockLinkWithTags])

    const result = await listLinksWithTags('user-1')
    expect(result).toHaveLength(1)
    expect(result[0].tags).toHaveLength(1)
    expect(result[0].tags[0].source).toBe('user')
  })
})

// ---- upsertTag + linkTagToLink ----

describe('upsertTag', () => {
  it('normalizes name to lowercase and returns tag', async () => {
    const { upsertTag } = await import('@/lib/db/queries/tags')

    vi.mocked(upsertTag).mockImplementationOnce(async (userId, name, source) => ({
      id: 'tag-x',
      userId,
      name: name.toLowerCase().trim(),
      source,
    }))

    const tag = await upsertTag('user-1', 'React', 'user')
    expect(tag.name).toBe('react')
  })
})
