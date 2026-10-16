/**
 * Canonical form of a URL, used as the saved value and the duplicate key.
 *
 * Only changes the WHATWG URL parser treats as equivalent: scheme and host case,
 * default ports, and the root slash ("https://a.com" and "https://a.com/" are
 * the same page). Path, query and fragment are kept, since sites route on them.
 */
export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim()
  try {
    return new URL(trimmed).href
  } catch {
    return trimmed
  }
}
