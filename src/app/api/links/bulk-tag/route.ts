/**
 * POST /api/links/bulk-tag — add one user tag to many links (bulk Add tag in
 * the link grid).
 *
 * Session auth. bulkAddTag filters by the caller's user id, so ids belonging
 * to other users are silently skipped and not counted.
 */

import { z } from 'zod'
import { auth } from '@/lib/auth/server'
import { headers } from 'next/headers'
import { bulkAddTag } from '@/lib/db/queries/tags'
import { MAX_TAG_NAME_LENGTH } from '@/lib/links/limits'

const MAX_IDS = 500

const bulkSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(MAX_IDS),
  name: z.string().trim().min(1).max(MAX_TAG_NAME_LENGTH),
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
    return Response.json({ error: `Expected { ids: string[] (1-${MAX_IDS}), name: string (1-${MAX_TAG_NAME_LENGTH} chars) }` }, { status: 400 })
  }

  const { tag, added } = await bulkAddTag(session.user.id, parsed.data.ids, parsed.data.name)
  return Response.json({ tag, added })
}
