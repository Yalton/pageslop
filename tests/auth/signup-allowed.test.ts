import { describe, it, expect } from 'vitest'
import { signupAllowed } from '@/lib/auth/signup'

describe('signupAllowed', () => {
  it('defaults to allowed when unset', () => {
    expect(signupAllowed()).toBe(true)
    expect(signupAllowed(undefined)).toBe(true)
    expect(signupAllowed('')).toBe(true)
  })

  it('is allowed for "true" and any other value', () => {
    expect(signupAllowed('true')).toBe(true)
    expect(signupAllowed('1')).toBe(true)
    expect(signupAllowed('yes')).toBe(true)
  })

  it('is disabled only for "false", case- and whitespace-insensitive', () => {
    expect(signupAllowed('false')).toBe(false)
    expect(signupAllowed('FALSE')).toBe(false)
    expect(signupAllowed(' False ')).toBe(false)
  })
})
