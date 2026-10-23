import { describe, it, expect } from 'vitest'
import { redactAuthPath } from '@/lib/auth/log'

describe('redactAuthPath', () => {
  it('drops the query string, including verify-email tokens', () => {
    const url = new URL('https://pageslop.example.com/api/auth/verify-email?token=eyJhbGciOi.abc.def&callbackURL=%2Fdashboard')
    expect(redactAuthPath(url)).toBe('/api/auth/verify-email')
  })

  it('masks the reset-password token segment', () => {
    const url = new URL('https://pageslop.example.com/api/auth/reset-password/s3cr3tT0k3n?callbackURL=%2Freset')
    expect(redactAuthPath(url)).toBe('/api/auth/reset-password/[redacted]')
  })

  it('leaves other paths alone', () => {
    expect(redactAuthPath(new URL('https://pageslop.example.com/api/auth/get-session'))).toBe('/api/auth/get-session')
  })
})
