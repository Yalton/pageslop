import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
// Load the routes up front, outside any test's timeout. vi.mock is hoisted,
// so they still get the mocks, and the tests' dynamic imports hit the cache.
import '@/app/api/links/[id]/route'
import '@/app/api/links/bulk-stash-state/route'

vi.mock('@/lib/db/queries/links', () => ({
  deleteLink: vi.fn(),
  updateLinkFields: vi.fn(),
  bulkSetStashState: vi.fn(),
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

const NOW = new Date('2026-10-03T12:00:00.000Z')

async function signedIn(session: typeof mockSession | null = mockSession) {
  const { auth } = await import('@/lib/auth/server')
  vi.mocked(auth.api.getSession).mockResolvedValue(session as never)
}

function jsonReq(url: string, method: string, body: unknown) {
  return new Request(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('PATCH /api/links/[id] with stashState', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  async function patch(body: unknown, id = 'link-1') {
    const { PATCH } = await import('@/app/api/links/[id]/route')
    return PATCH(jsonReq(`http://localhost/api/links/${id}`, 'PATCH', body), {
      params: Promise.resolve({ id }),
    })
  }

  it('returns 401 without a session', async () => {
    await signedIn(null)
    const { updateLinkFields } = await import('@/lib/db/queries/links')
    const res = await patch({ stashState: 'kept' })
    expect(res.status).toBe(401)
    expect(updateLinkFields).not.toHaveBeenCalled()
  })

  it.each(['read', 'kept', 'archived'] as const)('sets stashState=%s without touching stashedAt', async (state) => {
    await signedIn()
    const { updateLinkFields } = await import('@/lib/db/queries/links')
    vi.mocked(updateLinkFields).mockResolvedValue({ id: 'link-1', stashState: state } as never)
    const res = await patch({ stashState: state })
    expect(res.status).toBe(200)
    expect(updateLinkFields).toHaveBeenCalledWith('user-1', 'link-1', { stashState: state })
  })

  it('sets stashedAt to now when restoring to inbox', async () => {
    await signedIn()
    const { updateLinkFields } = await import('@/lib/db/queries/links')
    vi.mocked(updateLinkFields).mockResolvedValue({ id: 'link-1', stashState: 'inbox' } as never)
    const res = await patch({ stashState: 'inbox' })
    expect(res.status).toBe(200)
    expect(updateLinkFields).toHaveBeenCalledWith('user-1', 'link-1', {
      stashState: 'inbox',
      stashedAt: NOW,
    })
  })

  it('accepts null to take a link out of the stash flow', async () => {
    await signedIn()
    const { updateLinkFields } = await import('@/lib/db/queries/links')
    vi.mocked(updateLinkFields).mockResolvedValue({ id: 'link-1', stashState: null } as never)
    const res = await patch({ stashState: null })
    expect(res.status).toBe(200)
    expect(updateLinkFields).toHaveBeenCalledWith('user-1', 'link-1', { stashState: null })
  })

  it('returns 400 for an unknown stashState', async () => {
    await signedIn()
    const { updateLinkFields } = await import('@/lib/db/queries/links')
    const res = await patch({ stashState: 'deleted' })
    expect(res.status).toBe(400)
    expect(updateLinkFields).not.toHaveBeenCalled()
  })

  it('returns 400 for a non-string stashState', async () => {
    await signedIn()
    const res = await patch({ stashState: 3 })
    expect(res.status).toBe(400)
  })

  it("returns 404 for a link the caller does not own", async () => {
    await signedIn()
    const { updateLinkFields } = await import('@/lib/db/queries/links')
    vi.mocked(updateLinkFields).mockResolvedValue(undefined as never)
    const res = await patch({ stashState: 'kept' }, 'someone-elses-link')
    expect(res.status).toBe(404)
    expect(updateLinkFields).toHaveBeenCalledWith('user-1', 'someone-elses-link', { stashState: 'kept' })
  })

  it('still updates description and category alongside stashState', async () => {
    await signedIn()
    const { updateLinkFields } = await import('@/lib/db/queries/links')
    vi.mocked(updateLinkFields).mockResolvedValue({ id: 'link-1' } as never)
    const res = await patch({ description: 'd', category: 'News', stashState: 'read' })
    expect(res.status).toBe(200)
    expect(updateLinkFields).toHaveBeenCalledWith('user-1', 'link-1', {
      description: 'd',
      category: 'News',
      stashState: 'read',
    })
  })

  it('does not add stash fields when stashState is absent', async () => {
    await signedIn()
    const { updateLinkFields } = await import('@/lib/db/queries/links')
    vi.mocked(updateLinkFields).mockResolvedValue({ id: 'link-1' } as never)
    await patch({ description: 'only this' })
    expect(updateLinkFields).toHaveBeenCalledWith('user-1', 'link-1', { description: 'only this' })
  })
})

describe('POST /api/links/bulk-stash-state', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  async function bulk(body: unknown) {
    const { POST } = await import('@/app/api/links/bulk-stash-state/route')
    return POST(jsonReq('http://localhost/api/links/bulk-stash-state', 'POST', body))
  }

  it('returns 401 without a session', async () => {
    await signedIn(null)
    const { bulkSetStashState } = await import('@/lib/db/queries/links')
    const res = await bulk({ ids: ['a'], stashState: 'kept' })
    expect(res.status).toBe(401)
    expect(bulkSetStashState).not.toHaveBeenCalled()
  })

  it('updates the given ids for the session user and returns the count', async () => {
    await signedIn()
    const { bulkSetStashState } = await import('@/lib/db/queries/links')
    vi.mocked(bulkSetStashState).mockResolvedValue(2)
    const res = await bulk({ ids: ['link-1', 'link-2'], stashState: 'read' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ updated: 2 })
    expect(bulkSetStashState).toHaveBeenCalledWith('user-1', ['link-1', 'link-2'], 'read')
  })

  it("only touches the caller's links: ignores a userId in the body and reports 0 for foreign ids", async () => {
    await signedIn()
    const { bulkSetStashState } = await import('@/lib/db/queries/links')
    // The query filters by user_id, so another user's ids match nothing
    vi.mocked(bulkSetStashState).mockResolvedValue(0)
    const res = await bulk({ userId: 'user-2', ids: ['user2-link'], stashState: 'archived' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ updated: 0 })
    expect(bulkSetStashState).toHaveBeenCalledWith('user-1', ['user2-link'], 'archived')
  })

  it.each([
    ['missing ids', { stashState: 'kept' }],
    ['empty ids', { ids: [], stashState: 'kept' }],
    ['non-string id', { ids: [1], stashState: 'kept' }],
    ['empty-string id', { ids: [''], stashState: 'kept' }],
    ['too many ids', { ids: Array.from({ length: 501 }, (_, i) => `id-${i}`), stashState: 'kept' }],
    ['unknown state', { ids: ['a'], stashState: 'deleted' }],
    ['null state', { ids: ['a'], stashState: null }],
  ])('returns 400 for %s', async (_label, body) => {
    await signedIn()
    const { bulkSetStashState } = await import('@/lib/db/queries/links')
    const res = await bulk(body)
    expect(res.status).toBe(400)
    expect(bulkSetStashState).not.toHaveBeenCalled()
  })

  it('returns 400 for a body that is not JSON', async () => {
    await signedIn()
    const res = await bulk('{bad')
    expect(res.status).toBe(400)
  })
})
