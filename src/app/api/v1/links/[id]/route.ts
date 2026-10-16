/**
 * GET /api/v1/links/:id — one of the token owner's links (scope links:read).
 * Another user's link is a 404, the same as a missing one.
 */

import { requireScope, jsonError } from '@/lib/api/bearer'
import { getLinkWithTags } from '@/lib/db/queries/links'
import { toApiLink } from '@/lib/links/api-link'

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
