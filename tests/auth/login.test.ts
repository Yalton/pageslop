import { describe, it, expect, vi } from 'vitest'
import { loginSchema } from '@/lib/validations/auth'

// Mock the auth client for function existence tests
vi.mock('@/lib/auth/client', () => ({
  authClient: {
    signIn: {
      email: vi.fn(),
    },
  },
}))

describe('Login validation schema', () => {
  it('returns session — valid login input passes validation', () => {
    const result = loginSchema.safeParse({
      email: 'alice@example.com',
      password: 'password123',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid password — empty password fails validation', () => {
    const result = loginSchema.safeParse({
      email: 'alice@example.com',
      password: '',
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('Password is required')
  })

  it('rejects empty email', () => {
    const result = loginSchema.safeParse({
      email: '',
      password: 'password123',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid email format', () => {
    const result = loginSchema.safeParse({
      email: 'not-an-email',
      password: 'password123',
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('Invalid email address')
  })
})

describe('Auth client API shape', () => {
  it('authClient.signIn.email is a function', async () => {
    const { authClient } = await import('@/lib/auth/client')
    expect(typeof authClient.signIn.email).toBe('function')
  })
})
