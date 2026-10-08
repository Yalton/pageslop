import { beforeEach, describe, expect, it, vi } from 'vitest'

const getSession = vi.fn()
const limit = vi.fn()
const readFile = vi.fn()

vi.mock('@/lib/auth/server', () => ({ auth: { api: { getSession } } }))
vi.mock('next/headers', () => ({ headers: () => new Headers() }))
vi.mock('@/lib/db/client', () => ({
  db: { select: () => ({ from: () => ({ where: () => ({ limit }) }) }) },
}))
vi.mock('node:fs/promises', () => ({ readFile }))

const id = '12345678-1234-1234-1234-123456789abc'
const params = { params: Promise.resolve({ id }) }

describe('GET /api/screenshots/[id]', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('denies a request without a valid session before reading a file', async () => {
    getSession.mockResolvedValue(null)
    const { GET } = await import('@/app/api/screenshots/[id]/route')
    const response = await GET({} as never, params)
    expect(response.status).toBe(401)
    expect(limit).not.toHaveBeenCalled()
    expect(readFile).not.toHaveBeenCalled()
  })

  it('hides another user’s screenshot', async () => {
    getSession.mockResolvedValue({ user: { id: 'other-user' } })
    limit.mockResolvedValue([])
    const { GET } = await import('@/app/api/screenshots/[id]/route')
    const response = await GET({} as never, params)
    expect(response.status).toBe(404)
    expect(readFile).not.toHaveBeenCalled()
  })

  it('serves an owned screenshot without shared caching', async () => {
    getSession.mockResolvedValue({ user: { id: 'owner' } })
    limit.mockResolvedValue([{ id }])
    readFile.mockResolvedValue(Buffer.from('webp'))
    const { GET } = await import('@/app/api/screenshots/[id]/route')
    const response = await GET({} as never, params)
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(await response.text()).toBe('webp')
  })
})
