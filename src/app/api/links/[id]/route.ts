import { auth } from '@/lib/auth/server'
import { headers } from 'next/headers'
import { deleteLink, updateLinkFields } from '@/lib/db/queries/links'
import { CATEGORIES } from '@/types'

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

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return new Response('Unauthorized', { status: 401 })

  const { id } = await params
  const body = await req.json() as { description?: string; category?: string }

  // Validate category if provided
  if (body.category !== undefined && !CATEGORIES.includes(body.category as typeof CATEGORIES[number])) {
    return Response.json({ error: 'Invalid category' }, { status: 400 })
  }

  const data: { description?: string; category?: string } = {}
  if (body.description !== undefined) data.description = body.description
  if (body.category !== undefined) data.category = body.category

  const updated = await updateLinkFields(session.user.id, id, data)

  if (!updated) {
    return Response.json({ error: 'Link not found' }, { status: 404 })
  }

  return Response.json(updated)
}
