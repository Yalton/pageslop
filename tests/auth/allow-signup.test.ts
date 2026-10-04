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

type AuthOptions = { emailAndPassword: { enabled: boolean; disableSignUp?: boolean } }

async function loadAuthOptions(): Promise<AuthOptions> {
  vi.resetModules()
  const mod = await import('@/lib/auth/server')
  return mod.auth as unknown as AuthOptions
}

describe('ALLOW_SIGNUP', () => {
  const original = process.env.ALLOW_SIGNUP

  beforeEach(() => {
    delete process.env.ALLOW_SIGNUP
  })

  afterEach(() => {
    if (original === undefined) delete process.env.ALLOW_SIGNUP
    else process.env.ALLOW_SIGNUP = original
  })

  it('ALLOW_SIGNUP=false blocks signup', async () => {
    process.env.ALLOW_SIGNUP = 'false'
    const options = await loadAuthOptions()
    expect(options.emailAndPassword.enabled).toBe(true)
    expect(options.emailAndPassword.disableSignUp).toBe(true)
  })

  it('signup stays enabled when ALLOW_SIGNUP is unset', async () => {
    const options = await loadAuthOptions()
    expect(options.emailAndPassword.disableSignUp).toBe(false)
  })

  it('signup stays enabled when ALLOW_SIGNUP=true', async () => {
    process.env.ALLOW_SIGNUP = 'true'
    const options = await loadAuthOptions()
    expect(options.emailAndPassword.disableSignUp).toBe(false)
  })
})
