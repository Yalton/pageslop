/**
 * CSRF defence for session-cookie requests. SameSite=Lax already keeps the
 * cookie off cross-site POSTs in current browsers; this also refuses unsafe
 * requests whose Origin is not this app, which covers same-site subdomains
 * and browsers that treat cookies without SameSite as None.
 *
 * Runs in middleware (edge runtime), so it uses only Web APIs.
 */

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export function isUnsafeMethod(method: string): boolean {
  return !SAFE_METHODS.has(method.toUpperCase())
}

function originOf(value: string | undefined | null): string | null {
  if (!value) return null
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

/** The host the browser addressed, as a reverse proxy forwards it. */
function requestHost(headers: Headers, urlHost: string | undefined): string | null {
  const forwarded = headers.get('x-forwarded-host')?.split(',')[0]?.trim()
  return forwarded || headers.get('host') || urlHost || null
}

/**
 * Whether an unsafe-method request was sent by this app's own pages.
 *
 * `Sec-Fetch-Site: same-origin` is accepted outright. Otherwise the Origin
 * header must be the configured app origin (BETTER_AUTH_URL) or carry the
 * same host the request was sent to (X-Forwarded-Host, Host, or `urlHost`
 * from the request URL). A cross-site page cannot forge Origin or Host, so a
 * missing or foreign Origin is refused.
 */
export function isSameOriginRequest(headers: Headers, appUrl: string | undefined, urlHost?: string): boolean {
  if (headers.get('sec-fetch-site') === 'same-origin') return true

  const origin = headers.get('origin')
  if (!origin || origin === 'null') return false

  const appOrigin = originOf(appUrl)
  if (appOrigin && origin === appOrigin) return true

  const host = requestHost(headers, urlHost)
  if (!host) return false
  try {
    return new URL(origin).host === host.toLowerCase()
  } catch {
    return false
  }
}
