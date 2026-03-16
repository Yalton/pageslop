import { auth } from '@/lib/auth/server'
import { headers } from 'next/headers'
import { deleteLink } from '@/lib/db/queries/links'

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return new Response('Unauthorized', { status: 401 })

  const { id } = await params
  const deleted = await deleteLink(session.user.id, id)

  if (!deleted) {
    return Response.json({ error: 'Link not found' }, { status: 404 })
  }

  return Response.json({ deleted })
}
