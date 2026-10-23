import { describe, it, expect } from 'vitest'
import {
  isBuildPhase,
  parseList,
  requireAuthSecret,
  requireAuthUrl,
  requireEncryptionKey,
} from '@/lib/env'

describe('requireAuthSecret', () => {
  it('rejects a missing or blank secret', () => {
    expect(() => requireAuthSecret(undefined)).toThrow(/not set/)
    expect(() => requireAuthSecret('   ')).toThrow(/not set/)
  })

  it('rejects the old .env.example placeholder even though it is 32 chars', () => {
    expect('generate-a-random-32-char-string').toHaveLength(32)
    expect(() => requireAuthSecret('generate-a-random-32-char-string')).toThrow(/placeholder/)
  })

  it('rejects secrets shorter than 32 chars', () => {
    expect(() => requireAuthSecret('a'.repeat(31))).toThrow(/at least 32/)
  })

  it('accepts a random 32+ char secret', () => {
    const secret = 'Zx9kQ2mB7vR1tY4uP8wE3nL6hJ0cF5aS'
    expect(requireAuthSecret(secret)).toBe(secret)
  })
})

describe('requireAuthUrl', () => {
  it('rejects a missing URL', () => {
    expect(() => requireAuthUrl(undefined)).toThrow(/BETTER_AUTH_URL is not set/)
    expect(() => requireAuthUrl('')).toThrow(/BETTER_AUTH_URL is not set/)
  })

  it('rejects invalid or non-http URLs', () => {
    expect(() => requireAuthUrl('pageslop.example.com')).toThrow(/not a valid URL/)
    expect(() => requireAuthUrl('ftp://pageslop.example.com')).toThrow(/http or https/)
  })

  it('accepts an https URL', () => {
    expect(requireAuthUrl('https://pageslop.example.com')).toBe('https://pageslop.example.com')
  })
})

describe('requireEncryptionKey', () => {
  it('rejects missing, placeholder, short and non-hex keys', () => {
    expect(() => requireEncryptionKey(undefined)).toThrow(/64-char hex/)
    expect(() => requireEncryptionKey('generate-a-64-char-hex-string')).toThrow(/64-char hex/)
    expect(() => requireEncryptionKey('a'.repeat(63))).toThrow(/64-char hex/)
    expect(() => requireEncryptionKey('z'.repeat(64))).toThrow(/64-char hex/)
  })

  it('returns a 32-byte key for 64 hex chars', () => {
    expect(requireEncryptionKey('ab'.repeat(32))).toHaveLength(32)
  })
})

describe('parseList', () => {
  it('splits, trims and drops empties', () => {
    expect(parseList(' 10.0.0.1, 10.0.1.0/24 ,')).toEqual(['10.0.0.1', '10.0.1.0/24'])
  })

  it('lowercases when asked', () => {
    expect(parseList('CF-Connecting-IP', true)).toEqual(['cf-connecting-ip'])
  })

  it('returns undefined when unset or empty', () => {
    expect(parseList(undefined)).toBeUndefined()
    expect(parseList(' , ')).toBeUndefined()
  })
})

describe('isBuildPhase', () => {
  it('is true only during next build', () => {
    const original = process.env.NEXT_PHASE
    process.env.NEXT_PHASE = 'phase-production-build'
    expect(isBuildPhase()).toBe(true)
    process.env.NEXT_PHASE = 'phase-production-server'
    expect(isBuildPhase()).toBe(false)
    if (original === undefined) delete process.env.NEXT_PHASE
    else process.env.NEXT_PHASE = original
  })
})
