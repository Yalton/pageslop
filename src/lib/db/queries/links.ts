import { db } from '@/lib/db/client'
import { links, rawContent, linkTags, tags } from '@/lib/db/schema'
import { eq, and, desc, inArray } from 'drizzle-orm'
import type { LinkWithTags, Tag } from '@/types'

export async function insertLink(userId: string, url: string) {
  const domain = new URL(url).hostname.replace(/^www\./, '')
  const [link] = await db.insert(links)
    .values({ url, userId, domain, status: 'pending' })
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
    tags: tagRows as Tag[],
  }
}

/**
 * Update description and/or category on a link (user-editable fields).
 */
export async function updateLinkFields(
  userId: string,
  linkId: string,
  data: { description?: string; category?: string }
) {
  const [updated] = await db.update(links)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(links.id, linkId), eq(links.userId, userId)))
    .returning()
  return updated
}
