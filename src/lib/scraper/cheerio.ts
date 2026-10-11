import * as cheerio from 'cheerio'
import { safeFetch } from '../net/ssrf-guard'

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
  const { response: res } = await safeFetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Pageslop/1.0)' },
    signal: AbortSignal.timeout(8000), // 8s hard timeout
  })

  const rawHtml = await res.text()
  const $ = cheerio.load(rawHtml)

  const title = $('meta[property="og:title"]').attr('content')
    || $('title').text().trim()
    || ''

  const description = $('meta[property="og:description"]').attr('content')
    || $('meta[name="description"]').attr('content')
    || ''

  // Try multiple image meta tags in priority order
  let ogImage = $('meta[property="og:image"]').attr('content')
    || $('meta[property="og:image:url"]').attr('content')
    || $('meta[name="twitter:image"]').attr('content')
    || $('meta[name="twitter:image:src"]').attr('content')
    || null

  // Resolve relative og:image URLs
  if (ogImage && !ogImage.startsWith('http')) {
    const base = new URL(url)
    ogImage = new URL(ogImage, base.origin).href
  }

  // Prefer high-res icons, then fall back to standard favicon
  let favicon = $('link[rel="apple-touch-icon"]').attr('href')
    || $('link[rel="apple-touch-icon-precomposed"]').attr('href')
    || $('link[rel="icon"][sizes="192x192"]').attr('href')
    || $('link[rel="icon"][sizes="180x180"]').attr('href')
    || $('link[rel="icon"][sizes="128x128"]').attr('href')
    || $('link[rel="icon"]').attr('href')
    || $('link[rel="shortcut icon"]').attr('href')
    || null

  // Resolve relative favicon URLs
  if (favicon && !favicon.startsWith('http')) {
    const base = new URL(url)
    favicon = new URL(favicon, base.origin).href
  }

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
