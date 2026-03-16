export type LinkStatus = 'pending' | 'ready' | 'error'

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
  createdAt: Date
  updatedAt: Date
}

export interface LinkWithDuplicate extends Link {
  duplicate?: boolean
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
