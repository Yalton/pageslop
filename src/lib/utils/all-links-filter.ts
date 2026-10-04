import type { LinkWithTags } from '@/types'

/** inbox and read links live on /dashboard/revisit, not in All Links. */
export function isVisibleInAllLinks(link: Pick<LinkWithTags, 'stashState'>): boolean {
  return link.stashState !== 'inbox' && link.stashState !== 'read'
}

export function filterAllLinksView(links: LinkWithTags[]): LinkWithTags[] {
  return links.filter(isVisibleInAllLinks)
}

/**
 * Which empty state All Links shows: none, a first-run hint, or a pointer to
 * To Revisit when every link is waiting there.
 */
export function allLinksEmptyState(
  links: Pick<LinkWithTags, 'stashState'>[],
): 'no-links' | 'all-in-revisit' | null {
  if (links.length === 0) return 'no-links'
  return links.some(isVisibleInAllLinks) ? null : 'all-in-revisit'
}

export function isArchived(link: Pick<LinkWithTags, 'stashState'>): boolean {
  return link.stashState === 'archived'
}
