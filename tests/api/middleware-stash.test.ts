import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { middleware } from '@/middleware'

function run(path: string, method = 'GET') {
  return middleware(new NextRequest(`http://localhost${path}`, { method }))
}

describe('middleware /api/stash bypass', () => {
  it('does not redirect POST /api/stash without a session cookie', () => {
    const res = run('/api/stash', 'POST')
    expect(res.headers.get('location')).toBeNull()
    expect(res.headers.get('x-middleware-next')).toBe('1')
  })

  it('does not redirect GET /api/stash/ping without a session cookie', () => {
    const res = run('/api/stash/ping')
    expect(res.headers.get('location')).toBeNull()
    expect(res.headers.get('x-middleware-next')).toBe('1')
  })

  it('still redirects session routes without a cookie', () => {
    const res = run('/api/links')
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost/login')
  })

  it('does not bypass paths that merely start with the same letters', () => {
    const res = run('/api/stashed')
    expect(res.status).toBe(307)
  })
})
