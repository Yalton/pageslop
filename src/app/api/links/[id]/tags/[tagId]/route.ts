import { auth } from '@/lib/auth/server'
import { headers } from 'next/headers'
import { db } from '@/lib/db/client'
import { links } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { deleteLinkTag } from '@/lib/db/queries/tags'

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; tagId: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return new Response('Unauthorized', { status: 401 })

  const { id: linkId, tagId } = await params

  // Verify link ownership
  const [link] = await db
    .select()
    .from(links)
    .where(and(eq(links.id, linkId), eq(links.userId, session.user.id)))
    .limit(1)

  if (!link) {
    return Response.json({ error: 'Link not found' }, { status: 404 })
  }

  await deleteLinkTag(linkId, tagId)

  return Response.json({ deleted: true })
}
