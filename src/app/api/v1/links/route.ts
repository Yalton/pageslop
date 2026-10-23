/**
 * GET  /api/v1/links — page through the token owner's links (scope links:read)
 * POST /api/v1/links — save one link (scope links:write)
 *
 * Bearer token auth. See docs/api.md.
 */

import { z } from 'zod'
import { requireScope, jsonError } from '@/lib/api/bearer'
import { findDuplicate, getLinkWithTags, insertLink, listLinksPage } from '@/lib/db/queries/links'
import { enqueueScrapeJob } from '@/lib/queue/boss'
import { decodeCursor } from '@/lib/links/cursor'
import { toApiLink } from '@/lib/links/api-link'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200
const MAX_URL_LENGTH = 2048
const MAX_TITLE_LENGTH = 500

/** A query param, or undefined when absent or blank. */
function param(url: URL, name: string): string | undefined {
  const value = url.searchParams.get(name)?.trim()
  return value ? value : undefined
}

export async function GET(req: Request): Promise<Response> {
  const authed = await requireScope(req, 'links:read')
  if (authed instanceof Response) return authed

  const url = new URL(req.url)

  let limit = DEFAULT_LIMIT
  const rawLimit = param(url, 'limit')
  if (rawLimit !== undefined) {
    limit = /^\d+$/.test(rawLimit) ? Number(rawLimit) : NaN
    if (!(limit >= 1 && limit <= MAX_LIMIT)) {
      return jsonError(400, `limit must be an integer from 1 to ${MAX_LIMIT}`)
    }
  }

  const rawCursor = param(url, 'cursor')
  const cursor = rawCursor === undefined ? null : decodeCursor(rawCursor)
  if (rawCursor !== undefined && !cursor) {
    return jsonError(400, 'cursor is invalid: pass nextCursor from a previous response unchanged')
  }

  // Tags are stored lowercase; domains lowercase without a leading www.
  const tag = param(url, 'tag')?.toLowerCase()
  const domain = param(url, 'domain')?.toLowerCase().replace(/^www\./, '')
  const view = param(url, 'view') ?? 'saved'
  if (!['saved', 'all', 'revisit', 'inbox', 'read', 'kept', 'archived'].includes(view)) {
    return jsonError(400, 'view must be saved, all, revisit, inbox, read, kept, or archived')
  }

  try {
    const page = await listLinksPage(authed.userId, { q: param(url, 'q'), tag, domain, view: view as 'saved' | 'all' | 'revisit' | 'inbox' | 'read' | 'kept' | 'archived', limit, cursor })
    return Response.json({ links: page.links.map(toApiLink), nextCursor: page.nextCursor })
  } catch (err) {
    console.error('[api/v1/links] listLinksPage failed', err)
    return jsonError(500, 'Failed to list links')
  }
}

const saveBodySchema = z.object({
  url: z.string().max(MAX_URL_LENGTH),
  title: z.string().max(MAX_TITLE_LENGTH).optional(),
})

function isHttpUrl(raw: string): boolean {
  try {
    const { protocol } = new URL(raw.trim())
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

export async function POST(req: Request): Promise<Response> {
  const authed = await requireScope(req, 'links:write')
  if (authed instanceof Response) return authed

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return jsonError(400, 'Invalid JSON body')
  }

  const parsed = saveBodySchema.safeParse(raw)
  if (!parsed.success || !isHttpUrl(parsed.data.url)) {
    return jsonError(
      400,
      `Invalid body: expected { url, title? } with an http(s) url of at most ${MAX_URL_LENGTH} characters and a title of at most ${MAX_TITLE_LENGTH}`,
    )
  }
  const { url, title } = parsed.data

  try {
    // findDuplicate and insertLink both canonicalise the URL, so the same page
    // is never saved twice (insertLink also absorbs a concurrent save).
    const existing = await findDuplicate(authed.userId, url)
    if (existing) {
      const withTags = await getLinkWithTags(authed.userId, existing.id)
      return Response.json({ link: toApiLink(withTags ?? existing), duplicate: true })
    }

    const link = await insertLink(authed.userId, url, title ? { title } : {})

    // The link is saved; a queue failure only delays enrichment.
    try {
      await enqueueScrapeJob(link.id, link.url)
    } catch (err) {
      console.error('[api/v1/links] enqueueScrapeJob failed', link.id, err)
    }

    return Response.json({ link: toApiLink(link), duplicate: false }, { status: 201 })
  } catch (err) {
    console.error('[api/v1/links] save failed', err)
    return jsonError(500, 'Failed to save link')
  }
}
