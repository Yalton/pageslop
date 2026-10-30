import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const getSession = vi.fn()
const limit = vi.fn()
const readFile = vi.fn()

vi.mock('@/lib/auth/server', () => ({ auth: { api: { getSession } } }))
vi.mock('next/headers', () => ({ headers: () => new Headers() }))
vi.mock('@/lib/db/client', () => ({
  db: { select: () => ({ from: () => ({ where: () => ({ limit }) }) }) },
}))
vi.mock('node:fs/promises', () => ({ readFile, rm: vi.fn() }))

const id = '12345678-1234-1234-1234-123456789abc'
let GET: typeof import('@/app/api/images/[id]/[kind]/route').GET
const params = (kind: string) => ({ params: Promise.resolve({ id, kind }) })

describe('GET /api/images/[id]/[kind]', () => {
  // The cold import pulls next/server, drizzle-orm and the schema; do it once
  beforeAll(async () => {
    ;({ GET } = await import('@/app/api/images/[id]/[kind]/route'))
  }, 30_000)

  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('rejects an unknown image kind before checking the session', async () => {
    const response = await GET({} as never, params('../../etc/passwd'))
    expect(response.status).toBe(400)
    expect(getSession).not.toHaveBeenCalled()
  })

  it('denies a request without a valid session before reading a file', async () => {
    getSession.mockResolvedValue(null)
    const response = await GET({} as never, params('og'))
    expect(response.status).toBe(401)
    expect(readFile).not.toHaveBeenCalled()
  })

  it('hides another user’s image', async () => {
    getSession.mockResolvedValue({ user: { id: 'other-user' } })
    limit.mockResolvedValue([])
    const response = await GET({} as never, params('favicon'))
    expect(response.status).toBe(404)
    expect(readFile).not.toHaveBeenCalled()
  })

  it('serves an owned image as private WebP', async () => {
    getSession.mockResolvedValue({ user: { id: 'owner' } })
    limit.mockResolvedValue([{ id }])
    readFile.mockResolvedValue(Buffer.from('webp'))
    const response = await GET({} as never, params('og'))
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('image/webp')
    expect(response.headers.get('Cache-Control')).toBe('private, max-age=3600')
    expect(readFile.mock.calls[0][0]).toMatch(new RegExp(`${id}-og\\.webp$`))
  })
})
