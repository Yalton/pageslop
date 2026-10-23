import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PATCH, DELETE as deleteLinkRoute } from '@/app/api/v1/links/[id]/route'
import { POST as addTag } from '@/app/api/v1/links/[id]/tags/route'
import { DELETE as removeTag } from '@/app/api/v1/links/[id]/tags/[name]/route'
import type { LinkWithTags } from '@/types'

vi.mock('@/lib/auth/api-token', () => ({ authenticateBearer: vi.fn() }))
vi.mock('@/lib/db/queries/links', () => ({ getLinkWithTags: vi.fn(), updateLinkFields: vi.fn(), deleteLink: vi.fn() }))
vi.mock('@/lib/db/queries/tags', () => ({ upsertTag: vi.fn(), linkTagToLink: vi.fn(), deleteLinkTag: vi.fn() }))

import { authenticateBearer } from '@/lib/auth/api-token'
import { getLinkWithTags, updateLinkFields, deleteLink } from '@/lib/db/queries/links'
import { upsertTag, linkTagToLink, deleteLinkTag } from '@/lib/db/queries/tags'

const params = { params: Promise.resolve({ id: 'link-1', name: 'rust' }) }
const sample = {
  id: 'link-1', url: 'https://example.com/', title: 'Example', description: null,
  domain: 'example.com', category: null, status: 'ready', favicon: null,
  ogImage: null, source: 'stash', stashState: 'inbox', stashedAt: new Date('2026-10-01'),
  tags: [{ id: 'tag-1', name: 'rust' }],
  createdAt: new Date('2026-10-01'), updatedAt: new Date('2026-10-01'),
} as LinkWithTags

function req(method: string, body?: unknown) {
  return new Request('http://localhost/api/v1/links/link-1', {
    method, headers: { authorization: 'Bearer ps_test', 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(authenticateBearer).mockResolvedValue({ userId: 'owner', scopes: ['links:read', 'links:write', 'links:manage'] } as never)
  vi.mocked(getLinkWithTags).mockResolvedValue(sample)
  vi.mocked(updateLinkFields).mockResolvedValue(sample as never)
  vi.mocked(deleteLink).mockResolvedValue(true as never)
  vi.mocked(upsertTag).mockResolvedValue({ id: 'tag-2', userId: 'owner', name: 'new', source: 'user' })
})

describe('bearer link writes', () => {
  it('moves a link to inbox and marks a category as user selected', async () => {
    const res = await PATCH(req('PATCH', { category: 'Technology', stashState: 'inbox' }), params)
    expect(res.status).toBe(200)
    expect(updateLinkFields).toHaveBeenCalledWith('owner', 'link-1', expect.objectContaining({
      category: 'Technology', categorySource: 'user', stashState: 'inbox', stashedAt: expect.any(Date),
    }))
    expect((await res.json()).link.stashedAt).toBe('2026-10-01T00:00:00.000Z')
  })

  it('rejects invalid edits before writing and checks write scope', async () => {
    expect((await PATCH(req('PATCH', { category: 'Invalid' }), params)).status).toBe(400)
    vi.mocked(authenticateBearer).mockResolvedValue({ userId: 'owner', scopes: ['links:read', 'links:write'] } as never)
    expect((await PATCH(req('PATCH', { stashState: 'archived' }), params)).status).toBe(403)
    expect((await deleteLinkRoute(req('DELETE'), params)).status).toBe(403)
    expect((await addTag(req('POST', { name: 'new' }), params)).status).toBe(403)
    expect((await removeTag(req('DELETE'), params)).status).toBe(403)
    expect(updateLinkFields).not.toHaveBeenCalled()
    expect(deleteLink).not.toHaveBeenCalled()
  })

  it('reports missing or foreign links as 404 without creating a tag', async () => {
    vi.mocked(getLinkWithTags).mockResolvedValue(null)
    vi.mocked(updateLinkFields).mockResolvedValue(undefined as never)
    vi.mocked(deleteLink).mockResolvedValue(false as never)
    expect((await PATCH(req('PATCH', { description: 'note' }), params)).status).toBe(404)
    expect((await deleteLinkRoute(req('DELETE'), params)).status).toBe(404)
    expect((await addTag(req('POST', { name: 'new' }), params)).status).toBe(404)
    expect((await removeTag(req('DELETE'), params)).status).toBe(404)
    expect(upsertTag).not.toHaveBeenCalled()
    expect(deleteLinkTag).not.toHaveBeenCalled()
  })

  it('adds and removes tags only after resolving the owned link', async () => {
    expect((await addTag(req('POST', { name: 'New' }), params)).status).toBe(200)
    expect(upsertTag).toHaveBeenCalledWith('owner', 'New', 'user')
    expect(linkTagToLink).toHaveBeenCalledWith('link-1', 'tag-2')
    expect((await removeTag(req('DELETE'), params)).status).toBe(200)
    expect(deleteLinkTag).toHaveBeenCalledWith('link-1', 'tag-1')
  })
})
