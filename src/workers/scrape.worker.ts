import { PgBoss } from 'pg-boss'
import { scrapeUrl } from '../lib/scraper/cheerio'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { eq } from 'drizzle-orm'
import * as schema from '../lib/db/schema'

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

async function main() {
  await boss.start()
  console.log('[worker] pg-boss started, listening for scrape jobs...')

  await boss.work<{ linkId: string; url: string }>('scrape', { localConcurrency: 5 }, async ([job]) => {
    const { linkId, url } = job.data!
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

      console.log(`[worker] completed scraping ${url}`)
    } catch (err) {
      console.error(`[worker] failed scraping ${url}:`, err)
      await db.update(schema.links)
        .set({ status: 'error', updatedAt: new Date() })
        .where(eq(schema.links.id, linkId))
    }
  })
}

main().catch((err) => {
  console.error('[worker] fatal:', err)
  process.exit(1)
})
