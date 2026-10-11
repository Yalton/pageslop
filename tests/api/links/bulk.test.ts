import { describe, it, expect, vi, beforeEach } from 'vitest'
// Load the routes up front, outside any test's timeout. vi.mock is hoisted,
// so they still get the mocks, and the tests' dynamic imports hit the cache.
import '@/app/api/links/bulk-delete/route'
import '@/app/api/links/bulk-tag/route'

vi.mock('@/lib/db/queries/links', () => ({
  bulkDeleteLinks: vi.fn(),
}))

vi.mock('@/lib/db/queries/tags', () => ({
  bulkAddTag: vi.fn(),
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

const mockSession = {
  user: { id: 'user-1', email: 'test@example.com' },
  session: {} as never,
}

async function signedIn(session: typeof mockSession | null = mockSession) {
  const { auth } = await import('@/lib/auth/server')
  vi.mocked(auth.api.getSession).mockResolvedValue(session as never)
}

function jsonReq(url: string, body: unknown) {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('POST /api/links/bulk-delete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  async function bulkDelete(body: unknown) {
    const { POST } = await import('@/app/api/links/bulk-delete/route')
    return POST(jsonReq('http://localhost/api/links/bulk-delete', body))
  }

  it('returns 401 without a session', async () => {
    await signedIn(null)
    const { bulkDeleteLinks } = await import('@/lib/db/queries/links')
    const res = await bulkDelete({ ids: ['a'] })
    expect(res.status).toBe(401)
    expect(bulkDeleteLinks).not.toHaveBeenCalled()
  })

  it("deletes the caller's links and returns the count", async () => {
    await signedIn()
    const { bulkDeleteLinks } = await import('@/lib/db/queries/links')
    vi.mocked(bulkDeleteLinks).mockResolvedValue(2)
    const res = await bulkDelete({ userId: 'user-2', ids: ['link-1', 'link-2'] })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ deleted: 2 })
    expect(bulkDeleteLinks).toHaveBeenCalledWith('user-1', ['link-1', 'link-2'])
  })

  it.each([
    ['missing ids', {}],
    ['empty ids', { ids: [] }],
    ['empty-string id', { ids: [''] }],
    ['too many ids', { ids: Array.from({ length: 501 }, (_, i) => `id-${i}`) }],
    ['a body that is not JSON', '{bad'],
  ])('returns 400 for %s', async (_label, body) => {
    await signedIn()
    const { bulkDeleteLinks } = await import('@/lib/db/queries/links')
    const res = await bulkDelete(body)
    expect(res.status).toBe(400)
    expect(bulkDeleteLinks).not.toHaveBeenCalled()
  })
})

describe('POST /api/links/bulk-tag', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  async function bulkTag(body: unknown) {
    const { POST } = await import('@/app/api/links/bulk-tag/route')
    return POST(jsonReq('http://localhost/api/links/bulk-tag', body))
  }

  it('returns 401 without a session', async () => {
    await signedIn(null)
    const { bulkAddTag } = await import('@/lib/db/queries/tags')
    const res = await bulkTag({ ids: ['a'], name: 'reading' })
    expect(res.status).toBe(401)
    expect(bulkAddTag).not.toHaveBeenCalled()
  })

  it('adds the trimmed tag to the given links for the session user', async () => {
    await signedIn()
    const { bulkAddTag } = await import('@/lib/db/queries/tags')
    const tag = { id: 't1', userId: 'user-1', name: 'reading', source: 'user' }
    vi.mocked(bulkAddTag).mockResolvedValue({ tag, added: 2 } as never)
    const res = await bulkTag({ ids: ['link-1', 'link-2'], name: '  reading ' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ tag, added: 2 })
    expect(bulkAddTag).toHaveBeenCalledWith('user-1', ['link-1', 'link-2'], 'reading')
  })

  it.each([
    ['missing name', { ids: ['a'] }],
    ['blank name', { ids: ['a'], name: '   ' }],
    ['too long name', { ids: ['a'], name: 'x'.repeat(51) }],
    ['empty ids', { ids: [], name: 'reading' }],
    ['a body that is not JSON', '{bad'],
  ])('returns 400 for %s', async (_label, body) => {
    await signedIn()
    const { bulkAddTag } = await import('@/lib/db/queries/tags')
    const res = await bulkTag(body)
    expect(res.status).toBe(400)
    expect(bulkAddTag).not.toHaveBeenCalled()
  })
})
