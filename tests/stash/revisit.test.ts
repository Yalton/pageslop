import { describe, it, expect } from 'vitest'
import {
  isRevisitable,
  selectRevisitLinks,
  countInbox,
  daysSince,
  expiresInDays,
  rowMeta,
  needsDismissConfirm,
  openAllUrls,
  CLIENT_STASH_EXPIRE_DAYS,
} from '@/lib/stash/revisit'
import type { LinkWithTags, StashState } from '@/types'

const DAY = 86_400_000

function makeLink(id: string, stashState: StashState | null, stashedAt: Date | null = null): LinkWithTags {
  return {
    id,
    userId: 'u1',
    url: `https://example.com/${id}`,
    title: null,
    description: null,
    ogImage: null,
    favicon: null,
    domain: 'example.com',
    status: 'ready',
    category: null,
    source: stashState ? 'stash' : 'manual',
    stashState,
    stashedAt,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    tags: [],
  } as unknown as LinkWithTags
}

describe('isRevisitable / selectRevisitLinks', () => {
  it('accepts inbox and read only', () => {
    expect(isRevisitable({ stashState: 'inbox' })).toBe(true)
    expect(isRevisitable({ stashState: 'read' })).toBe(true)
    expect(isRevisitable({ stashState: 'kept' })).toBe(false)
    expect(isRevisitable({ stashState: 'archived' })).toBe(false)
    expect(isRevisitable({ stashState: null })).toBe(false)
  })

  it('keeps input order and drops non-revisitable links', () => {
    const links = [
      makeLink('a', 'inbox'),
      makeLink('b', null),
      makeLink('c', 'read'),
      makeLink('d', 'kept'),
      makeLink('e', 'archived'),
    ]
    expect(selectRevisitLinks(links).map((l) => l.id)).toEqual(['a', 'c'])
  })
})

describe('countInbox', () => {
  it('counts only inbox links', () => {
    expect(
      countInbox([
        { stashState: 'inbox' },
        { stashState: 'inbox' },
        { stashState: 'read' },
        { stashState: null },
      ]),
    ).toBe(2)
  })

  it('returns 0 for an empty list', () => {
    expect(countInbox([])).toBe(0)
  })
})

describe('daysSince', () => {
  const now = new Date('2026-03-15T12:00:00Z')

  it('floors whole days', () => {
    expect(daysSince(new Date(now.getTime() - 2.9 * DAY), now)).toBe(2)
  })

  it('accepts ISO strings', () => {
    expect(daysSince('2026-03-10T12:00:00Z', now)).toBe(5)
  })

  it('never returns a negative number for future dates', () => {
    expect(daysSince(new Date(now.getTime() + DAY), now)).toBe(0)
  })
})

describe('expiresInDays', () => {
  const now = new Date('2026-03-15T12:00:00Z')

  it('defaults to the 14 day window', () => {
    expect(CLIENT_STASH_EXPIRE_DAYS).toBe(14)
    expect(expiresInDays(now, now)).toBe(14)
  })

  it('rounds partial days up', () => {
    // stashed 10.5 days ago: 3.5 days remain, shown as 4
    expect(expiresInDays(new Date(now.getTime() - 10.5 * DAY), now)).toBe(4)
  })

  it('clamps at 0 once the window has passed', () => {
    expect(expiresInDays(new Date(now.getTime() - 20 * DAY), now)).toBe(0)
  })

  it('honours a custom window', () => {
    expect(expiresInDays(new Date(now.getTime() - 5 * DAY), now, 7)).toBe(2)
  })
})

describe('rowMeta', () => {
  const now = new Date('2026-03-15T12:00:00Z')

  it('shows only the stashed label when more than 3 days remain', () => {
    expect(rowMeta(new Date(now.getTime() - 2 * DAY), now)).toEqual({
      stashedLabel: 'stashed 2d ago',
      expiryLabel: null,
    })
  })

  it('adds the expiry label at exactly 3 days remaining', () => {
    expect(rowMeta(new Date(now.getTime() - 11 * DAY), now)).toEqual({
      stashedLabel: 'stashed 11d ago',
      expiryLabel: 'expires in 3d',
    })
  })

  it('shows "expires in 0d" when overdue but not yet archived', () => {
    expect(rowMeta(new Date(now.getTime() - 15 * DAY), now).expiryLabel).toBe('expires in 0d')
  })

  it('returns nulls when stashedAt is missing', () => {
    expect(rowMeta(null, now)).toEqual({ stashedLabel: null, expiryLabel: null })
  })
})

describe('needsDismissConfirm', () => {
  it('confirms only above 10 items', () => {
    expect(needsDismissConfirm(10)).toBe(false)
    expect(needsDismissConfirm(11)).toBe(true)
  })
})

describe('openAllUrls', () => {
  it('reports opened ids and the blocked count', () => {
    const opened: string[] = []
    const result = openAllUrls(
      [
        { id: 'a', url: 'https://a.test' },
        { id: 'b', url: 'https://b.test' },
        { id: 'c', url: 'https://c.test' },
      ],
      (url) => {
        opened.push(url)
        return url === 'https://b.test' ? null : {}
      },
    )
    expect(opened).toEqual(['https://a.test', 'https://b.test', 'https://c.test'])
    expect(result).toEqual({ openedIds: ['a', 'c'], blockedCount: 1 })
  })

  it('handles an empty list', () => {
    expect(openAllUrls([], () => ({}))).toEqual({ openedIds: [], blockedCount: 0 })
  })
})
