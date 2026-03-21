export type LinkStatus = 'pending' | 'ready' | 'error'
export type UptimeStatus = 'unchecked' | 'up' | 'down'
export type EnrichmentSource = 'rule' | 'llm' | 'llm_failed' | null

export const CATEGORIES = [
  'Technology',
  'News',
  'Reference',
  'Entertainment',
  'Shopping',
  'Social',
  'Education',
  'Finance',
  'Health',
  'Creative',
  'Other',
] as const

export type Category = typeof CATEGORIES[number]

export interface Link {
  id: string
  userId: string
  url: string
  title: string | null
  description: string | null
  ogImage: string | null
  favicon: string | null
  domain: string | null
  status: LinkStatus
  category: string | null
  createdAt: Date
  updatedAt: Date
  enrichmentSource: EnrichmentSource
  enrichmentError: string | null
  uptimeStatus: UptimeStatus
  lastStatusCode: number | null
  lastCheckedAt: Date | null
  consecutiveFailures: number
}

export interface LinkWithDuplicate extends Link {
  duplicate?: boolean
}

export interface LinkWithTags extends Link {
  tags: Tag[]
}

export interface Tag {
  id: string
  userId: string
  name: string
  source: 'user' | 'rule' | 'llm'
}

export interface LinkTag {
  linkId: string
  tagId: string
}

export interface SaveLinksRequest {
  urls: string
  force?: boolean
}

export interface SaveLinksResponse {
  saved: LinkWithDuplicate[]
}
