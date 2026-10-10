import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => {
  // select().from().innerJoin().innerJoin().where().groupBy().orderBy()
  const orderBy = vi.fn<() => Promise<unknown[]>>(() => Promise.resolve([]))
  const groupBy = vi.fn(() => ({ orderBy }))
  const where = vi.fn((_cond: unknown) => ({ groupBy }))
  const chain: Record<string, unknown> = {}
  const innerJoin = vi.fn((_table: unknown, _on: unknown) => chain)
  const leftJoin = vi.fn((_table: unknown, _on: unknown) => chain)
  Object.assign(chain, { innerJoin, leftJoin, where })
  const from = vi.fn(() => chain)
  const select = vi.fn((_fields: Record<string, unknown>) => ({ from }))
  return { orderBy, groupBy, where, innerJoin, leftJoin, from, select }
})

vi.mock('@/lib/db/client', () => ({ db: { select: h.select } }))

import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'
import { listTagsWithCount } from '@/lib/db/queries/tags'

const render = (fragment: unknown) => new PgDialect().sqlToQuery(fragment as SQL)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('listTagsWithCount', () => {
  it('counts only links shown in All Links', async () => {
    await listTagsWithCount('u1')

    const joins = [...h.innerJoin.mock.calls, ...h.leftJoin.mock.calls]
      .map(([, on]) => render(on).sql)
    const linkJoin = joins.find((s) => s.includes('"links"."stash_state"'))
    expect(linkJoin).toBeDefined()
    expect(linkJoin).toContain('"links"."stash_state" is null')
    expect(linkJoin).toContain('"links"."stash_state" = $')
    const { params } = render(
      [...h.innerJoin.mock.calls, ...h.leftJoin.mock.calls]
        .map(([, on]) => on)
        .find((on) => render(on).sql.includes('"links"."stash_state"')),
    )
    expect(params).toContain('kept')
  })

  it('drops tags with no shown links instead of listing them with 0', async () => {
    await listTagsWithCount('u1')
    expect(h.leftJoin).not.toHaveBeenCalled()
    expect(h.innerJoin).toHaveBeenCalledTimes(2)
  })
})
