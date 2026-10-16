import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// /api/stash and /api/v1 (and their subpaths) use bearer-token auth and return
// their own 401/403 JSON, so they must not be redirected for lacking a session cookie.
const publicPaths = ['/', '/login', '/signup', '/forgot-password', '/reset-password', '/privacy', '/terms', '/about', '/api/auth', '/api/stash', '/api/v1']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public paths
  if (publicPaths.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next()
  }

  // Check for session cookie (either plain or __Secure- prefixed)
  const sessionToken = request.cookies.get('better-auth.session_token') || request.cookies.get('__Secure-better-auth.session_token')
  if (!sessionToken) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
