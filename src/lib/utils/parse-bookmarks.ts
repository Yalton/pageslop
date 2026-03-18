import * as cheerio from 'cheerio'

export interface ParsedBookmark {
  url: string
  title: string
  addedAt?: Date
}

/**
 * Parse Netscape-format HTML bookmark files (exported from Chrome, Firefox, Safari).
 * Extracts all valid links from <a href> elements.
 */
export function parseNetscapeBookmarks(html: string): ParsedBookmark[] {
  if (!html || !html.trim()) return []

  const $ = cheerio.load(html)
  const bookmarks: ParsedBookmark[] = []

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || ''

    // Validate URL — skip javascript:, empty, and other invalid schemes
    let validUrl: string
    try {
      const parsed = new URL(href)
      // Only accept http and https URLs
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return
      validUrl = href
    } catch {
      return
    }

    // Extract title — fall back to URL if empty
    const text = $(el).text().trim()
    const title = text.length > 0 ? text : validUrl

    // Extract add_date attribute (Unix timestamp in seconds)
    const addDateAttr = $(el).attr('add_date')
    let addedAt: Date | undefined
    if (addDateAttr) {
      const timestamp = parseInt(addDateAttr, 10)
      if (!isNaN(timestamp) && timestamp > 0) {
        addedAt = new Date(timestamp * 1000)
      }
    }

    bookmarks.push({ url: validUrl, title, addedAt })
  })

  return bookmarks
}
