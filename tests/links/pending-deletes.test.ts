import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createPendingDeletes, DELETE_DELAY_MS, UNDO_WINDOW_MS } from '@/lib/links/pending-deletes'

describe('createPendingDeletes', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('runs the delete only after the undo toast has gone', () => {
    expect(DELETE_DELAY_MS).toBeGreaterThan(UNDO_WINDOW_MS)
  })

  it('runs the delete once the delay passes', () => {
    const run = vi.fn()
    const pending = createPendingDeletes(run)
    pending.schedule('a')
    expect(pending.has('a')).toBe(true)
    vi.advanceTimersByTime(DELETE_DELAY_MS - 1)
    expect(run).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(run).toHaveBeenCalledWith('a')
    expect(pending.has('a')).toBe(false)
  })

  it('cancel stops the delete and reports whether one was pending', () => {
    const run = vi.fn()
    const pending = createPendingDeletes(run)
    pending.schedule('a')
    expect(pending.cancel('a')).toBe(true)
    vi.advanceTimersByTime(DELETE_DELAY_MS)
    expect(run).not.toHaveBeenCalled()
    expect(pending.cancel('a')).toBe(false)
  })

  it('flush runs every pending delete now', () => {
    const run = vi.fn()
    const pending = createPendingDeletes(run)
    pending.schedule('a')
    pending.schedule('b')
    pending.flush()
    expect(run.mock.calls.map(([id]) => id).sort()).toEqual(['a', 'b'])
    vi.advanceTimersByTime(DELETE_DELAY_MS)
    expect(run).toHaveBeenCalledTimes(2)
  })

  it('bumps the version and notifies subscribers on every change', () => {
    const pending = createPendingDeletes(vi.fn())
    const listener = vi.fn()
    const unsubscribe = pending.subscribe(listener)
    const v0 = pending.getVersion()

    pending.schedule('a')
    expect(pending.getVersion()).toBeGreaterThan(v0)
    pending.cancel('a')
    pending.schedule('b')
    vi.advanceTimersByTime(DELETE_DELAY_MS)
    expect(listener).toHaveBeenCalledTimes(4)

    unsubscribe()
    pending.schedule('c')
    expect(listener).toHaveBeenCalledTimes(4)
  })

  it('keeps the version when nothing changed', () => {
    const pending = createPendingDeletes(vi.fn())
    const v = pending.getVersion()
    expect(pending.cancel('missing')).toBe(false)
    pending.flush()
    expect(pending.getVersion()).toBe(v)
  })
})
