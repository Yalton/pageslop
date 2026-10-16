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

describe('middleware public-path bypass refuses dot segments', () => {
  it.each([
    '/api/v1/%2e%2e/dashboard',
    '/api/v1/%2E%2E/dashboard',
    '/api/v1/%2e%2e%2fdashboard',
    '/api/v1/%2E%2E%2Fdashboard',
    '/api/v1/links/%2e%2e/%2e%2e/dashboard',
    '/api/v1/links/%2e%2fsecret',
    '/api/v1/%252e%252e/dashboard',
    '/api/v1/..%5cdashboard',
    '/api/stash/%2e%2e/dashboard',
    '/api/stash/%2E%2E%2Fsettings',
    '/api/stash/ping/%2e%2e/%2e%2e/links',
  ])('redirects %s without a session cookie', (path) => {
    const res = run(path)
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost/login')
  })

  it('treats an undecodable pathname as non-public', () => {
    expect(run('/api/v1/%E0%A4%A').status).toBe(307)
    expect(run('/api/stash/%E0%A4%A').status).toBe(307)
  })

  it('still lets ordinary encoded characters through', () => {
    const res = run('/api/v1/links/abc%2Ddef')
    expect(res.headers.get('location')).toBeNull()
    expect(res.headers.get('x-middleware-next')).toBe('1')
  })
})
