import { auth } from '@/lib/auth/server'
import { headers } from 'next/headers'
import { deleteLink, updateLinkFields } from '@/lib/db/queries/links'
import { MAX_DESCRIPTION_LENGTH } from '@/lib/links/limits'
import { CATEGORIES, STASH_STATES, type StashState } from '@/types'

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
  let body: { description?: unknown; category?: string; stashState?: unknown }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (typeof body !== 'object' || body === null) {
    return Response.json({ error: 'Body must be a JSON object' }, { status: 400 })
  }

  // Validate description if provided: a string, capped like /api/v1 and MCP
  if (
    body.description !== undefined &&
    (typeof body.description !== 'string' || body.description.length > MAX_DESCRIPTION_LENGTH)
  ) {
    return Response.json(
      { error: `description must be a string of at most ${MAX_DESCRIPTION_LENGTH} characters` },
      { status: 400 },
    )
  }

  // Validate category if provided
  if (body.category !== undefined && !CATEGORIES.includes(body.category as typeof CATEGORIES[number])) {
    return Response.json({ error: 'Invalid category' }, { status: 400 })
  }

  // Validate stashState if provided: one of STASH_STATES, or null to leave the stash flow
  if (
    body.stashState !== undefined &&
    body.stashState !== null &&
    !STASH_STATES.includes(body.stashState as StashState)
  ) {
    return Response.json({ error: 'Invalid stashState' }, { status: 400 })
  }

  const data: {
    description?: string
    category?: string
    categorySource?: 'user'
    stashState?: StashState | null
    stashedAt?: Date
  } = {}
  if (typeof body.description === 'string') data.description = body.description
  if (body.category !== undefined) {
    data.category = body.category
    data.categorySource = 'user' // hand-picked: enrichment must not overwrite it
  }
  if (body.stashState !== undefined) {
    data.stashState = body.stashState as StashState | null
    // "Restore to inbox" restarts the expiry clock
    if (body.stashState === 'inbox') data.stashedAt = new Date()
  }

  const updated = await updateLinkFields(session.user.id, id, data)

  if (!updated) {
    return Response.json({ error: 'Link not found' }, { status: 404 })
  }

  return Response.json(updated)
}
