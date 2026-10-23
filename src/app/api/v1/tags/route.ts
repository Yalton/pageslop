/**
 * GET /api/v1/tags — the token owner's tags with link counts (scope links:read).
 * Counts cover the same links GET /api/v1/links returns (the All Links view).
 */

import { requireScope, jsonError } from '@/lib/api/bearer'
import { listTagsWithCount } from '@/lib/db/queries/tags'

export async function GET(req: Request): Promise<Response> {
  const authed = await requireScope(req, 'links:read')
  if (authed instanceof Response) return authed

  const view = new URL(req.url).searchParams.get('view') ?? 'saved'
  if (view !== 'saved' && view !== 'all' && view !== 'revisit') {
    return jsonError(400, 'view must be saved, all, or revisit')
  }
  try {
    const tags = await listTagsWithCount(authed.userId, view)
    return Response.json({ tags })
  } catch (err) {
    console.error('[api/v1/tags] listTagsWithCount failed', err)
    return jsonError(500, 'Failed to list tags')
  }
}
