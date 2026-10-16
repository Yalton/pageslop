import type { LinkWithTags } from '@/types'
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

export interface LinkViewState {
  sort: LinkSort
  domain: string | null
  category: string | null
  untagged: boolean
  described: boolean
}

export const DEFAULT_LINK_VIEW: LinkViewState = {
  sort: 'newest',
  domain: null,
  category: null,
  untagged: false,
  described: false,
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

/** Accepts Date or the ISO string SWR delivers from JSON. */
function time(value: Date | string | null): number {
  return value ? new Date(value).getTime() : 0
}

/**
 * Newest first. Links saved in one transaction (a stash of many tabs) share
 * created_at, so ties fall back to stashedAt and then id to keep the order
 * stable across refetches.
 */
function byNewest(a: LinkWithTags, b: LinkWithTags): number {
  return (
    time(b.createdAt) - time(a.createdAt) ||
    time(b.stashedAt) - time(a.stashedAt) ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
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
      (!view.described || Boolean(link.description?.trim())),
  )
  return sortLinks(filtered, view.sort)
}

/** True when a filter (not just the sort) narrows the list. */
export function hasActiveLinkFilters(view: LinkViewState): boolean {
  return Boolean(view.domain || view.category || view.untagged || view.described)
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
