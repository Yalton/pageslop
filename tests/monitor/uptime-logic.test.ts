import { describe, it, expect, vi, beforeEach } from 'vitest'
import { updateUptimeStatus } from '@/lib/monitor/uptime'

// Mock the db client
const mockUpdate = vi.fn()
const mockSet = vi.fn()
const mockWhere = vi.fn()

vi.mock('@/lib/db/client', () => ({
  db: {
    update: vi.fn(() => ({
      set: mockSet,
    })),
    select: vi.fn(),
  },
}))

import { db } from '@/lib/db/client'

beforeEach(() => {
  vi.clearAllMocks()
  // Chain: db.update().set().where() => resolves
  mockWhere.mockResolvedValue([])
  mockSet.mockReturnValue({ where: mockWhere })
  vi.mocked(db.update).mockReturnValue({ set: mockSet } as any)
})

describe('updateUptimeStatus()', () => {
  it('sets uptimeStatus to "up" and resets consecutiveFailures to 0 on success', async () => {
    await updateUptimeStatus('link-123', true, 200)

    expect(db.update).toHaveBeenCalledOnce()
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        uptimeStatus: 'up',
        consecutiveFailures: 0,
        lastStatusCode: 200,
      })
    )
    expect(mockWhere).toHaveBeenCalledOnce()
  })

  it('sets lastStatusCode on success', async () => {
    await updateUptimeStatus('link-123', true, 200)

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ lastStatusCode: 200 })
    )
  })

  it('sets lastCheckedAt on any call', async () => {
    await updateUptimeStatus('link-123', true, 200)

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ lastCheckedAt: expect.any(Date) })
    )
  })

  it('on first failure: increments consecutiveFailures atomically (does NOT set uptimeStatus to down yet)', async () => {
    await updateUptimeStatus('link-456', false, 503)

    expect(db.update).toHaveBeenCalledOnce()
    const setArg = mockSet.mock.calls[0][0]
    // consecutiveFailures should be an SQL expression object (not plain 0 or 1)
    expect(setArg.consecutiveFailures).not.toBe(0)
    expect(setArg.consecutiveFailures).not.toBe(1)
    // uptimeStatus should be a SQL expression (CASE), not a plain string 'down'
    expect(setArg.uptimeStatus).not.toBe('down')
    expect(setArg.lastStatusCode).toBe(503)
  })

  it('on failure: uses SQL CASE expression for uptimeStatus flip', async () => {
    await updateUptimeStatus('link-456', false, 503)

    const setArg = mockSet.mock.calls[0][0]
    // uptimeStatus should be a SQL object (Drizzle SQL template), not a plain string
    expect(typeof setArg.uptimeStatus).toBe('object')
    expect(setArg.uptimeStatus).not.toBeNull()
  })

  it('on failure: uses SQL expression for consecutiveFailures increment', async () => {
    await updateUptimeStatus('link-456', false, 503)

    const setArg = mockSet.mock.calls[0][0]
    // consecutiveFailures should be a SQL object (Drizzle SQL template), not a plain number
    expect(typeof setArg.consecutiveFailures).toBe('object')
    expect(setArg.consecutiveFailures).not.toBeNull()
  })

  it('success after being down: resets uptimeStatus to "up" and consecutiveFailures to 0', async () => {
    await updateUptimeStatus('link-789', true, 200)

    const setArg = mockSet.mock.calls[0][0]
    expect(setArg.uptimeStatus).toBe('up')
    expect(setArg.consecutiveFailures).toBe(0)
  })
})
