import { isHttpUrl } from './http-url'

/**
 * Opens a saved link in a new tab. Non-http(s) URLs (javascript:, data:, ...)
 * are refused, and the tab never gets a handle on this window or a Referer.
 * Returns whether the URL was allowed to open.
 */
export function openExternal(url: string, win: Pick<Window, 'open'> = window): boolean {
  if (!isHttpUrl(url)) return false
  win.open(url, '_blank', 'noopener,noreferrer')
  return true
}
