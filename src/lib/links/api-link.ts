import type { LinkWithTags } from '@/types'

/**
 * The public shape of a link in /api/v1 (and anything else exposing links
 * outside the app, such as an MCP server). Fields are picked explicitly so
 * userId and internal enrichment/uptime state never leak.
 */
export interface ApiLink {
  id: string
  url: string
  title: string | null
  description: string | null
  domain: string | null
  category: string | null
  status: string
  favicon: string | null
  ogImage: string | null
  source: string
  stashState: string | null
  tags: string[]
  createdAt: string
  updatedAt: string
}

/** A link row, with or without tags (a freshly inserted link has none yet). */
type LinkInput = Omit<ApiLink, 'tags' | 'createdAt' | 'updatedAt'> & {
  createdAt: Date | string
  updatedAt: Date | string
  tags?: Pick<LinkWithTags['tags'][number], 'name'>[]
}

export function toApiLink(link: LinkInput): ApiLink {
  return {
    id: link.id,
    url: link.url,
    title: link.title,
    description: link.description,
    domain: link.domain,
    category: link.category,
    status: link.status,
    favicon: link.favicon,
    ogImage: link.ogImage,
    source: link.source,
    stashState: link.stashState,
    tags: (link.tags ?? []).map((t) => t.name),
    createdAt: new Date(link.createdAt).toISOString(),
    updatedAt: new Date(link.updatedAt).toISOString(),
  }
}
