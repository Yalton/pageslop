import { auth } from '@/lib/auth/server'
import { headers } from 'next/headers'
import { db } from '@/lib/db/client'
import { links } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { upsertTag, linkTagToLink } from '@/lib/db/queries/tags'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return new Response('Unauthorized', { status: 401 })

  const { id: linkId } = await params
  const body = await req.json() as { name?: string }

  // Validate name
  if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
    return Response.json({ error: 'Tag name is required' }, { status: 400 })
  }

  // Verify link ownership
  const [link] = await db
    .select()
    .from(links)
    .where(and(eq(links.id, linkId), eq(links.userId, session.user.id)))
    .limit(1)

  if (!link) {
    return Response.json({ error: 'Link not found' }, { status: 404 })
  }

  const tag = await upsertTag(session.user.id, body.name, 'user')
  await linkTagToLink(linkId, tag.id)

  return Response.json({ tag }, { status: 201 })
}
