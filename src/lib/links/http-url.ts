/**
 * Whether a string parses as an absolute http: or https: URL. Every path that
 * saves or opens a link uses this, so javascript:, data:, file: and the like
 * never become clickable links.
 */
export function isHttpUrl(raw: string): boolean {
  try {
    const { protocol } = new URL(raw.trim())
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}
