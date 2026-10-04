import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => {
  const limit = vi.fn()
  const orderBy = vi.fn()
  const selectWhere = vi.fn(() => ({ limit, orderBy }))
  const from = vi.fn(() => ({ where: selectWhere }))
  const select = vi.fn(() => ({ from }))

  const insertReturning = vi.fn()
  const values = vi.fn(() => ({ returning: insertReturning }))
  const insert = vi.fn(() => ({ values }))

  const deleteReturning = vi.fn()
  const deleteWhere = vi.fn(() => ({ returning: deleteReturning }))
  const del = vi.fn(() => ({ where: deleteWhere }))

  const updateWhere = vi.fn(() => Promise.resolve([]))
  const set = vi.fn(() => ({ where: updateWhere }))
  const update = vi.fn(() => ({ set }))

  return {
    limit, orderBy, selectWhere, from, select,
    insertReturning, values, insert,
    deleteReturning, deleteWhere, del,
    updateWhere, set, update,
  }
})

vi.mock('@/lib/db/client', () => ({
  db: { select: h.select, insert: h.insert, update: h.update, delete: h.del },
}))

import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'
import {
  createApiToken,
  listApiTokens,
  deleteApiToken,
  findTokenByHash,
  touchApiToken,
} from '@/lib/db/queries/api-tokens'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createApiToken', () => {
  it('inserts userId, name and hash, and returns the summary without the hash', async () => {
    const createdAt = new Date('2026-10-03T00:00:00Z')
    h.insertReturning.mockResolvedValueOnce([
      { id: 'tok-1', name: 'Firefox laptop', createdAt, lastUsedAt: null },
    ])

    const result = await createApiToken('user-1', 'Firefox laptop', 'a'.repeat(64))

    expect(h.values).toHaveBeenCalledWith({
      userId: 'user-1',
      name: 'Firefox laptop',
      tokenHash: 'a'.repeat(64),
    })
    const returningArg = h.insertReturning.mock.calls.at(0)?.at(0) as unknown as Record<string, unknown>
    expect(Object.keys(returningArg).sort()).toEqual(['createdAt', 'id', 'lastUsedAt', 'name'])
    expect(result).toEqual({ id: 'tok-1', name: 'Firefox laptop', createdAt, lastUsedAt: null })
  })
})

describe('listApiTokens', () => {
  it('selects only id, name, createdAt, lastUsedAt (never tokenHash)', async () => {
    const rows = [{ id: 'tok-1', name: 'A', createdAt: new Date(), lastUsedAt: null }]
    h.orderBy.mockResolvedValueOnce(rows)

    const result = await listApiTokens('user-1')

    const selectArg = h.select.mock.calls.at(0)?.at(0) as unknown as Record<string, unknown>
    expect(Object.keys(selectArg).sort()).toEqual(['createdAt', 'id', 'lastUsedAt', 'name'])
    expect(selectArg).not.toHaveProperty('tokenHash')
    expect(h.selectWhere).toHaveBeenCalledOnce()
    expect(result).toBe(rows)
  })
})

describe('deleteApiToken', () => {
  it('returns true when a row was deleted', async () => {
    h.deleteReturning.mockResolvedValueOnce([{ id: 'tok-1' }])
    await expect(deleteApiToken('user-1', 'tok-1')).resolves.toBe(true)
    expect(h.deleteWhere).toHaveBeenCalledOnce()
  })

  it("filters on the owner's userId as well as the token id", async () => {
    h.deleteReturning.mockResolvedValueOnce([])
    await deleteApiToken('user-1', 'tok-1')
    const where = new PgDialect().sqlToQuery((h.deleteWhere.mock.calls[0] as unknown[])[0] as SQL)
    expect(where.sql).toContain('"user_id" = $2')
    expect(where.params).toEqual(['tok-1', 'user-1'])
  })

  it('returns false when nothing matched (wrong owner or unknown id)', async () => {
    h.deleteReturning.mockResolvedValueOnce([])
    await expect(deleteApiToken('user-2', 'tok-1')).resolves.toBe(false)
  })
})

describe('findTokenByHash', () => {
  it('returns {id, userId, lastUsedAt} when found', async () => {
    h.limit.mockResolvedValueOnce([{ id: 'tok-1', userId: 'user-1', lastUsedAt: null }])
    await expect(findTokenByHash('b'.repeat(64))).resolves.toEqual({
      id: 'tok-1',
      userId: 'user-1',
      lastUsedAt: null,
    })
    const selectArg = h.select.mock.calls.at(0)?.at(0) as unknown as Record<string, unknown>
    expect(Object.keys(selectArg).sort()).toEqual(['id', 'lastUsedAt', 'userId'])
  })

  it('returns null when not found', async () => {
    h.limit.mockResolvedValueOnce([])
    await expect(findTokenByHash('c'.repeat(64))).resolves.toBeNull()
  })
})

describe('touchApiToken', () => {
  it('sets lastUsedAt to a Date', async () => {
    await touchApiToken('tok-1')
    expect(h.set).toHaveBeenCalledWith({ lastUsedAt: expect.any(Date) })
    expect(h.updateWhere).toHaveBeenCalledOnce()
  })
})
