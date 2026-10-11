/** How long the delete toasts, and their Undo button, stay up. */
export const UNDO_WINDOW_MS = 5000

/** The server delete waits a little past the toast, so a last-moment Undo still lands. */
export const DELETE_DELAY_MS = UNDO_WINDOW_MS + 1000

/**
 * Holds deletes back for DELETE_DELAY_MS, so Undo can cancel them before the
 * server row is gone. Ids scheduled together are deleted together: `run`
 * gets each batch's remaining ids in one call.
 */
export function createPendingDeletes(run: (ids: string[]) => void) {
  const batches = new Map<number, { timer: ReturnType<typeof setTimeout>; ids: Set<string> }>()
  const batchOf = new Map<string, number>()
  const listeners = new Set<() => void>()
  let nextBatch = 0
  // Bumped on every change, so a React hook can tell when to recompute.
  let version = 0

  function changed() {
    version++
    for (const listener of listeners) listener()
  }

  /** Takes `id` out of its batch, dropping the batch when it empties. */
  function detach(id: string): boolean {
    const key = batchOf.get(id)
    if (key === undefined) return false
    batchOf.delete(id)
    const batch = batches.get(key)!
    batch.ids.delete(id)
    if (batch.ids.size === 0) {
      clearTimeout(batch.timer)
      batches.delete(key)
    }
    return true
  }

  function fire(key: number) {
    const batch = batches.get(key)
    if (!batch) return
    clearTimeout(batch.timer)
    batches.delete(key)
    for (const id of batch.ids) batchOf.delete(id)
    changed()
    run([...batch.ids])
  }

  return {
    schedule(ids: string | string[]) {
      const list = typeof ids === 'string' ? [ids] : ids
      if (list.length === 0) return
      for (const id of list) detach(id)
      const key = nextBatch++
      batches.set(key, { timer: setTimeout(() => fire(key), DELETE_DELAY_MS), ids: new Set(list) })
      for (const id of list) batchOf.set(id, key)
      changed()
    },
    /** Returns true when a delete was still pending and is now cancelled. */
    cancel(id: string): boolean {
      if (!detach(id)) return false
      changed()
      return true
    },
    has(id: string): boolean {
      return batchOf.has(id)
    },
    /** Runs every pending delete now, e.g. when the page is closing. */
    flush() {
      for (const key of [...batches.keys()]) fire(key)
    },
    /** For useSyncExternalStore. */
    subscribe(listener: () => void): () => void {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getVersion(): number {
      return version
    },
  }
}
