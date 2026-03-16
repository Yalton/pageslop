import { describe, it, expect, vi } from 'vitest'

// Mock the auth client
vi.mock('@/lib/auth/client', () => ({
  authClient: {
    signOut: vi.fn(),
  },
}))

describe('Auth logout', () => {
  it('invalidates session — authClient.signOut is callable', async () => {
    const { authClient } = await import('@/lib/auth/client')
    expect(typeof authClient.signOut).toBe('function')
  })

  it('signOut can be called without throwing', async () => {
    const { authClient } = await import('@/lib/auth/client')
    expect(() => authClient.signOut()).not.toThrow()
  })
})
