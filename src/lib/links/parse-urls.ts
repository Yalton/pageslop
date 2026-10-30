import { isHttpUrl } from './http-url'
import { MAX_URL_LENGTH } from './limits'

/**
 * Parse a newline-separated string of URLs, keeping only http(s) ones of at
 * most MAX_URL_LENGTH characters.
 * Used by POST /api/links route handler.
 */
export function parseUrls(input: string): string[] {
  return input
    .split('\n')
    .map((u) => u.trim())
    .filter((u) => u !== '' && u.length <= MAX_URL_LENGTH && isHttpUrl(u))
}
