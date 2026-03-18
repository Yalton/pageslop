import { PgBoss } from 'pg-boss'

let boss: PgBoss | null = null

export function getBoss(): PgBoss {
  if (!boss) {
    // In API routes, use pooled connection for sending jobs only
    // The worker process creates its own PgBoss with direct connection
    boss = new PgBoss({
      connectionString: process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL!,
    })
    boss.on('error', console.error)
  }
  return boss
}

export async function enqueueScrapeJob(linkId: string, url: string, importJobId?: string) {
  const b = getBoss()
  // Ensure boss is started and queue exists before sending
  await b.start()
  await b.createQueue('scrape')
  await b.send('scrape', { linkId, url, importJobId }, {
    retryLimit: 2,
    retryDelay: 5,
    expireInSeconds: 60,
  })
}

export async function enqueueEnrichJob(linkId: string) {
  const b = getBoss()
  await b.start()
  await b.createQueue('enrich')
  await b.send('enrich', { linkId }, {
    retryLimit: 2,
    retryDelay: 10,
    expireInSeconds: 120,
  })
}
