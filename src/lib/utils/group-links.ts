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
