import { describe, it, expect } from 'vitest'
import {
  stashExpiryCutoff,
  stashExpireDays,
  STASH_EXPIRE_DEFAULT_DAYS,
} from '@/lib/stash/expiry'

describe('stashExpiryCutoff', () => {
  it('subtracts the given number of whole days from now', () => {
    const now = new Date('2026-10-03T12:00:00.000Z')
    expect(stashExpiryCutoff(now, 14).toISOString()).toBe('2026-09-19T12:00:00.000Z')
  })

  it('returns a time equal to now when days is 0', () => {
    const now = new Date('2026-10-03T12:00:00.000Z')
    expect(stashExpiryCutoff(now, 0).getTime()).toBe(now.getTime())
  })

  it('does not mutate the input date', () => {
    const now = new Date('2026-10-03T12:00:00.000Z')
    stashExpiryCutoff(now, 3)
    expect(now.toISOString()).toBe('2026-10-03T12:00:00.000Z')
  })
})

describe('stashExpireDays', () => {
  it('defaults to 14', () => {
    expect(STASH_EXPIRE_DEFAULT_DAYS).toBe(14)
    expect(stashExpireDays()).toBe(14)
    expect(stashExpireDays(undefined)).toBe(14)
  })

  it('parses a positive integer', () => {
    expect(stashExpireDays('7')).toBe(7)
    expect(stashExpireDays(' 30 ')).toBe(30)
  })

  it('falls back to 14 for garbage input', () => {
    expect(stashExpireDays('')).toBe(14)
    expect(stashExpireDays('abc')).toBe(14)
    expect(stashExpireDays('NaN')).toBe(14)
  })

  it('falls back to 14 for zero or negative values', () => {
    expect(stashExpireDays('0')).toBe(14)
    expect(stashExpireDays('-3')).toBe(14)
  })

  it('falls back to 14 for non-integer values', () => {
    expect(stashExpireDays('7.5')).toBe(14)
  })

  // 1e300 is an integer to Number.isInteger, but it would make the cutoff an Invalid Date.
  it('falls back to 14 for integers too large to be exact', () => {
    expect(stashExpireDays('1e300')).toBe(14)
    expect(stashExpireDays(String(2 ** 53))).toBe(14)
  })
})
