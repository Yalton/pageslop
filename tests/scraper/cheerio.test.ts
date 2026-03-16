import { describe, it, expect, vi, beforeEach } from 'vitest'
import { scrapeUrl } from '@/lib/scraper/cheerio'

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
    vi.mocked(fetch).mockResolvedValueOnce({
      text: async () => html,
    } as Response)

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
    vi.mocked(fetch).mockResolvedValueOnce({
      text: async () => html,
    } as Response)

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
    vi.mocked(fetch).mockResolvedValueOnce({
      text: async () => html,
    } as Response)

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
    vi.mocked(fetch).mockResolvedValueOnce({
      text: async () => html,
    } as Response)

    const result = await scrapeUrl('https://example.com')
    expect(result.bodyText).toContain('Hello world')
  })

  it('handles timeout', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new DOMException('The operation was aborted', 'AbortError'))

    await expect(scrapeUrl('https://example.com')).rejects.toThrow()
  })
})
