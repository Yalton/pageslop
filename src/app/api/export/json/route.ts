import { auth } from '@/lib/auth/server'
import { headers } from 'next/headers'
import { listLinksWithTags } from '@/lib/db/queries/links'

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return new Response('Unauthorized', { status: 401 })

  const links = await listLinksWithTags(session.user.id)

  return new Response(JSON.stringify(links, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="pageslop-export-${Date.now()}.json"`,
    },
  })
}
