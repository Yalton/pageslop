import { describe, it, expect, vi, beforeEach } from 'vitest'
// Load the routes up front, outside any test's timeout. vi.mock is hoisted,
// so they still get the mocks, and the tests' dynamic imports hit the cache.
import '@/app/api/settings/tokens/route'
import '@/app/api/settings/tokens/[id]/route'

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

vi.mock('@/lib/auth/api-token', () => ({
  generateToken: vi.fn(),
}))

vi.mock('@/lib/db/queries/api-tokens', () => ({
  createApiToken: vi.fn(),
  listApiTokens: vi.fn(),
  deleteApiToken: vi.fn(),
}))

const mockSession = {
  user: { id: 'user-1', email: 'test@example.com' },
  session: {} as never,
}

const RAW = 'ps_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
const HASH = 'a'.repeat(64)

async function signedIn(session: typeof mockSession | null = mockSession) {
  const { auth } = await import('@/lib/auth/server')
  vi.mocked(auth.api.getSession).mockResolvedValue(session as never)
}

function postReq(body: unknown) {
  return new Request('http://localhost/api/settings/tokens', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('POST /api/settings/tokens', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 without a session', async () => {
    await signedIn(null)
    const { createApiToken } = await import('@/lib/db/queries/api-tokens')
    const { POST } = await import('@/app/api/settings/tokens/route')
    const res = await POST(postReq({ name: 'Firefox laptop' }))
    expect(res.status).toBe(401)
    expect(createApiToken).not.toHaveBeenCalled()
  })

  it('creates a token, stores only the hash, and returns the raw token once', async () => {
    await signedIn()
    const { generateToken } = await import('@/lib/auth/api-token')
    const { createApiToken } = await import('@/lib/db/queries/api-tokens')
    vi.mocked(generateToken).mockReturnValue({ raw: RAW, hash: HASH })
    vi.mocked(createApiToken).mockResolvedValue({
      id: 'tok-1',
      userId: 'user-1',
      name: 'Firefox laptop',
      tokenHash: HASH,
      createdAt: new Date('2026-10-03T12:00:00.000Z'),
      lastUsedAt: null,
    } as never)

    const { POST } = await import('@/app/api/settings/tokens/route')
    const res = await POST(postReq({ name: '  Firefox laptop  ' }))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json).toEqual({ id: 'tok-1', name: 'Firefox laptop', token: RAW })
    expect(createApiToken).toHaveBeenCalledWith('user-1', 'Firefox laptop', HASH)
    // The raw token is never passed to the DB layer
    expect(JSON.stringify(vi.mocked(createApiToken).mock.calls)).not.toContain(RAW)
    // The hash never goes back to the client
    expect(JSON.stringify(json)).not.toContain(HASH)
  })

  it('returns 400 for a missing name', async () => {
    await signedIn()
    const { createApiToken } = await import('@/lib/db/queries/api-tokens')
    const { POST } = await import('@/app/api/settings/tokens/route')
    const res = await POST(postReq({}))
    expect(res.status).toBe(400)
    expect(createApiToken).not.toHaveBeenCalled()
  })

  it('returns 400 for a blank name', async () => {
    await signedIn()
    const { POST } = await import('@/app/api/settings/tokens/route')
    const res = await POST(postReq({ name: '   ' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for a name over 100 characters', async () => {
    await signedIn()
    const { POST } = await import('@/app/api/settings/tokens/route')
    const res = await POST(postReq({ name: 'x'.repeat(101) }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for a body that is not JSON', async () => {
    await signedIn()
    const { POST } = await import('@/app/api/settings/tokens/route')
    const res = await POST(postReq('{bad'))
    expect(res.status).toBe(400)
  })
})

describe('GET /api/settings/tokens', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 without a session', async () => {
    await signedIn(null)
    const { GET } = await import('@/app/api/settings/tokens/route')
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it("lists the caller's tokens and never returns hashes or raw tokens", async () => {
    await signedIn()
    const { listApiTokens } = await import('@/lib/db/queries/api-tokens')
    vi.mocked(listApiTokens).mockResolvedValue([
      {
        id: 'tok-1',
        userId: 'user-1',
        name: 'Firefox laptop',
        tokenHash: HASH,
        createdAt: new Date('2026-10-01T00:00:00.000Z'),
        lastUsedAt: new Date('2026-10-03T09:00:00.000Z'),
      },
      {
        id: 'tok-2',
        userId: 'user-1',
        name: 'Firefox desktop',
        tokenHash: 'b'.repeat(64),
        createdAt: new Date('2026-10-02T00:00:00.000Z'),
        lastUsedAt: null,
      },
    ] as never)

    const { GET } = await import('@/app/api/settings/tokens/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).not.toContain(HASH)
    expect(text).not.toContain('b'.repeat(64))
    expect(text).not.toContain('tokenHash')
    expect(text).not.toContain('ps_')
    expect(JSON.parse(text)).toEqual({
      tokens: [
        { id: 'tok-1', name: 'Firefox laptop', createdAt: '2026-10-01T00:00:00.000Z', lastUsedAt: '2026-10-03T09:00:00.000Z' },
        { id: 'tok-2', name: 'Firefox desktop', createdAt: '2026-10-02T00:00:00.000Z', lastUsedAt: null },
      ],
    })
    expect(listApiTokens).toHaveBeenCalledWith('user-1')
  })
})

describe('DELETE /api/settings/tokens/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function delReq(id: string) {
    return [
      new Request(`http://localhost/api/settings/tokens/${id}`, { method: 'DELETE' }),
      { params: Promise.resolve({ id }) },
    ] as const
  }

  it('returns 401 without a session', async () => {
    await signedIn(null)
    const { deleteApiToken } = await import('@/lib/db/queries/api-tokens')
    const { DELETE } = await import('@/app/api/settings/tokens/[id]/route')
    const res = await DELETE(...delReq('tok-1'))
    expect(res.status).toBe(401)
    expect(deleteApiToken).not.toHaveBeenCalled()
  })

  it("revokes the caller's own token", async () => {
    await signedIn()
    const { deleteApiToken } = await import('@/lib/db/queries/api-tokens')
    vi.mocked(deleteApiToken).mockResolvedValue(true)
    const { DELETE } = await import('@/app/api/settings/tokens/[id]/route')
    const res = await DELETE(...delReq('tok-1'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ deleted: true })
    expect(deleteApiToken).toHaveBeenCalledWith('user-1', 'tok-1')
  })

  it("returns 404 for another user's token, scoping the delete to the caller", async () => {
    await signedIn()
    const { deleteApiToken } = await import('@/lib/db/queries/api-tokens')
    vi.mocked(deleteApiToken).mockResolvedValue(false)
    const { DELETE } = await import('@/app/api/settings/tokens/[id]/route')
    const res = await DELETE(...delReq('tok-owned-by-user-2'))
    expect(res.status).toBe(404)
    expect(deleteApiToken).toHaveBeenCalledWith('user-1', 'tok-owned-by-user-2')
  })
})
