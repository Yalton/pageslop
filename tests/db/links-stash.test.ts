import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => {
  // select().from().where().limit()
  const limit = vi.fn<() => Promise<unknown[]>>()
  const selectWhere = vi.fn(() => ({ limit }))
  const from = vi.fn(() => ({ where: selectWhere }))
  const select = vi.fn(() => ({ from }))

  // insert().values().onConflictDoNothing().returning()
  const insertReturning = vi.fn<() => Promise<unknown[]>>()
  const onConflictDoNothing = vi.fn(() => ({ returning: insertReturning }))
  const values = vi.fn(() => ({ returning: insertReturning, onConflictDoNothing }))
  const insert = vi.fn(() => ({ values }))

  // update().set().where() is awaitable directly or via .returning()
  const updateReturning = vi.fn<() => Promise<unknown[]>>(() => Promise.resolve([]))
  const updateWhere = vi.fn(() => {
    const p: Promise<unknown[]> = Promise.resolve([])
    return Object.assign(p, { returning: updateReturning })
  })
  const set = vi.fn((_values: Record<string, unknown>) => ({ where: updateWhere }))
  const update = vi.fn(() => ({ set }))

  // The transaction handle forwards to the same chains, but through its own
  // spies, so a test can tell which queries ran inside the transaction.
  const tx = {
    select: vi.fn(() => select()),
    insert: vi.fn(() => insert()),
    update: vi.fn(() => update()),
  }
  const transaction = vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx))

  return { limit, selectWhere, from, select, insertReturning, onConflictDoNothing, values, insert, updateReturning, updateWhere, set, update, tx, transaction }
})

vi.mock('@/lib/db/client', () => ({
  db: { select: h.select, insert: h.insert, update: h.update, transaction: h.transaction },
}))

import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'
import { insertLink, findDuplicate, stashTabs, bulkSetStashState, updateLinkFields } from '@/lib/db/queries/links'

// Render a drizzle SQL fragment, so a test can check what it filters or sets.
const render = (fragment: unknown) => new PgDialect().sqlToQuery(fragment as SQL)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('insertLink', () => {
  it('defaults to source manual with no stash state', async () => {
    h.insertReturning.mockResolvedValueOnce([{ id: 'l1', url: 'https://www.example.com/' }])
    await insertLink('user-1', 'https://www.example.com/')
    expect(h.values).toHaveBeenCalledWith({
      url: 'https://www.example.com/',
      userId: 'user-1',
      domain: 'example.com',
      status: 'pending',
      source: 'manual',
      stashState: null,
      stashedAt: null,
      title: null,
    })
  })

  it('passes source, stashState, stashedAt and title through', async () => {
    const at = new Date('2026-10-01T10:00:00Z')
    h.insertReturning.mockResolvedValueOnce([{ id: 'l1', url: 'https://a.com/' }])
    await insertLink('user-1', 'https://a.com/', {
      source: 'stash',
      stashState: 'inbox',
      stashedAt: at,
      title: 'A',
    })
    expect(h.values).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'stash', stashState: 'inbox', stashedAt: at, title: 'A' })
    )
  })
})

describe('duplicate URLs', () => {
  it('insertLink stores the canonical URL', async () => {
    h.insertReturning.mockResolvedValueOnce([{ id: 'l1', url: 'http://media.example.net/' }])
    await insertLink('user-1', 'http://Media.Example.net')
    expect(h.values).toHaveBeenCalledWith(expect.objectContaining({ url: 'http://media.example.net/' }))
  })

  it('insertLink returns the existing row instead of throwing when the URL is already saved', async () => {
    const existing = { id: 'old-1', userId: 'user-1', url: 'https://a.com/' }
    h.insertReturning.mockResolvedValueOnce([])
    h.limit.mockResolvedValueOnce([existing])
    await expect(insertLink('user-1', 'https://a.com')).resolves.toBe(existing)
    expect(h.onConflictDoNothing).toHaveBeenCalled()
  })

  it('findDuplicate looks up the canonical URL', async () => {
    h.limit.mockResolvedValueOnce([])
    await findDuplicate('user-1', 'https://A.com')
    const where = render((h.selectWhere.mock.calls[0] as unknown[])[0])
    expect(where.params).toContain('https://a.com/')
  })
})

describe('stashTabs', () => {
  const closedAt = new Date('2026-10-02T08:00:00Z')

  it('treats URLs that differ only by the root slash as one link, but echoes both as saved', async () => {
    h.limit.mockResolvedValueOnce([])
    h.insertReturning.mockResolvedValueOnce([{ id: 'new-1', url: 'https://a.com/' }])

    const result = await stashTabs('user-1', [
      { url: 'https://a.com', closedAt },
      { url: 'https://a.com/', closedAt },
    ])

    expect(h.insert).toHaveBeenCalledTimes(1)
    expect(h.values).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://a.com/' }))
    expect(result.saved).toEqual(['https://a.com', 'https://a.com/'])
    expect(result.inserted).toEqual([{ id: 'new-1', url: 'https://a.com/' }])
  })

  it('inserts a new URL as stash/inbox and reports it in saved and inserted', async () => {
    h.limit.mockResolvedValueOnce([])
    h.insertReturning.mockResolvedValueOnce([{ id: 'new-1', url: 'https://a.com/x' }])

    const result = await stashTabs('user-1', [{ url: 'https://a.com/x', title: 'X', closedAt }])

    expect(h.values).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://a.com/x',
        userId: 'user-1',
        source: 'stash',
        stashState: 'inbox',
        stashedAt: closedAt,
        title: 'X',
      })
    )
    expect(h.update).not.toHaveBeenCalled()
    expect(result).toEqual({ saved: ['https://a.com/x'], inserted: [{ id: 'new-1', url: 'https://a.com/x' }] })
  })

  // Review Focus #2: the same URL twice in one batch must be inserted once, with no unique violation.
  it('dedupes a URL repeated within one batch: one lookup, one insert, saved once', async () => {
    const earlier = new Date('2026-10-02T07:00:00Z')
    const later = new Date('2026-10-02T09:00:00Z')
    h.limit.mockResolvedValueOnce([])
    h.insertReturning.mockResolvedValueOnce([{ id: 'new-1', url: 'https://dup.com/' }])

    const result = await stashTabs('user-1', [
      { url: 'https://dup.com/', title: 'First', closedAt: earlier },
      { url: 'https://dup.com/', title: 'Second', closedAt: later },
    ])

    expect(h.limit).toHaveBeenCalledTimes(1)
    expect(h.insert).toHaveBeenCalledTimes(1)
    expect(h.values).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'First', stashedAt: later })
    )
    expect(result.saved).toEqual(['https://dup.com/'])
    expect(result.inserted).toEqual([{ id: 'new-1', url: 'https://dup.com/' }])
  })

  it('re-stashes an existing link to inbox without inserting, and fills a missing title', async () => {
    h.limit.mockResolvedValueOnce([
      { id: 'link-9', userId: 'user-1', url: 'https://old.com/', title: null, stashState: 'read' },
    ])

    const result = await stashTabs('user-1', [{ url: 'https://old.com/', title: 'Old', closedAt }])

    expect(h.insert).not.toHaveBeenCalled()
    expect(h.set).toHaveBeenCalledWith({
      stashState: 'inbox',
      stashedAt: closedAt,
      updatedAt: expect.any(Date),
      title: 'Old',
    })
    expect(h.updateWhere).toHaveBeenCalledOnce()
    expect(result).toEqual({ saved: ['https://old.com/'], inserted: [] })
  })

  it('leaves a kept link kept on re-stash, so it never becomes eligible for expiry', async () => {
    h.limit.mockResolvedValueOnce([
      { id: 'link-9', userId: 'user-1', url: 'https://old.com/', title: 'T', stashState: 'kept' },
    ])

    await stashTabs('user-1', [{ url: 'https://old.com/', closedAt }])

    const setArg = h.set.mock.calls[0][0] as Record<string, unknown>
    expect(setArg).not.toHaveProperty('stashState')
    expect(setArg).toMatchObject({ stashedAt: closedAt })
  })

  it('does not overwrite an existing title on re-stash', async () => {
    h.limit.mockResolvedValueOnce([
      { id: 'link-9', userId: 'user-1', url: 'https://old.com/', title: 'Scraped title', stashState: null },
    ])

    await stashTabs('user-1', [{ url: 'https://old.com/', title: 'Tab title', closedAt }])

    const setArg = h.set.mock.calls[0][0] as Record<string, unknown>
    expect(setArg).not.toHaveProperty('title')
    expect(setArg).toMatchObject({ stashState: 'inbox', stashedAt: closedAt })
  })

  it('echoes URL strings byte-for-byte (trailing slash, fragment) in input order', async () => {
    const urls = ['https://a.com/', 'https://a.com', 'https://a.com/page#frag']
    for (const url of ['https://a.com/', 'https://a.com/page#frag']) {
      h.limit.mockResolvedValueOnce([])
      h.insertReturning.mockResolvedValueOnce([{ id: `id-${url}`, url }])
    }

    const result = await stashTabs('user-1', urls.map((url) => ({ url, closedAt })))

    expect(result.saved).toEqual(urls)
    expect(result.inserted.map((i) => i.url)).toEqual(['https://a.com/', 'https://a.com/page#frag'])
  })

  // pageslop-dpz: a failure part-way through must not leave earlier inserts
  // committed but missing from `inserted`, where they would never be scraped.
  it('runs every lookup and write for the batch inside one transaction', async () => {
    h.limit
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'link-9', userId: 'user-1', url: 'https://old.com/', title: 'T' }])
    h.insertReturning.mockResolvedValueOnce([{ id: 'new-1', url: 'https://a.com/' }])

    await stashTabs('user-1', [
      { url: 'https://a.com/', closedAt },
      { url: 'https://old.com/', closedAt },
    ])

    expect(h.transaction).toHaveBeenCalledOnce()
    expect(h.tx.select).toHaveBeenCalledTimes(h.select.mock.calls.length)
    expect(h.tx.insert).toHaveBeenCalledTimes(h.insert.mock.calls.length)
    expect(h.tx.update).toHaveBeenCalledTimes(h.update.mock.calls.length)
    expect(h.select).toHaveBeenCalledTimes(2)
    expect(h.insert).toHaveBeenCalledTimes(1)
    expect(h.update).toHaveBeenCalledTimes(1)
  })

  it('rejects from inside the transaction when a later insert fails, so it rolls back', async () => {
    h.limit.mockResolvedValue([])
    h.insertReturning
      .mockResolvedValueOnce([{ id: 'new-1', url: 'https://a.com/' }])
      .mockRejectedValueOnce(new Error('connection lost'))

    const pending = stashTabs('user-1', [
      { url: 'https://a.com/', closedAt },
      { url: 'https://b.com/', closedAt },
    ])

    await expect(pending).rejects.toThrow('connection lost')
    await expect(h.transaction.mock.results[0].value).rejects.toThrow('connection lost')
    h.limit.mockReset()
  })

  it('returns empty arrays for an empty batch without touching the db', async () => {
    await expect(stashTabs('user-1', [])).resolves.toEqual({ saved: [], inserted: [] })
    expect(h.select).not.toHaveBeenCalled()
    expect(h.insert).not.toHaveBeenCalled()
    expect(h.transaction).not.toHaveBeenCalled()
  })
})

describe('bulkSetStashState', () => {
  it('returns 0 and skips the query for an empty id list', async () => {
    await expect(bulkSetStashState('user-1', [], 'kept')).resolves.toBe(0)
    expect(h.update).not.toHaveBeenCalled()
  })

  it('updates the state and returns the affected row count', async () => {
    h.updateReturning.mockResolvedValueOnce([{ id: 'a' }, { id: 'b' }])
    await expect(bulkSetStashState('user-1', ['a', 'b', 'c'], 'kept')).resolves.toBe(2)
    const setArg = h.set.mock.calls[0][0] as Record<string, unknown>
    expect(setArg).toMatchObject({ stashState: 'kept', updatedAt: expect.any(Date) })
    expect(setArg).not.toHaveProperty('stashedAt')
    expect(h.updateWhere).toHaveBeenCalledOnce()
  })

  it("filters on the owner's userId as well as the ids", async () => {
    h.updateReturning.mockResolvedValueOnce([])
    await bulkSetStashState('user-1', ['a'], 'kept')
    const where = render((h.updateWhere.mock.calls[0] as unknown[])[0])
    expect(where.sql).toContain('"user_id" = $1')
    expect(where.params).toEqual(['user-1', 'a'])
  })

  it('starts the expiry clock for a never-stashed link marked read', async () => {
    h.updateReturning.mockResolvedValueOnce([{ id: 'a' }])
    await bulkSetStashState('user-1', ['a'], 'read')
    const setArg = h.set.mock.calls[0][0] as Record<string, unknown>
    expect(render(setArg.stashedAt).sql).toBe('coalesce("links"."stashed_at", now())')
  })

  it('resets stashedAt when moving back to inbox', async () => {
    h.updateReturning.mockResolvedValueOnce([{ id: 'a' }])
    await bulkSetStashState('user-1', ['a'], 'inbox')
    expect(h.set).toHaveBeenCalledWith({
      stashState: 'inbox',
      updatedAt: expect.any(Date),
      stashedAt: expect.any(Date),
    })
  })
})

describe('updateLinkFields', () => {
  it('starts the expiry clock for a never-stashed link marked read', async () => {
    h.updateReturning.mockResolvedValueOnce([{ id: 'l1' }])
    await updateLinkFields('user-1', 'l1', { stashState: 'read' })
    const setArg = h.set.mock.calls[0][0] as Record<string, unknown>
    expect(render(setArg.stashedAt).sql).toBe('coalesce("links"."stashed_at", now())')
  })

  it('accepts stashState and stashedAt', async () => {
    const at = new Date('2026-10-03T00:00:00Z')
    h.updateReturning.mockResolvedValueOnce([{ id: 'l1', stashState: 'inbox', stashedAt: at }])
    const updated = await updateLinkFields('user-1', 'l1', { stashState: 'inbox', stashedAt: at })
    expect(h.set).toHaveBeenCalledWith({ stashState: 'inbox', stashedAt: at, updatedAt: expect.any(Date) })
    expect(updated).toEqual({ id: 'l1', stashState: 'inbox', stashedAt: at })
  })
})
