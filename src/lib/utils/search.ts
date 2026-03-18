import type { LinkWithTags } from '@/types'

/**
 * Filter links by an optional tag filter (exact match) and optional search query (substring).
 * Tag filter applies first, then search query. Both filters compose (intersection).
 *
 * @param links - Array of links to filter
 * @param query - Search string for substring matching across title, description, URL, domain, tags
 * @param tagFilter - Exact tag name match (case-insensitive), or null to skip
 * @returns Filtered array of links
 */
export function filterLinks(
  links: LinkWithTags[],
  query: string,
  tagFilter: string | null
): LinkWithTags[] {
  let result = links

  // Tag filter: exact match (case-insensitive)
  if (tagFilter) {
    const lowerTag = tagFilter.toLowerCase()
    result = result.filter((link) =>
      link.tags.some((t) => t.name.toLowerCase() === lowerTag)
    )
  }

  // Search query: substring match across title, description, URL, domain, and tag names
  const q = query.trim().toLowerCase()
  if (q) {
    result = result.filter(
      (link) =>
        link.title?.toLowerCase().includes(q) ||
        link.description?.toLowerCase().includes(q) ||
        link.url.toLowerCase().includes(q) ||
        link.domain?.toLowerCase().includes(q) ||
        link.tags.some((t) => t.name.toLowerCase().includes(q))
    )
  }

  return result
}
