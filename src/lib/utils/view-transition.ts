/**
 * Enter animation for the links results area. The results fade and settle in
 * when the user changes what is shown (site tab, category, sort, filters,
 * tag, view mode), and never when the same view only gets new data (SWR
 * revalidation, a pending link turning ready, an optimistic delete).
 */

/** Long enough to read as motion, short enough not to slow anyone down. */
export const VIEW_ENTER_MS = 200

export const VIEW_ENTER_KEYFRAMES: Keyframe[] = [
  { opacity: 0, transform: 'translateY(4px)' },
  { opacity: 1, transform: 'none' },
]

export const VIEW_ENTER_OPTIONS: KeyframeAnimationOptions = {
  duration: VIEW_ENTER_MS,
  easing: 'cubic-bezier(0.2, 0, 0, 1)',
}

type KeyValue = string | number | boolean | null | undefined

/**
 * A string that changes exactly when the user picks a different view. Every
 * field of `state` counts, so a filter added to the view state later is picked
 * up without touching this. Field order does not matter; null, undefined and
 * false all read as "off". Leave the search query out: it changes per
 * keystroke and animating while typing is noise.
 */
export function viewTransitionKey(state: Record<string, KeyValue>): string {
  return Object.keys(state)
    .filter((k) => state[k] !== null && state[k] !== undefined && state[k] !== false && state[k] !== '')
    .sort()
    .map((k) => `${k}=${String(state[k])}`)
    .join('&')
}

/** Animate only on a real change, not on the first render. */
export function shouldAnimateView(previousKey: string | null, nextKey: string, reducedMotion: boolean): boolean {
  return !reducedMotion && previousKey !== null && previousKey !== nextKey
}
