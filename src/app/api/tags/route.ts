import { auth } from '@/lib/auth/server'
import { headers } from 'next/headers'
import { listTagsWithCount } from '@/lib/db/queries/tags'

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return new Response('Unauthorized', { status: 401 })

  const tagList = await listTagsWithCount(session.user.id)
  return Response.json(tagList)
}
