import { auth } from '@/lib/auth/server'
import { headers } from 'next/headers'
import { db } from '@/lib/db/client'
import { importJobs } from '@/lib/db/schema'
import { insertLink, findDuplicate } from '@/lib/db/queries/links'
import { enqueueScrapeJob } from '@/lib/queue/boss'
import { parseNetscapeBookmarks } from '@/lib/utils/parse-bookmarks'

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return new Response('Unauthorized', { status: 401 })

  const userId = session.user.id

  // Parse multipart form data
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return Response.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) {
    return Response.json({ error: 'No file provided' }, { status: 400 })
  }

  const html = await file.text()
  if (!html.trim()) {
    return Response.json({ error: 'File is empty' }, { status: 400 })
  }

  // Parse bookmarks from HTML
  const bookmarks = parseNetscapeBookmarks(html)

  if (bookmarks.length === 0) {
    return Response.json({ jobId: null, total: 0 }, { status: 200 })
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
