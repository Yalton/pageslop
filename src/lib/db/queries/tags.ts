import { db } from '@/lib/db/client'
import { tags, linkTags, links } from '@/lib/db/schema'
import { eq, and, or, isNull, sql } from 'drizzle-orm'
import type { Tag } from '@/types'

/**
 * Upsert a tag by (userId, name). Normalizes name to lowercase trim.
 * Uses onConflictDoNothing — if conflict, selects existing row.
 */
export async function upsertTag(
  userId: string,
  name: string,
  source: 'rule' | 'user' | 'llm'
): Promise<Tag> {
  const normalizedName = name.toLowerCase().trim()

  const [inserted] = await db
    .insert(tags)
    .values({ userId, name: normalizedName, source })
    .onConflictDoNothing()
    .returning()

  if (inserted) {
    return inserted as Tag
  }

  // Conflict — select the existing row
  const [existing] = await db
    .select()
    .from(tags)
    .where(and(eq(tags.userId, userId), eq(tags.name, normalizedName)))
    .limit(1)

  return existing as Tag
}

/**
 * Link a tag to a link. Uses onConflictDoNothing — safe to call multiple times.
 */
export async function linkTagToLink(linkId: string, tagId: string): Promise<void> {
  await db
    .insert(linkTags)
    .values({ linkId, tagId })
    .onConflictDoNothing()
}

/**
 * Get all tags for a given link.
 */
export async function getTagsForLink(linkId: string): Promise<Tag[]> {
  const rows = await db
    .select({
      id: tags.id,
      userId: tags.userId,
      name: tags.name,
      source: tags.source,
    })
    .from(linkTags)
    .innerJoin(tags, eq(linkTags.tagId, tags.id))
    .where(eq(linkTags.linkId, linkId))

  return rows as Tag[]
}

/**
 * Remove a tag from a link.
 */
export async function deleteLinkTag(linkId: string, tagId: string): Promise<void> {
  await db
    .delete(linkTags)
    .where(and(eq(linkTags.linkId, linkId), eq(linkTags.tagId, tagId)))
}

/**
 * List a user's tags with the count of links each tag is applied to, counting
 * only links All Links shows (see isVisibleInAllLinks), so a tag's count
 * matches what filtering by it shows. Tags with no such links are left out.
 * Returns tags sorted alphabetically by name.
 */
export async function listTagsWithCount(
  userId: string
): Promise<{ name: string; count: number }[]> {
  return db
    .select({
      name: tags.name,
      count: sql<number>`count(${links.id})::int`,
    })
    .from(tags)
    .innerJoin(linkTags, eq(tags.id, linkTags.tagId))
    .innerJoin(
      links,
      and(
        eq(linkTags.linkId, links.id),
        or(isNull(links.stashState), eq(links.stashState, 'kept')),
      ),
    )
    .where(eq(tags.userId, userId))
    .groupBy(tags.name)
    .orderBy(tags.name)
}
