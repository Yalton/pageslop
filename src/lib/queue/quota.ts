import { and, count, eq, gt, ne } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { links } from '@/lib/db/schema'

/**
 * Most links one user may have waiting to be scraped, so one account cannot
 * flood the shared queue. Bookmark imports are exempt (they run one at a
 * time instead). Override with MAX_PENDING_LINKS.
 */
export const DEFAULT_MAX_PENDING_LINKS = 1000

/**
 * A link still pending after this long lost its scrape job (a queue failure
 * or a worker crash). It no longer counts as queued, so it cannot block its
 * owner forever.
 */
export const STUCK_PENDING_MS = 24 * 60 * 60 * 1000

export function maxPendingLinks(env: Record<string, string | undefined> = process.env): number {
  const value = Number(env.MAX_PENDING_LINKS)
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_MAX_PENDING_LINKS
}

/**
 * The error to show when saving `adding` more links would take a user with
 * `pending` queued links over `limit`, or null when they fit.
 */
export function queueFullMessage(pending: number, adding: number, limit: number): string | null {
  if (pending + adding <= limit) return null
  return `You have ${limit.toLocaleString('en-US')} links waiting to be fetched; try again once some finish`
}

function recentlyPending(userId: string) {
  return and(
    eq(links.userId, userId),
    eq(links.status, 'pending'),
    gt(links.createdAt, new Date(Date.now() - STUCK_PENDING_MS)),
  )
}

/** Null when the user may queue `adding` more links, else the error message. */
export async function checkScrapeQuota(userId: string, adding: number): Promise<string | null> {
  if (adding <= 0) return null
  const [row] = await db
    .select({ n: count() })
    .from(links)
    .where(and(recentlyPending(userId), ne(links.source, 'import')))
  return queueFullMessage(row?.n ?? 0, adding, maxPendingLinks())
}

export const IMPORT_IN_PROGRESS_MESSAGE =
  'An import is still being fetched; wait for it to finish before starting another'

/** Whether links from one of the user's imports are still waiting to be scraped. */
export async function hasImportInProgress(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: links.id })
    .from(links)
    .where(and(recentlyPending(userId), eq(links.source, 'import')))
    .limit(1)
  return !!row
}
