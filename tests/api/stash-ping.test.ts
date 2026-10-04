import { describe, it, expect, vi, beforeEach } from 'vitest'
// Load the routes up front, outside any test's timeout. vi.mock is hoisted,
// so they still get the mocks, and the tests' dynamic imports hit the cache.
import '@/app/api/stash/ping/route'

vi.mock('@/lib/auth/api-token', () => ({
  authenticateBearer: vi.fn(),
}))

vi.mock('@/lib/db/queries/users', () => ({
  getUserEmail: vi.fn(),
}))

function pingReq(token: string | null = 'ps_valid') {
  const headers: Record<string, string> = {}
  if (token) headers.authorization = `Bearer ${token}`
  return new Request('http://localhost/api/stash/ping', { headers })
}

describe('GET /api/stash/ping', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns ok and the account email for a valid token', async () => {
    const { authenticateBearer } = await import('@/lib/auth/api-token')
    const { getUserEmail } = await import('@/lib/db/queries/users')
    vi.mocked(authenticateBearer).mockResolvedValue({ userId: 'user-1' })
    vi.mocked(getUserEmail).mockResolvedValue('test@example.com')

    const { GET } = await import('@/app/api/stash/ping/route')
    const res = await GET(pingReq())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, user: { email: 'test@example.com' } })
    expect(getUserEmail).toHaveBeenCalledWith('user-1')
  })

  it('returns 401 without a token', async () => {
    const { authenticateBearer } = await import('@/lib/auth/api-token')
    vi.mocked(authenticateBearer).mockResolvedValue(null)

    const { GET } = await import('@/app/api/stash/ping/route')
    const res = await GET(pingReq(null))
    expect(res.status).toBe(401)
  })

  it('returns 401 for an unknown or revoked token', async () => {
    const { authenticateBearer } = await import('@/lib/auth/api-token')
    const { getUserEmail } = await import('@/lib/db/queries/users')
    vi.mocked(authenticateBearer).mockResolvedValue(null)

    const { GET } = await import('@/app/api/stash/ping/route')
    const res = await GET(pingReq('ps_revoked'))
    expect(res.status).toBe(401)
    expect(getUserEmail).not.toHaveBeenCalled()
  })

  it('returns 401 when the token user no longer exists', async () => {
    const { authenticateBearer } = await import('@/lib/auth/api-token')
    const { getUserEmail } = await import('@/lib/db/queries/users')
    vi.mocked(authenticateBearer).mockResolvedValue({ userId: 'user-gone' })
    vi.mocked(getUserEmail).mockResolvedValue(null)

    const { GET } = await import('@/app/api/stash/ping/route')
    const res = await GET(pingReq())
    expect(res.status).toBe(401)
  })
})
