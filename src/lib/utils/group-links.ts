import type { LinkWithTags } from '@/types'

const UNCATEGORIZED = 'Uncategorized'

/**
 * Group links by their category field. Links with null category are placed in "Uncategorized".
 * Returns a Map with category keys sorted alphabetically, with "Uncategorized" always last.
 *
 * @param links - Array of links to group
 * @returns Map<category, links[]> preserving sorted insertion order
 */
export function groupLinks(links: LinkWithTags[]): Map<string, LinkWithTags[]> {
  // Build an intermediate plain object for grouping
  const groups: Record<string, LinkWithTags[]> = {}

  for (const link of links) {
    const key = link.category ?? UNCATEGORIZED
    if (!groups[key]) {
      groups[key] = []
    }
    groups[key].push(link)
  }

  // Sort category keys alphabetically, "Uncategorized" always last
  const sortedKeys = Object.keys(groups)
    .filter((k) => k !== UNCATEGORIZED)
    .sort()

  if (groups[UNCATEGORIZED]) {
    sortedKeys.push(UNCATEGORIZED)
  }

  // Build the Map in sorted order
  const result = new Map<string, LinkWithTags[]>()
  for (const key of sortedKeys) {
    result.set(key, groups[key])
  }

  return result
}

const OTHER_DOMAIN = 'other'

function domainKey(link: LinkWithTags): string {
  if (link.domain) return link.domain
  try {
    return new URL(link.url).hostname.replace(/^www\./, '') || OTHER_DOMAIN
  } catch {
    return OTHER_DOMAIN
  }
}

function stashedTime(link: LinkWithTags): number {
  return link.stashedAt ? new Date(link.stashedAt).getTime() : 0
}

/**
 * Group links by domain. A null domain falls back to the URL hostname
 * (without "www."); unparseable URLs go under "other".
 * Groups are ordered by size descending, then domain name ascending.
 * Links inside a group are ordered by stashedAt descending (null last).
 *
 * @param links - Array of links to group (not mutated)
 * @returns Map<domain, links[]> whose insertion order is the display order
 */
export function groupByDomain(links: LinkWithTags[]): Map<string, LinkWithTags[]> {
  const groups = new Map<string, LinkWithTags[]>()

  for (const link of links) {
    const key = domainKey(link)
    const bucket = groups.get(key)
    if (bucket) bucket.push(link)
    else groups.set(key, [link])
  }

  const ordered = [...groups.entries()].sort(
    ([a, aLinks], [b, bLinks]) => bLinks.length - aLinks.length || a.localeCompare(b)
  )

  const result = new Map<string, LinkWithTags[]>()
  for (const [key, bucket] of ordered) {
    result.set(key, [...bucket].sort((x, y) => stashedTime(y) - stashedTime(x)))
  }
  return result
}
