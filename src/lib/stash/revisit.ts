import type { LinkWithTags } from '@/types'

/**
 * Client-side mirror of STASH_EXPIRE_DAYS. The server value lives in
 * src/lib/stash/expiry.ts, which reads process.env and must not be bundled
 * into client components. Keep this in sync with the server default.
 */
export const CLIENT_STASH_EXPIRE_DAYS = 14
/** Rows show "expires in Nd" once this many days or fewer remain. */
export const EXPIRY_WARNING_DAYS = 3
/** "Dismiss all" asks for confirmation above this many items. */
export const DISMISS_CONFIRM_THRESHOLD = 10

const DAY_MS = 86_400_000

export function isRevisitable(link: Pick<LinkWithTags, 'stashState'>): boolean {
  return link.stashState === 'inbox' || link.stashState === 'read'
}

export function selectRevisitLinks(links: LinkWithTags[]): LinkWithTags[] {
  return links.filter(isRevisitable)
}

export function countInbox(links: Pick<LinkWithTags, 'stashState'>[]): number {
  let count = 0
  for (const link of links) {
    if (link.stashState === 'inbox') count++
  }
  return count
}

export function daysSince(date: Date | string, now: Date): number {
  const elapsed = now.getTime() - new Date(date).getTime()
  return Math.max(0, Math.floor(elapsed / DAY_MS))
}

export function expiresInDays(
  stashedAt: Date | string,
  now: Date,
  days: number = CLIENT_STASH_EXPIRE_DAYS,
): number {
  const expiresAt = new Date(stashedAt).getTime() + days * DAY_MS
  return Math.max(0, Math.ceil((expiresAt - now.getTime()) / DAY_MS))
}

export interface RevisitRowMeta {
  stashedLabel: string | null
  expiryLabel: string | null
}

export function rowMeta(
  stashedAt: Date | string | null,
  now: Date,
  days: number = CLIENT_STASH_EXPIRE_DAYS,
): RevisitRowMeta {
  if (!stashedAt) return { stashedLabel: null, expiryLabel: null }
  const remaining = expiresInDays(stashedAt, now, days)
  return {
    stashedLabel: `stashed ${daysSince(stashedAt, now)}d ago`,
    expiryLabel: remaining <= EXPIRY_WARNING_DAYS ? `expires in ${remaining}d` : null,
  }
}

export function needsDismissConfirm(count: number): boolean {
  return count > DISMISS_CONFIRM_THRESHOLD
}

export interface OpenAllResult {
  openedIds: string[]
  blockedCount: number
}

/**
 * Opens each URL with `openFn`. A null/undefined return means the browser
 * blocked the pop-up. Only ids whose tab actually opened are returned, so the
 * caller marks just those as read.
 */
export function openAllUrls(
  items: { id: string; url: string }[],
  openFn: (url: string) => unknown,
): OpenAllResult {
  const openedIds: string[] = []
  let blockedCount = 0
  for (const item of items) {
    const handle = openFn(item.url)
    if (handle == null) {
      blockedCount++
    } else {
      openedIds.push(item.id)
    }
  }
  return { openedIds, blockedCount }
}
