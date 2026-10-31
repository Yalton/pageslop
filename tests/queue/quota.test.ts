import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db/client', () => ({ db: {} }))

import { DEFAULT_MAX_PENDING_LINKS, maxPendingLinks, queueFullMessage } from '@/lib/queue/quota'

describe('maxPendingLinks', () => {
  it('defaults to 1000', () => {
    expect(DEFAULT_MAX_PENDING_LINKS).toBe(1000)
    expect(maxPendingLinks({})).toBe(1000)
  })

  it('takes MAX_PENDING_LINKS when it is a positive integer', () => {
    expect(maxPendingLinks({ MAX_PENDING_LINKS: '250' })).toBe(250)
  })

  it.each(['0', '-5', '2.5', 'lots', ''])('ignores MAX_PENDING_LINKS=%j', (value) => {
    expect(maxPendingLinks({ MAX_PENDING_LINKS: value })).toBe(1000)
  })
})

describe('queueFullMessage', () => {
  it('allows saves that reach the cap exactly', () => {
    expect(queueFullMessage(0, 1000, 1000)).toBeNull()
    expect(queueFullMessage(999, 1, 1000)).toBeNull()
  })

  it('refuses saves that would go over the cap', () => {
    expect(queueFullMessage(1000, 1, 1000)).toBe(
      'You have 1,000 links waiting to be fetched; try again once some finish',
    )
    expect(queueFullMessage(990, 20, 1000)).not.toBeNull()
  })
})
