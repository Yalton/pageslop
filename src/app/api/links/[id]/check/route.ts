import { auth } from '@/lib/auth/server'
import { headers } from 'next/headers'
import { getLinkWithTags } from '@/lib/db/queries/links'
import { enqueueMonitorJob } from '@/lib/queue/boss'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return new Response('Unauthorized', { status: 401 })

  const { id } = await params

  const link = await getLinkWithTags(session.user.id, id)
  if (!link) {
    return Response.json({ error: 'Link not found' }, { status: 404 })
  }

  await enqueueMonitorJob(id)

  return Response.json({ queued: true })
}
