import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@/app/api/links/[id]/route'

vi.mock('@/lib/db/queries/links', () => ({
  deleteLink: vi.fn(),
  updateLinkFields: vi.fn(),
}))
vi.mock('@/lib/auth/server', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('next/headers', () => ({ headers: vi.fn(() => new Headers()) }))

function patch(body: unknown) {
  return new Request('http://localhost/api/links/link-1', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}
const ctx = { params: Promise.resolve({ id: 'link-1' }) }

describe('PATCH /api/links/[id] categorySource', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const { auth } = await import('@/lib/auth/server')
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: 'user-1' } } as never)
    const { updateLinkFields } = await import('@/lib/db/queries/links')
    vi.mocked(updateLinkFields).mockResolvedValue({ id: 'link-1' } as never)
  })

  it("marks the category as hand-picked ('user') when category changes", async () => {
    const { PATCH } = await import('@/app/api/links/[id]/route')
    const res = await PATCH(patch({ category: 'Entertainment' }), ctx)
    expect(res.status).toBe(200)
    const { updateLinkFields } = await import('@/lib/db/queries/links')
    expect(updateLinkFields).toHaveBeenCalledWith('user-1', 'link-1', {
      category: 'Entertainment',
      categorySource: 'user',
    })
  })

  it('does not touch categorySource when only the description changes', async () => {
    const { PATCH } = await import('@/app/api/links/[id]/route')
    await PATCH(patch({ description: 'hi' }), ctx)
    const { updateLinkFields } = await import('@/lib/db/queries/links')
    expect(updateLinkFields).toHaveBeenCalledWith('user-1', 'link-1', { description: 'hi' })
  })
})
