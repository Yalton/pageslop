import { PgBoss } from 'pg-boss'
import { scrapeUrl } from '../lib/scraper/cheerio'
import { checkUrl } from '../lib/monitor/check-url'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { eq, sql, and } from 'drizzle-orm'
import * as schema from '../lib/db/schema'
import { importJobs } from '../lib/db/schema'
import { enrich } from '../lib/enrichment/classify'

// DIRECT connection (no -pooler in hostname) — required for pg-boss LISTEN/NOTIFY
const pool = new Pool({
  connectionString: process.env.DATABASE_URL_DIRECT!,
  max: 5,
})
const db = drizzle({ client: pool, schema })

const boss = new PgBoss({
  connectionString: process.env.DATABASE_URL_DIRECT!,
})

boss.on('error', (err) => console.error('[pg-boss error]', err))

/**
 * Enqueue backfill jobs for all links that have raw_content but no category.
 * Runs once at startup.
 */
async function backfillEnrichment() {
  const rows = await db.execute<{ id: string }>(sql`
    SELECT links.id
    FROM links
    LEFT JOIN raw_content ON raw_content.link_id = links.id
    WHERE links.category IS NULL
    AND raw_content.id IS NOT NULL
  `)

  const linkIds = rows.rows.map((r) => r.id)
  console.log(`[worker] backfill: queuing ${linkIds.length} links for enrichment`)

  const BATCH_SIZE = 50
  for (let i = 0; i < linkIds.length; i += BATCH_SIZE) {
    const batch = linkIds.slice(i, i + BATCH_SIZE)
    await boss.insert(
      'enrich',
      batch.map((linkId) => ({
        data: { linkId },
        retryLimit: 2,
        retryDelay: 10,
        expireInSeconds: 120,
      }))
    )
    if (i + BATCH_SIZE < linkIds.length) {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }
}

async function main() {
  await boss.start()
  await boss.createQueue('scrape')
  await boss.createQueue('enrich')
  await boss.createQueue('monitor-sweep')
  await boss.createQueue('monitor')
  console.log('[worker] pg-boss started, listening for scrape, enrich, monitor-sweep, and monitor jobs...')

  // Register 24-hour cron for monitor sweep at 02:00 UTC (pg-boss upserts on restart)
  await boss.schedule('monitor-sweep', '0 2 * * *', {}, { tz: 'UTC' })

  // Run backfill for un-enriched links
  await backfillEnrichment()

  await boss.work<{ linkId: string; url: string; importJobId?: string }>('scrape', { localConcurrency: 5 }, async ([job]) => {
    const { linkId, url, importJobId } = job.data!
    console.log(`[worker] scraping ${url} for link ${linkId}`)

    try {
      const result = await scrapeUrl(url)

      // Update link with scraped metadata
      await db.update(schema.links)
        .set({
          title: result.title || null,
          description: result.description || null,
          ogImage: result.ogImage,
          favicon: result.favicon,
          status: 'ready',
          updatedAt: new Date(),
        })
        .where(eq(schema.links.id, linkId))

      // Store raw content for Phase 2 classification
      await db.insert(schema.rawContent)
        .values({
          linkId,
          bodyText: result.bodyText,
          rawHtml: result.rawHtml,
        })

      // Chain enrich job after successful scrape
      await boss.send('enrich', { linkId }, {
        retryLimit: 2,
        retryDelay: 10,
        expireInSeconds: 120,
      })

      // Update import job progress if this scrape is part of a bulk import
      if (importJobId) {
        const [updated] = await db.update(importJobs)
          .set({ processedUrls: sql`${importJobs.processedUrls} + 1`, updatedAt: new Date() })
          .where(eq(importJobs.id, importJobId))
          .returning()

        if (updated && updated.processedUrls >= updated.totalUrls) {
          await db.update(importJobs)
            .set({ status: 'complete' })
            .where(eq(importJobs.id, importJobId))
        }
      }

      console.log(`[worker] completed scraping ${url}`)
    } catch (err) {
      console.error(`[worker] failed scraping ${url}:`, err)
      await db.update(schema.links)
        .set({ status: 'error', updatedAt: new Date() })
        .where(eq(schema.links.id, linkId))
    }
  })

  await boss.work<{ linkId: string }>('enrich', { localConcurrency: 10 }, async ([job]) => {
    const { linkId } = job.data!
    console.log(`[worker] enriching link ${linkId}`)

    // Fetch the link row
    const [link] = await db.select().from(schema.links).where(eq(schema.links.id, linkId)).limit(1)
    if (!link) {
      console.warn(`[worker] enrich: link ${linkId} not found, skipping`)
      return
    }

    // Fetch rawContent for this link
    const [raw] = await db.select().from(schema.rawContent).where(eq(schema.rawContent.linkId, linkId)).limit(1)
    if (!raw) {
      console.warn(`[worker] enrich: no rawContent for link ${linkId}, skipping`)
      return
    }

    // Run enrichment
    const result = enrich({
      bodyText: raw.bodyText,
      existingDescription: link.description,
      domain: link.domain,
      title: link.title,
    })

    // Update link: description only if currently null, always set category
    await db.update(schema.links)
      .set({
        ...(link.description === null ? { description: result.description } : {}),
        category: result.category,
        updatedAt: new Date(),
      })
      .where(eq(schema.links.id, linkId))

    // Upsert and link each tag using inline logic (worker's local db, not @/ alias)
    for (const tagName of result.tags) {
      const normalizedName = tagName.toLowerCase().trim()

      // Try to insert tag
      const [insertedTag] = await db
        .insert(schema.tags)
        .values({ userId: link.userId, name: normalizedName, source: 'rule' })
        .onConflictDoNothing()
        .returning()

      let tagId: string
      if (insertedTag) {
        tagId = insertedTag.id
      } else {
        // Conflict — select existing
        const [existingTag] = await db
          .select()
          .from(schema.tags)
          .where(and(eq(schema.tags.userId, link.userId), eq(schema.tags.name, normalizedName)))
          .limit(1)
        tagId = existingTag.id
      }

      // Link tag to link (ignore duplicate)
      await db
        .insert(schema.linkTags)
        .values({ linkId, tagId })
        .onConflictDoNothing()
    }

    console.log(`[worker] enriched link ${linkId}: category=${result.category}, tags=${result.tags.join(', ')}`)
  })

  // monitor-sweep: fan out per-link monitor jobs on a 24-hour cron
  await boss.work('monitor-sweep', { localConcurrency: 1 }, async ([_job]) => {
    // Fetch all ready links for uptime monitoring
    const readyLinks = await db
      .select({ id: schema.links.id })
      .from(schema.links)
      .where(eq(schema.links.status, 'ready'))

    console.log(`[worker] monitor-sweep: queuing ${readyLinks.length} links for monitoring`)

    if (readyLinks.length === 0) return

    // Fan out individual monitor jobs with staggered startAfter (10s per 100 links)
    const BATCH_SIZE = 100
    const batches: typeof readyLinks[] = []
    for (let i = 0; i < readyLinks.length; i += BATCH_SIZE) {
      batches.push(readyLinks.slice(i, i + BATCH_SIZE))
    }

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex]
      const startAfterSeconds = batchIndex * 10
      const startAfter = new Date(Date.now() + startAfterSeconds * 1000)

      await boss.insert(
        'monitor',
        batch.map((link) => ({
          data: { linkId: link.id },
          startAfter,
          retryLimit: 1,
          expireInSeconds: 30,
        }))
      )
    }
  })

  // monitor: check a single link and update uptime status
  await boss.work<{ linkId: string }>('monitor', { localConcurrency: 20 }, async ([job]) => {
    const { linkId } = job.data!

    // Fetch the link's URL
    const [link] = await db
      .select({ url: schema.links.url })
      .from(schema.links)
      .where(eq(schema.links.id, linkId))
      .limit(1)

    if (!link) {
      // Link was deleted — skip silently
      return
    }

    const result = await checkUrl(link.url)

    if (result.up) {
      // Success: reset consecutive failures and mark up
      await db.update(schema.links)
        .set({
          uptimeStatus: 'up',
          lastStatusCode: result.statusCode,
          lastCheckedAt: new Date(),
          consecutiveFailures: 0,
          updatedAt: new Date(),
        })
        .where(eq(schema.links.id, linkId))
    } else {
      // Failure: atomically increment consecutiveFailures and flip to 'down' at >= 2
      await db.update(schema.links)
        .set({
          consecutiveFailures: sql`${schema.links.consecutiveFailures} + 1`,
          lastStatusCode: result.statusCode,
          lastCheckedAt: new Date(),
          uptimeStatus: sql`CASE WHEN ${schema.links.consecutiveFailures} + 1 >= 2 THEN 'down' ELSE ${schema.links.uptimeStatus} END`,
          updatedAt: new Date(),
        })
        .where(eq(schema.links.id, linkId))
    }

    console.log(`[worker] monitor ${linkId}: ${result.up ? 'up' : 'down'} (${result.statusCode})`)
  })
}

main().catch((err) => {
  console.error('[worker] fatal:', err)
  process.exit(1)
})
