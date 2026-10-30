import { describe, expect, it } from 'vitest'
import { contentSecurityPolicy, securityHeaders } from '@/lib/security-headers'

function directive(policy: string, name: string): string[] | undefined {
  const found = policy.split('; ').find((d) => d.startsWith(`${name} `))
  return found?.split(' ').slice(1)
}

describe('contentSecurityPolicy', () => {
  it('forbids framing, plugins and foreign form posts', () => {
    const policy = contentSecurityPolicy(false)
    expect(directive(policy, 'frame-ancestors')).toEqual(["'none'"])
    expect(directive(policy, 'object-src')).toEqual(["'none'"])
    expect(directive(policy, 'form-action')).toEqual(["'self'"])
    expect(directive(policy, 'base-uri')).toEqual(["'self'"])
  })

  it('only loads scripts and connections from the app itself in production', () => {
    const policy = contentSecurityPolicy(false)
    expect(directive(policy, 'script-src')).toEqual(["'self'", "'unsafe-inline'"])
    expect(directive(policy, 'connect-src')).toEqual(["'self'"])
  })

  it('allows eval and the HMR socket only in development', () => {
    const policy = contentSecurityPolicy(true)
    expect(directive(policy, 'script-src')).toContain("'unsafe-eval'")
    expect(directive(policy, 'connect-src')).toContain('ws:')
  })

  it('loads images only from the app itself', () => {
    expect(directive(contentSecurityPolicy(false), 'img-src')).toEqual(["'self'", 'data:', 'blob:'])
  })
})

describe('securityHeaders', () => {
  it('sends the CSP with frame, sniffing and referrer protections', () => {
    const headers = Object.fromEntries(securityHeaders(false).map((h) => [h.key, h.value]))
    expect(headers['Content-Security-Policy']).toBe(contentSecurityPolicy(false))
    expect(headers['X-Frame-Options']).toBe('DENY')
    expect(headers['X-Content-Type-Options']).toBe('nosniff')
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin')
  })
})
