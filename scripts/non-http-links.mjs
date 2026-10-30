// Lists links whose URL is not http(s), saved before POST /api/links checked
// the scheme. Pass --delete to delete them as well.
//
//   node --env-file=.env scripts/non-http-links.mjs [--delete]
import { pathToFileURL } from 'node:url'
import pg from 'pg'

// Case-insensitive, like URL parsing: HTTPS://x is a valid http(s) URL.
export const NON_HTTP_WHERE = `url !~* '^https?://'`

export async function nonHttpLinks(client, { remove = false } = {}) {
  const query = remove
    ? `delete from links where ${NON_HTTP_WHERE} returning id, user_id, url`
    : `select id, user_id, url from links where ${NON_HTTP_WHERE}`
  const { rows } = await client.query(query)
  return rows
}

async function main() {
  const remove = process.argv.includes('--delete')
  const url = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL_DIRECT or DATABASE_URL must be set')
  const client = new pg.Client({ connectionString: url })
  await client.connect()
  try {
    const rows = await nonHttpLinks(client, { remove })
    for (const row of rows) console.log(`${row.id}  user ${row.user_id}  ${row.url.slice(0, 80)}`)
    console.log(`${rows.length} link(s) with a non-http(s) URL${remove ? ' deleted' : '. Run again with --delete to delete them'}`)
  } finally {
    await client.end()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
