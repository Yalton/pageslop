import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { middleware } from '@/middleware'

function run(path: string, method = 'GET') {
  return middleware(new NextRequest(`http://localhost${path}`, { method }))
}

describe('middleware /api/mcp bypass', () => {
  it.each([
    ['POST', '/api/mcp'],
    ['GET', '/api/mcp'],
    ['DELETE', '/api/mcp'],
  ])('does not redirect %s %s without a session cookie', (method, path) => {
    const res = run(path, method)
    expect(res.headers.get('location')).toBeNull()
    expect(res.headers.get('x-middleware-next')).toBe('1')
  })

  it('does not bypass paths that merely start with the same letters', () => {
    expect(run('/api/mcpx').status).toBe(307)
    expect(run('/api/mcp-admin').status).toBe(307)
  })

  it.each([
    '/api/mcp/%2e%2e/%2e%2e/dashboard',
    '/api/mcp/%2e%2e%2fdashboard',
    '/api/mcp/%252e%252e/dashboard',
    '/api/mcp/%2E%2E/settings',
  ])('refuses the bypass for encoded dot segments: %s', (path) => {
    expect(run(path).status).toBe(307)
  })
})

describe('middleware landing images', () => {
  it('serves the landing page images without a session cookie', () => {
    expect(run('/landing/youtube.png').headers.get('x-middleware-next')).toBe('1')
  })
})
