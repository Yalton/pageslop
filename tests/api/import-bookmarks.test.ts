import { describe, it, expect, vi, beforeEach } from 'vitest'
// Load the routes up front, outside any test's timeout. vi.mock is hoisted,
// so they still get the mocks, and the tests' dynamic imports hit the cache.
import '@/app/api/import/bookmarks/route'

vi.mock('@/lib/db/client', () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([{ id: 'job-1' }])),
      })),
    })),
  },
}))

vi.mock('@/lib/db/queries/links', () => ({
  insertLink: vi.fn(),
  findDuplicate: vi.fn(),
}))

vi.mock('@/lib/queue/boss', () => ({
  enqueueScrapeJob: vi.fn(),
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

const BOOKMARKS_HTML = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><A HREF="https://example.com" ADD_DATE="1704067200">Example Site</A>
    <DT><A HREF="https://github.com/user/repo" ADD_DATE="1704153600">GitHub Repo</A>
</DL><p>`

function uploadRequest(html: string): Request {
  const form = new FormData()
  form.append('file', new File([html], 'bookmarks.html', { type: 'text/html' }))
  return new Request('http://localhost/api/import/bookmarks', { method: 'POST', body: form })
}

describe('POST /api/import/bookmarks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("inserts new bookmarks with source 'import'", async () => {
    const { auth } = await import('@/lib/auth/server')
    const { insertLink, findDuplicate } = await import('@/lib/db/queries/links')
    const { enqueueScrapeJob } = await import('@/lib/queue/boss')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(auth.api.getSession).mockResolvedValueOnce({ user: { id: 'user-1' }, session: {} } as any)
    vi.mocked(findDuplicate).mockResolvedValue(null as never)
    vi.mocked(insertLink).mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (_userId: string, url: string) => ({ id: `link-${url}`, url }) as any
    )

    const { POST } = await import('@/app/api/import/bookmarks/route')
    const res = await POST(uploadRequest(BOOKMARKS_HTML))

    expect(res.status).toBe(202)
    expect(insertLink).toHaveBeenCalledTimes(2)
    expect(insertLink).toHaveBeenCalledWith('user-1', 'https://example.com', { source: 'import' })
    expect(insertLink).toHaveBeenCalledWith('user-1', 'https://github.com/user/repo', { source: 'import' })
    expect(enqueueScrapeJob).toHaveBeenCalledTimes(2)
  })

  it('rejects a file over 10 MB with 413 before parsing it', async () => {
    const { auth } = await import('@/lib/auth/server')
    const { insertLink } = await import('@/lib/db/queries/links')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(auth.api.getSession).mockResolvedValueOnce({ user: { id: 'user-1' }, session: {} } as any)

    const { POST } = await import('@/app/api/import/bookmarks/route')
    const res = await POST(uploadRequest('x'.repeat(10 * 1024 * 1024 + 1)))

    expect(res.status).toBe(413)
    expect((await res.json()).error).toMatch(/too large/i)
    expect(insertLink).not.toHaveBeenCalled()
  })

  it('rejects an oversized chunked upload with no Content-Length', async () => {
    const { auth } = await import('@/lib/auth/server')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(auth.api.getSession).mockResolvedValueOnce({ user: { id: 'user-1' }, session: {} } as any)

    const chunk = new Uint8Array(1024 * 1024).fill(120)
    let sent = 0
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (sent++ < 12) controller.enqueue(chunk)
        else controller.close()
      },
    })
    const req = new Request('http://localhost/api/import/bookmarks', {
      method: 'POST',
      headers: { 'content-type': 'multipart/form-data; boundary=x' },
      body,
      // @ts-expect-error -- Node's fetch needs duplex for a streamed body
      duplex: 'half',
    })

    const { POST } = await import('@/app/api/import/bookmarks/route')
    const res = await POST(req)
    expect(res.status).toBe(413)
  })

  it('rejects more than 10000 bookmarks with 400 and saves none', async () => {
    const { auth } = await import('@/lib/auth/server')
    const { insertLink } = await import('@/lib/db/queries/links')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(auth.api.getSession).mockResolvedValueOnce({ user: { id: 'user-1' }, session: {} } as any)

    const entries = Array.from({ length: 10_001 }, (_, i) => `<DT><A HREF="https://e.com/${i}">${i}</A>`).join('\n')
    const { POST } = await import('@/app/api/import/bookmarks/route')
    const res = await POST(uploadRequest(`<DL><p>\n${entries}\n</DL><p>`))

    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/at most 10000/)
    expect(insertLink).not.toHaveBeenCalled()
  })
})
