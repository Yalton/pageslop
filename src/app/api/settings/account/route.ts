import { auth } from '@/lib/auth/server'
import { headers } from 'next/headers'
import { deleteUserAccount } from '@/lib/db/queries/users'
import { removeScreenshots } from '@/lib/scraper/screenshot-files'

export async function DELETE(req: Request): Promise<Response> {
  const requestHeaders = await headers()
  const session = await auth.api.getSession({ headers: requestHeaders })
  if (!session) return new Response('Unauthorized', { status: 401 })

  let body: { confirm?: string; password?: unknown }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (body.confirm !== 'DELETE') {
    return Response.json({ error: 'Confirmation required. Send { "confirm": "DELETE" }' }, { status: 400 })
  }

  // A stolen session cookie alone must not be enough to delete the account.
  if (typeof body.password !== 'string' || body.password === '') {
    return Response.json({ error: 'Enter your password to delete your account' }, { status: 400 })
  }
  try {
    await auth.api.verifyPassword({ body: { password: body.password }, headers: requestHeaders })
  } catch {
    return Response.json({ error: 'Incorrect password' }, { status: 403 })
  }

  const linkIds = await deleteUserAccount(session.user.id)
  await removeScreenshots(linkIds)

  return Response.json({ message: 'Account deleted' })
}
