import { describe, it, expect, vi, beforeEach } from 'vitest'
// Load the route up front, outside any test's timeout.
import '@/app/api/v1/tags/route'

vi.mock('@/lib/auth/api-token', () => ({
  authenticateBearer: vi.fn(),
}))

vi.mock('@/lib/db/queries/tags', () => ({
  listTagsWithCount: vi.fn(),
}))

function req(token: string | null = 'ps_valid') {
  const headers: Record<string, string> = {}
  if (token) headers.authorization = `Bearer ${token}`
  return new Request('http://localhost/api/v1/tags', { headers })
}

async function setup(auth: { userId: string; scopes: string[] } | null) {
  const { authenticateBearer } = await import('@/lib/auth/api-token')
  const { listTagsWithCount } = await import('@/lib/db/queries/tags')
  vi.mocked(authenticateBearer).mockResolvedValue(auth as never)
  const { GET } = await import('@/app/api/v1/tags/route')
  return { GET, listTagsWithCount }
}

describe('GET /api/v1/tags', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns the token owner's tags with counts", async () => {
    const { GET, listTagsWithCount } = await setup({ userId: 'user-1', scopes: ['links:read'] })
    vi.mocked(listTagsWithCount).mockResolvedValue([{ name: 'rust', count: 3 }])
    const res = await GET(req())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ tags: [{ name: 'rust', count: 3 }] })
    expect(listTagsWithCount).toHaveBeenCalledWith('user-1')
  })

  it('returns 401 without a valid token', async () => {
    const { GET, listTagsWithCount } = await setup(null)
    const res = await GET(req(null))
    expect(res.status).toBe(401)
    expect(listTagsWithCount).not.toHaveBeenCalled()
  })

  it('returns 403 without links:read', async () => {
    const { GET, listTagsWithCount } = await setup({ userId: 'user-1', scopes: ['stash'] })
    const res = await GET(req())
    expect(res.status).toBe(403)
    expect(listTagsWithCount).not.toHaveBeenCalled()
  })
})
