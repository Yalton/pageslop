import type { Cache, State } from 'swr'

/** API responses kept between visits, so pages can render them instantly. */
export const PERSISTED_KEYS = ['/api/links', '/api/tags'] as const

const STORAGE_PREFIX = 'pageslop-swr:'

type Stored = Record<string, unknown>

/** Reads the saved responses for a user, or nothing when storage is unavailable. */
export function loadPersisted(userId: string, storage: Pick<Storage, 'getItem'> | null): Stored {
  try {
    const raw = storage?.getItem(STORAGE_PREFIX + userId)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Stored) : {}
  } catch {
    return {}
  }
}

/** Picks the persisted keys' current data out of an SWR cache. */
export function snapshot(cache: Pick<Cache, 'get'>): Stored {
  const out: Stored = {}
  for (const key of PERSISTED_KEYS) {
    const data = cache.get(key)?.data
    if (data !== undefined) out[key] = data
  }
  return out
}

/**
 * An empty SWR cache plus the user's saved responses (`saved`), which the
 * caller writes into the cache once the page has hydrated: putting them in
 * before would make the first client render differ from the server HTML.
 * Call `save` to write the current responses back (on pagehide / tab hide).
 */
export function createPersistentCache(userId: string, storage: Storage | null) {
  const cache = new Map<string, State>()
  const saved: Stored = {}
  for (const [key, data] of Object.entries(loadPersisted(userId, storage))) {
    if ((PERSISTED_KEYS as readonly string[]).includes(key)) saved[key] = data
  }
  function save() {
    try {
      const data = snapshot(cache)
      if (Object.keys(data).length === 0) storage?.removeItem(STORAGE_PREFIX + userId)
      else storage?.setItem(STORAGE_PREFIX + userId, JSON.stringify(data))
    } catch {
      // Full or blocked storage: the next visit just loads from the network.
    }
  }
  return { cache, saved, save }
}

/** Removes every user's saved responses, e.g. on log out. */
export function clearPersisted(storage: Storage | null) {
  try {
    if (!storage) return
    for (let i = storage.length - 1; i >= 0; i--) {
      const key = storage.key(i)
      if (key?.startsWith(STORAGE_PREFIX)) storage.removeItem(key)
    }
  } catch {
    // Nothing saved that we can reach.
  }
}

/** localStorage, or null where it is missing or throws (private mode, SSR). */
export function browserStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}
