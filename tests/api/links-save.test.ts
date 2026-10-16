import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/queries/links', () => ({
  insertLink: vi.fn(),
  findDuplicate: vi.fn(),
  listLinksWithTags: vi.fn(),
}))
vi.mock('@/lib/queue/boss', () => ({ enqueueScrapeJob: vi.fn() }))
vi.mock('@/lib/auth/server', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))

import { POST } from '@/app/api/links/route'
import { insertLink, findDuplicate } from '@/lib/db/queries/links'
import { enqueueScrapeJob } from '@/lib/queue/boss'
import { auth } from '@/lib/auth/server'

function post(body: unknown) {
  return POST(new Request('http://localhost/api/links', { method: 'POST', body: JSON.stringify(body) }))
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: 'user-1' } } as never)
  vi.mocked(insertLink).mockImplementation(async (_u, url) => ({ id: `id-${url}`, url }) as never)
})

describe('POST /api/links duplicates', () => {
  it('returns the existing link flagged duplicate and does not insert', async () => {
    vi.mocked(findDuplicate).mockResolvedValue({ id: 'old-1', url: 'https://a.com/' } as never)
    const res = await post({ urls: 'https://a.com' })
    const { saved } = await res.json()
    expect(insertLink).not.toHaveBeenCalled()
    expect(enqueueScrapeJob).not.toHaveBeenCalled()
    expect(saved).toEqual([{ id: 'old-1', url: 'https://a.com/', duplicate: true }])
  })

  it('ignores force, so an already saved URL is never saved twice', async () => {
    vi.mocked(findDuplicate).mockResolvedValue({ id: 'old-1', url: 'https://a.com/' } as never)
    await post({ urls: 'https://a.com/', force: true })
    expect(findDuplicate).toHaveBeenCalled()
    expect(insertLink).not.toHaveBeenCalled()
  })

  it('saves a URL pasted twice in one batch only once', async () => {
    vi.mocked(findDuplicate).mockResolvedValue(null as never)
    const res = await post({ urls: 'https://a.com\nhttps://a.com/\nhttps://b.com/' })
    const { saved } = await res.json()
    expect(insertLink).toHaveBeenCalledTimes(2)
    expect(saved.map((s: { url: string }) => s.url)).toEqual(['https://a.com/', 'https://b.com/'])
  })
})
