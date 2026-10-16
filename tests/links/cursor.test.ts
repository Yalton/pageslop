import { describe, it, expect } from 'vitest'
import { encodeCursor, decodeCursor } from '@/lib/links/cursor'

describe('link list cursor', () => {
  it('round-trips a full-precision timestamp and id', () => {
    const c = { createdAt: '2026-10-01 12:34:56.123456', id: 'abc-123' }
    const encoded = encodeCursor(c)
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(decodeCursor(encoded)).toEqual(c)
  })

  it('accepts timestamps without fractional seconds', () => {
    const c = { createdAt: '2026-10-01 12:34:56', id: 'x' }
    expect(decodeCursor(encodeCursor(c))).toEqual(c)
  })

  it.each([
    ['garbage', 'not-a-cursor'],
    ['empty', ''],
    ['json but wrong shape', Buffer.from('{"a":1}').toString('base64url')],
    ['bad timestamp', Buffer.from(JSON.stringify(['yesterday', 'x'])).toString('base64url')],
    ['sql in timestamp', Buffer.from(JSON.stringify(["2026-10-01 00:00:00'; drop", 'x'])).toString('base64url')],
    ['empty id', Buffer.from(JSON.stringify(['2026-10-01 00:00:00', ''])).toString('base64url')],
  ])('returns null for %s', (_label, raw) => {
    expect(decodeCursor(raw)).toBeNull()
  })
})
