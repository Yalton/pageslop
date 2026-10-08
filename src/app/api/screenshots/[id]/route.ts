import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { and, eq } from 'drizzle-orm'
import { auth } from '@/lib/auth/server'
import { db } from '@/lib/db/client'
import { links } from '@/lib/db/schema'

const SCREENSHOT_DIR = process.env.SCREENSHOT_DIR || join(process.cwd(), 'data', 'screenshots')

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  // Sanitize: only allow UUID-like IDs
  if (!/^[a-f0-9-]{36}$/.test(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [ownedLink] = await db.select({ id: links.id }).from(links)
    .where(and(eq(links.id, id), eq(links.userId, session.user.id)))
    .limit(1)
  if (!ownedLink) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const filePath = join(SCREENSHOT_DIR, `${id}.webp`)

  try {
    const data = await readFile(filePath)
    return new NextResponse(data, {
      headers: {
        'Content-Type': 'image/webp',
        'Cache-Control': 'private, no-store',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
