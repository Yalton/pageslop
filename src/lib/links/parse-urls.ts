/**
 * Parse a newline-separated string of URLs, filtering out invalid ones.
 * Used by POST /api/links route handler.
 */
export function parseUrls(input: string): string[] {
  return input
    .split('\n')
    .map((u) => u.trim())
    .filter((u) => {
      if (!u) return false
      try {
        new URL(u)
        return true
      } catch {
        return false
      }
    })
}
