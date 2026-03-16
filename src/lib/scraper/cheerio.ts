import * as cheerio from 'cheerio'

export interface ScrapeResult {
  title: string
  description: string
  ogImage: string | null
  favicon: string | null
  bodyText: string | null
  rawHtml: string
}

export async function scrapeUrl(url: string): Promise<ScrapeResult> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Pageslop/1.0)' },
    signal: AbortSignal.timeout(8000), // 8s hard timeout
    redirect: 'follow',
  })

  const rawHtml = await res.text()
  const $ = cheerio.load(rawHtml)

  const title = $('meta[property="og:title"]').attr('content')
    || $('title').text().trim()
    || ''

  const description = $('meta[property="og:description"]').attr('content')
    || $('meta[name="description"]').attr('content')
    || ''

  const ogImage = $('meta[property="og:image"]').attr('content') || null

  let favicon = $('link[rel="icon"]').attr('href')
    || $('link[rel="shortcut icon"]').attr('href')
    || null

  // Resolve relative favicon URLs
  if (favicon && !favicon.startsWith('http')) {
    const base = new URL(url)
    favicon = new URL(favicon, base.origin).href
  }

  // Extract body text for Phase 2 classification
  $('script, style, nav, header, footer').remove()
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 5000) || null

  return { title, description, ogImage, favicon, bodyText, rawHtml }
}
