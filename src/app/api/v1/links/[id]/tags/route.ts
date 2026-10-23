import { z } from 'zod'
import { requireScope, jsonError } from '@/lib/api/bearer'
import { getLinkWithTags } from '@/lib/db/queries/links'
import { upsertTag, linkTagToLink } from '@/lib/db/queries/tags'
import { toApiLink } from '@/lib/links/api-link'
import { MAX_TAG_NAME_LENGTH } from '@/lib/links/limits'

const tagSchema = z.object({ name: z.string().trim().min(1).max(MAX_TAG_NAME_LENGTH) }).strict()

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const authed = await requireScope(req, 'links:manage')
  if (authed instanceof Response) return authed
  let raw: unknown
  try { raw = await req.json() } catch { return jsonError(400, 'Invalid JSON body') }
  const parsed = tagSchema.safeParse(raw)
  if (!parsed.success) return jsonError(400, `Expected { name: string (1-${MAX_TAG_NAME_LENGTH} chars) }`)
  const { id } = await params
  try {
    if (!await getLinkWithTags(authed.userId, id)) return jsonError(404, 'Link not found')
    const tag = await upsertTag(authed.userId, parsed.data.name, 'user')
    await linkTagToLink(id, tag.id)
    const link = await getLinkWithTags(authed.userId, id)
    if (!link) return jsonError(404, 'Link not found')
    return Response.json({ link: toApiLink(link) })
  } catch (err) {
    console.error('[api/v1/links/:id/tags] add failed', err)
    return jsonError(500, 'Failed to add tag')
  }
}
