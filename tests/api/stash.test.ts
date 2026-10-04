import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
// Load the routes up front, outside any test's timeout. vi.mock is hoisted,
// so they still get the mocks, and the tests' dynamic imports hit the cache.
import '@/app/api/stash/route'

vi.mock('@/lib/auth/api-token', () => ({
  authenticateBearer: vi.fn(),
}))

vi.mock('@/lib/db/queries/links', () => ({
  stashTabs: vi.fn(),
}))

vi.mock('@/lib/queue/boss', () => ({
  enqueueScrapeJob: vi.fn(),
}))

const NOW = new Date('2026-10-03T12:00:00.000Z')

function stashReq(body: unknown, token: string | null = 'ps_valid') {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (token) headers.authorization = `Bearer ${token}`
  return new Request('http://localhost/api/stash', {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

async function setup(userId: string | null = 'user-1') {
  const { authenticateBearer } = await import('@/lib/auth/api-token')
  const { stashTabs } = await import('@/lib/db/queries/links')
  const { enqueueScrapeJob } = await import('@/lib/queue/boss')
  vi.mocked(authenticateBearer).mockResolvedValue(userId ? { userId } : null)
  // Default: echo every URL back, insert nothing
  vi.mocked(stashTabs).mockImplementation(async (_userId, tabs) => ({
    saved: tabs.map((t) => t.url),
    inserted: [],
  }))
  vi.mocked(enqueueScrapeJob).mockResolvedValue(undefined)
  const { POST } = await import('@/app/api/stash/route')
  return { POST, authenticateBearer, stashTabs, enqueueScrapeJob }
}

describe('POST /api/stash', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('auth', () => {
    it('returns 401 when the Authorization header is missing', async () => {
      const { POST, stashTabs } = await setup(null)
      const res = await POST(stashReq({ tabs: [] }, null))
      expect(res.status).toBe(401)
      expect(stashTabs).not.toHaveBeenCalled()
    })

    it('returns 401 for an unknown token', async () => {
      const { POST, stashTabs } = await setup(null)
      const res = await POST(stashReq({ tabs: [{ url: 'https://example.com' }] }, 'ps_unknown'))
      expect(res.status).toBe(401)
      expect(stashTabs).not.toHaveBeenCalled()
    })

    it('returns 401 for a revoked token', async () => {
      // A revoked token's row is deleted, so authenticateBearer finds nothing
      const { POST, stashTabs } = await setup(null)
      const res = await POST(stashReq({ tabs: [{ url: 'https://example.com' }] }, 'ps_revoked'))
      expect(res.status).toBe(401)
      expect(stashTabs).not.toHaveBeenCalled()
    })

    it('checks auth before parsing the body', async () => {
      const { POST } = await setup(null)
      const res = await POST(stashReq('not json', null))
      expect(res.status).toBe(401)
    })

    it("uses only the token's user, so one user's token cannot touch another user's links", async () => {
      const { POST, stashTabs } = await setup('user-2')
      const res = await POST(
        stashReq({ userId: 'user-1', tabs: [{ url: 'https://example.com' }] }, 'ps_user2'),
      )
      expect(res.status).toBe(200)
      expect(stashTabs).toHaveBeenCalledTimes(1)
      expect(vi.mocked(stashTabs).mock.calls[0][0]).toBe('user-2')
    })
  })

  describe('body validation', () => {
    it('returns 400 for a body that is not JSON', async () => {
      const { POST } = await setup()
      const res = await POST(stashReq('{nope'))
      expect(res.status).toBe(400)
    })

    it('returns 400 when tabs is missing', async () => {
      const { POST } = await setup()
      const res = await POST(stashReq({}))
      expect(res.status).toBe(400)
    })

    it('returns 400 when a url is not a string', async () => {
      const { POST, stashTabs } = await setup()
      const res = await POST(stashReq({ tabs: [{ url: 42 }] }))
      expect(res.status).toBe(400)
      expect(stashTabs).not.toHaveBeenCalled()
    })

    it('returns 400 for more than 100 tabs', async () => {
      const { POST, stashTabs } = await setup()
      const tabs = Array.from({ length: 101 }, (_, i) => ({ url: `https://example.com/${i}` }))
      const res = await POST(stashReq({ tabs }))
      expect(res.status).toBe(400)
      expect(stashTabs).not.toHaveBeenCalled()
    })

    it('accepts exactly 100 tabs', async () => {
      const { POST } = await setup()
      const tabs = Array.from({ length: 100 }, (_, i) => ({ url: `https://example.com/${i}` }))
      const res = await POST(stashReq({ tabs }))
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.saved).toHaveLength(100)
    })

    it('returns empty saved and rejected for an empty batch without calling stashTabs', async () => {
      const { POST, stashTabs } = await setup()
      const res = await POST(stashReq({ tabs: [] }))
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ saved: [], rejected: [] })
      expect(stashTabs).not.toHaveBeenCalled()
    })
  })

  describe('URL handling', () => {
    it('rejects non-http URLs and unparseable strings, and saves the rest', async () => {
      const { POST, stashTabs } = await setup()
      const res = await POST(
        stashReq({
          tabs: [
            { url: 'ftp://files.example.com/a' },
            { url: 'not a url' },
            { url: 'javascript:alert(1)' },
            { url: 'about:blank' },
            { url: 'https://ok.example.com/' },
          ],
        }),
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.saved).toEqual(['https://ok.example.com/'])
      expect(json.rejected).toEqual([
        { url: 'ftp://files.example.com/a', reason: 'unsupported_protocol' },
        { url: 'not a url', reason: 'invalid_url' },
        { url: 'javascript:alert(1)', reason: 'unsupported_protocol' },
        { url: 'about:blank', reason: 'unsupported_protocol' },
      ])
      const passedTabs = vi.mocked(stashTabs).mock.calls[0][1]
      expect(passedTabs.map((t) => t.url)).toEqual(['https://ok.example.com/'])
    })

    it('rejects a URL longer than 2048 characters', async () => {
      const { POST, stashTabs } = await setup()
      const long = 'https://a.com/' + 'x'.repeat(2049 - 'https://a.com/'.length)
      const exact = 'https://b.com/' + 'y'.repeat(2048 - 'https://b.com/'.length)
      const res = await POST(stashReq({ tabs: [{ url: long }, { url: exact }] }))
      const json = await res.json()
      expect(json.saved).toEqual([exact])
      expect(json.rejected).toEqual([{ url: long, reason: 'url_too_long' }])
      expect(vi.mocked(stashTabs).mock.calls[0][1].map((t) => t.url)).toEqual([exact])
    })

    it('truncates a title to 500 characters', async () => {
      const { POST, stashTabs } = await setup()
      await POST(stashReq({ tabs: [{ url: 'https://a.com/', title: 't'.repeat(600) }] }))
      expect(vi.mocked(stashTabs).mock.calls[0][1][0].title).toBe('t'.repeat(500))
    })

    it('does not call stashTabs when every URL is rejected', async () => {
      const { POST, stashTabs } = await setup()
      const res = await POST(stashReq({ tabs: [{ url: 'file:///etc/passwd' }] }))
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({
        saved: [],
        rejected: [{ url: 'file:///etc/passwd', reason: 'unsupported_protocol' }],
      })
      expect(stashTabs).not.toHaveBeenCalled()
    })

    // Review Focus #1
    it('echoes a trailing-slash URL and a #fragment URL byte-for-byte', async () => {
      const { POST, stashTabs } = await setup()
      const urls = ['https://example.com/path/', 'https://example.com/a#frag']
      const res = await POST(stashReq({ tabs: urls.map((url) => ({ url })) }))
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.saved).toEqual(urls)
      // The route must pass the raw strings through, not new URL(u).href
      const passedTabs = vi.mocked(stashTabs).mock.calls[0][1]
      expect(passedTabs.map((t) => t.url)).toEqual(urls)
    })

    it('does not trim or normalise URL strings', async () => {
      const { POST, stashTabs } = await setup()
      const url = 'HTTPS://Example.COM/Mixed?q=1&b=2'
      const res = await POST(stashReq({ tabs: [{ url }] }))
      const json = await res.json()
      expect(json.saved).toEqual([url])
      expect(vi.mocked(stashTabs).mock.calls[0][1][0].url).toBe(url)
    })

    // Review Focus #2 (route level; the query-level dedupe is tested in Task 3)
    it('passes a duplicate URL within one batch through without error and enqueues one scrape', async () => {
      const { POST, stashTabs, enqueueScrapeJob } = await setup()
      vi.mocked(stashTabs).mockImplementation(async (_userId, tabs) => {
        const saved = [...new Set(tabs.map((t) => t.url))]
        return { saved, inserted: [{ id: 'link-1', url: saved[0] }] }
      })
      const url = 'https://dup.example.com/page'
      const res = await POST(
        stashReq({
          tabs: [
            { url, title: 'First', closedAt: '2026-10-03T10:00:00.000Z' },
            { url, title: 'Second', closedAt: '2026-10-03T11:00:00.000Z' },
          ],
        }),
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.saved).toContain(url)
      expect(json.rejected).toEqual([])
      expect(enqueueScrapeJob).toHaveBeenCalledTimes(1)
      expect(enqueueScrapeJob).toHaveBeenCalledWith('link-1', url)
    })
  })

  describe('saving and scraping', () => {
    it('saves tabs with title and closedAt, and enqueues a scrape for each inserted link only', async () => {
      const { POST, stashTabs, enqueueScrapeJob } = await setup()
      vi.mocked(stashTabs).mockResolvedValue({
        saved: ['https://new.example.com/', 'https://old.example.com/'],
        inserted: [{ id: 'link-new', url: 'https://new.example.com/' }],
      })
      const res = await POST(
        stashReq({
          tabs: [
            { url: 'https://new.example.com/', title: 'New', closedAt: '2026-10-02T08:30:00.000Z' },
            { url: 'https://old.example.com/', title: 'Old', closedAt: '2026-10-02T09:00:00.000Z' },
          ],
        }),
      )
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({
        saved: ['https://new.example.com/', 'https://old.example.com/'],
        rejected: [],
      })
      expect(stashTabs).toHaveBeenCalledWith('user-1', [
        { url: 'https://new.example.com/', title: 'New', closedAt: new Date('2026-10-02T08:30:00.000Z') },
        { url: 'https://old.example.com/', title: 'Old', closedAt: new Date('2026-10-02T09:00:00.000Z') },
      ])
      expect(enqueueScrapeJob).toHaveBeenCalledTimes(1)
      expect(enqueueScrapeJob).toHaveBeenCalledWith('link-new', 'https://new.example.com/')
    })

    it('treats a null title as absent', async () => {
      const { POST, stashTabs } = await setup()
      await POST(stashReq({ tabs: [{ url: 'https://example.com/', title: null }] }))
      const tab = vi.mocked(stashTabs).mock.calls[0][1][0]
      expect(tab.title).toBeUndefined()
    })

    it('still returns 200 with saved URLs when enqueueing a scrape fails', async () => {
      const { POST, stashTabs, enqueueScrapeJob } = await setup()
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      vi.mocked(stashTabs).mockResolvedValue({
        saved: ['https://example.com/'],
        inserted: [{ id: 'link-1', url: 'https://example.com/' }],
      })
      vi.mocked(enqueueScrapeJob).mockRejectedValue(new Error('queue down'))
      const res = await POST(stashReq({ tabs: [{ url: 'https://example.com/' }] }))
      expect(res.status).toBe(200)
      expect((await res.json()).saved).toEqual(['https://example.com/'])
      expect(errSpy).toHaveBeenCalled()
      errSpy.mockRestore()
    })

    it('returns 500 and no saved list when stashTabs throws', async () => {
      const { POST, stashTabs } = await setup()
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      vi.mocked(stashTabs).mockRejectedValue(new Error('db down'))
      const res = await POST(stashReq({ tabs: [{ url: 'https://example.com/' }] }))
      expect(res.status).toBe(500)
      const json = await res.json()
      expect(json.saved).toBeUndefined()
      errSpy.mockRestore()
    })
  })

  // Review Focus #5
  describe('closedAt fallback', () => {
    async function closedAtFor(closedAt: unknown) {
      const { POST, stashTabs } = await setup()
      const tab: Record<string, unknown> = { url: 'https://example.com/' }
      if (closedAt !== undefined) tab.closedAt = closedAt
      const res = await POST(stashReq({ tabs: [tab] }))
      expect(res.status).toBe(200)
      return vi.mocked(stashTabs).mock.calls[0][1][0].closedAt
    }

    it('uses a valid ISO closedAt', async () => {
      expect(await closedAtFor('2026-10-01T00:00:00.000Z')).toEqual(new Date('2026-10-01T00:00:00.000Z'))
    })

    it('falls back to server now when closedAt is missing', async () => {
      expect(await closedAtFor(undefined)).toEqual(NOW)
    })

    it('falls back to server now when closedAt is an unparseable string', async () => {
      expect(await closedAtFor('yesterday-ish')).toEqual(NOW)
    })

    it('falls back to server now when closedAt is not a string', async () => {
      expect(await closedAtFor(1727000000000)).toEqual(NOW)
      vi.clearAllMocks()
      expect(await closedAtFor(null)).toEqual(NOW)
      vi.clearAllMocks()
      expect(await closedAtFor({ when: 'now' })).toEqual(NOW)
    })

    it('clamps a closedAt in the future to server now', async () => {
      expect(await closedAtFor('2030-01-01T00:00:00.000Z')).toEqual(NOW)
    })
  })
})
