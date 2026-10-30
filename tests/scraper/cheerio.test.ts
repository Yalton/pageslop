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

  it('falls back to the first article paragraph when the page has no meta description', async () => {
    // Trimmed from a Wikipedia article: skip link, tagline, hatnote, empty paragraph, citation
    const html = `<html><head><title>Bauhaus - Wikipedia</title></head><body>
      <a class="mw-jump-link" href="#bodyContent">Jump to content</a>
      <nav><ul><li>Main page</li></ul></nav>
      <main id="content">
        <h1>Bauhaus</h1>
        <div id="siteSub">From Wikipedia, the free encyclopedia</div>
        <div class="hatnote">For other uses, see Bauhaus (disambiguation).</div>
        <p class="mw-empty-elt"></p>
        <p>The <b>Staatliches Bauhaus</b>, commonly known as the Bauhaus, was a German art school operational from 1919 to 1933 that combined crafts and the fine arts.<sup class="reference">[1]</sup> The school became famous for its approach to design.</p>
      </main></body></html>`
    vi.mocked(fetch).mockResolvedValueOnce(new Response(html))

    const result = await scrapeUrl('https://en.wikipedia.org/wiki/Bauhaus')
    expect(result.description).toMatch(/^The Staatliches Bauhaus, commonly known as the Bauhaus/)
    expect(result.description).not.toContain('[1]')
    expect(result.description).not.toContain('Jump to content')
  })

  it('leaves the description empty when the page has no meta description or real paragraph', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('<html><body><p>Hi</p><div>Some loose text that is not a paragraph at all here</div></body></html>'))
    const result = await scrapeUrl('https://example.com')
    expect(result.description).toBe('')
  })

  it('caps the scraped title at 500 and the description at 2000 characters', async () => {
    const html = `<html><head><title>${'t'.repeat(5000)}</title>
      <meta name="description" content="${'d'.repeat(50000)}" /></head><body></body></html>`
    vi.mocked(fetch).mockResolvedValueOnce(new Response(html))

    const result = await scrapeUrl('https://example.com')
    expect(result.title).toHaveLength(500)
    expect(result.title.endsWith('…')).toBe(true)
    expect(result.description).toHaveLength(2000)
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

  it('separates adjacent element text with whitespace', async () => {
    const html = `
      <html><head><title>Page</title></head>
        <body><div><a href="/a">About</a><a href="/p">Press</a><a href="/c">Copyright</a><a href="/x">Contact</a></div><p>One</p>Loose<p>Two</p></body>
      </html>
    `
    vi.mocked(fetch).mockResolvedValueOnce(new Response(html))

    const result = await scrapeUrl('https://example.com')
    expect(result.bodyText).toBe('About Press Copyright Contact One Loose Two')
  })

  it('drops noscript, svg, iframe, template content and collapses whitespace', async () => {
    const html = `
      <html><head><title>Page</title></head>
        <body>
          <noscript>Please enable JavaScript</noscript>
          <svg><style>.a{fill:#221f1f}</style><text>svgtext</text></svg>
          <iframe src="https://x.test">iframe fallback</iframe>
          <template><p>templated</p></template>
          <main>
            <h1>Real</h1>
            <p>Content   here</p>
          </main>
        </body>
      </html>
    `
    vi.mocked(fetch).mockResolvedValueOnce(new Response(html))

    const result = await scrapeUrl('https://example.com')
    expect(result.bodyText).toBe('Real Content here')
  })

  it('drops form picker options such as country lists', async () => {
    const html = `
      <html><body>
        <main><p>Sign in</p>
          <select><option>Netherlands (+31)</option><option>French Guiana (+594)</option></select>
          <datalist id="c"><option value="Territory"></option></datalist>
        </main>
      </body></html>
    `
    vi.mocked(fetch).mockResolvedValueOnce(new Response(html))

    const result = await scrapeUrl('https://example.com')
    expect(result.bodyText).toBe('Sign in')
  })

  it('caps body text at 5000 chars', async () => {
    const html = `<html><body>${'<p>word</p>'.repeat(3000)}</body></html>`
    vi.mocked(fetch).mockResolvedValueOnce(new Response(html))

    const result = await scrapeUrl('https://example.com')
    expect(result.bodyText!.length).toBeLessThanOrEqual(5000)
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

describe('scrapeUrl body limits', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it.each(['application/pdf', 'image/png', 'application/octet-stream', 'video/mp4', 'application/json'])(
    'skips parsing a %s response and returns empty metadata',
    async (type) => {
      const body = new ReadableStream({ pull: (c) => c.enqueue(new Uint8Array(1024)) }) // endless
      vi.mocked(fetch).mockResolvedValueOnce(new Response(body, { headers: { 'content-type': type } }))

      const result = await scrapeUrl('https://example.com/file')
      expect(result).toEqual({ title: '', description: '', ogImage: null, favicon: null, bodyText: null, rawHtml: '' })
    },
  )

  it.each(['text/html; charset=utf-8', 'application/xhtml+xml', 'text/plain'])('parses a %s response', async (type) => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('<html><head><title>T</title></head><body>x</body></html>', { headers: { 'content-type': type } }),
    )
    expect((await scrapeUrl('https://example.com')).title).toBe('T')
  })

  it('reads at most MAX_HTML_BYTES of an oversized page and still extracts <head> metadata', async () => {
    const { MAX_HTML_BYTES } = await import('@/lib/scraper/cheerio')
    const head = new TextEncoder().encode('<html><head><title>Big</title></head><body>')
    const filler = new Uint8Array(64 * 1024).fill(97)
    let sentHead = false
    let pulled = 0
    const body = new ReadableStream<Uint8Array>({
      pull(c) {
        if (!sentHead) {
          sentHead = true
          c.enqueue(head)
        } else {
          pulled++
          c.enqueue(filler) // never closes
        }
      },
    })
    vi.mocked(fetch).mockResolvedValueOnce(new Response(body, { headers: { 'content-type': 'text/html' } }))

    const result = await scrapeUrl('https://example.com')
    expect(result.title).toBe('Big')
    expect(result.rawHtml.length).toBe(MAX_HTML_BYTES)
    expect(pulled).toBeLessThan(MAX_HTML_BYTES / filler.byteLength + 4)
  })
})

