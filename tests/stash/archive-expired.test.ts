import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'

const captured = vi.hoisted(() => ({
  table: undefined as unknown,
  set: undefined as Record<string, unknown> | undefined,
  where: undefined as SQL | undefined,
  rows: [] as { id: string }[],
}))

vi.mock('@/lib/db/client', () => ({
  db: {
    update: vi.fn((table: unknown) => {
      captured.table = table
      return {
        set: (values: Record<string, unknown>) => {
          captured.set = values
          return {
            where: (where: SQL) => {
              captured.where = where
              return { returning: async () => captured.rows }
            },
          }
        },
      }
    }),
  },
}))

import { archiveExpiredStash } from '@/lib/db/queries/links'
import { links } from '@/lib/db/schema'

describe('archiveExpiredStash', () => {
  beforeEach(() => {
    captured.table = undefined
    captured.set = undefined
    captured.where = undefined
    captured.rows = []
  })

  it('updates the links table, setting stashState to archived and bumping updatedAt', async () => {
    await archiveExpiredStash(new Date('2026-01-01T00:00:00.000Z'))
    expect(captured.table).toBe(links)
    expect(captured.set?.stashState).toBe('archived')
    expect(captured.set?.updatedAt).toBeInstanceOf(Date)
    expect(Object.keys(captured.set ?? {}).sort()).toEqual(['stashState', 'updatedAt'])
  })

  it('only targets inbox and read links stashed before the cutoff', async () => {
    const cutoff = new Date('2026-01-01T00:00:00.000Z')
    await archiveExpiredStash(cutoff)
    const query = new PgDialect().sqlToQuery(captured.where!)
    expect(query.sql).toBe(
      '("links"."stash_state" in ($1, $2) and "links"."stashed_at" < $3)'
    )
    expect(query.params).toEqual(['inbox', 'read', '2026-01-01T00:00:00.000Z'])
  })

  it('returns the number of archived rows', async () => {
    captured.rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    await expect(archiveExpiredStash(new Date())).resolves.toBe(3)
  })

  it('returns 0 when nothing expired', async () => {
    await expect(archiveExpiredStash(new Date())).resolves.toBe(0)
  })
})
