import { auth } from '@/lib/auth/server'
import { headers } from 'next/headers'
import { db } from '@/lib/db/client'
import { importJobs } from '@/lib/db/schema'
import { insertLink, findDuplicate } from '@/lib/db/queries/links'
import { enqueueScrapeJob } from '@/lib/queue/boss'
import { parseNetscapeBookmarks } from '@/lib/utils/parse-bookmarks'
import { readLimited } from '@/lib/net/read-limited'

/** Largest bookmarks file accepted; browser exports of thousands of links are a few MB. */
const MAX_IMPORT_BYTES = 10 * 1024 * 1024
/** Most bookmarks one import may queue for scraping. */
const MAX_IMPORT_BOOKMARKS = 10_000
// Room for the multipart boundary and part headers around the file itself
const MULTIPART_OVERHEAD_BYTES = 64 * 1024

function tooLarge(message: string) {
  return Response.json({ error: message }, { status: 413 })
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return new Response('Unauthorized', { status: 401 })

  const userId = session.user.id

  // Bound the upload before buffering it: Content-Length when sent, and the
  // bytes actually read either way (a chunked body has no length up front).
  const sizeLimitMessage = `File is too large (max ${MAX_IMPORT_BYTES / 1024 / 1024} MB)`
  const bodyLimit = MAX_IMPORT_BYTES + MULTIPART_OVERHEAD_BYTES
  const declaredLength = Number(req.headers.get('content-length'))
  if (declaredLength > bodyLimit) return tooLarge(sizeLimitMessage)
  const { bytes, truncated } = await readLimited(req.body, bodyLimit)
  if (truncated) return tooLarge(sizeLimitMessage)

  // Parse multipart form data
  let formData: FormData
  try {
    const contentType = req.headers.get('content-type') ?? ''
    formData = await new Response(bytes, { headers: { 'content-type': contentType } }).formData()
  } catch {
    return Response.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return Response.json({ error: 'No file provided' }, { status: 400 })
  }
  if (file.size > MAX_IMPORT_BYTES) return tooLarge(sizeLimitMessage)

  const html = await file.text()
  if (!html.trim()) {
    return Response.json({ error: 'File is empty' }, { status: 400 })
  }

  // Parse bookmarks from HTML
  const bookmarks = parseNetscapeBookmarks(html)

  if (bookmarks.length === 0) {
    return Response.json({ jobId: null, total: 0 }, { status: 200 })
  }
  if (bookmarks.length > MAX_IMPORT_BOOKMARKS) {
    return Response.json(
      { error: `Too many bookmarks (${bookmarks.length}); import at most ${MAX_IMPORT_BOOKMARKS} at a time` },
      { status: 400 },
    )
  }

  // Create import job record
  const [job] = await db
    .insert(importJobs)
    .values({
      userId,
      totalUrls: bookmarks.length,
      status: 'processing',
    })
    .returning()

  const jobId = job.id

  // Process bookmarks: check duplicates, insert links, enqueue scrape jobs
  for (const bookmark of bookmarks) {
    const existing = await findDuplicate(userId, bookmark.url)
    if (existing) continue

    const link = await insertLink(userId, bookmark.url, { source: 'import' })
    await enqueueScrapeJob(link.id, bookmark.url, jobId)
  }

  return Response.json({ jobId, total: bookmarks.length }, { status: 202 })
}
