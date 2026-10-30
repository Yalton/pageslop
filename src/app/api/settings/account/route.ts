import { auth } from '@/lib/auth/server'
import { headers } from 'next/headers'
import { db } from '@/lib/db/client'
import { links, user } from '@/lib/db/schema'
import { removeScreenshots } from '@/lib/scraper/screenshot-files'
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

  // Delete user — cascades to all links, tags, sessions, etc. via ON DELETE CASCADE.
  // Screenshot files live outside the database, so collect the link ids first.
  const linkIds = (await db.select({ id: links.id }).from(links).where(eq(links.userId, session.user.id))).map((r) => r.id)
  await db.delete(user).where(eq(user.id, session.user.id))
  await removeScreenshots(linkIds)

  return Response.json({ message: 'Account deleted' })
}
