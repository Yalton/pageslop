/**
 * The part of a saved URL that is safe to write to logs: its host. Paths and
 * query strings can carry secrets (signed S3 links, magic sign-in links), so
 * logs name the link by id and host instead.
 */
export function hostForLog(url: string): string {
  try {
    return new URL(url).host || '(no host)'
  } catch {
    return '(invalid URL)'
  }
}
