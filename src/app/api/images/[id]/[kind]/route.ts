import { readFile } from 'node:fs/promises'
import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { and, eq } from 'drizzle-orm'
import { auth } from '@/lib/auth/server'
import { db } from '@/lib/db/client'
import { links } from '@/lib/db/schema'
import { IMAGE_KINDS, type ImageKind, cachedImagePath } from '@/lib/scraper/screenshot-files'

/** GET /api/images/:id/:kind — a link's cached preview image or favicon (see image-cache.ts). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; kind: string }> },
) {
  const { id, kind } = await params

  if (!/^[a-f0-9-]{36}$/.test(id) || !(IMAGE_KINDS as readonly string[]).includes(kind)) {
    return NextResponse.json({ error: 'Invalid image' }, { status: 400 })
  }

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [ownedLink] = await db.select({ id: links.id }).from(links)
    .where(and(eq(links.id, id), eq(links.userId, session.user.id)))
    .limit(1)
  if (!ownedLink) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const data = await readFile(cachedImagePath(id, kind as ImageKind))
    return new NextResponse(data, {
      headers: {
        'Content-Type': 'image/webp',
        // Re-scraping a link overwrites its file, so let browsers reuse it only briefly
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
