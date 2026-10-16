/**
 * Resolve an og:image / favicon value against the final page URL.
 * Returns an absolute http(s) URL, or null if the value is empty,
 * unresolvable, or not http(s).
 */
export function resolveAssetUrl(value: string | null | undefined, pageUrl: string): string | null {
  const v = value?.trim()
  if (!v) return null
  try {
    const u = new URL(v, pageUrl)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null
  } catch {
    return null
  }
}
