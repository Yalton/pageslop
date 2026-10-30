// Applies the committed drizzle/ migrations at container start.
//
// Databases created before this script existed were built with
// `drizzle-kit push`, so they have the tables but no record of which
// migrations they contain. For those, the migrations whose objects already
// exist are recorded as applied ("baselined") first; anything newer then runs
// as a normal migration. A failed migration exits non-zero so the app does not
// start on a half-migrated schema.
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'

const MIGRATIONS_FOLDER = 'drizzle'

// One check per migration that existed while the entrypoint still used push.
// Each query returns true when that migration's objects are present.
// Migrations added after this list are never baselined; they always run.
export const PUSH_ERA_CHECKS = {
  '0000_clean_justice': `select to_regclass('public.links') is not null`,
  '0001_mean_purifiers': `select to_regclass('public.api_tokens') is not null`,
  '0002_safe_spyke': `select exists (select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'links' and column_name = 'category_source')`,
  '0003_equal_madrox': `select exists (select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'api_tokens' and column_name = 'scopes')`,
}

/**
 * The journal entries a push-built database already contains: the leading run
 * of push-era migrations whose check passed. Stops at the first miss, so a
 * database pushed by an older release gets the later migrations applied.
 */
export function entriesToBaseline(entries, present) {
  const out = []
  for (const entry of entries) {
    if (!(entry.tag in PUSH_ERA_CHECKS) || !present[entry.tag]) break
    out.push(entry)
  }
  return out
}

async function scalar(client, query) {
  const { rows } = await client.query(query)
  return Object.values(rows[0])[0]
}

async function baselinePushedDatabase(client, folder) {
  if (await scalar(client, `select to_regclass('drizzle.__drizzle_migrations') is not null`)) {
    if (Number(await scalar(client, 'select count(*) from drizzle.__drizzle_migrations')) > 0) return
  }
  if (!(await scalar(client, PUSH_ERA_CHECKS['0000_clean_justice']))) return // empty database

  const { entries } = JSON.parse(readFileSync(join(folder, 'meta/_journal.json'), 'utf8'))
  const present = {}
  for (const [tag, query] of Object.entries(PUSH_ERA_CHECKS)) present[tag] = await scalar(client, query)
  const baseline = entriesToBaseline(entries, present)

  await client.query('begin')
  await client.query('create schema if not exists drizzle')
  await client.query(
    'create table if not exists drizzle.__drizzle_migrations (id serial primary key, hash text not null, created_at bigint)',
  )
  for (const entry of baseline) {
    const sql = readFileSync(join(folder, `${entry.tag}.sql`), 'utf8')
    const hash = createHash('sha256').update(sql).digest('hex')
    await client.query('insert into drizzle.__drizzle_migrations (hash, created_at) values ($1, $2)', [hash, entry.when])
  }
  await client.query('commit')
  console.log(`[migrate] Recorded ${baseline.length} migration(s) already present in a push-built database`)
}

async function main() {
  const url = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL_DIRECT or DATABASE_URL must be set')
  const client = new pg.Client({ connectionString: url })
  await client.connect()
  try {
    await baselinePushedDatabase(client, MIGRATIONS_FOLDER)
    await migrate(drizzle(client), { migrationsFolder: MIGRATIONS_FOLDER })
    console.log('[migrate] Database schema is up to date')
  } finally {
    await client.end()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error('[migrate] Migration failed:', err)
    process.exit(1)
  })
}
