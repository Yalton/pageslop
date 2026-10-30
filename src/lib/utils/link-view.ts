import type { LinkWithTags, UptimeStatus } from '@/types'
import { domainKey } from '@/lib/utils/group-links'

/**
 * Sort and filter state for All Links and Archived, kept in the URL query
 * next to ?tag= so a view can be bookmarked or shared.
 */
export const LINK_SORTS = ['newest', 'oldest', 'title', 'domain'] as const
export type LinkSort = (typeof LINK_SORTS)[number]

export const LINK_SORT_LABELS: Record<LinkSort, string> = {
  newest: 'Newest first',
  oldest: 'Oldest first',
  title: 'Title A–Z',
  domain: 'Website A–Z',
}

/**
 * Status facet values. 'down' is "dead": the link's uptimeStatus is 'down',
 * which is exactly what the red UptimeDot shows (two consecutive failed checks).
 * Links whose scrape errored but never flipped to 'down' are not dead.
 */
export const LINK_STATUSES = ['down', 'up', 'unchecked'] as const satisfies readonly UptimeStatus[]
export type LinkStatusFilter = (typeof LINK_STATUSES)[number]

export const LINK_STATUS_LABELS: Record<LinkStatusFilter, string> = {
  down: 'Dead',
  up: 'Up',
  unchecked: 'Unchecked',
}

export interface LinkViewState {
  sort: LinkSort
  domain: string | null
  category: string | null
  untagged: boolean
  described: boolean
  status: LinkStatusFilter | null
}

export const DEFAULT_LINK_VIEW: LinkViewState = {
  sort: 'newest',
  domain: null,
  category: null,
  untagged: false,
  described: false,
  status: null,
}

interface QueryReader {
  get(name: string): string | null
}

export function parseLinkView(params: QueryReader): LinkViewState {
  const sort = params.get('sort')
  return {
    sort: (LINK_SORTS as readonly string[]).includes(sort ?? '') ? (sort as LinkSort) : 'newest',
    domain: params.get('domain') || null,
    category: params.get('category') || null,
    untagged: params.get('untagged') === '1',
    described: params.get('described') === '1',
    status: (LINK_STATUSES as readonly string[]).includes(params.get('status') ?? '')
      ? (params.get('status') as LinkStatusFilter)
      : null,
  }
}

/** A change to the query: view fields plus the existing tag filter. null or a default value removes the param. */
export type LinkViewPatch = Partial<LinkViewState> & { tag?: string | null }

/** Applies patch to the current query and returns the new query string (no leading "?"). Other params are kept. */
export function linkViewQuery(current: URLSearchParams, patch: LinkViewPatch): string {
  const next = new URLSearchParams(current)
  for (const [key, value] of Object.entries(patch)) {
    next.delete(key)
    if (value === null || value === undefined || value === false || value === '') continue
    if (key === 'sort' && value === DEFAULT_LINK_VIEW.sort) continue
    next.set(key, value === true ? '1' : String(value))
  }
  return next.toString()
}

/** Patch that turns off every facet filter (not the sort). */
export const CLEAR_FACETS: LinkViewPatch = { domain: null, category: null, untagged: false, described: false, status: null }

/** Patch that turns off every filter including ?tag=; the sort is kept. */
export const CLEAR_ALL_FILTERS: LinkViewPatch = { ...CLEAR_FACETS, tag: null }

export interface FilterChip {
  key: string
  /** What the filter is, e.g. "Website"; null for on/off filters whose value says it all. */
  label: string | null
  value: string
  /** Patch that removes just this filter. */
  remove: LinkViewPatch
}

/** One removable chip per active filter, tag first, in the order the Filters panel lists them. */
export function activeFilterChips(view: LinkViewState, tag: string | null): FilterChip[] {
  const chips: FilterChip[] = []
  if (tag) chips.push({ key: 'tag', label: 'Tag', value: tag, remove: { tag: null } })
  if (view.domain) chips.push({ key: 'domain', label: 'Website', value: view.domain, remove: { domain: null } })
  if (view.category) chips.push({ key: 'category', label: 'Category', value: view.category, remove: { category: null } })
  if (view.status) chips.push({ key: 'status', label: 'Status', value: LINK_STATUS_LABELS[view.status], remove: { status: null } })
  if (view.untagged) chips.push({ key: 'untagged', label: null, value: 'Untagged', remove: { untagged: false } })
  if (view.described) chips.push({ key: 'described', label: null, value: 'Has description', remove: { described: false } })
  return chips
}

/** Path plus the patched query, or the bare path when no params remain. */
export function linkViewHref(basePath: string, current: URLSearchParams, patch: LinkViewPatch): string {
  const query = linkViewQuery(current, patch)
  return query ? `${basePath}?${query}` : basePath
}

/**
 * Why nothing matched, naming every active cause, e.g.
 * 'No links matching "rust", tagged "go", from github.com'. null when nothing filters.
 */
export function emptyFilterMessage(search: string, tag: string | null, view: LinkViewState): string | null {
  const q = search.trim()
  const parts = [
    q && `matching "${q}"`,
    tag && `tagged "${tag}"`,
    view.domain && `from ${view.domain}`,
    view.category && `in ${view.category}`,
    view.untagged && 'without tags',
    view.described && 'with a description',
    view.status && `that are ${LINK_STATUS_LABELS[view.status].toLowerCase()}`,
  ].filter(Boolean)
  return parts.length ? `No links ${parts.join(', ')}` : null
}

/** Accepts Date or the ISO string SWR delivers from JSON. */
function time(value: Date | string | null): number {
  return value ? new Date(value).getTime() : 0
}

/**
 * Newest first. Links saved in one transaction (a stash of many tabs) share
 * created_at, so ties fall back to stashedAt and then id descending, matching
 * listLinksWithTags (ORDER BY created_at DESC, id DESC), so the order is stable.
 */
function byNewest(a: LinkWithTags, b: LinkWithTags): number {
  return (
    time(b.createdAt) - time(a.createdAt) ||
    time(b.stashedAt) - time(a.stashedAt) ||
    (a.id < b.id ? 1 : a.id > b.id ? -1 : 0)
  )
}

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true })

const COMPARATORS: Record<LinkSort, (a: LinkWithTags, b: LinkWithTags) => number> = {
  newest: byNewest,
  oldest: (a, b) => byNewest(b, a),
  title: (a, b) => collator.compare(a.title?.trim() || a.url, b.title?.trim() || b.url) || byNewest(a, b),
  domain: (a, b) => collator.compare(domainKey(a), domainKey(b)) || byNewest(a, b),
}

/** Returns a sorted copy. */
export function sortLinks(links: LinkWithTags[], sort: LinkSort): LinkWithTags[] {
  return [...links].sort(COMPARATORS[sort])
}

/** Filters by the view's domain, category, untagged and described settings, then sorts. */
export function applyLinkView(links: LinkWithTags[], view: LinkViewState): LinkWithTags[] {
  const filtered = links.filter(
    (link) =>
      (!view.domain || domainKey(link) === view.domain) &&
      (!view.category || link.category === view.category) &&
      (!view.untagged || link.tags.length === 0) &&
      (!view.described || Boolean(link.description?.trim())) &&
      (!view.status || link.uptimeStatus === view.status),
  )
  return sortLinks(filtered, view.sort)
}

/** True when a filter (not just the sort) narrows the list. */
export function hasActiveLinkFilters(view: LinkViewState): boolean {
  return Boolean(view.domain || view.category || view.untagged || view.described || view.status)
}

/** Number of active filters (not the sort); each facet and toggle counts once. */
export function activeFilterCount(view: LinkViewState): number {
  return [view.domain, view.category, view.untagged, view.described, view.status].filter(Boolean).length
}

export interface FacetOption {
  value: string
  count: number
}

function countBy(values: (string | null)[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1)
  return counts
}

/** Domains present in links, most links first, then by name. */
export function domainOptions(links: LinkWithTags[]): FacetOption[] {
  return [...countBy(links.map(domainKey))]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || collator.compare(a.value, b.value))
}

/** Categories present in links, alphabetical. Uncategorized links are left out. */
export function categoryOptions(links: LinkWithTags[]): FacetOption[] {
  return [...countBy(links.map((l) => l.category))]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => collator.compare(a.value, b.value))
}

/** Counts per status, in fixed order (Dead first); zero counts are kept so the options don't jump. */
export function statusOptions(links: LinkWithTags[]): FacetOption[] {
  return LINK_STATUSES.map((value) => ({ value, count: links.filter((l) => l.uptimeStatus === value).length }))
}

/** Radix Select reserves the empty string, so "no filter" is this value in the control. */
export const ANY_FACET = '__any'

export function facetToSelect(value: string | null): string {
  return value ?? ANY_FACET
}

export function facetFromSelect(value: string): string | null {
  return value === ANY_FACET ? null : value
}

/**
 * Options for a facet control. A value from the URL that no visible link has
 * is added first with count 0, so the control can still show it.
 */
export function facetItems(options: FacetOption[], selected: string | null): FacetOption[] {
  if (!selected || options.some((o) => o.value === selected)) return options
  return [{ value: selected, count: 0 }, ...options]
}
