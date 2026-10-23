import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('better-auth', () => ({
  betterAuth: vi.fn((options: unknown) => options),
}))
vi.mock('better-auth/adapters/drizzle', () => ({
  drizzleAdapter: vi.fn(() => ({})),
}))
vi.mock('better-auth/next-js', () => ({
  nextCookies: vi.fn(() => ({ id: 'next-cookies' })),
}))
vi.mock('@/lib/db/client', () => ({ db: {} }))
vi.mock('@/lib/email/send', () => ({ sendEmail: vi.fn() }))
vi.mock('@/lib/email/templates', () => ({
  verificationEmail: vi.fn(() => ({ subject: '', html: '' })),
  passwordResetEmail: vi.fn(() => ({ subject: '', html: '' })),
}))

type AuthOptions = {
  secret?: string
  baseURL?: string
  trustedOrigins: string[]
  emailAndPassword: { revokeSessionsOnPasswordReset?: boolean }
  advanced: { ipAddress: { ipAddressHeaders: string[]; trustedProxies?: string[] } }
}

async function loadAuthOptions(): Promise<AuthOptions> {
  vi.resetModules()
  const mod = await import('@/lib/auth/server')
  return mod.auth as unknown as AuthOptions
}

const KEYS = ['BETTER_AUTH_SECRET', 'BETTER_AUTH_URL', 'TRUSTED_IP_HEADER', 'TRUSTED_PROXIES', 'NEXT_PHASE']

describe('auth server config', () => {
  const saved: Record<string, string | undefined> = {}

  beforeEach(() => {
    for (const key of KEYS) saved[key] = process.env[key]
    delete process.env.TRUSTED_IP_HEADER
    delete process.env.TRUSTED_PROXIES
    delete process.env.NEXT_PHASE
  })

  afterEach(() => {
    for (const key of KEYS) {
      if (saved[key] === undefined) delete process.env[key]
      else process.env[key] = saved[key]
    }
  })

  it('passes the validated secret and URL to Better Auth', async () => {
    const options = await loadAuthOptions()
    expect(options.secret).toBe(process.env.BETTER_AUTH_SECRET)
    expect(options.baseURL).toBe('http://localhost:3000')
    expect(options.trustedOrigins).toEqual(['http://localhost:3000'])
  })

  it('refuses to load with the placeholder secret', async () => {
    process.env.BETTER_AUTH_SECRET = 'generate-a-random-32-char-string'
    await expect(loadAuthOptions()).rejects.toThrow(/placeholder/)
  })

  it('refuses to load without BETTER_AUTH_URL', async () => {
    delete process.env.BETTER_AUTH_URL
    await expect(loadAuthOptions()).rejects.toThrow(/BETTER_AUTH_URL is not set/)
  })

  it('skips validation during next build', async () => {
    process.env.NEXT_PHASE = 'phase-production-build'
    delete process.env.BETTER_AUTH_SECRET
    delete process.env.BETTER_AUTH_URL
    const options = await loadAuthOptions()
    expect(options.secret).toBeUndefined()
    expect(options.trustedOrigins).toEqual([])
  })

  it('reads the client IP from x-forwarded-for by default', async () => {
    const options = await loadAuthOptions()
    expect(options.advanced.ipAddress.ipAddressHeaders).toEqual(['x-forwarded-for'])
    expect(options.advanced.ipAddress.trustedProxies).toBeUndefined()
  })

  it('uses TRUSTED_IP_HEADER and TRUSTED_PROXIES when set', async () => {
    process.env.TRUSTED_IP_HEADER = 'CF-Connecting-IP'
    process.env.TRUSTED_PROXIES = '172.18.0.1, 10.0.0.0/24'
    const options = await loadAuthOptions()
    expect(options.advanced.ipAddress.ipAddressHeaders).toEqual(['cf-connecting-ip'])
    expect(options.advanced.ipAddress.trustedProxies).toEqual(['172.18.0.1', '10.0.0.0/24'])
  })
  it('trusts no client IP header when TRUSTED_IP_HEADER=none', async () => {
    process.env.TRUSTED_IP_HEADER = 'None'
    const options = await loadAuthOptions()
    expect(options.advanced.ipAddress.ipAddressHeaders).toEqual([])
  })

  it('revokes all sessions when the password is reset', async () => {
    const options = await loadAuthOptions()
    expect(options.emailAndPassword.revokeSessionsOnPasswordReset).toBe(true)
  })
})
