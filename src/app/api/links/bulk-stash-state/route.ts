/**
 * POST /api/links/bulk-stash-state — set stashState on many links at once
 * (Open all / Keep all / Dismiss all on /dashboard/revisit).
 *
 * Session auth. bulkSetStashState filters by the caller's user id, so ids
 * belonging to other users are silently skipped and not counted.
 */

import { z } from 'zod'
import { auth } from '@/lib/auth/server'
import { headers } from 'next/headers'
import { bulkSetStashState } from '@/lib/db/queries/links'
import { STASH_STATES } from '@/types'

const MAX_IDS = 500

const bulkSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(MAX_IDS),
  stashState: z.enum(STASH_STATES),
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
    return Response.json(
      { error: `Expected { ids: string[] (1-${MAX_IDS}), stashState: ${STASH_STATES.join(' | ')} }` },
      { status: 400 },
    )
  }

  const updated = await bulkSetStashState(session.user.id, parsed.data.ids, parsed.data.stashState)
  return Response.json({ updated })
}
