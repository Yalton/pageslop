import { auth } from '@/lib/auth/server'
import { headers } from 'next/headers'
import { listLinksWithTags } from '@/lib/db/queries/links'
import { generateNetscapeHTML } from '@/lib/utils/export-html'

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return new Response('Unauthorized', { status: 401 })

  const links = await listLinksWithTags(session.user.id)
  const html = generateNetscapeHTML(links)

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html',
      'Content-Disposition': `attachment; filename="pageslop-bookmarks-${Date.now()}.html"`,
    },
  })
}
