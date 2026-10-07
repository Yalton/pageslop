import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { configureSafeFetch, SsrfBlockedError } from '@/lib/net/ssrf-guard'
import { scrapeUrl } from '@/lib/scraper/cheerio'

// Route safeFetch through the stubbed global fetch and a fake public resolver
let restoreSafeFetch: () => void
beforeEach(() => {
  restoreSafeFetch = configureSafeFetch({
    fetch: (url, init) => fetch(url, init as RequestInit),
    resolve: async () => [{ address: '93.184.215.14', family: 4 }],
  })
})
afterEach(() => restoreSafeFetch())

describe('scrapeUrl', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('extracts OG data', async () => {
    const html = `
      <html>
        <head>
          <meta property="og:title" content="Test Title" />
          <meta property="og:description" content="A description" />
          <meta property="og:image" content="https://example.com/img.jpg" />
          <link rel="icon" href="https://example.com/favicon.ico" />
        </head>
        <body><p>Hello world</p></body>
      </html>
    `
    vi.mocked(fetch).mockResolvedValueOnce(new Response(html))

    const result = await scrapeUrl('https://example.com')
    expect(result.title).toBe('Test Title')
    expect(result.description).toBe('A description')
    expect(result.ogImage).toBe('https://example.com/img.jpg')
  })

  it('falls back to title tag', async () => {
    const html = `
      <html>
        <head>
          <title>Fallback Title</title>
        </head>
        <body><p>Content</p></body>
      </html>
    `
    vi.mocked(fetch).mockResolvedValueOnce(new Response(html))

    const result = await scrapeUrl('https://example.com')
    expect(result.title).toBe('Fallback Title')
    expect(result.ogImage).toBeNull()
  })

  it('resolves relative favicon', async () => {
    const html = `
      <html>
        <head>
          <title>Page</title>
          <link rel="icon" href="/favicon.ico" />
        </head>
        <body></body>
      </html>
    `
    vi.mocked(fetch).mockResolvedValueOnce(new Response(html))

    const result = await scrapeUrl('https://example.com/page')
    expect(result.favicon).toBe('https://example.com/favicon.ico')
  })

  it('extracts body text', async () => {
    const html = `
      <html>
        <head><title>Page</title></head>
        <body><p>Hello world</p></body>
      </html>
    `
    vi.mocked(fetch).mockResolvedValueOnce(new Response(html))

    const result = await scrapeUrl('https://example.com')
    expect(result.bodyText).toContain('Hello world')
  })

  it('handles timeout', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new DOMException('The operation was aborted', 'AbortError'))

    await expect(scrapeUrl('https://example.com')).rejects.toThrow()
  })

  it.each([
    'http://192.168.50.78:81/',
    'http://127.0.0.1:3000/',
    'http://[::1]/',
    'http://2130706433/',
    'file:///etc/passwd',
  ])('refuses internal URL %s without fetching', async (url) => {
    await expect(scrapeUrl(url)).rejects.toThrow(SsrfBlockedError)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('refuses a public URL that 302s to 192.168.50.1', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(null, { status: 302, headers: { location: 'http://192.168.50.1/' } })
    )
    await expect(scrapeUrl('https://example.com')).rejects.toThrow(SsrfBlockedError)
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
