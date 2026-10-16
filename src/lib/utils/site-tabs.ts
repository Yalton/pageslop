import type { LinkWithTags } from '@/types'
import { domainKey } from '@/lib/utils/group-links'
import { type FacetOption, type LinkSort } from '@/lib/utils/link-view'

/** How many website tabs show before the rest go under "More". */
export const SITE_TAB_LIMIT = 8

export interface SiteTabs {
  tabs: FacetOption[]
  overflow: FacetOption[]
}

/**
 * Splits domain options (most links first, as domainOptions returns them) into
 * the tabs shown in the row and the overflow behind "More". The selected site
 * always gets a tab: when it would fall into the overflow it takes the last
 * slot, and a site from the URL that no link has shows with count 0.
 */
export function siteTabs(options: FacetOption[], selected: string | null, limit = SITE_TAB_LIMIT): SiteTabs {
  const known = !selected || options.some((o) => o.value === selected)
  const all = known ? options : [...options, { value: selected, count: 0 }]
  const index = selected ? all.findIndex((o) => o.value === selected) : -1
  if (index === -1 || index < limit) {
    return { tabs: all.slice(0, limit), overflow: all.slice(limit) }
  }
  const tabs = [...all.slice(0, Math.max(limit - 1, 0)), all[index]]
  const overflow = all.filter((o) => !tabs.includes(o))
  return { tabs, overflow }
}

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
