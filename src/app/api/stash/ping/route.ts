/**
 * GET /api/stash/ping — lets the extension's "Test connection" button
 * confirm the server URL and token (bearer token auth).
 */

import { authenticateBearer } from '@/lib/auth/api-token'
import { getUserEmail } from '@/lib/db/queries/users'

export async function GET(req: Request): Promise<Response> {
  const authed = await authenticateBearer(req)
  if (!authed) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const email = await getUserEmail(authed.userId)
  if (!email) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  return Response.json({ ok: true, user: { email } })
}
