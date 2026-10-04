import { describe, it, expect, vi, beforeEach } from 'vitest'
// Load the routes up front, outside any test's timeout. vi.mock is hoisted,
// so they still get the mocks, and the tests' dynamic imports hit the cache.
import '@/app/api/settings/api-key/route'

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

// Mock crypto module
vi.mock('@/lib/enrichment/crypto', () => ({
  encryptApiKey: vi.fn(),
  decryptApiKey: vi.fn(),
  maskApiKey: vi.fn(),
}))

// Mock llm-enrich module
vi.mock('@/lib/enrichment/llm-enrich', () => ({
  validateApiKey: vi.fn(),
}))

// Mock user query module
vi.mock('@/lib/db/queries/users', () => ({
  getEncryptedApiKey: vi.fn(),
  setEncryptedApiKey: vi.fn(),
  clearEncryptedApiKey: vi.fn(),
}))

const mockSession = {
  user: { id: 'user-1', name: 'Test User', email: 'test@example.com' },
  session: {} as never,
}

describe('POST /api/settings/api-key', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    const { auth } = await import('@/lib/auth/server')
    vi.mocked(auth.api.getSession).mockResolvedValueOnce(null)

    const { POST } = await import('@/app/api/settings/api-key/route')
    const req = new Request('http://localhost/api/settings/api-key', {
      method: 'POST',
      body: JSON.stringify({ apiKey: 'sk-ant-test' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 when apiKey is missing from body', async () => {
    const { auth } = await import('@/lib/auth/server')
    vi.mocked(auth.api.getSession).mockResolvedValueOnce(mockSession as never)

    const { POST } = await import('@/app/api/settings/api-key/route')
    const req = new Request('http://localhost/api/settings/api-key', {
      method: 'POST',
      body: JSON.stringify({}),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when validateApiKey returns false (invalid key)', async () => {
    const { auth } = await import('@/lib/auth/server')
    const { validateApiKey } = await import('@/lib/enrichment/llm-enrich')

    vi.mocked(auth.api.getSession).mockResolvedValueOnce(mockSession as never)
    vi.mocked(validateApiKey).mockResolvedValueOnce(false)

    const { POST } = await import('@/app/api/settings/api-key/route')
    const req = new Request('http://localhost/api/settings/api-key', {
      method: 'POST',
      body: JSON.stringify({ apiKey: 'sk-ant-bad-key' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body).toHaveProperty('error')
  })

  it('returns 200 with maskedKey when valid key is saved', async () => {
    const { auth } = await import('@/lib/auth/server')
    const { validateApiKey } = await import('@/lib/enrichment/llm-enrich')
    const { encryptApiKey, maskApiKey } = await import('@/lib/enrichment/crypto')
    const { setEncryptedApiKey } = await import('@/lib/db/queries/users')

    vi.mocked(auth.api.getSession).mockResolvedValueOnce(mockSession as never)
    vi.mocked(validateApiKey).mockResolvedValueOnce(true)
    vi.mocked(encryptApiKey).mockReturnValueOnce('encrypted-blob')
    vi.mocked(maskApiKey).mockReturnValueOnce('sk-a...alue')
    vi.mocked(setEncryptedApiKey).mockResolvedValueOnce(undefined)

    const { POST } = await import('@/app/api/settings/api-key/route')
    const req = new Request('http://localhost/api/settings/api-key', {
      method: 'POST',
      body: JSON.stringify({ apiKey: 'sk-ant-api03-longkeyvalue' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('maskedKey', 'sk-a...alue')
    expect(body).toHaveProperty('message')
    expect(setEncryptedApiKey).toHaveBeenCalledWith('user-1', 'encrypted-blob')
  })
})

describe('GET /api/settings/api-key', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    const { auth } = await import('@/lib/auth/server')
    vi.mocked(auth.api.getSession).mockResolvedValueOnce(null)

    const { GET } = await import('@/app/api/settings/api-key/route')
    const req = new Request('http://localhost/api/settings/api-key')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('returns { hasKey: false } when user has no key', async () => {
    const { auth } = await import('@/lib/auth/server')
    const { getEncryptedApiKey } = await import('@/lib/db/queries/users')

    vi.mocked(auth.api.getSession).mockResolvedValueOnce(mockSession as never)
    vi.mocked(getEncryptedApiKey).mockResolvedValueOnce(null)

    const { GET } = await import('@/app/api/settings/api-key/route')
    const req = new Request('http://localhost/api/settings/api-key')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ hasKey: false })
  })

  it('returns { hasKey: true, maskedKey } when user has key — never full key', async () => {
    const { auth } = await import('@/lib/auth/server')
    const { getEncryptedApiKey } = await import('@/lib/db/queries/users')
    const { decryptApiKey, maskApiKey } = await import('@/lib/enrichment/crypto')

    vi.mocked(auth.api.getSession).mockResolvedValueOnce(mockSession as never)
    vi.mocked(getEncryptedApiKey).mockResolvedValueOnce('encrypted-blob')
    vi.mocked(decryptApiKey).mockReturnValueOnce('sk-ant-api03-longkeyvalue')
    vi.mocked(maskApiKey).mockReturnValueOnce('sk-a...alue')

    const { GET } = await import('@/app/api/settings/api-key/route')
    const req = new Request('http://localhost/api/settings/api-key')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('hasKey', true)
    expect(body).toHaveProperty('maskedKey', 'sk-a...alue')
    // Full key must NOT be in the response
    expect(JSON.stringify(body)).not.toContain('sk-ant-api03-longkeyvalue')
  })
})

describe('DELETE /api/settings/api-key', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    const { auth } = await import('@/lib/auth/server')
    vi.mocked(auth.api.getSession).mockResolvedValueOnce(null)

    const { DELETE } = await import('@/app/api/settings/api-key/route')
    const req = new Request('http://localhost/api/settings/api-key', { method: 'DELETE' })
    const res = await DELETE(req)
    expect(res.status).toBe(401)
  })

  it('clears key and returns 200 with message', async () => {
    const { auth } = await import('@/lib/auth/server')
    const { clearEncryptedApiKey } = await import('@/lib/db/queries/users')

    vi.mocked(auth.api.getSession).mockResolvedValueOnce(mockSession as never)
    vi.mocked(clearEncryptedApiKey).mockResolvedValueOnce(undefined)

    const { DELETE } = await import('@/app/api/settings/api-key/route')
    const req = new Request('http://localhost/api/settings/api-key', { method: 'DELETE' })
    const res = await DELETE(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('message')
    expect(clearEncryptedApiKey).toHaveBeenCalledWith('user-1')
  })
})
