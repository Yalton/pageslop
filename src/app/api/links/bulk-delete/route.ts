/**
 * POST /api/links/bulk-delete — delete many links at once (bulk Delete in the
 * link grid, and every delete once its undo window has passed).
 *
 * Session auth. bulkDeleteLinks filters by the caller's user id, so ids
 * belonging to other users are silently skipped and not counted.
 */

import { z } from 'zod'
import { auth } from '@/lib/auth/server'
import { headers } from 'next/headers'
import { bulkDeleteLinks } from '@/lib/db/queries/links'

const MAX_IDS = 500

const bulkSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(MAX_IDS),
})

export async function POST(req: Request): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return new Response('Unauthorized', { status: 401 })

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = bulkSchema.safeParse(raw)
  if (!parsed.success) {
    return Response.json({ error: `Expected { ids: string[] (1-${MAX_IDS}) }` }, { status: 400 })
  }

  const deleted = await bulkDeleteLinks(session.user.id, parsed.data.ids)
  return Response.json({ deleted })
}
