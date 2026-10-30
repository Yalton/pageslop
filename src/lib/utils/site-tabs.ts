import type { LinkWithTags } from '@/types'
import { domainKey } from '@/lib/utils/group-links'
import { type LinkSort } from '@/lib/utils/link-view'

/** Each site's favicon: the first one any of its links has. Sites without one are left out. */
export function siteFavicons(links: LinkWithTags[]): Map<string, string> {
  const favicons = new Map<string, string>()
  for (const link of links) {
    const site = domainKey(link)
    if (link.favicon && !favicons.has(site)) favicons.set(site, link.favicon)
  }
  return favicons
}

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true })

/**
 * Groups links by website for the "By site" view. Links keep the order they
 * were given in, so the toolbar's sort applies inside each group. Sites are
 * ordered A–Z when sorting by website, otherwise by link count then name.
 */
export function groupLinksBySite(links: LinkWithTags[], sort: LinkSort): Map<string, LinkWithTags[]> {
  const groups = new Map<string, LinkWithTags[]>()
  for (const link of links) {
    const site = domainKey(link)
    const bucket = groups.get(site)
    if (bucket) bucket.push(link)
    else groups.set(site, [link])
  }
  const ordered = [...groups].sort(([a, aLinks], [b, bLinks]) =>
    sort === 'domain'
      ? collator.compare(a, b)
      : bLinks.length - aLinks.length || collator.compare(a, b),
  )
  return new Map(ordered)
}
