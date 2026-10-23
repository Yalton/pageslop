import { auth } from '@/lib/auth/server'
import { headers } from 'next/headers'
import { db } from '@/lib/db/client'
import { links } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { upsertTag, linkTagToLink } from '@/lib/db/queries/tags'
import { MAX_TAG_NAME_LENGTH } from '@/lib/links/limits'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return new Response('Unauthorized', { status: 401 })

  const { id: linkId } = await params
  let body: { name?: unknown }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Validate name
  const name = typeof body === 'object' && body !== null && typeof body.name === 'string' ? body.name.trim() : ''
  if (name.length === 0) {
    return Response.json({ error: 'Tag name is required' }, { status: 400 })
  }
  if (name.length > MAX_TAG_NAME_LENGTH) {
    return Response.json({ error: `Tag name must be at most ${MAX_TAG_NAME_LENGTH} characters` }, { status: 400 })
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

  const tag = await upsertTag(session.user.id, name, 'user')
  await linkTagToLink(linkId, tag.id)

  return Response.json({ tag }, { status: 201 })
}
