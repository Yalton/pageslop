import { describe, it, expect } from 'vitest'
import { isSameOriginRequest, isUnsafeMethod } from '@/lib/auth/same-origin'

const APP = 'https://slop.example.org'

function h(init: Record<string, string>) {
  return new Headers(init)
}

describe('isUnsafeMethod', () => {
  it.each(['POST', 'PATCH', 'PUT', 'DELETE', 'post'])('%s is unsafe', (m) => expect(isUnsafeMethod(m)).toBe(true))
  it.each(['GET', 'HEAD', 'OPTIONS'])('%s is safe', (m) => expect(isUnsafeMethod(m)).toBe(false))
})

describe('isSameOriginRequest', () => {
  it('accepts Sec-Fetch-Site: same-origin', () => {
    expect(isSameOriginRequest(h({ 'sec-fetch-site': 'same-origin' }), APP)).toBe(true)
  })

  it('accepts an Origin equal to the configured app origin', () => {
    expect(isSameOriginRequest(h({ origin: APP, host: 'internal:3000' }), `${APP}/`)).toBe(true)
  })

  it('accepts an Origin with the host the request was sent to when no app URL is set', () => {
    expect(isSameOriginRequest(h({ origin: 'http://localhost:3000', host: 'localhost:3000' }), undefined)).toBe(true)
  })

  it('uses X-Forwarded-Host behind a reverse proxy', () => {
    expect(
      isSameOriginRequest(h({ origin: 'https://slop.lan', host: '127.0.0.1:3000', 'x-forwarded-host': 'slop.lan' }), undefined),
    ).toBe(true)
  })

  it.each([
    ['a foreign Origin', { origin: 'https://evil.example', host: 'slop.example.org' }],
    ['a sibling subdomain', { origin: 'https://evil.example.org', host: 'slop.example.org', 'sec-fetch-site': 'same-site' }],
    ['Origin: null', { origin: 'null', host: 'slop.example.org' }],
    ['no Origin at all', { host: 'slop.example.org' }],
    ['a cross-site fetch', { 'sec-fetch-site': 'cross-site', origin: 'https://evil.example', host: 'slop.example.org' }],
    ['a malformed Origin', { origin: 'not a url', host: 'slop.example.org' }],
  ])('refuses %s', (_label, headers) => {
    expect(isSameOriginRequest(h(headers), APP)).toBe(false)
  })
})
