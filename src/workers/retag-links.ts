/**
 * One-off cleanup of generated tags, run after the tag extractor changed.
 *
 *   node --import tsx src/workers/retag-links.ts [--dry-run]
 *
 * 1. Re-tags every link that was not LLM-enriched with the current rule
 *    extractor, re-extracting body text from stored HTML where there is some.
 *    Keyword tags survive only when two or more of the user's links share
 *    them. The link's generated tags are replaced; tags with source 'user' stay.
 * 2. Per user, drops rule tags the extractor now rejects as junk and folds
 *    plural generated tags into their singular form.
 * 3. Deletes generated tags no link uses any more.
 *
 * Everything runs in one transaction. --dry-run prints what would change and
 * rolls back.
 */
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { and, eq, inArray, isNull, ne, or, sql } from 'drizzle-orm'
import * as schema from '../lib/db/schema'
import { buildTags } from '../lib/enrichment/classify'
import { planTagCleanup } from '../lib/enrichment/retag'
import { bodyTextFromHtml } from '../lib/scraper/cheerio'

const dryRun = process.argv.includes('--dry-run')
const pool = new Pool({ connectionString: process.env.DATABASE_URL! })
const db = drizzle({ client: pool, schema })
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

class DryRunRollback extends Error {}

async function tagIdFor(tx: Tx, userId: string, name: string): Promise<string> {
  const [inserted] = await tx
    .insert(schema.tags)
    .values({ userId, name, source: 'rule' })
    .onConflictDoNothing()
    .returning({ id: schema.tags.id })
  if (inserted) return inserted.id
  const [existing] = await tx
    .select({ id: schema.tags.id })
    .from(schema.tags)
    .where(and(eq(schema.tags.userId, userId), eq(schema.tags.name, name)))
    .limit(1)
  return existing.id
}

async function retagRuleLinks(tx: Tx): Promise<number> {
  const rows = await tx
    .select({
      id: schema.links.id,
      userId: schema.links.userId,
      url: schema.links.url,
      domain: schema.links.domain,
      title: schema.links.title,
      description: schema.links.description,
      bodyText: schema.rawContent.bodyText,
      rawHtml: schema.rawContent.rawHtml,
    })
    .from(schema.links)
    .innerJoin(schema.rawContent, eq(schema.rawContent.linkId, schema.links.id))
    .where(or(isNull(schema.links.enrichmentSource), ne(schema.links.enrichmentSource, 'llm')))

  const links = rows.map((row) => ({
    ...row,
    bodyText: row.rawHtml ? bodyTextFromHtml(row.rawHtml) : row.bodyText,
  }))
  const tagsFor = (link: (typeof links)[number], knownTags?: ReadonlySet<string>) =>
    buildTags(link.bodyText ?? '', link.domain, link.title, {
      description: link.description,
      url: link.url,
      knownTags,
    })

  // A keyword tag is worth keeping when at least two of the user's links would
  // get it, or the user already has it from somewhere this script leaves alone
  // (tags they typed, LLM-tagged links). Links that differ only by #fragment
  // are one page, so they count once.
  const pageNames = new Map<string, Map<string, Set<string>>>()
  for (const link of links) {
    const pages = pageNames.get(link.userId) ?? new Map<string, Set<string>>()
    const page = link.url.split('#')[0]
    const names = pages.get(page) ?? new Set<string>()
    for (const name of tagsFor(link)) names.add(name)
    pages.set(page, names)
    pageNames.set(link.userId, pages)
  }
  const linkCounts = new Map<string, Map<string, number>>()
  for (const [userId, pages] of pageNames) {
    const counts = new Map<string, number>()
    for (const names of pages.values()) for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1)
    linkCounts.set(userId, counts)
  }
  const keptRows = await tx
    .selectDistinct({ userId: schema.tags.userId, name: schema.tags.name })
    .from(schema.tags)
    .innerJoin(schema.linkTags, eq(schema.linkTags.tagId, schema.tags.id))
    .innerJoin(schema.links, eq(schema.links.id, schema.linkTags.linkId))
    .where(or(eq(schema.tags.source, 'user'), eq(schema.links.enrichmentSource, 'llm')))
  const knownTags = new Map<string, Set<string>>()
  const known = (userId: string) => {
    if (!knownTags.has(userId)) knownTags.set(userId, new Set())
    return knownTags.get(userId)!
  }
  for (const [userId, counts] of linkCounts) {
    for (const [name, n] of counts) if (n >= 2) known(userId).add(name)
  }
  for (const { userId, name } of keptRows) known(userId).add(name)

  for (const link of links) {
    if (link.rawHtml) {
      await tx.update(schema.rawContent).set({ bodyText: link.bodyText }).where(eq(schema.rawContent.linkId, link.id))
    }

    // Tag source is per tag, not per link, so a generated tag the user also
    // added by hand to this link is replaced too.
    await tx.delete(schema.linkTags).where(
      and(
        eq(schema.linkTags.linkId, link.id),
        inArray(
          schema.linkTags.tagId,
          tx.select({ id: schema.tags.id }).from(schema.tags).where(ne(schema.tags.source, 'user')),
        ),
      ),
    )

    const names = tagsFor(link, known(link.userId))
    for (const name of names) {
      const tagId = await tagIdFor(tx, link.userId, name)
      await tx.insert(schema.linkTags).values({ linkId: link.id, tagId }).onConflictDoNothing()
    }
    if (dryRun) console.log(`  ${link.title ?? link.id}: ${names.join(', ') || '(no tags)'}`)
  }
  return links.length
}

async function cleanUpTags(tx: Tx): Promise<{ merged: number; deleted: number }> {
  const rows = await tx
    .select({ id: schema.tags.id, userId: schema.tags.userId, name: schema.tags.name, source: schema.tags.source })
    .from(schema.tags)

  const byUser = new Map<string, typeof rows>()
  for (const row of rows) byUser.set(row.userId, [...(byUser.get(row.userId) ?? []), row])

  let merged = 0
  let deleted = 0
  for (const [userId, userTags] of byUser) {
    const plan = planTagCleanup(userTags)
    for (const { fromId, toName } of plan.merges) {
      const toId = await tagIdFor(tx, userId, toName)
      await tx.execute(sql`
        insert into link_tags (link_id, tag_id)
        select link_id, ${toId} from link_tags where tag_id = ${fromId}
        on conflict do nothing`)
      await tx.delete(schema.tags).where(eq(schema.tags.id, fromId))
      merged++
    }
    if (plan.deletes.length > 0) {
      await tx.delete(schema.tags).where(inArray(schema.tags.id, plan.deletes))
      deleted += plan.deletes.length
    }
  }
  return { merged, deleted }
}

async function deleteOrphanTags(tx: Tx): Promise<number> {
  const removed = await tx
    .delete(schema.tags)
    .where(
      and(
        ne(schema.tags.source, 'user'),
        sql`not exists (select 1 from link_tags where link_tags.tag_id = ${schema.tags.id})`,
      ),
    )
    .returning({ id: schema.tags.id })
  return removed.length
}

async function main() {
  try {
    await db.transaction(async (tx) => {
      const retagged = await retagRuleLinks(tx)
      const { merged, deleted } = await cleanUpTags(tx)
      const orphans = await deleteOrphanTags(tx)
      console.log(
        `${dryRun ? '[dry run] ' : ''}re-tagged ${retagged} links, merged ${merged} plural tags, ` +
          `deleted ${deleted} junk tags and ${orphans} unused tags`,
      )
      if (dryRun) throw new DryRunRollback()
    })
  } catch (err) {
    if (!(err instanceof DryRunRollback)) throw err
    console.log('[dry run] rolled back, nothing changed')
  } finally {
    await pool.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
