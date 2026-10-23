/**
 * GET /api/v1/links/:id — one of the token owner's links (scope links:read).
 * PATCH and DELETE require links:manage.
 * Another user's link is a 404, the same as a missing one.
 */

import { z } from 'zod'
import { requireScope, jsonError } from '@/lib/api/bearer'
import { deleteLink, getLinkWithTags, updateLinkFields } from '@/lib/db/queries/links'
import { toApiLink } from '@/lib/links/api-link'
import { CATEGORIES, STASH_STATES } from '@/types'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const authed = await requireScope(req, 'links:read')
  if (authed instanceof Response) return authed

  const { id } = await params
  try {
    const link = await getLinkWithTags(authed.userId, id)
    if (!link) return jsonError(404, 'Link not found')
    return Response.json({ link: toApiLink(link) })
  } catch (err) {
    console.error('[api/v1/links/:id] getLinkWithTags failed', err)
    return jsonError(500, 'Failed to load link')
  }
}

const patchSchema = z.object({
  description: z.string().max(10000).optional(),
  category: z.enum(CATEGORIES).optional(),
  stashState: z.enum(STASH_STATES).nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0)

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const authed = await requireScope(req, 'links:manage')
  if (authed instanceof Response) return authed
  let raw: unknown
  try { raw = await req.json() } catch { return jsonError(400, 'Invalid JSON body') }
  const parsed = patchSchema.safeParse(raw)
  if (!parsed.success) return jsonError(400, 'Expected description, category or stashState')
  const { id } = await params
  const data = {
    ...parsed.data,
    ...(parsed.data.category !== undefined ? { categorySource: 'user' as const } : {}),
    ...(parsed.data.stashState === 'inbox' ? { stashedAt: new Date() } : {}),
  }
  try {
    if (!await updateLinkFields(authed.userId, id, data)) return jsonError(404, 'Link not found')
    const link = await getLinkWithTags(authed.userId, id)
    if (!link) return jsonError(404, 'Link not found')
    return Response.json({ link: toApiLink(link) })
  } catch (err) {
    console.error('[api/v1/links/:id] update failed', err)
    return jsonError(500, 'Failed to update link')
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const authed = await requireScope(req, 'links:manage')
  if (authed instanceof Response) return authed
  const { id } = await params
  try {
    if (!await deleteLink(authed.userId, id)) return jsonError(404, 'Link not found')
    return Response.json({ deleted: true })
  } catch (err) {
    console.error('[api/v1/links/:id] delete failed', err)
    return jsonError(500, 'Failed to delete link')
  }
}
