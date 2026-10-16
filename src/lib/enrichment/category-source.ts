export type CategorySource = 'rule' | 'llm' | 'user'

/**
 * Columns to set when enrichment writes a category. A category the user picked
 * by hand ('user') is never overwritten, so re-scrapes and backfills skip it.
 */
export function categoryUpdate(
  currentSource: string | null | undefined,
  category: string,
  source: 'rule' | 'llm'
): { category?: string; categorySource?: CategorySource } {
  if (currentSource === 'user') return {}
  return { category, categorySource: source }
}
