/** How long the delete toasts, and their Undo button, stay up. */
export const UNDO_WINDOW_MS = 5000

/** The server delete waits a little past the toast, so a last-moment Undo still lands. */
export const DELETE_DELAY_MS = UNDO_WINDOW_MS + 1000

/**
 * Holds deletes back for DELETE_DELAY_MS, so Undo can cancel them before the
 * server row is gone. `run` performs the real delete.
 */
export function createPendingDeletes(run: (id: string) => void) {
  const timers = new Map<string, ReturnType<typeof setTimeout>>()

  function fire(id: string) {
    timers.delete(id)
    run(id)
  }

  return {
    schedule(id: string) {
      clearTimeout(timers.get(id))
      timers.set(id, setTimeout(() => fire(id), DELETE_DELAY_MS))
    },
    /** Returns true when a delete was still pending and is now cancelled. */
    cancel(id: string): boolean {
      const timer = timers.get(id)
      if (timer === undefined) return false
      clearTimeout(timer)
      timers.delete(id)
      return true
    },
    has(id: string): boolean {
      return timers.has(id)
    },
    /** Runs every pending delete now, e.g. when the page is closing. */
    flush() {
      for (const [id, timer] of timers) {
        clearTimeout(timer)
        fire(id)
      }
    },
  }
}
