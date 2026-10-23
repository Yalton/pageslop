import { isHttpUrl } from './http-url'

/**
 * Parse a newline-separated string of URLs, keeping only http(s) ones.
 * Used by POST /api/links route handler.
 */
export function parseUrls(input: string): string[] {
  return input
    .split('\n')
    .map((u) => u.trim())
    .filter((u) => u !== '' && isHttpUrl(u))
}
