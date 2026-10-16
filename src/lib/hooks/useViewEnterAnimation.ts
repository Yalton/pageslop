'use client'

import { useLayoutEffect, useRef } from 'react'
import { VIEW_ENTER_KEYFRAMES, VIEW_ENTER_OPTIONS, shouldAnimateView } from '@/lib/utils/view-transition'

/**
 * Plays a short fade-and-settle on the returned element whenever `key`
 * changes. Uses the Web Animations API on the existing element, so nothing
 * remounts (cards keep their state) and only opacity/transform move (no
 * layout). Runs before paint, so the new content never shows un-animated
 * for a frame. A no-op without element.animate or with reduced motion.
 */
export function useViewEnterAnimation<T extends HTMLElement>(key: string) {
  const ref = useRef<T>(null)
  const previousKey = useRef<string | null>(null)

  useLayoutEffect(() => {
    const prev = previousKey.current
    previousKey.current = key
    const el = ref.current
    if (!el || typeof el.animate !== 'function' || !el.firstElementChild) return
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    if (!shouldAnimateView(prev, key, reduced)) return
    // A quick second change restarts from the start rather than stacking.
    for (const a of el.getAnimations()) a.cancel()
    el.animate(VIEW_ENTER_KEYFRAMES, VIEW_ENTER_OPTIONS)
  }, [key])

  return ref
}
