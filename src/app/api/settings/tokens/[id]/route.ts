/**
 * DELETE /api/settings/tokens/[id] — revoke one of the caller's tokens.
 * Session auth. Deleting the row is the revocation; bearer requests using
 * that token get 401 from then on.
 */

import { auth } from '@/lib/auth/server'
import { headers } from 'next/headers'
import { deleteApiToken } from '@/lib/db/queries/api-tokens'

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return new Response('Unauthorized', { status: 401 })

  const { id } = await params
  const deleted = await deleteApiToken(session.user.id, id)
  if (!deleted) {
    return Response.json({ error: 'Token not found' }, { status: 404 })
  }

  return Response.json({ deleted: true })
}
