import { db } from '@/lib/db/client'
import { links, rawContent, linkTags, tags } from '@/lib/db/schema'
import { eq, and, desc, inArray } from 'drizzle-orm'
import type { LinkSource, LinkWithTags, StashState, Tag } from '@/types'

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

export interface InsertLinkOptions {
  source?: LinkSource
  stashState?: StashState | null
  stashedAt?: Date | null
  title?: string | null
}

export async function insertLink(userId: string, url: string, opts: InsertLinkOptions = {}) {
  const domain = new URL(url).hostname.replace(/^www\./, '')
  const [link] = await db.insert(links)
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
    .returning()
  return link
}

export async function findDuplicate(userId: string, url: string) {
  const result = await db.select().from(links)
    .where(and(eq(links.userId, userId), eq(links.url, url)))
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
    .orderBy(desc(links.createdAt))

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

/**
 * Update user-editable fields on a link: description, category, and stash state.
 */
export async function updateLinkFields(
  userId: string,
  linkId: string,
  data: {
    description?: string
    category?: string
    stashState?: StashState | null
    stashedAt?: Date | null
  }
) {
  const [updated] = await db.update(links)
    .set({ ...data, updatedAt: new Date() })
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
 * - Existing links move to 'inbox' with stashedAt = closedAt. Their other fields are
 *   left alone, except that a missing title is filled from the tab.
 * - New links are inserted with source 'stash', stashState 'inbox'.
 *
 * `saved` echoes each distinct URL string exactly as given (no normalisation), so the
 * extension can match it against its open tabs. `inserted` lists only new links, which
 * the caller must enqueue for scraping.
 */
export async function stashTabs(
  userId: string,
  tabs: StashTabInput[]
): Promise<{ saved: string[]; inserted: { id: string; url: string }[] }> {
  const byUrl = new Map<string, { title?: string; closedAt: Date }>()
  for (const tab of tabs) {
    const title = tab.title ? tab.title : undefined
    const prev = byUrl.get(tab.url)
    if (!prev) {
      byUrl.set(tab.url, { title, closedAt: tab.closedAt })
      continue
    }
    byUrl.set(tab.url, {
      title: prev.title ?? title,
      closedAt: tab.closedAt.getTime() > prev.closedAt.getTime() ? tab.closedAt : prev.closedAt,
    })
  }

  const saved: string[] = []
  const inserted: { id: string; url: string }[] = []

  for (const [url, tab] of byUrl) {
    const existing = await findDuplicate(userId, url)
    if (existing) {
      await db.update(links)
        .set({
          stashState: 'inbox',
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
      })
      inserted.push({ id: link.id, url })
    }
    saved.push(url)
  }

  return { saved, inserted }
}

/**
 * Set stash_state on many links at once, scoped to the owner. Returns the number of rows updated.
 * Moving links back to 'inbox' also resets stashed_at to now so they do not expire immediately.
 */
export async function bulkSetStashState(
  userId: string,
  ids: string[],
  state: StashState
): Promise<number> {
  if (ids.length === 0) return 0
  const now = new Date()
  const rows = await db.update(links)
    .set({
      stashState: state,
      updatedAt: now,
      ...(state === 'inbox' ? { stashedAt: now } : {}),
    })
    .where(and(eq(links.userId, userId), inArray(links.id, ids)))
    .returning({ id: links.id })
  return rows.length
}
