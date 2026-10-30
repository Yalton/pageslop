import { describe, it, expect } from 'vitest'
import { parseNetscapeBookmarks } from '@/lib/utils/parse-bookmarks'

// Standard Chrome-exported Netscape HTML bookmark fixture
const CHROME_BOOKMARK_HTML = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and overwritten.
     DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3 ADD_DATE="1704067200" LAST_MODIFIED="1704067200" PERSONAL_TOOLBAR_FOLDER="true">Bookmarks bar</H3>
    <DL><p>
        <DT><A HREF="https://example.com" ADD_DATE="1704067200">Example Site</A>
        <DT><A HREF="https://github.com/user/repo" ADD_DATE="1704153600">GitHub Repo</A>
        <DT><A HREF="https://news.ycombinator.com" ADD_DATE="1704240000">Hacker News</A>
        <DT><A HREF="javascript:void(0)" ADD_DATE="1704326400">Invalid JS Link</A>
        <DT><A HREF="" ADD_DATE="1704326400">Empty Href</A>
        <DT><A HREF="https://no-title-site.com" ADD_DATE="1704412800"></A>
    </DL><p>
</DL><p>`

// Firefox-style bookmark export (slightly different nesting but same a[href] pattern)
const FIREFOX_BOOKMARK_HTML = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks Menu</H1>
<DL><p>
    <DT><H3>Mozilla Firefox</H3>
    <DL><p>
        <DT><A HREF="https://mozilla.org" ADD_DATE="1704067200">Mozilla</A>
        <DT><A HREF="https://support.mozilla.org/en-US/products/firefox" ADD_DATE="1704153600">Firefox Support</A>
    </DL><p>
</DL><p>`

describe('parseNetscapeBookmarks', () => {
  it('parses standard Chrome bookmark export — extracts URLs and titles', () => {
    const result = parseNetscapeBookmarks(CHROME_BOOKMARK_HTML)
    const urls = result.map((b) => b.url)

    expect(urls).toContain('https://example.com')
    expect(urls).toContain('https://github.com/user/repo')
    expect(urls).toContain('https://news.ycombinator.com')
  })

  it('extracts add_date attribute and converts Unix timestamp to Date', () => {
    const result = parseNetscapeBookmarks(CHROME_BOOKMARK_HTML)
    const example = result.find((b) => b.url === 'https://example.com')

    expect(example).toBeDefined()
    expect(example!.addedAt).toBeInstanceOf(Date)
    // 1704067200 * 1000 = Jan 1, 2024
    expect(example!.addedAt!.getTime()).toBe(1704067200 * 1000)
  })

  it('skips entries with invalid URLs — javascript:void(0)', () => {
    const result = parseNetscapeBookmarks(CHROME_BOOKMARK_HTML)
    const urls = result.map((b) => b.url)

    expect(urls).not.toContain('javascript:void(0)')
  })

  it('skips entries with empty href', () => {
    const result = parseNetscapeBookmarks(CHROME_BOOKMARK_HTML)
    const urls = result.map((b) => b.url)

    // Empty href would be filtered out
    expect(urls.every((u) => u.length > 0)).toBe(true)
  })

  it('uses link text as title', () => {
    const result = parseNetscapeBookmarks(CHROME_BOOKMARK_HTML)
    const hn = result.find((b) => b.url === 'https://news.ycombinator.com')

    expect(hn!.title).toBe('Hacker News')
  })

  it('falls back to URL as title when link text is empty', () => {
    const result = parseNetscapeBookmarks(CHROME_BOOKMARK_HTML)
    const noTitle = result.find((b) => b.url === 'https://no-title-site.com')

    expect(noTitle).toBeDefined()
    expect(noTitle!.title).toBe('https://no-title-site.com')
  })

  it('returns empty array for empty input', () => {
    const result = parseNetscapeBookmarks('')
    expect(result).toEqual([])
  })

  it('returns empty array for non-HTML input', () => {
    const result = parseNetscapeBookmarks('not html at all, just plain text')
    expect(result).toEqual([])
  })

  it('handles Firefox bookmark export format', () => {
    const result = parseNetscapeBookmarks(FIREFOX_BOOKMARK_HTML)
    const urls = result.map((b) => b.url)

    expect(urls).toContain('https://mozilla.org')
    expect(urls).toContain('https://support.mozilla.org/en-US/products/firefox')
  })
})

describe('parseNetscapeBookmarks limits', () => {
  it('skips URLs longer than 2048 characters and caps titles at 500', () => {
    const long = `https://example.com/${'a'.repeat(2100)}`
    const html = `<DL><DT><A HREF="${long}">Too long</A><DT><A HREF="https://ok.com">${'t'.repeat(800)}</A></DL>`
    const result = parseNetscapeBookmarks(html)
    expect(result.map((b) => b.url)).toEqual(['https://ok.com'])
    expect(result[0].title).toHaveLength(500)
  })
})
