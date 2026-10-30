'use client'

import { useEffect, useRef, type RefObject } from 'react'

/** Fired on window to open the save dialog where there is no inline save input (MobileFAB listens). */
export const OPEN_SAVE_DIALOG_EVENT = 'pageslop:open-save-dialog'

/** Set on the button that opens a link card's detail panel (LinkCard, LinkCardList), so j/k find cards in screen order. */
const LINK_OPEN_ATTR = 'data-link-open'

/** Shown in the shortcut list. Enter and Escape come from the card buttons and dialogs themselves. */
export const LINK_SHORTCUTS = [
  { keys: ['/'], label: 'Search links' },
  { keys: ['n'], label: 'Save a link' },
  { keys: ['j', 'k'], label: 'Next or previous link' },
  { keys: ['Enter'], label: 'Open the focused link' },
  { keys: ['Esc'], label: 'Close the open panel' },
  { keys: ['?'], label: 'Show these shortcuts' },
] as const

interface LinkShortcutRefs {
  /** Wraps the search input. */
  search: RefObject<HTMLElement | null>
  /** Wraps the inline save input; null on pages without one. */
  save: RefObject<HTMLElement | null>
  /** Wraps the link cards. */
  results: RefObject<HTMLElement | null>
  onHelp: () => void
}

function isTyping(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || target.closest('input, textarea, select') !== null
}

function focusField(wrapper: HTMLElement | null) {
  const field = wrapper?.querySelector<HTMLElement>('input, textarea')
  field?.focus()
  return field != null
}

/** Moves focus one card forward or back, starting from the first card when none has focus. */
function moveCardFocus(results: HTMLElement | null, step: 1 | -1) {
  const buttons = [...(results?.querySelectorAll<HTMLElement>(`[${LINK_OPEN_ATTR}]`) ?? [])]
  if (buttons.length === 0) return
  const current = buttons.indexOf(document.activeElement as HTMLElement)
  const next = current === -1 ? 0 : Math.min(Math.max(current + step, 0), buttons.length - 1)
  buttons[next].focus()
  buttons[next].scrollIntoView?.({ block: 'nearest' })
}

/**
 * Dashboard keyboard shortcuts: '/' search, 'n' save, j/k between cards, '?' the shortcut list.
 * Ignored while typing in a field, with Ctrl/Meta/Alt held, or while a dialog is open.
 */
export function useLinkShortcuts({ search, save, results, onHelp }: LinkShortcutRefs) {
  const onHelpRef = useRef(onHelp)
  onHelpRef.current = onHelp

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return
      if (isTyping(e.target) || document.querySelector('[role="dialog"]')) return

      switch (e.key) {
        case '/':
          if (focusField(search.current)) e.preventDefault()
          break
        case 'n': {
          e.preventDefault()
          // The inline save input is hidden below md; there the FAB's dialog does the job.
          const desktop = window.matchMedia?.('(min-width: 768px)').matches ?? true
          if (!(desktop && focusField(save.current))) window.dispatchEvent(new Event(OPEN_SAVE_DIALOG_EVENT))
          break
        }
        case 'j':
          e.preventDefault()
          moveCardFocus(results.current, 1)
          break
        case 'k':
          e.preventDefault()
          moveCardFocus(results.current, -1)
          break
        case '?':
          e.preventDefault()
          onHelpRef.current()
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [search, save, results])
}
