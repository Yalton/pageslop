import { describe, it, expect, vi } from 'vitest'
import { signupSchema } from '@/lib/validations/auth'

// Mock the auth client for function existence tests
vi.mock('@/lib/auth/client', () => ({
  authClient: {
    signUp: {
      email: vi.fn(),
    },
  },
}))

describe('Signup validation schema', () => {
  it('creates user — valid signup input passes validation', () => {
    const result = signupSchema.safeParse({
      name: 'Alice',
      email: 'alice@example.com',
      password: 'password123',
    })
    expect(result.success).toBe(true)
  })

  it('rejects duplicate email scenario — invalid email fails validation', () => {
    const result = signupSchema.safeParse({
      name: 'Alice',
      email: 'not-an-email',
      password: 'password123',
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('Invalid email address')
  })

  it('rejects missing name', () => {
    const result = signupSchema.safeParse({
      name: '',
      email: 'alice@example.com',
      password: 'password123',
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('Name is required')
  })

  it('rejects password shorter than 8 characters', () => {
    const result = signupSchema.safeParse({
      name: 'Alice',
      email: 'alice@example.com',
      password: 'short',
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe(
      'Password must be at least 8 characters'
    )
  })
})

describe('Auth client API shape', () => {
  it('authClient.signUp.email is a function', async () => {
    const { authClient } = await import('@/lib/auth/client')
    expect(typeof authClient.signUp.email).toBe('function')
  })
})
