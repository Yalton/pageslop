import { db } from '@/lib/db/client'
import { links, rawContent, linkTags, tags } from '@/lib/db/schema'
import { eq, and, desc, inArray, lt, sql, type SQL } from 'drizzle-orm'
import type { LinkSource, LinkWithTags, StashState, Tag } from '@/types'
import { normalizeUrl } from '@/lib/links/normalize-url'

/**
 * List all links eligible for uptime monitoring.
 * Returns only 'ready' links (skip pending/error) across all users.
 */
export async function listLinksForMonitor(): Promise<{ id: string; url: string }[]> {
  return db
    .select({ id: links.id, url: links.url })
    .from(links)
    .where(eq(links.status, 'ready'))
}

/** The db itself, or a transaction handle from db.transaction(). */
type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0]

export interface InsertLinkOptions {
  source?: LinkSource
  stashState?: StashState | null
  stashedAt?: Date | null
  title?: string | null
}

/**
 * Insert a link under its canonical URL. If the user already saved that URL
 * (including a concurrent save), returns the existing row instead.
 */
export async function insertLink(
  userId: string,
  rawUrl: string,
  opts: InsertLinkOptions = {},
  executor: Executor = db,
) {
  const url = normalizeUrl(rawUrl)
  const domain = new URL(url).hostname.replace(/^www\./, '')
  const [link] = await executor.insert(links)
    .values({
      url,
      userId,
      domain,
      status: 'pending',
      source: opts.source ?? 'manual',
      stashState: opts.stashState ?? null,
      stashedAt: opts.stashedAt ?? null,
      title: opts.title ?? null,
    })
    .onConflictDoNothing({ target: [links.userId, links.url] })
    .returning()
  if (link) return link
  const existing = await findDuplicate(userId, url, executor)
  if (!existing) throw new Error(`insertLink: conflict on ${url} but no existing row`)
  return existing
}

export async function findDuplicate(userId: string, url: string, executor: Executor = db) {
  const result = await executor.select().from(links)
    .where(and(eq(links.userId, userId), eq(links.url, normalizeUrl(url))))
    .limit(1)
  return result[0] || null
}

export async function listLinks(userId: string) {
  return db.select().from(links)
    .where(eq(links.userId, userId))
    .orderBy(desc(links.createdAt))
}

export async function deleteLink(userId: string, linkId: string) {
  const result = await db.delete(links)
    .where(and(eq(links.id, linkId), eq(links.userId, userId)))
    .returning()
  return result[0] || null
}

/** Delete many of the owner's links at once. Returns the number of rows deleted. */
export async function bulkDeleteLinks(userId: string, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0
  const rows = await db.delete(links)
    .where(and(eq(links.userId, userId), inArray(links.id, ids)))
    .returning({ id: links.id })
  return rows.length
}

export async function updateLinkMetadata(linkId: string, data: {
  title?: string | null
  description?: string | null
  ogImage?: string | null
  favicon?: string | null
  status: string
}) {
  const [updated] = await db.update(links)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(links.id, linkId))
    .returning()
  return updated
}

export async function insertRawContent(linkId: string, bodyText: string | null, rawHtml: string | null) {
  await db.insert(rawContent).values({ linkId, bodyText, rawHtml })
}

/**
 * List all links for a user with their tags included (no N+1 queries).
 * One query for links, one batch query for all their tags.
 */
export async function listLinksWithTags(userId: string): Promise<LinkWithTags[]> {
  const userLinks = await db.select().from(links)
    .where(eq(links.userId, userId))
    .orderBy(desc(links.createdAt), desc(links.id))

  if (userLinks.length === 0) return []

  const linkIds = userLinks.map((l) => l.id)

  const tagRows = await db
    .select({
      linkId: linkTags.linkId,
      id: tags.id,
      userId: tags.userId,
      name: tags.name,
      source: tags.source,
    })
    .from(linkTags)
    .innerJoin(tags, eq(linkTags.tagId, tags.id))
    .where(inArray(linkTags.linkId, linkIds))

  // Build Map<linkId, Tag[]>
  const tagMap = new Map<string, Tag[]>()
  for (const row of tagRows) {
    const existing = tagMap.get(row.linkId) ?? []
    existing.push({ id: row.id, userId: row.userId, name: row.name, source: row.source as Tag['source'] })
    tagMap.set(row.linkId, existing)
  }

  return userLinks.map((link) => ({
    ...link,
    status: link.status as LinkWithTags['status'],
    enrichmentSource: link.enrichmentSource as LinkWithTags['enrichmentSource'],
    uptimeStatus: link.uptimeStatus as LinkWithTags['uptimeStatus'],
    source: link.source as LinkWithTags['source'],
    stashState: link.stashState as LinkWithTags['stashState'],
    tags: tagMap.get(link.id) ?? [],
  }))
}

/**
 * Get a single link with its tags for a user.
 */
export async function getLinkWithTags(userId: string, linkId: string): Promise<LinkWithTags | null> {
  const [link] = await db.select().from(links)
    .where(and(eq(links.id, linkId), eq(links.userId, userId)))
    .limit(1)

  if (!link) return null

  const tagRows = await db
    .select({
      id: tags.id,
      userId: tags.userId,
      name: tags.name,
      source: tags.source,
    })
    .from(linkTags)
    .innerJoin(tags, eq(linkTags.tagId, tags.id))
    .where(eq(linkTags.linkId, linkId))

  return {
    ...link,
    status: link.status as LinkWithTags['status'],
    enrichmentSource: link.enrichmentSource as LinkWithTags['enrichmentSource'],
    uptimeStatus: link.uptimeStatus as LinkWithTags['uptimeStatus'],
    source: link.source as LinkWithTags['source'],
    stashState: link.stashState as LinkWithTags['stashState'],
    tags: tagRows as Tag[],
  }
}

// Marking a never-stashed link 'read' starts its expiry clock, or it would
// never expire. An existing stashedAt is kept.
const startExpiryClock = sql`coalesce(${links.stashedAt}, now())`

/**
 * Update user-editable fields on a link: description, category, and stash state.
 */
export async function updateLinkFields(
  userId: string,
  linkId: string,
  data: {
    description?: string
    category?: string
    categorySource?: 'rule' | 'llm' | 'user'
    stashState?: StashState | null
    stashedAt?: Date | null
  }
) {
  const values: Record<string, unknown> = { ...data, updatedAt: new Date() }
  if (data.stashState === 'read' && data.stashedAt === undefined) values.stashedAt = startExpiryClock
  const [updated] = await db.update(links)
    .set(values)
    .where(and(eq(links.id, linkId), eq(links.userId, userId)))
    .returning()
  return updated
}

export interface StashTabInput {
  url: string
  title?: string
  closedAt: Date
}

/**
 * Save closed browser tabs into the user's revisit inbox.
 *
 * - URLs repeated within the batch are collapsed first, so the same (userId, url)
 *   is never inserted twice in one call (no unique-constraint violation).
 *   The first non-empty title and the latest closedAt win.
 * - Existing links move to 'inbox' with stashedAt = closedAt, except kept links,
 *   which stay kept. Their other fields are left alone, except that a missing title
 *   is filled from the tab.
 * - New links are inserted with source 'stash', stashState 'inbox'.
 *
 * The whole batch runs in one transaction. If any row fails, nothing is saved and
 * the call rejects, so a link is never committed without reaching `inserted` (and
 * so never left unscraped). The extension keeps the tabs open and retries.
 *
 * URLs are collapsed by canonical form (see normalizeUrl), but `saved` echoes each
 * distinct URL string exactly as given, so the extension can match it against its open
 * tabs. `inserted` lists only new links (canonical URL), which the caller must enqueue
 * for scraping.
 */
export async function stashTabs(
  userId: string,
  tabs: StashTabInput[]
): Promise<{ saved: string[]; inserted: { id: string; url: string }[] }> {
  const byUrl = new Map<string, { title?: string; closedAt: Date; given: string[] }>()
  for (const tab of tabs) {
    const title = tab.title ? tab.title : undefined
    const key = normalizeUrl(tab.url)
    const prev = byUrl.get(key)
    if (!prev) {
      byUrl.set(key, { title, closedAt: tab.closedAt, given: [tab.url] })
      continue
    }
    byUrl.set(key, {
      title: prev.title ?? title,
      closedAt: tab.closedAt.getTime() > prev.closedAt.getTime() ? tab.closedAt : prev.closedAt,
      given: prev.given.includes(tab.url) ? prev.given : [...prev.given, tab.url],
    })
  }

  const saved: string[] = []
  const inserted: { id: string; url: string }[] = []
  if (byUrl.size === 0) return { saved, inserted }

  await db.transaction(async (tx) => {
    for (const [url, tab] of byUrl) {
      const existing = await findDuplicate(userId, url, tx)
      if (existing) {
        await tx.update(links)
          .set({
            ...(existing.stashState === 'kept' ? {} : { stashState: 'inbox' as const }),
            stashedAt: tab.closedAt,
            updatedAt: new Date(),
            ...(!existing.title && tab.title ? { title: tab.title } : {}),
          })
          .where(and(eq(links.id, existing.id), eq(links.userId, userId)))
      } else {
        const link = await insertLink(userId, url, {
          source: 'stash',
          stashState: 'inbox',
          stashedAt: tab.closedAt,
          title: tab.title ?? null,
        }, tx)
        inserted.push({ id: link.id, url })
      }
      saved.push(...tab.given)
    }
  })

  return { saved, inserted }
}

/**
 * Set stash_state on many links at once, scoped to the owner. Returns the number of rows updated.
 * Moving links back to 'inbox' also resets stashed_at to now so they do not expire immediately.
 * null puts a link back in All Links as an ordinary saved link (restoring one archived from there).
 */
export async function bulkSetStashState(
  userId: string,
  ids: string[],
  state: StashState | null
): Promise<number> {
  if (ids.length === 0) return 0
  const now = new Date()
  const rows = await db.update(links)
    .set({
      stashState: state,
      updatedAt: now,
      ...(state === 'inbox' ? { stashedAt: now } : {}),
      ...(state === 'read' ? { stashedAt: startExpiryClock } : {}),
    })
    .where(and(eq(links.userId, userId), inArray(links.id, ids)))
    .returning({ id: links.id })
  return rows.length
}

/**
 * Moves stashed links in 'inbox' or 'read' whose stashedAt is older than the
 * cutoff into 'archived'. Never deletes. Returns the number of rows changed.
 * Links with a null stashedAt are never matched (NULL < cutoff is not true).
 */
export async function archiveExpiredStash(cutoff: Date): Promise<number> {
  const rows = await db
    .update(links)
    .set({ stashState: 'archived', updatedAt: new Date() })
    .where(and(inArray(links.stashState, ['inbox', 'read']), lt(links.stashedAt, cutoff)))
    .returning({ id: links.id })
  return rows.length
}
