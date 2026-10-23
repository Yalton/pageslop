import { describe, it, expect, vi, beforeEach } from 'vitest'

// A drizzle-like query chain: every builder method records its args and
// returns the chain; awaiting the chain yields the next queued result.
const h = vi.hoisted(() => {
  const results: unknown[][] = []
  const calls: { method: string; args: unknown[] }[] = []
  const chain: Record<string, unknown> = {}
  for (const method of ['from', 'where', 'orderBy', 'limit', 'innerJoin']) {
    chain[method] = (...args: unknown[]) => {
      calls.push({ method, args })
      return chain
    }
  }
  chain.then = (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
    Promise.resolve(results.shift() ?? []).then(resolve, reject)
  const select = vi.fn((...args: unknown[]) => {
    calls.push({ method: 'select', args })
    return chain
  })
  return { results, calls, select }
})

vi.mock('@/lib/db/client', () => ({ db: { select: h.select } }))

import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'
import { listLinksPage } from '@/lib/db/queries/links'
import { decodeCursor } from '@/lib/links/cursor'

const render = (fragment: unknown) => new PgDialect().sqlToQuery(fragment as SQL)

function row(id: string, cursorTs: string) {
  return {
    link: {
      id,
      userId: 'u1',
      url: `https://example.com/${id}`,
      createdAt: new Date(cursorTs.replace(' ', 'T') + 'Z'),
      stashState: null,
    },
    cursorTs,
  }
}

/** The first query's WHERE, rendered. */
function firstWhere() {
  const call = h.calls.find((c) => c.method === 'where')
  return render(call?.args[0])
}

beforeEach(() => {
  h.results.length = 0
  h.calls.length = 0
  vi.clearAllMocks()
})

describe('listLinksPage', () => {
  it('scopes to the user and the All Links view, ordered newest first with id tie-break', async () => {
    await listLinksPage('u1', { limit: 50, cursor: null })
    const where = firstWhere()
    expect(where.sql).toContain('"links"."user_id" = $1')
    expect(where.params[0]).toBe('u1')
    expect(where.sql).toContain('"links"."stash_state" is null')
    expect(where.params).toContain('kept')
    const orderBy = h.calls.find((c) => c.method === 'orderBy')!.args.map((a) => render(a).sql)
    expect(orderBy).toEqual(['"links"."created_at" desc', '"links"."id" desc'])
  })

  it('selects revisit, all and individual stash views without losing owner scope', async () => {
    for (const [view, expected] of [
      ['revisit', ['inbox', 'read']],
      ['all', []],
      ['archived', ['archived']],
    ] as const) {
      h.calls.length = 0
      await listLinksPage('u1', { limit: 20, cursor: null, view })
      const where = firstWhere()
      expect(where.params).toContain('u1')
      for (const value of expected) expect(where.params).toContain(value)
      if (view === 'all') expect(where.sql).not.toContain('stash_state')
    }
  })

  it('fetches one extra row to detect a next page', async () => {
    await listLinksPage('u1', { limit: 2, cursor: null })
    expect(h.calls.find((c) => c.method === 'limit')!.args[0]).toBe(3)
  })

  it('returns nextCursor from the last row of a full page, at full timestamp precision', async () => {
    h.results.push([
      row('a', '2026-10-03 00:00:00.000003'),
      row('b', '2026-10-02 00:00:00.000002'),
      row('c', '2026-10-01 00:00:00.000001'),
    ])
    h.results.push([{ linkId: 'a', id: 't1', userId: 'u1', name: 'rust', source: 'user' }])
    const page = await listLinksPage('u1', { limit: 2, cursor: null })
    expect(page.links.map((l) => l.id)).toEqual(['a', 'b'])
    expect(page.links[0].tags).toEqual([{ id: 't1', userId: 'u1', name: 'rust', source: 'user' }])
    expect(page.links[1].tags).toEqual([])
    expect(decodeCursor(page.nextCursor!)).toEqual({ createdAt: '2026-10-02 00:00:00.000002', id: 'b' })
  })

  it('returns a null nextCursor on the last page and skips the tag query when empty', async () => {
    h.results.push([])
    const page = await listLinksPage('u1', { limit: 2, cursor: null })
    expect(page).toEqual({ links: [], nextCursor: null })
    expect(h.select).toHaveBeenCalledTimes(1)
  })

  it('returns a null nextCursor when the page is exactly full', async () => {
    h.results.push([row('a', '2026-10-03 00:00:00'), row('b', '2026-10-02 00:00:00')])
    const page = await listLinksPage('u1', { limit: 2, cursor: null })
    expect(page.links).toHaveLength(2)
    expect(page.nextCursor).toBeNull()
  })

  it('filters by cursor as a (created_at, id) row comparison', async () => {
    await listLinksPage('u1', { limit: 5, cursor: { createdAt: '2026-10-02 00:00:00.5', id: 'b' } })
    const where = firstWhere()
    expect(where.sql).toMatch(/\("links"\."created_at", "links"\."id"\) < \(\$\d+::timestamp, \$\d+\)/)
    expect(where.params).toEqual(expect.arrayContaining(['2026-10-02 00:00:00.5', 'b']))
  })

  it('searches title, url and description case-insensitively, escaping LIKE wildcards', async () => {
    await listLinksPage('u1', { limit: 5, cursor: null, q: '50%_off\\' })
    const where = firstWhere()
    expect(where.sql).toContain('"links"."title" ilike')
    expect(where.sql).toContain('"links"."url" ilike')
    expect(where.sql).toContain('"links"."description" ilike')
    expect(where.params).toContain('%50\\%\\_off\\\\%')
  })

  it('filters by domain', async () => {
    await listLinksPage('u1', { limit: 5, cursor: null, domain: 'example.com' })
    const where = firstWhere()
    expect(where.sql).toContain('"links"."domain" = $')
    expect(where.params).toContain('example.com')
  })

  it('filters by tag name through link_tags', async () => {
    await listLinksPage('u1', { limit: 5, cursor: null, tag: 'rust' })
    const where = firstWhere()
    expect(where.sql).toContain('exists (select 1 from "link_tags"')
    expect(where.sql).toContain('"tags"."name" = $')
    expect(where.params).toContain('rust')
  })
})
