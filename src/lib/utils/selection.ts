import type { LinkWithTags, StashState } from '@/types'

/**
 * Next selection after clicking `id`. A plain click toggles it. A shift-click
 * with an anchor (the last plain-clicked id) sets every id between the two,
 * in display order, to the clicked id's new state.
 */
export function toggleSelection(
  selected: ReadonlySet<string>,
  order: readonly string[],
  id: string,
  shiftKey: boolean,
  anchor: string | null,
): Set<string> {
  const next = new Set(selected)
  const select = !selected.has(id)
  const from = anchor && shiftKey ? order.indexOf(anchor) : -1
  const to = order.indexOf(id)
  if (from === -1 || to === -1) {
    if (select) next.add(id)
    else next.delete(id)
    return next
  }
  const [lo, hi] = from < to ? [from, to] : [to, from]
  for (const rangeId of order.slice(lo, hi + 1)) {
    if (select) next.add(rangeId)
    else next.delete(rangeId)
  }
  return next
}

/**
 * Where Restore sends an archived link: tabs the extension saved go back to
 * the To Revisit inbox, links saved by hand go back to All Links.
 */
export function restoreTarget(link: Pick<LinkWithTags, 'source'>): StashState | null {
  return link.source === 'stash' ? 'inbox' : null
}

/** Groups link ids by a state, so each group can be set with one bulk call. */
export function groupIdsByState<S>(entries: Iterable<[string, S]>): Map<S, string[]> {
  const groups = new Map<S, string[]>()
  for (const [id, state] of entries) groups.set(state, [...(groups.get(state) ?? []), id])
  return groups
}
