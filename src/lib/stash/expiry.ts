export const STASH_EXPIRE_DEFAULT_DAYS = 14

const MS_PER_DAY = 86_400_000

/**
 * Returns the moment before which stashed links are considered expired.
 * Pure: does not read the clock or the environment.
 */
export function stashExpiryCutoff(now: Date, days: number): Date {
  return new Date(now.getTime() - days * MS_PER_DAY)
}

/**
 * Parses STASH_EXPIRE_DAYS. Missing, non-numeric, non-integer, zero,
 * negative or unsafely large values fall back to the default of 14 days.
 */
export function stashExpireDays(raw?: string): number {
  const trimmed = (raw ?? '').trim()
  const parsed = Number(trimmed)
  return trimmed !== '' && Number.isSafeInteger(parsed) && parsed > 0
    ? parsed
    : STASH_EXPIRE_DEFAULT_DAYS
}
