import { auth } from '@/lib/auth/server'
import { headers } from 'next/headers'
import { insertLink, findDuplicate, listLinksWithTags } from '@/lib/db/queries/links'
import { enqueueScrapeJob } from '@/lib/queue/boss'
import { parseUrls } from '@/lib/links/parse-urls'
import { normalizeUrl } from '@/lib/links/normalize-url'
import type { SaveLinksRequest, LinkWithDuplicate } from '@/types'

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return new Response('Unauthorized', { status: 401 })

  const body: SaveLinksRequest = await req.json()
  // One entry per canonical URL, so a URL pasted twice is saved once.
  const urlList = [...new Set(parseUrls(body.urls).map(normalizeUrl))]

  if (urlList.length === 0) {
    return Response.json({ error: 'No valid URLs provided' }, { status: 400 })
  }

  const saved: LinkWithDuplicate[] = []

  for (const url of urlList) {
    const existing = await findDuplicate(session.user.id, url)
    if (existing) {
      saved.push({ ...existing, duplicate: true } as LinkWithDuplicate)
      continue
    }

    const link = await insertLink(session.user.id, url)
    await enqueueScrapeJob(link.id, url)
    saved.push(link as LinkWithDuplicate)
  }

  return Response.json({ saved }, { status: 202 })
}

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return new Response('Unauthorized', { status: 401 })

  const data = await listLinksWithTags(session.user.id)
  return Response.json(data)
}
