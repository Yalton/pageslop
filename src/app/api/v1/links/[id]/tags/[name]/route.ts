import { requireScope, jsonError } from '@/lib/api/bearer'
import { getLinkWithTags } from '@/lib/db/queries/links'
import { deleteLinkTag } from '@/lib/db/queries/tags'
import { toApiLink } from '@/lib/links/api-link'

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; name: string }> }): Promise<Response> {
  const authed = await requireScope(req, 'links:manage')
  if (authed instanceof Response) return authed
  const { id, name } = await params
  const normalized = name.trim().toLowerCase()
  if (!normalized || normalized.length > 50) return jsonError(400, 'Invalid tag name')
  try {
    const link = await getLinkWithTags(authed.userId, id)
    if (!link) return jsonError(404, 'Link not found')
    const tag = link.tags.find((tag) => tag.name === normalized)
    if (!tag) return jsonError(404, 'Tag not found on link')
    await deleteLinkTag(id, tag.id)
    const updated = await getLinkWithTags(authed.userId, id)
    if (!updated) return jsonError(404, 'Link not found')
    return Response.json({ link: toApiLink(updated) })
  } catch (err) {
    console.error('[api/v1/links/:id/tags/:name] delete failed', err)
    return jsonError(500, 'Failed to remove tag')
  }
}
