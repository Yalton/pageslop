import type { Link } from '@/types'

// Column defaults for a fresh, never-enriched, never-checked link. Spread
// into a fixture so it stays a full Link when the table gains columns.
export const LINK_DEFAULTS: Pick<
  Link,
  | 'enrichmentSource'
  | 'enrichmentError'
  | 'categorySource'
  | 'uptimeStatus'
  | 'lastStatusCode'
  | 'lastCheckedAt'
  | 'consecutiveFailures'
  | 'source'
  | 'stashState'
  | 'stashedAt'
> = {
  enrichmentSource: null,
  enrichmentError: null,
  categorySource: null,
  uptimeStatus: 'unchecked',
  lastStatusCode: null,
  lastCheckedAt: null,
  consecutiveFailures: 0,
  source: 'manual',
  stashState: null,
  stashedAt: null,
}
