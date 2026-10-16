/**
 * GET /api/v1/tags — the token owner's tags with link counts (scope links:read).
 * Counts cover the same links GET /api/v1/links returns (the All Links view).
 */

import { requireScope, jsonError } from '@/lib/api/bearer'
import { listTagsWithCount } from '@/lib/db/queries/tags'

export async function GET(req: Request): Promise<Response> {
  const authed = await requireScope(req, 'links:read')
  if (authed instanceof Response) return authed

  try {
    const tags = await listTagsWithCount(authed.userId)
    return Response.json({ tags })
  } catch (err) {
    console.error('[api/v1/tags] listTagsWithCount failed', err)
    return jsonError(500, 'Failed to list tags')
  }
}
