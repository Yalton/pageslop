import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { middleware } from '@/middleware'

function run(path: string, method = 'GET') {
  return middleware(new NextRequest(`http://localhost${path}`, { method }))
}

describe('middleware /api/v1 bypass', () => {
  it.each([
    ['GET', '/api/v1/links'],
    ['POST', '/api/v1/links'],
    ['GET', '/api/v1/links/abc'],
    ['GET', '/api/v1/tags'],
  ])('does not redirect %s %s without a session cookie', (method, path) => {
    const res = run(path, method)
    expect(res.headers.get('location')).toBeNull()
    expect(res.headers.get('x-middleware-next')).toBe('1')
  })

  it('does not bypass paths that merely start with the same letters', () => {
    expect(run('/api/v10/links').status).toBe(307)
    expect(run('/api/v1x').status).toBe(307)
  })
})
