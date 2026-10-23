import { describe, it, expect, vi, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { middleware } from '@/middleware'

const COOKIE = { cookie: 'better-auth.session_token=abc' }

function run(path: string, method: string, headers: Record<string, string> = {}) {
  return middleware(new NextRequest(`http://localhost:3000${path}`, { method, headers }))
}

afterEach(() => vi.unstubAllEnvs())

describe('middleware CSRF check on session-cookie writes', () => {
  it.each(['POST', 'PATCH', 'DELETE'])('refuses a cross-origin %s with 403', async (method) => {
    const res = run('/api/links', method, { ...COOKIE, origin: 'https://evil.example' })
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'Cross-origin request refused' })
  })

  it('refuses a cookie write with no Origin header', () => {
    expect(run('/api/links/abc', 'DELETE', COOKIE).status).toBe(403)
  })

  it('lets the app’s own same-origin fetches through', () => {
    const res = run('/api/links', 'POST', { ...COOKIE, origin: 'http://localhost:3000' })
    expect(res.headers.get('x-middleware-next')).toBe('1')
  })

  it('accepts the BETTER_AUTH_URL origin even when the internal host differs', () => {
    vi.stubEnv('BETTER_AUTH_URL', 'https://slop.example.org')
    const res = run('/api/settings/tokens', 'POST', { ...COOKIE, origin: 'https://slop.example.org' })
    expect(res.headers.get('x-middleware-next')).toBe('1')
  })

  it('accepts Sec-Fetch-Site: same-origin', () => {
    const res = run('/api/links/bulk-delete', 'POST', { ...COOKIE, 'sec-fetch-site': 'same-origin' })
    expect(res.headers.get('x-middleware-next')).toBe('1')
  })

  it('does not check safe methods', () => {
    const res = run('/api/links', 'GET', { ...COOKIE, origin: 'https://evil.example' })
    expect(res.headers.get('x-middleware-next')).toBe('1')
  })

  it.each([
    ['/api/v1/links', 'POST'],
    ['/api/v1/links/abc', 'DELETE'],
    ['/api/mcp', 'POST'],
    ['/api/stash', 'POST'],
    ['/api/auth/sign-in/email', 'POST'],
  ])('leaves bearer-token and Better Auth route %s %s alone, cookie or not', (path, method) => {
    for (const headers of [{}, { ...COOKIE, origin: 'moz-extension://abc' }]) {
      const res = run(path, method, headers)
      expect(res.headers.get('x-middleware-next')).toBe('1')
    }
  })
})
