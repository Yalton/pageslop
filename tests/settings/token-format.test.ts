import { describe, it, expect } from 'vitest'
import { formatTokenDate, validateTokenName, TOKEN_NAME_MAX } from '@/lib/settings/token-format'

describe('formatTokenDate', () => {
  it('returns "Never" for null', () => {
    expect(formatTokenDate(null)).toBe('Never')
  })

  it('formats a Date as "MMM d, yyyy"', () => {
    // Local-time constructor keeps the test independent of the machine's timezone
    expect(formatTokenDate(new Date(2026, 0, 5, 12))).toBe('Jan 5, 2026')
  })

  it('accepts ISO strings from JSON', () => {
    const iso = new Date(2026, 10, 30, 12).toISOString()
    expect(formatTokenDate(iso)).toBe('Nov 30, 2026')
  })

  it('returns "Never" for an unparseable string', () => {
    expect(formatTokenDate('not a date')).toBe('Never')
  })
})

describe('validateTokenName', () => {
  it('rejects empty and whitespace-only names', () => {
    expect(validateTokenName('')).toBe('Name is required')
    expect(validateTokenName('   ')).toBe('Name is required')
  })

  it('rejects names longer than the limit after trimming', () => {
    expect(validateTokenName('x'.repeat(TOKEN_NAME_MAX + 1))).toBe(
      `Name must be ${TOKEN_NAME_MAX} characters or fewer`,
    )
    expect(validateTokenName(`  ${'x'.repeat(TOKEN_NAME_MAX)}  `)).toBeNull()
  })

  it('accepts a normal name', () => {
    expect(validateTokenName('Firefox laptop')).toBeNull()
  })
})
