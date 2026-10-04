import type { LinkWithTags } from '@/types'

/** inbox and read links live on /dashboard/revisit, not in All Links. */
export function isVisibleInAllLinks(link: Pick<LinkWithTags, 'stashState'>): boolean {
  return link.stashState !== 'inbox' && link.stashState !== 'read'
}

export function filterAllLinksView(links: LinkWithTags[]): LinkWithTags[] {
  return links.filter(isVisibleInAllLinks)
}

export function isArchived(link: Pick<LinkWithTags, 'stashState'>): boolean {
  return link.stashState === 'archived'
}
