import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@/app/api/settings/account/route'

vi.mock('@/lib/auth/server', () => ({
  auth: { api: { getSession: vi.fn(), verifyPassword: vi.fn() } },
}))
vi.mock('next/headers', () => ({ headers: vi.fn(() => new Headers()) }))
vi.mock('@/lib/db/queries/users', () => ({ deleteUserAccount: vi.fn() }))
vi.mock('@/lib/scraper/screenshot-files', () => ({ removeScreenshots: vi.fn() }))

const mockSession = { user: { id: 'user-1', email: 'test@example.com' }, session: {} as never }

function del(body: unknown) {
  return new Request('http://localhost/api/settings/account', { method: 'DELETE', body: JSON.stringify(body) })
}

describe('DELETE /api/settings/account', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 without a session', async () => {
    const { auth } = await import('@/lib/auth/server')
    vi.mocked(auth.api.getSession).mockResolvedValueOnce(null)
    const { DELETE } = await import('@/app/api/settings/account/route')
    expect((await DELETE(del({ confirm: 'DELETE', password: 'pw' }))).status).toBe(401)
  })

  it('requires the password', async () => {
    const { auth } = await import('@/lib/auth/server')
    const { deleteUserAccount } = await import('@/lib/db/queries/users')
    vi.mocked(auth.api.getSession).mockResolvedValueOnce(mockSession as never)
    const { DELETE } = await import('@/app/api/settings/account/route')
    const res = await DELETE(del({ confirm: 'DELETE' }))
    expect(res.status).toBe(400)
    expect(deleteUserAccount).not.toHaveBeenCalled()
  })

  it('refuses a wrong password and deletes nothing', async () => {
    const { auth } = await import('@/lib/auth/server')
    const { deleteUserAccount } = await import('@/lib/db/queries/users')
    vi.mocked(auth.api.getSession).mockResolvedValueOnce(mockSession as never)
    vi.mocked(auth.api.verifyPassword).mockRejectedValueOnce(new Error('INVALID_PASSWORD'))
    const { DELETE } = await import('@/app/api/settings/account/route')
    const res = await DELETE(del({ confirm: 'DELETE', password: 'wrong' }))
    expect(res.status).toBe(403)
    expect(deleteUserAccount).not.toHaveBeenCalled()
  })

  it('deletes the account and its screenshots with the right password', async () => {
    const { auth } = await import('@/lib/auth/server')
    const { deleteUserAccount } = await import('@/lib/db/queries/users')
    const { removeScreenshots } = await import('@/lib/scraper/screenshot-files')
    vi.mocked(auth.api.getSession).mockResolvedValueOnce(mockSession as never)
    vi.mocked(auth.api.verifyPassword).mockResolvedValueOnce({ status: true } as never)
    vi.mocked(deleteUserAccount).mockResolvedValueOnce(['link-1', 'link-2'])
    const { DELETE } = await import('@/app/api/settings/account/route')
    const res = await DELETE(del({ confirm: 'DELETE', password: 'right' }))
    expect(res.status).toBe(200)
    expect(auth.api.verifyPassword).toHaveBeenCalledWith(expect.objectContaining({ body: { password: 'right' } }))
    expect(deleteUserAccount).toHaveBeenCalledWith('user-1')
    expect(removeScreenshots).toHaveBeenCalledWith(['link-1', 'link-2'])
  })
})
