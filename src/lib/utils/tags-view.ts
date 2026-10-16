export interface TagWithCount {
  name: string
  count: number
}

/**
 * Which tags the Tags page lists. Tags on a single link are mostly noise, so
 * they stay hidden unless the user asks for them or searches.
 */
export function selectTagsToShow(
  tags: TagWithCount[],
  query: string,
  showAll: boolean,
): { shown: TagWithCount[]; hiddenCount: number } {
  const q = query.trim().toLowerCase()
  if (q) {
    return { shown: tags.filter((t) => t.name.toLowerCase().includes(q)), hiddenCount: 0 }
  }
  if (showAll) return { shown: tags, hiddenCount: 0 }
  const shown = tags.filter((t) => t.count > 1)
  return { shown, hiddenCount: tags.length - shown.length }
}

/**
 * A tag's size relative to the busiest tag, from 0 to 1. A floor keeps the
 * smallest tag's bar visible; with no usable max everything is at the floor.
 */
export function tagWeight(count: number, maxCount: number, floor = 0.08): number {
  if (!(maxCount > 0) || !(count > 0)) return floor
  return Math.min(1, Math.max(floor, count / maxCount))
}
