import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { configureSafeFetch } from '@/lib/net/ssrf-guard'
import { checkUrl } from '@/lib/monitor/check-url'

// Route safeFetch through the stubbed global fetch and a fake public resolver
let restoreSafeFetch: () => void
beforeEach(() => {
  restoreSafeFetch = configureSafeFetch({
    fetch: (url, init) => fetch(url, init as RequestInit),
    resolve: async () => [{ address: '93.184.215.14', family: 4 }],
  })
})
afterEach(() => restoreSafeFetch())

describe('checkUrl()', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns { statusCode: 200, up: true } for a 200 HEAD response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(null, { status: 200 })
    )
    const result = await checkUrl('http://example.com')
    expect(result).toEqual({ statusCode: 200, up: true })
    expect(fetch).toHaveBeenCalledWith(
      'http://example.com/',
      expect.objectContaining({ method: 'HEAD' })
    )
  })

  it('returns { statusCode: 200, up: true } for a 301->200 redirect', async () => {
    // safeFetch follows (and vets) redirects itself
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(null, { status: 301, headers: { location: 'https://example.com/' } }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
    const result = await checkUrl('http://example.com')
    expect(result).toEqual({ statusCode: 200, up: true })
  })

  it('falls back to GET when HEAD returns 404 (server may block HEAD), returns GET result', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))

    const result = await checkUrl('http://example.com')
    expect(result).toEqual({ statusCode: 200, up: true })
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      'http://example.com/',
      expect.objectContaining({ method: 'HEAD' })
    )
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      'http://example.com/',
      expect.objectContaining({ method: 'GET' })
    )
  })

  it('returns { statusCode: 404, up: false } when both HEAD and GET return 404 (true not-found)', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }))

    const result = await checkUrl('http://example.com')
    expect(result).toEqual({ statusCode: 404, up: false })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('returns { statusCode: 503, up: false } for a 503 HEAD response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(null, { status: 503 })
    )
    const result = await checkUrl('http://example.com')
    expect(result).toEqual({ statusCode: 503, up: false })
  })

  it('retries with GET when HEAD returns 405, returns GET result', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(null, { status: 405 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))

    const result = await checkUrl('http://example.com')
    expect(result).toEqual({ statusCode: 200, up: true })
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      'http://example.com/',
      expect.objectContaining({ method: 'HEAD' })
    )
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      'http://example.com/',
      expect.objectContaining({ method: 'GET' })
    )
  })

  it('returns { statusCode: null, up: false } on AbortError (timeout)', async () => {
    const abortError = new DOMException('The operation was aborted.', 'AbortError')
    vi.mocked(fetch).mockRejectedValueOnce(abortError)

    const result = await checkUrl('http://example.com')
    expect(result).toEqual({ statusCode: null, up: false })
  })

  it('returns { statusCode: null, up: false } on network error', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'))

    const result = await checkUrl('http://example.com')
    expect(result).toEqual({ statusCode: null, up: false })
  })

  it.each([
    'http://192.168.50.78:81',
    'http://127.0.0.1:3000',
    'http://[::1]/',
    'http://0x7f.1/',
  ])('reports internal URL %s as down without fetching', async (url) => {
    const result = await checkUrl(url)
    expect(result).toEqual({ statusCode: null, up: false })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('reports a public URL that 302s to 192.168.50.1 as down', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(null, { status: 302, headers: { location: 'http://192.168.50.1/' } })
    )
    const result = await checkUrl('http://example.com')
    expect(result).toEqual({ statusCode: null, up: false })
    // Never asked for the internal URL
    for (const call of vi.mocked(fetch).mock.calls) {
      expect(String(call[0])).toBe('http://example.com/')
    }
  })
})
