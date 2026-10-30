import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { isSameOriginRequest, isUnsafeMethod } from '@/lib/auth/same-origin'

// /api/stash, /api/v1 and /api/mcp (and their subpaths) use bearer-token auth and return
// their own 401/403 JSON, so they must not be redirected for lacking a session cookie.
const publicPaths = ['/', '/login', '/signup', '/forgot-password', '/reset-password', '/privacy', '/terms', '/about', '/landing', '/api/auth', '/api/stash', '/api/v1', '/api/mcp']

// Repeated decoding is bounded so a deeply nested encoding cannot loop forever.
const MAX_DECODE_PASSES = 3

/**
 * Whether a pathname may use the public-path bypass. The prefix check runs on
 * the raw pathname, so "/api/v1/%2e%2e/dashboard" would match "/api/v1/" yet
 * could resolve elsewhere. Refuse the bypass if, after percent-decoding
 * (repeatedly, for double encoding), any segment split on "/" or "\" is "." or
 * "..", or if the pathname cannot be decoded at all.
 */
function hasNoDotSegments(pathname: string): boolean {
  let decoded = pathname
  for (let pass = 0; pass < MAX_DECODE_PASSES; pass++) {
    let next: string
    try {
      next = decodeURIComponent(decoded)
    } catch {
      return false
    }
    if (next === decoded) break
    decoded = next
  }
  if (/%[0-9a-f]{2}/i.test(decoded)) return false // still encoded after the last pass
  return !decoded.split(/[/\\]/).some((segment) => segment === '.' || segment === '..')
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public paths
  if (
    hasNoDotSegments(pathname) &&
    publicPaths.some((p) => pathname === p || pathname.startsWith(p + '/'))
  ) {
    return NextResponse.next()
  }

  // Check for session cookie (either plain or __Secure- prefixed)
  const sessionToken = request.cookies.get('better-auth.session_token') || request.cookies.get('__Secure-better-auth.session_token')
  if (!sessionToken) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // CSRF: a cookie-authenticated write must come from the app's own origin.
  // Bearer-token routes (/api/v1, /api/mcp, /api/stash) and Better Auth's own
  // /api/auth routes returned above, so the extension and API clients never
  // reach this check.
  if (isUnsafeMethod(request.method) && !isSameOriginRequest(request.headers, process.env.BETTER_AUTH_URL, request.nextUrl.host)) {
    return NextResponse.json({ error: 'Cross-origin request refused' }, { status: 403 })
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
