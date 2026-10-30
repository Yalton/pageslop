'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { SWRConfig, preload, useSWRConfig } from 'swr'
import { jsonFetcher } from '@/lib/swr/fetcher'
import { PERSISTED_KEYS, browserStorage, createPersistentCache } from '@/lib/swr/persistent-cache'

/**
 * Shares one SWR cache across the dashboard, seeded from the last visit, and
 * starts loading every page's data as soon as the dashboard opens, so
 * switching pages never waits on the network.
 */
export function DataProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  const [{ cache, saved, save }] = useState(() => createPersistentCache(userId, browserStorage()))

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') save()
    }
    window.addEventListener('pagehide', save)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.removeEventListener('pagehide', save)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [save])

  return (
    <SWRConfig value={{ provider: () => cache }}>
      {/* Before children, so its layout effect runs before their SWR hooks start fetching. */}
      <Preload saved={saved} />
      {children}
    </SWRConfig>
  )
}

/**
 * Shows the saved responses right after hydration, then fetches every page's
 * data. `preload` alone only hands its response to the next hook that asks,
 * so the result is also written to the cache, for pages not open yet and for
 * the copy saved for the next visit.
 *
 * This runs in a layout effect: after hydration, before paint, and before the
 * pages' hooks start their requests, so they pick up the preloaded request
 * instead of sending their own, and SWR keeps their result (it drops a
 * request that started before the latest mutate of its key).
 *
 * It runs once. In development StrictMode re-runs effects, and SWRConfig's
 * cleanup unregisters the cache provider until its own effect re-runs, which
 * happens after this child's: a mutate in between throws inside SWR.
 */
function Preload({ saved }: { saved: Record<string, unknown> }) {
  const { mutate } = useSWRConfig()
  const started = useRef(false)
  useLayoutEffect(() => {
    if (started.current) return
    started.current = true
    for (const [key, data] of Object.entries(saved)) void mutate(key, data, { revalidate: false })
    for (const key of PERSISTED_KEYS) {
      preload(key, jsonFetcher)
        .then((data) => mutate(key, data, { revalidate: false }))
        .catch(() => {})
    }
  }, [mutate, saved])
  return null
}
