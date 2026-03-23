import { auth } from '@/lib/auth/server'
import { headers } from 'next/headers'
import { db } from '@/lib/db/client'
import { user } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function DELETE(req: Request): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return new Response('Unauthorized', { status: 401 })

  let body: { confirm?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (body.confirm !== 'DELETE') {
    return Response.json({ error: 'Confirmation required. Send { "confirm": "DELETE" }' }, { status: 400 })
  }

  // Delete user — cascades to all links, tags, sessions, etc. via ON DELETE CASCADE
  await db.delete(user).where(eq(user.id, session.user.id))

  return Response.json({ message: 'Account deleted' })
}
