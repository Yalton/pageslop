/**
 * True for errors a browser hits when it is still running an older build than
 * the server has: the JS chunk or server action it asks for no longer exists.
 * A full reload fixes them.
 */
export function isStaleBuildError(error: { name?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  if (error.name === 'ChunkLoadError') return true
  const message = error.message ?? ''
  return (
    /Loading (CSS )?chunk [\w/-]+ failed/i.test(message) ||
    /Failed to fetch dynamically imported module/i.test(message) ||
    /Failed to find Server Action/i.test(message)
  )
}

const RELOAD_KEY = 'pageslop-stale-build-reload'
/** Do not reload again within this window, so a real outage cannot loop. */
const RELOAD_COOLDOWN_MS = 30_000

/** Whether to reload now, given when we last reloaded for this (ms since epoch, or null). */
export function shouldReloadForStaleBuild(lastReloadAt: number | null, now: number): boolean {
  return lastReloadAt === null || now - lastReloadAt > RELOAD_COOLDOWN_MS
}

/** Reloads the page once for a stale-build error. Returns true when it did. */
export function reloadForStaleBuild(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY)) || null
    if (!shouldReloadForStaleBuild(last, Date.now())) return false
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
  } catch {
    // No sessionStorage: reload anyway, the browser's own cache keeps it from looping fast.
  }
  window.location.reload()
  return true
}
