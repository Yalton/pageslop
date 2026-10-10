import type { LinkWithTags } from '@/types'

/**
 * All Links, the graph and tag counts show user-saved links and stash links the
 * user chose to keep. inbox and read live on /dashboard/revisit; archived stash
 * was dismissed or expired. listTagsWithCount mirrors this rule in SQL.
 */
export function isVisibleInAllLinks(link: Pick<LinkWithTags, 'stashState'>): boolean {
  return link.stashState === null || link.stashState === 'kept'
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
