import * as cheerio from 'cheerio'
import { safeFetch } from '../net/ssrf-guard'
import { resolveAssetUrl } from './resolve-asset-url'
import { readLimited } from '../net/read-limited'
import { MAX_SCRAPED_DESCRIPTION_LENGTH, MAX_TITLE_LENGTH, truncateText } from '../links/limits'

/** Most of a page's body read for metadata; <head> tags come first, so 2 MB is plenty. */
export const MAX_HTML_BYTES = 2 * 1024 * 1024

/**
 * Whether a Content-Type is worth parsing as a page. A missing header is
 * treated as HTML; text/* (incl. text/plain) and XHTML/XML are parsed too.
 * PDFs, images, video, archives and JSON are not.
 */
function isParsableContentType(contentType: string | null): boolean {
  if (!contentType) return true
  const type = contentType.split(';')[0].trim().toLowerCase()
  return type.startsWith('text/') || type === 'application/xml' || type.endsWith('+xml')
}

export interface ScrapeResult {
  title: string
  description: string
  ogImage: string | null
  favicon: string | null
  bodyText: string | null
  rawHtml: string
}

export async function scrapeUrl(url: string): Promise<ScrapeResult> {
  // safeFetch enforces the SSRF policy on the URL and every redirect hop
  const { response: res, url: finalUrl } = await safeFetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Pageslop/1.0)' },
    signal: AbortSignal.timeout(8000), // 8s hard timeout
  })

  // A non-page resource saves fine with empty metadata (the worker stores null
  // title/description and queues a screenshot); its body is never read.
  if (!isParsableContentType(res.headers.get('content-type'))) {
    await res.body?.cancel().catch(() => {})
    return { title: '', description: '', ogImage: null, favicon: null, bodyText: null, rawHtml: '' }
  }

  // Read at most MAX_HTML_BYTES, so a huge or endless body cannot exhaust memory
  // or bloat raw_content. A cut-off page still parses: cheerio closes open tags.
  const { bytes } = await readLimited(res.body, MAX_HTML_BYTES)
  const rawHtml = new TextDecoder().decode(bytes)
  const $ = cheerio.load(rawHtml)

  const title = truncateText($('meta[property="og:title"]').attr('content')
    || $('title').text().trim()
    || '', MAX_TITLE_LENGTH)

  const description = truncateText($('meta[property="og:description"]').attr('content')
    || $('meta[name="description"]').attr('content')
    || '', MAX_SCRAPED_DESCRIPTION_LENGTH)

  // Try multiple image meta tags in priority order
  const rawOgImage = $('meta[property="og:image"]').attr('content')
    || $('meta[property="og:image:url"]').attr('content')
    || $('meta[name="twitter:image"]').attr('content')
    || $('meta[name="twitter:image:src"]').attr('content')
    || null

  const ogImage = resolveAssetUrl(rawOgImage, finalUrl)

  // Prefer high-res icons, then fall back to standard favicon
  const rawFavicon = $('link[rel="apple-touch-icon"]').attr('href')
    || $('link[rel="apple-touch-icon-precomposed"]').attr('href')
    || $('link[rel="icon"][sizes="192x192"]').attr('href')
    || $('link[rel="icon"][sizes="180x180"]').attr('href')
    || $('link[rel="icon"][sizes="128x128"]').attr('href')
    || $('link[rel="icon"]').attr('href')
    || $('link[rel="shortcut icon"]').attr('href')
    || null

  const favicon = resolveAssetUrl(rawFavicon, finalUrl)

  // Extract body text for Phase 2 classification
  const bodyText = extractBodyText($)

  return { title, description, ogImage, favicon, bodyText, rawHtml }
}

/** DOM node type (domhandler's AnyNode) without depending on domhandler directly. */
type AnyNode = Extract<Parameters<typeof cheerio.load>[0], readonly unknown[]>[number]

/** Elements whose content is never readable page text. */
// select/datalist: form pickers (country lists on sign-up pages) are not page content.
const NON_TEXT_SELECTOR =
  'script, style, noscript, svg, iframe, template, object, embed, canvas, nav, header, footer, select, datalist'

const BODY_TEXT_MAX = 5000

/**
 * Collects the visible body text with a space between every text node, so
 * adjacent elements (e.g. `<a>About</a><a>Press</a>`) do not run together.
 * Whitespace is collapsed and the result capped at 5000 chars.
 */
function extractBodyText($: cheerio.CheerioAPI): string | null {
  $(NON_TEXT_SELECTOR).remove()
  const parts: string[] = []
  const walk = (nodes: AnyNode[]) => {
    for (const node of nodes) {
      if (node.type === 'text') parts.push(node.data)
      else if ('children' in node) walk(node.children)
    }
  }
  walk($('body').toArray())
  return parts.join(' ').replace(/\s+/g, ' ').trim().slice(0, BODY_TEXT_MAX) || null
}

/** Body text from stored HTML, extracted the same way scrapeUrl does it. */
export function bodyTextFromHtml(html: string): string | null {
  return extractBodyText(cheerio.load(html))
}
