/**
 * Path of an auth request that is safe to log. Drops the query string
 * (verify-email?token=..., callback URLs) and masks the token segment of
 * /reset-password/<token>, since either is enough to take over an account.
 */
export function redactAuthPath(url: URL): string {
  return url.pathname.replace(/\/reset-password\/[^/]+/, '/reset-password/[redacted]')
}
