import { db } from '@/lib/db/client'
import { links, rawContent } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'

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
