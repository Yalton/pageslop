/**
 * GET /api/stash/ping — lets the extension's "Test connection" button
 * confirm the server URL and token (bearer token auth).
 */

import { requireScope } from '@/lib/api/bearer'
import { getUserEmail } from '@/lib/db/queries/users'

export async function GET(req: Request): Promise<Response> {
  const authed = await requireScope(req, 'stash')
  if (authed instanceof Response) return authed

  const email = await getUserEmail(authed.userId)
  if (!email) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  return Response.json({ ok: true, user: { email } })
}
