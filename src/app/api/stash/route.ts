/**
 * POST /api/stash — save closing browser tabs (bearer token auth).
 *
 * The extension closes a tab only if its URL string comes back in `saved`,
 * so URL strings are never trimmed or normalised here. `new URL()` is used
 * only to check the protocol.
 */

import { z } from 'zod'
import { authenticateBearer } from '@/lib/auth/api-token'
import { stashTabs } from '@/lib/db/queries/links'
import { enqueueScrapeJob } from '@/lib/queue/boss'

const MAX_TABS = 100
const MAX_URL_LENGTH = 2048
const MAX_TITLE_LENGTH = 500

const stashBodySchema = z.object({
  tabs: z
    .array(
      z.object({
        url: z.string(),
        title: z.string().nullish(),
        favicon: z.string().nullish(),
        closedAt: z.unknown().optional(),
      }),
    )
    .max(MAX_TABS),
})

type RejectReason = 'invalid_url' | 'unsupported_protocol' | 'url_too_long'

function checkUrl(raw: string): RejectReason | null {
  if (raw.length > MAX_URL_LENGTH) return 'url_too_long'
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return 'invalid_url'
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return 'unsupported_protocol'
  }
  return null
}

/** Invalid, missing or future closedAt values fall back to the server's now. */
function parseClosedAt(value: unknown, now: Date): Date {
  if (typeof value !== 'string') return now
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return now
  if (parsed.getTime() > now.getTime()) return now
  return parsed
}

export async function POST(req: Request): Promise<Response> {
  const authed = await authenticateBearer(req)
  if (!authed) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = stashBodySchema.safeParse(raw)
  if (!parsed.success) {
    return Response.json(
      { error: `Invalid body: expected { tabs: [{ url, title?, closedAt? }] } with at most ${MAX_TABS} tabs` },
      { status: 400 },
    )
  }

  const now = new Date()
  const rejected: { url: string; reason: RejectReason }[] = []
  const valid: { url: string; title?: string; closedAt: Date }[] = []

  for (const tab of parsed.data.tabs) {
    const reason = checkUrl(tab.url)
    if (reason) {
      rejected.push({ url: tab.url, reason })
      continue
    }
    valid.push({
      url: tab.url,
      title: tab.title?.slice(0, MAX_TITLE_LENGTH) ?? undefined,
      closedAt: parseClosedAt(tab.closedAt, now),
    })
  }

  if (valid.length === 0) {
    return Response.json({ saved: [], rejected })
  }

  let result: Awaited<ReturnType<typeof stashTabs>>
  try {
    result = await stashTabs(authed.userId, valid)
  } catch (err) {
    console.error('[stash] stashTabs failed', err)
    return Response.json({ error: 'Failed to save tabs' }, { status: 500 })
  }

  // Links are already saved. A queue failure must not hide that from the
  // extension, or it would keep the tabs open and re-send them forever.
  for (const link of result.inserted) {
    try {
      await enqueueScrapeJob(link.id, link.url)
    } catch (err) {
      console.error('[stash] enqueueScrapeJob failed', link.id, err)
    }
  }

  return Response.json({ saved: result.saved, rejected })
}
