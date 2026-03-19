import { describe, it, expect, vi, beforeEach } from 'vitest'

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

// Mock database query modules
vi.mock('@/lib/db/queries/links', () => ({
  getLinkWithTags: vi.fn(),
}))

// Mock queue
vi.mock('@/lib/queue/boss', () => ({
  enqueueMonitorJob: vi.fn(),
}))

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
  tags: [],
}

describe('POST /api/links/[id]/check', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    const { auth } = await import('@/lib/auth/server')
    vi.mocked(auth.api.getSession).mockResolvedValueOnce(null)

    const { POST } = await import('@/app/api/links/[id]/check/route')

    const req = new Request('http://localhost/api/links/link-1/check', {
      method: 'POST',
    })

    const res = await POST(req, { params: Promise.resolve({ id: 'link-1' }) })
    expect(res.status).toBe(401)
  })

  it('returns 404 when link is not owned by user', async () => {
    const { auth } = await import('@/lib/auth/server')
    const { getLinkWithTags } = await import('@/lib/db/queries/links')

    vi.mocked(auth.api.getSession).mockResolvedValueOnce({
      user: { id: 'user-2' },
      session: {} as any,
    } as any)

    vi.mocked(getLinkWithTags).mockResolvedValueOnce(null)

    const { POST } = await import('@/app/api/links/[id]/check/route')

    const req = new Request('http://localhost/api/links/link-1/check', {
      method: 'POST',
    })

    const res = await POST(req, { params: Promise.resolve({ id: 'link-1' }) })
    expect(res.status).toBe(404)
    expect(getLinkWithTags).toHaveBeenCalledWith('user-2', 'link-1')
  })

  it('returns 200 with { queued: true } when link is owned and authenticated', async () => {
    const { auth } = await import('@/lib/auth/server')
    const { getLinkWithTags } = await import('@/lib/db/queries/links')
    const { enqueueMonitorJob } = await import('@/lib/queue/boss')

    vi.mocked(auth.api.getSession).mockResolvedValueOnce({
      user: { id: 'user-1' },
      session: {} as any,
    } as any)

    vi.mocked(getLinkWithTags).mockResolvedValueOnce(mockLink)
    vi.mocked(enqueueMonitorJob).mockResolvedValueOnce(undefined)

    const { POST } = await import('@/app/api/links/[id]/check/route')

    const req = new Request('http://localhost/api/links/link-1/check', {
      method: 'POST',
    })

    const res = await POST(req, { params: Promise.resolve({ id: 'link-1' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ queued: true })
    expect(enqueueMonitorJob).toHaveBeenCalledWith('link-1')
  })

  it('calls enqueueMonitorJob with the correct linkId from route params', async () => {
    const { auth } = await import('@/lib/auth/server')
    const { getLinkWithTags } = await import('@/lib/db/queries/links')
    const { enqueueMonitorJob } = await import('@/lib/queue/boss')

    vi.mocked(auth.api.getSession).mockResolvedValueOnce({
      user: { id: 'user-1' },
      session: {} as any,
    } as any)

    vi.mocked(getLinkWithTags).mockResolvedValueOnce({ ...mockLink, id: 'link-99' })
    vi.mocked(enqueueMonitorJob).mockResolvedValueOnce(undefined)

    const { POST } = await import('@/app/api/links/[id]/check/route')

    const req = new Request('http://localhost/api/links/link-99/check', {
      method: 'POST',
    })

    const res = await POST(req, { params: Promise.resolve({ id: 'link-99' }) })
    expect(res.status).toBe(200)
    expect(enqueueMonitorJob).toHaveBeenCalledWith('link-99')
  })
})
