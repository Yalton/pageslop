import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { checkUrl } from '@/lib/monitor/check-url'

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
      'http://example.com',
      expect.objectContaining({ method: 'HEAD' })
    )
  })

  it('returns { statusCode: 200, up: true } for a 301->200 redirect', async () => {
    // fetch follows redirects automatically, final response is 200
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(null, { status: 200 })
    )
    const result = await checkUrl('http://example.com')
    expect(result).toEqual({ statusCode: 200, up: true })
  })

  it('returns { statusCode: 404, up: false } for a 404 HEAD response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(null, { status: 404 })
    )
    const result = await checkUrl('http://example.com')
    expect(result).toEqual({ statusCode: 404, up: false })
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
      'http://example.com',
      expect.objectContaining({ method: 'HEAD' })
    )
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      'http://example.com',
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
})
