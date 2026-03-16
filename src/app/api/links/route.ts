import { auth } from '@/lib/auth/server'
import { headers } from 'next/headers'
import { insertLink, findDuplicate, listLinks } from '@/lib/db/queries/links'
import { enqueueScrapeJob } from '@/lib/queue/boss'
import type { SaveLinksRequest, LinkWithDuplicate } from '@/types'

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return new Response('Unauthorized', { status: 401 })

  const body: SaveLinksRequest = await req.json()
  const urlList = body.urls
    .split('\n')
    .map((u: string) => u.trim())
    .filter((u: string) => {
      try { new URL(u); return true } catch { return false }
    })

  if (urlList.length === 0) {
    return Response.json({ error: 'No valid URLs provided' }, { status: 400 })
  }

  const saved: LinkWithDuplicate[] = []

  for (const url of urlList) {
    // Duplicate check (skip if force=true)
    if (!body.force) {
      const existing = await findDuplicate(session.user.id, url)
      if (existing) {
        saved.push({ ...existing, duplicate: true } as LinkWithDuplicate)
        continue
      }
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

  const data = await listLinks(session.user.id)
  return Response.json(data)
}
